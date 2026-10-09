-- Reason visible to the uploader; corrections and resubmission are atomic.
begin;
alter table public.comprobantes add column if not exists motivo_rebote text;
create or replace function public.metricas_comprobantes_write_v2(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_actor text:=lower(nullif(p_payload->>'actorEmail',''));v_key text:=p_payload->>'submissionKey';
 v_id text:=p_payload->>'id';v_lead text;v_ghl text;v_sale text;v_item jsonb;v_patch jsonb;v_result jsonb;v_old comprobantes%rowtype;v_new comprobantes%rowtype;v_columns text;v_created jsonb:='[]';v_expected jsonb;
begin
 if v_actor is null then raise exception 'Falta el usuario de la operación';end if;
 perform set_config('metricas.receipt_write','on',true);
 if p_action='schema' then
  return (select jsonb_agg(jsonb_build_object('column_name',column_name,'data_type',data_type)) from information_schema.columns where table_schema='public' and table_name='comprobantes');
 elsif p_action='stage_files' then
  for v_item in select value from jsonb_array_elements(p_payload->'files') loop
   insert into comprobantes_cleanup_v2(bucket,object_path,status,available_at) values(v_item->>'bucket',v_item->>'object_path','staged',now()+interval '1 hour') on conflict do nothing;
  end loop;return '{"ok":true}';
 elsif p_action='cleanup_enqueue' then
  for v_item in select value from jsonb_array_elements(p_payload->'files') loop
   insert into comprobantes_cleanup_v2(bucket,object_path,status) values(v_item->>'bucket',v_item->>'object_path','pending') on conflict(bucket,object_path) do update set status='pending',available_at=now();
  end loop;return '{"ok":true}';
 elsif p_action='cleanup_claim' then
  with chosen as(select bucket,object_path from comprobantes_cleanup_v2 where available_at<=now() order by available_at limit 20 for update skip locked), claimed as(
   update comprobantes_cleanup_v2 q set status='processing',available_at=now()+interval '5 minutes',attempts=attempts+1 from chosen c where q.bucket=c.bucket and q.object_path=c.object_path returning q.*)
  select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into v_result from claimed;return v_result;
 elsif p_action='cleanup_finish' then
  if coalesce((p_payload->>'success')::boolean,false) then
   delete from comprobantes_cleanup_v2 where bucket=p_payload->>'bucket' and object_path=p_payload->>'object_path';
  else update comprobantes_cleanup_v2 set status='pending',available_at=now()+interval '5 minutes',last_error=left(p_payload->>'error',500) where bucket=p_payload->>'bucket' and object_path=p_payload->>'object_path';end if;
  return '{"ok":true}';
 end if;
 if p_action='create' then
  if v_key is null or v_key !~ '^[A-Za-z0-9-]{16,100}$' or jsonb_array_length(p_payload->'rows') not between 1 and 6 then raise exception 'Carga inválida';end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  select result into v_result from comprobantes_operaciones_v2 where submission_key=v_key and actor_email=v_actor;
  if found then return v_result||'{"idempotentReplay":true}';end if;
  if exists(select 1 from comprobantes_operaciones_v2 where submission_key=v_key) then raise exception 'La carga pertenece a otro usuario';end if;
  v_lead:=p_payload->'rows'->0->>'cliente';
 else
  select * into v_old from comprobantes where id=v_id;
  if not found then raise exception 'Comprobante inexistente';end if;
  v_lead:=v_old.cliente;
 end if;
 select ghlid into v_ghl from leads_raw where id=v_lead;
 if not found then raise exception 'Cliente inexistente';end if;
 -- Serialize every client identity, then lock rows in stable order.
 perform pg_advisory_xact_lock(hashtextextended('receipt-client:'||coalesce(nullif(v_ghl,''),v_lead),0));
 perform 1 from leads_raw where id=v_lead or (nullif(v_ghl,'') is not null and ghlid=v_ghl) order by id for update;
 perform 1 from comprobantes where cliente=v_lead or (nullif(v_ghl,'') is not null and ghlid=v_ghl) order by id for update;
 if p_action='create' then
  for v_item in select value from jsonb_array_elements(p_payload->'rows') loop
   if v_item->>'cliente' is distinct from v_lead or v_item->>'ghlid' is distinct from v_ghl or (v_item->>'cash_collected')::numeric<=0 or (v_item->>'tc')::numeric<=0 then raise exception 'Cliente o importes inválidos';end if;
   v_id:=v_item->>'id';v_sale:=v_item->>'venta_relacionada';
   if v_item->>'tipo' not in ('Venta','Cobranza','Devolucion','Devolución') then raise exception 'Tipo inválido';end if;
   if v_item->>'tipo'='Venta' then
    if v_sale is distinct from v_id or coalesce((v_item->>'facturacion')::numeric,0)<=0 then raise exception 'Venta inválida';end if;
   elsif not exists(select 1 from comprobantes where id=v_sale and tipo='Venta' and (cliente=v_lead or ghlid=v_ghl)) then raise exception 'La venta no pertenece al cliente';end if;
   v_item:=v_item||jsonb_build_object('estado',null,'rebotar_pago',false,'conciliar','false','conciliacion_financiera','false','conciliacion_financiera_2','false','created_at',now(),'updated_at',now());
   insert into comprobantes select * from jsonb_populate_record(null::comprobantes,v_item);
   insert into comprobantes_control_v2(id) values(v_id) on conflict do nothing;
   insert into comprobantes_eventos_v2(comprobante_id,actor_email,action,after_row) values(v_id,v_actor,'created',v_item);
   v_created:=v_created||jsonb_build_array(jsonb_build_object('id',v_id,'type',v_item->>'tipo'));
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'files','[]')) loop
   delete from comprobantes_cleanup_v2 where bucket=v_item->>'bucket' and object_path=v_item->>'objectPath';
  end loop;
  v_result:=jsonb_build_object('ok',true,'created',v_created);
  insert into comprobantes_operaciones_v2(submission_key,actor_email,result) values(v_key,v_actor,v_result);
 else
  select * into v_old from comprobantes where id=v_id;
  if not found then raise exception 'Comprobante inexistente';end if;
  if p_action in ('edit','delete') then
   if metricas_receipt_effective_v2(to_jsonb(v_old)) then raise exception 'Un comprobante conciliado no se puede editar ni eliminar';end if;
   v_expected:=to_jsonb(jsonb_populate_record(null::comprobantes,p_payload->'expectedRow'));
   if p_payload->'expectedRow' is null or exists(select 1 from jsonb_each(to_jsonb(v_old)) a join jsonb_each(v_expected) b using(key)
    where case when jsonb_typeof(a.value)='number' and jsonb_typeof(b.value)='number' then abs((a.value #>> '{}')::numeric-(b.value #>> '{}')::numeric)>0.0000001 else a.value is distinct from b.value end) then raise exception 'El comprobante cambió; recargá antes de continuar';end if;
  end if;
  if p_action='delete' then
   if v_old.tipo='Venta' and exists(select 1 from comprobantes where id<>v_id and position(v_id in coalesce(venta_relacionada,''))>0) then raise exception 'La venta tiene cobranzas o devoluciones vinculadas';end if;
   for v_item in select value from jsonb_array_elements(coalesce(p_payload->'files','[]')) loop
    insert into comprobantes_cleanup_v2(bucket,object_path) values(v_item->>'bucket',v_item->>'object_path') on conflict(bucket,object_path) do update set status='pending',available_at=now();
   end loop;
   delete from comprobantes where id=v_id;
   insert into comprobantes_control_v2(id,deleted) values(v_id,true) on conflict(id) do update set deleted=true;
   v_result:='{"ok":true}';
  elsif p_action in ('edit','reconcile') then
   v_patch:=p_payload->'patch';
   if p_action='reconcile' then
    if p_payload->>'state' not in ('conciliated','not_conciliated','bounced') then raise exception 'Estado inválido';end if;
    if p_payload->>'state'='bounced' and (length(btrim(coalesce(p_payload->>'reason',''))) not between 1 and 1000) then raise exception 'Indicá el motivo del rebote (hasta 1000 caracteres)';end if;
    v_patch:=jsonb_build_object('motivo_rebote',case when p_payload->>'state'='bounced' then btrim(p_payload->>'reason') else null end,'estado',case p_payload->>'state' when 'conciliated' then 'Conciliado' when 'bounced' then 'Rebotado' else null end,'rebotar_pago',p_payload->>'state'='bounced','conciliar',case when p_payload->>'state'='conciliated' then 'true' else 'false' end,'conciliacion_financiera',case when p_payload->>'state'='conciliated' then 'true' else 'false' end,'conciliacion_financiera_2',case when p_payload->>'state'='conciliated' then 'true' else 'false' end);
   elsif jsonb_typeof(v_patch)<>'object' or v_patch ?| array['id','cliente','ghlid','venta_relacionada','tipo','estado','rebotar_pago','cash_collected_total','cash_collected_neto_total','monto_incobrable','creado_por','responsable_venta'] then raise exception 'Campos de edición no permitidos';end if;
   if p_action='edit' and coalesce((p_payload->>'resubmit')::boolean,false) then
    if lower(coalesce(v_old.estado,''))<>'rebotado' and lower(coalesce(v_old.rebotar_pago::text,'false')) not in ('true','1') then raise exception 'Sólo se puede reenviar un comprobante rebotado';end if;
    v_patch:=v_patch||jsonb_build_object('estado',null,'rebotar_pago',false,'motivo_rebote',null,'conciliar','false','conciliacion_financiera','false','conciliacion_financiera_2','false');
   end if;
   select * into v_new from jsonb_populate_record(v_old,v_patch);
   if coalesce(v_new.cash_collected,0)<=0 or coalesce(v_new.tc::numeric,0)<=0 then raise exception 'Importes inválidos';end if;
   select string_agg(format('%I',attname),',') into v_columns from pg_attribute where attrelid='public.comprobantes'::regclass and attnum>0 and not attisdropped;
   execute format('update public.comprobantes set (%s)=(select %s from jsonb_populate_record(null::public.comprobantes,$1)) where id=$2',v_columns,v_columns) using to_jsonb(v_new),v_id;
   insert into comprobantes_control_v2(id) values(v_id) on conflict do nothing;
   v_result:=jsonb_build_object('ok',true,'row',to_jsonb(v_new));
  else raise exception 'Acción inválida';end if;
  insert into comprobantes_eventos_v2(comprobante_id,actor_email,action,before_row,after_row) values(v_id,v_actor,case when p_action='edit' and coalesce((p_payload->>'resubmit')::boolean,false) then 'resubmitted' else p_action end,to_jsonb(v_old),case when p_action='delete' then null else to_jsonb(v_new) end);
 end if;
 perform metricas_receipt_totals_v2(v_lead);
 return v_result;
end;$$;

notify pgrst,'reload schema';
commit;
