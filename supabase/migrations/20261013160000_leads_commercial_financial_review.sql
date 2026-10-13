-- GHL commercial data must not be blocked by legacy financial discrepancies.
-- Amounts come only from Supabase. Defer known conflicts, preserve totals and audit
-- the review; keep receipt mutations and all unrelated ingestion errors strict.
begin;
create or replace function public.leads_ghl_derive(r public.leads_raw) returns public.leads_raw
language plpgsql security definer set search_path=public,pg_temp as $$
declare parts text[];receipts jsonb;item jsonb;latest_sale jsonb;latest_meg jsonb;last_payment timestamptz;
 fact numeric:=0;cash numeric:=0;amount numeric;iva numeric;tc numeric;ars numeric;sgn integer;effective boolean;opening_fact numeric;opening_cash numeric;financial_before public.leads_raw;financial_error text;
begin
 -- Notion's resource parsing, now independent of Notion refreshes.
 if r.recurso_ig is not null then
  parts:=string_to_array(r.recurso_ig,',');
  r.primero_recurso:=btrim(split_part(regexp_replace(r.recurso_ig,'^\s*,',''),',',1));
  r.ultimo_recurso:=btrim(parts[array_length(parts,1)]);
  r.cantidad_recursos:=coalesce(array_length(parts,1),0);
  r.formato_fuente:=split_part(regexp_replace(btrim(split_part(r.primero_recurso,'-',1)),'\s+',' ','g'),' ',1);
 end if;
 -- Do not invent a country code; GHL already sends international phone numbers.
 if nullif(r.telefono,'') is not null then r.whatsapp:='https://wa.me/'||regexp_replace(r.telefono,'[^0-9]','','g');end if;
 financial_before:=r;
 begin
 select coalesce(jsonb_agg(to_jsonb(c) order by coalesce(c.f_venta,c.f_acreditacion) desc nulls last,c.id),'[]') into receipts from leads_ghl_receipts(r.id,r.ghlid) c;
 if jsonb_array_length(receipts)>0 or r.extra->>'ghl_receipts_managed'='true' or coalesce(r.facturacion_total,0)>0 then
  for item in select value from jsonb_array_elements(receipts) loop
   effective:=lower(coalesce(item->>'estado',''))='conciliado' and lower(coalesce(item->>'rebotar_pago','false')) not in('true','1');
   sgn:=case when item->>'tipo' in('Devolucion','Devolución') then -1 else 1 end;
   if item->>'tipo'='Venta' then
    fact:=fact+coalesce((item->>'facturacion')::numeric,0);
    if latest_sale is null then latest_sale:=item;end if;
    if latest_meg is null and item->>'producto_format' ilike '%meg%' then latest_meg:=item;end if;
   elsif sgn=-1 and effective then fact:=fact-coalesce((item->>'facturacion')::numeric,0);end if;
   if effective then
    amount:=coalesce((item->>'cash_collected')::numeric,0);iva:=coalesce((item->>'iva')::numeric,0);tc:=coalesce((item->>'tc')::numeric,0);
    ars:=coalesce((item->>'cash_ar')::numeric,(item->>'cash_collected_ar')::numeric,(item->>'cash_collected_ars')::numeric,0);
    if iva<>0 and amount<>0 then
     if tc<=0 and ars>0 and amount>0 then tc:=ars/amount;end if;
     if tc<=0 then raise exception 'Un comprobante conciliado tiene IVA sin TC válido';end if;
     amount:=greatest(0,amount-iva/tc);
    end if;
    cash:=cash+sgn*amount;
    if sgn=1 and amount>0 then last_payment:=greatest(last_payment,(item->>'f_acreditacion')::timestamptz);end if;
   end if;
  end loop;
  -- Preserve the pre-existing CRM financial history that has no individual receipts.
  -- Capture once, before takeover; never manufacture a new sale or commission.
  if jsonb_typeof(r.extra->'ghl_opening_balance')='object' then
   opening_fact:=(r.extra->'ghl_opening_balance'->>'facturacion')::numeric;
   opening_cash:=(r.extra->'ghl_opening_balance'->>'cash_collected')::numeric;
  elsif coalesce(r.extra->>'ghl_receipts_managed','false')<>'true' and coalesce(r.facturacion_total,0)>round(fact,2) then
   opening_fact:=round(r.facturacion_total-fact,2);
   opening_cash:=round(coalesce(r.cash_collected_total,0)-cash,2);
   if opening_cash<0 or opening_cash>opening_fact then
    raise exception 'Los totales históricos requieren revisión antes de reemplazarlos por comprobantes';
   end if;
   r.extra:=coalesce(r.extra,'{}')||jsonb_build_object('ghl_opening_balance',jsonb_build_object(
    'facturacion',opening_fact,'cash_collected',opening_cash,'source','pre_ghl_crm_totals',
    'captured_at',now(),'previous_facturacion',r.facturacion_total,'previous_cash',r.cash_collected_total));
  end if;
  fact:=fact+coalesce(opening_fact,0);cash:=cash+coalesce(opening_cash,0);
  r.facturacion_total:=round(fact,2);r.cash_collected_total:=round(cash,2);r.saldo:=round(fact-cash,2);
  if jsonb_array_length(receipts)>0 or coalesce(opening_fact,0)=0 then
   r.u_product_adquirido:=latest_sale->>'producto_format';
   r.fecha_venta:=left(latest_sale->>'f_venta',10);r.f_venta_meg:=left(latest_meg->>'f_venta',10);
  end if;
  r.monto_incobrable:=case when last_payment is null and coalesce(opening_fact,0)>0 then greatest(least(coalesce(r.monto_incobrable,0),r.saldo),0) when last_payment is not null and (now() at time zone 'America/Argentina/Buenos_Aires')::date-(last_payment at time zone 'America/Argentina/Buenos_Aires')::date>60 then greatest(r.saldo,0) else 0 end;
  r.extra:=coalesce(r.extra,'{}')||jsonb_build_object('ghl_receipts_managed',true,'ghl_last_payment',last_payment);
 end if;
 r.extra:=coalesce(r.extra,'{}')-'ghl_financial_review';
 exception when raise_exception then
  financial_error:=SQLERRM;
  -- Only a commercial GHL ingestion may defer these known financial conflicts.
  -- Receipt writes stay strict: never confirm money movement with stale balances.
  if current_setting('metricas.leads_commercial_ingest',true) is distinct from 'on'
   or financial_error not in ('Los totales históricos requieren revisión antes de reemplazarlos por comprobantes',
    'Un comprobante conciliado tiene IVA sin TC válido') then raise;end if;
  r:=financial_before;
  r.extra:=coalesce(r.extra,'{}')||jsonb_build_object('ghl_financial_review',jsonb_build_object(
   'status','pending','reason',financial_error,'source','supabase',
   'first_seen',coalesce(r.extra->'ghl_financial_review'->'first_seen',to_jsonb(now())),
   'preserved_totals',jsonb_build_object('facturacion',r.facturacion_total,'cash_collected',r.cash_collected_total,'saldo',r.saldo)));
 end;
 r.etapa:=case
  when nullif(r.agendo,'') is null then 'Sin agenda'
  when r.temperatura='Baja' then 'Baja'
  when nullif(r.call_confirm,'') is null and r.agendo='Agendo' then 'Agendo'
  when nullif(r.llamada_cc,'') is null and nullif(r.llamada_meg,'') is null then 'Call Confirm'
  when nullif(r.seguimiento,'') is null and nullif(r.producto_adq,'') is null then 'Llamada MEG'
  when nullif(r.seguimiento,'') is not null and nullif(r.producto_adq,'') is null then 'Seguimiento'
  when nullif(r.producto_adq,'') is not null then btrim((string_to_array(r.producto_adq,','))[array_length(string_to_array(r.producto_adq,','),1)])
  else null end;
 return r;
end;$$;


create or replace function public.metricas_leads_ghl_ingest(p_event uuid,p_ghlid text,p_location text,p_payload jsonb,p_patch jsonb,p_fields jsonb,p_warnings jsonb,p_source_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare oldrow leads_raw%rowtype;newrow leads_raw%rowtype;ev leads_ghl_events%rowtype;tracked leads_ghl_contacts%rowtype;
 commercial_flag text:=current_setting('metricas.leads_commercial_ingest',true);event_warnings jsonb:=coalesce(p_warnings,'[]');
 cnt integer;target text;cols text;safe_patch jsonb;operation text;f record;oldflag text:=current_setting('metricas.leads_ghl_write',true);
begin
 perform pg_advisory_xact_lock(hashtextextended('leads-ghl:'||coalesce(p_ghlid,''),0));
 select * into ev from leads_ghl_events where id=p_event;
 if found then
  if ev.ghlid is distinct from p_ghlid or ev.payload is distinct from p_payload then raise exception 'ID de evento reutilizado con otro contenido';end if;
  if ev.status in('created','updated','unchanged','stale') then return jsonb_build_object('status',ev.status,'receiptId',p_event,'leadId',ev.lead_id,'leadWritten',ev.status<>'stale','replayed',true,'warnings',ev.warnings);end if;
 end if;
 insert into leads_ghl_events(id,ghlid,location_id,payload,mapped_patch,warnings,source_updated_at)
 values(p_event,p_ghlid,p_location,p_payload,p_patch,coalesce(p_warnings,'[]'),p_source_at) on conflict(id) do nothing;
 begin
  if nullif(btrim(p_ghlid),'') is null or p_ghlid!~'^[a-zA-Z0-9_-]{1,100}$' then raise exception 'Falta un contact_id válido';end if;
  if p_location is distinct from 'WU2z8kl23Dr3IyBW1hv5' then raise exception 'Ubicación GHL no permitida o ausente';end if;
  if jsonb_typeof(p_patch)<>'object' or jsonb_typeof(p_fields)<>'object' then raise exception 'Mapeo inválido';end if;
  if p_source_at>now()+interval '10 minutes' then raise exception 'La fecha de actualización del origen está en el futuro';end if;
  update leads_ghl_events set mapped_patch=p_patch,warnings=coalesce(p_warnings,'[]') where id=p_event;
  select * into tracked from leads_ghl_contacts where ghlid=p_ghlid;
  if p_source_at is not null and tracked.source_updated_at is not null and p_source_at<tracked.source_updated_at then
   update leads_ghl_events set status='stale',lead_id=tracked.lead_id,error=null where id=p_event;
   return jsonb_build_object('status','stale','receiptId',p_event,'leadId',tracked.lead_id,'leadWritten',false,'message','Evento anterior al último recibido; conservado sin sobrescribir');
  end if;
  select count(*) into cnt from leads_raw where ghlid=p_ghlid;
  if cnt>1 then raise exception 'Más de un lead con este GHL ID; requiere revisión';end if;
  select * into oldrow from leads_raw where ghlid=p_ghlid for update;
  target:=oldrow.id;
  if target is null then
   if nullif(btrim(p_patch->>'nombre'),'') is null then raise exception 'Falta nombre para crear el lead';end if;
   target:=gen_random_uuid()::text;operation:='created';
  else operation:='updated';end if;
  select coalesce(jsonb_object_agg(key,value),'{}') into safe_patch from jsonb_each(p_patch)
  where key=any(array['nombre','mail','telefono','dni','instagram','usuario_ig','cc_whatsapp','origen','origen_actual','primer_origen','ultimo_origen','temperatura','calidad_lead','modelo_negocio','responsable','responsable_id','setter','closer','aplica','recuperado','agendo','respondio_apertura','confirmo_mensaje','llamada_meg','call_confirm','llamada_cc','facturacion','inversion','estrategia_a','seguimiento','seguimiento_setting','nuevo_seguidor','recurso_ig','recurso_tt','calendario_agendado','producto_de_interes','embudo_meg','embudo_club','producto_adq','u_product_adquirido','utm_source','utm_medium','utm_campaign','utm_content','utm_term','adname','adset','campaign','fecha_llamada','fecha_agenda','fecha_cancelada','fecha_rt','fecha_creada','fecha_venta','f_venta_meg','lista_negra','cliente_viejo','score']) and value not in('null'::jsonb,'""'::jsonb,'[]'::jsonb);
  safe_patch:=safe_patch||jsonb_build_object('id',target,'ghlid',p_ghlid);
  select * into newrow from jsonb_populate_record(oldrow,safe_patch);
  newrow.archived:=coalesce(oldrow.archived,false);
  -- Historical acquisition cohorts retain their existing CRM creation date.
  newrow.fecha_creada:=coalesce(oldrow.fecha_creada,newrow.fecha_creada);
  newrow.created_time:=coalesce(oldrow.created_time,newrow.fecha_creada,now() at time zone 'America/Argentina/Buenos_Aires');
  -- Never inherit the historical table default that invented an agenda for new contacts.
  newrow.fecha_agenda:=coalesce((safe_patch->>'fecha_agenda')::timestamp,oldrow.fecha_agenda);
  perform set_config('metricas.leads_commercial_ingest','on',true);
  newrow:=leads_ghl_derive(newrow);
  if operation='updated' and to_jsonb(newrow)=to_jsonb(oldrow) then operation:='unchanged';end if;
  newrow.last_edited_time:=case when operation='unchanged' then oldrow.last_edited_time else now() at time zone 'America/Argentina/Buenos_Aires' end;
  perform set_config('metricas.leads_ghl_write','on',true);
  if operation='created' then insert into leads_raw select newrow.*;
  elsif operation='updated' then
   select string_agg(format('%I',attname),',') into cols from pg_attribute where attrelid='public.leads_raw'::regclass and attnum>0 and not attisdropped and attgenerated='';
   execute format('update public.leads_raw set (%s)=(select %s from jsonb_populate_record(null::public.leads_raw,$1)) where id=$2',cols,cols) using to_jsonb(newrow),target;
  end if;
  select * into newrow from leads_raw where id=target;
  if newrow.extra->'ghl_financial_review'->>'status'='pending' then
   event_warnings:=event_warnings||jsonb_build_array(jsonb_build_object('field','financials',
    'reason','supabase_financial_review_pending','commercialUpdated',true,'totalsPreserved',true));
  end if;
  insert into leads_ghl_contacts(ghlid,lead_id,location_id,latest_payload,fields,last_event_id,source_updated_at)
  values(p_ghlid,target,p_location,p_payload,p_fields,p_event,p_source_at)
  on conflict(ghlid) do update set latest_payload=excluded.latest_payload,fields=leads_ghl_contacts.fields||excluded.fields,last_event_id=p_event,
    source_updated_at=coalesce(excluded.source_updated_at,leads_ghl_contacts.source_updated_at),updated_at=now();
  for f in select key,value from jsonb_each(p_fields) order by key loop
   insert into leads_ghl_fields(field_key,label,observed_types) values(f.key,coalesce(f.value->>'label',f.key),array[coalesce(f.value->>'type','unknown')])
   on conflict(field_key) do update set label=excluded.label,last_seen=now(),observed_types=(select array_agg(distinct t order by t) from unnest(leads_ghl_fields.observed_types||excluded.observed_types) t);
  end loop;
  update leads_ghl_events set status=operation,lead_id=target,error=null,warnings=event_warnings,before_row=case when oldrow.id is null then null else to_jsonb(oldrow) end,after_row=to_jsonb(newrow) where id=p_event;
  perform set_config('metricas.leads_ghl_write',coalesce(oldflag,''),true);
  perform set_config('metricas.leads_commercial_ingest',coalesce(commercial_flag,''),true);
  return jsonb_build_object('status',operation,'receiptId',p_event,'leadId',target,'leadWritten',true,'warnings',event_warnings,'fieldsCaptured',(select count(*) from jsonb_object_keys(p_fields)));
 exception when others then
  perform set_config('metricas.leads_commercial_ingest',coalesce(commercial_flag,''),true);
  if SQLSTATE in('40001','40P01','55P03') then raise;end if;
  update leads_ghl_events set status='error',error=SQLERRM where id=p_event;
  return jsonb_build_object('status','needs_review','receiptId',p_event,'leadWritten',false,'message',SQLERRM,'warnings',coalesce(p_warnings,'[]'));
 end;
end;$$;
create or replace function public.metricas_leads_ghl_refresh_aging() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare changed integer;flag text:=current_setting('metricas.leads_ghl_write',true);
begin
 perform set_config('metricas.leads_ghl_write','on',true);
 update leads_raw l set monto_incobrable=greatest(coalesce(saldo,0),0)
 where exists(select 1 from leads_ghl_contacts g where g.lead_id=l.id)
 and coalesce(l.extra->'ghl_financial_review'->>'status','')<>'pending'
 and l.extra->>'ghl_last_payment' is not null
 and (now() at time zone 'America/Argentina/Buenos_Aires')::date-((l.extra->>'ghl_last_payment')::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date>60
 and l.monto_incobrable is distinct from greatest(coalesce(l.saldo,0),0);
 get diagnostics changed=row_count;
 perform set_config('metricas.leads_ghl_write',coalesce(flag,''),true);return changed;
end;$$;

revoke all on function public.leads_ghl_derive(public.leads_raw) from public,anon,authenticated;
revoke all on function public.metricas_leads_ghl_ingest(uuid,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.metricas_leads_ghl_ingest(uuid,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz) to service_role;
notify pgrst,'reload schema';
commit;
