-- Additive internal receipt runtime. No historical receipts are moved or deleted.
begin;
create table if not exists public.comprobantes_operaciones_v2 (
 submission_key text primary key, actor_email text not null, result jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.comprobantes_eventos_v2 (
 id bigint generated always as identity primary key, comprobante_id text, actor_email text not null, action text not null,
 before_row jsonb, after_row jsonb, created_at timestamptz not null default now()
);
create table if not exists public.comprobantes_control_v2 (id text primary key, deleted boolean not null default false);
create table if not exists public.comprobantes_clientes_control_v2 (id text primary key);
create table if not exists public.comprobantes_cleanup_v2 (
 bucket text not null, object_path text not null, status text not null default 'pending', attempts integer not null default 0,
 available_at timestamptz not null default now(), last_error text, created_at timestamptz not null default now(),
 primary key(bucket,object_path), check(status in ('staged','pending','processing'))
);
create index if not exists comprobantes_cleanup_v2_due on public.comprobantes_cleanup_v2(available_at);
create index if not exists comprobantes_ghlid_lookup_v2 on public.comprobantes(ghlid);
create index if not exists comprobantes_sale_lookup_v2 on public.comprobantes(venta_relacionada);

create or replace function public.metricas_receipt_guard_v2() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if current_setting('metricas.receipt_write',true)='on' then
  if TG_OP='DELETE' then return old; else return new; end if;
 end if;
 if TG_TABLE_NAME='leads_raw' then
  if exists(select 1 from comprobantes_clientes_control_v2 where id=old.id) then
   new.facturacion_total:=old.facturacion_total;new.cash_collected_total:=old.cash_collected_total;new.saldo:=old.saldo;
  end if;
  return new;
 end if;
 if TG_OP='INSERT' then
  if exists(select 1 from comprobantes_control_v2 where id=new.id) then return null; end if;
  return new;
 end if;
 if exists(select 1 from comprobantes_control_v2 where id=old.id) then
  if TG_OP='DELETE' then return null; end if;
  return old;
 end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end; $$;
drop trigger if exists metricas_receipt_guard_v2 on public.comprobantes;
create trigger metricas_receipt_guard_v2 before insert or update or delete on public.comprobantes for each row execute function public.metricas_receipt_guard_v2();
drop trigger if exists metricas_lead_totals_guard_v2 on public.leads_raw;
create trigger metricas_lead_totals_guard_v2 before update on public.leads_raw for each row execute function public.metricas_receipt_guard_v2();

create or replace function public.metricas_receipt_effective_v2(r jsonb) returns boolean language sql immutable as $$
 select lower(coalesce(r->>'estado',''))='conciliado' and lower(coalesce(r->>'rebotar_pago','false')) not in ('true','1');
$$;

create or replace function public.metricas_receipt_totals_v2(p_lead text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ghl text;v_fact numeric;v_cash numeric;
begin
 select ghlid into v_ghl from leads_raw where id=p_lead;
 insert into comprobantes_clientes_control_v2(id) values(p_lead) on conflict do nothing;
 -- Recalculate only the client affected by an explicit internal action.
 select coalesce(sum(case when tipo='Venta' then coalesce(facturacion,0) when tipo in ('Devolucion','Devolución') and metricas_receipt_effective_v2(to_jsonb(c)) then -coalesce(facturacion,0) else 0 end),0),
 coalesce(sum(case when metricas_receipt_effective_v2(to_jsonb(c)) then (case when tipo in ('Devolucion','Devolución') then -1 else 1 end)*coalesce(cash_collected,0) else 0 end),0)
 into v_fact,v_cash from comprobantes c where c.cliente=p_lead or (nullif(v_ghl,'') is not null and (c.ghlid=v_ghl or c.cliente in(select id from leads_raw where ghlid=v_ghl)))
 or c.venta_relacionada in(select s.id from comprobantes s where s.tipo='Venta' and (s.cliente=p_lead or (nullif(v_ghl,'') is not null and (s.ghlid=v_ghl or s.cliente in(select id from leads_raw where ghlid=v_ghl)))));
 update leads_raw set facturacion_total=v_fact,cash_collected_total=v_cash,saldo=v_fact-v_cash where id=p_lead;
 -- Protect totals for any duplicate CRM IDs representing this same GHL contact.
 if nullif(v_ghl,'') is not null then
  insert into comprobantes_clientes_control_v2(id) select id from leads_raw where ghlid=v_ghl on conflict do nothing;
  update leads_raw set facturacion_total=v_fact,cash_collected_total=v_cash,saldo=v_fact-v_cash where ghlid=v_ghl;
 end if;
 update comprobantes sale set
  cash_collected_total=coalesce((select sum((case when c.tipo in ('Devolucion','Devolución') then -1 else 1 end)*coalesce(c.cash_collected,0)) from comprobantes c where (c.id=sale.id or c.venta_relacionada=sale.id) and metricas_receipt_effective_v2(to_jsonb(c))),0),
  cash_collected_neto_total=coalesce((select sum((case when c.tipo in ('Devolucion','Devolución') then -1 else 1 end)*coalesce(c.cash_collected_neto,0)) from comprobantes c where (c.id=sale.id or c.venta_relacionada=sale.id) and metricas_receipt_effective_v2(to_jsonb(c))),0)
 where sale.tipo='Venta' and (sale.cliente=p_lead or (nullif(v_ghl,'') is not null and (sale.ghlid=v_ghl or sale.cliente in(select id from leads_raw where ghlid=v_ghl))));
 update comprobantes sale set monto_incobrable=greatest(coalesce(sale.facturacion,0)-coalesce(sale.cash_collected_total,0)-coalesce((select sum(c.facturacion) from comprobantes c where c.venta_relacionada=sale.id and c.tipo in ('Devolucion','Devolución') and metricas_receipt_effective_v2(to_jsonb(c))),0),0)
 where sale.tipo='Venta' and (sale.cliente=p_lead or (nullif(v_ghl,'') is not null and (sale.ghlid=v_ghl or sale.cliente in(select id from leads_raw where ghlid=v_ghl))));
 insert into comprobantes_control_v2(id) select id from comprobantes where tipo='Venta' and (cliente=p_lead or (nullif(v_ghl,'') is not null and (ghlid=v_ghl or cliente in(select id from leads_raw where ghlid=v_ghl)))) on conflict do nothing;
end; $$;

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
    v_patch:=jsonb_build_object('estado',case p_payload->>'state' when 'conciliated' then 'Conciliado' when 'bounced' then 'Rebotado' else null end,'rebotar_pago',p_payload->>'state'='bounced','conciliar',case when p_payload->>'state'='conciliated' then 'true' else 'false' end,'conciliacion_financiera',case when p_payload->>'state'='conciliated' then 'true' else 'false' end,'conciliacion_financiera_2',case when p_payload->>'state'='conciliated' then 'true' else 'false' end);
   elsif jsonb_typeof(v_patch)<>'object' or v_patch ?| array['id','cliente','ghlid','venta_relacionada','tipo','estado','rebotar_pago','cash_collected_total','cash_collected_neto_total','monto_incobrable','creado_por','responsable_venta'] then raise exception 'Campos de edición no permitidos';end if;
   select * into v_new from jsonb_populate_record(v_old,v_patch);
   if coalesce(v_new.cash_collected,0)<=0 or coalesce(v_new.tc::numeric,0)<=0 then raise exception 'Importes inválidos';end if;
   select string_agg(format('%I',attname),',') into v_columns from pg_attribute where attrelid='public.comprobantes'::regclass and attnum>0 and not attisdropped;
   execute format('update public.comprobantes set (%s)=(select %s from jsonb_populate_record(null::public.comprobantes,$1)) where id=$2',v_columns,v_columns) using to_jsonb(v_new),v_id;
   insert into comprobantes_control_v2(id) values(v_id) on conflict do nothing;
   v_result:=jsonb_build_object('ok',true,'row',to_jsonb(v_new));
  else raise exception 'Acción inválida';end if;
  insert into comprobantes_eventos_v2(comprobante_id,actor_email,action,before_row,after_row) values(v_id,v_actor,p_action,to_jsonb(v_old),case when p_action='delete' then null else to_jsonb(v_new) end);
 end if;
 perform metricas_receipt_totals_v2(v_lead);
 return v_result;
end;$$;

alter table public.comprobantes_operaciones_v2 enable row level security;
alter table public.comprobantes_eventos_v2 enable row level security;
alter table public.comprobantes_control_v2 enable row level security;
alter table public.comprobantes_clientes_control_v2 enable row level security;
alter table public.comprobantes_cleanup_v2 enable row level security;
revoke all on public.comprobantes_operaciones_v2,public.comprobantes_eventos_v2,public.comprobantes_control_v2,public.comprobantes_clientes_control_v2,public.comprobantes_cleanup_v2 from public,anon,authenticated;
grant select on public.comprobantes_operaciones_v2,public.comprobantes_eventos_v2,public.comprobantes_control_v2,public.comprobantes_clientes_control_v2,public.comprobantes_cleanup_v2 to service_role;
revoke all on function public.metricas_receipt_guard_v2(),public.metricas_receipt_totals_v2(text),public.metricas_comprobantes_write_v2(text,jsonb) from public,anon,authenticated;
grant execute on function public.metricas_comprobantes_write_v2(text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
