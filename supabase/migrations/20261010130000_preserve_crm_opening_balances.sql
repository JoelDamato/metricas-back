-- Keep verified CRM opening history alongside the receipt ledger; no historical rows are changed here.
begin;
create or replace function public.leads_ghl_derive(r public.leads_raw) returns public.leads_raw
language plpgsql security definer set search_path=public,pg_temp as $$
declare parts text[];receipts jsonb;item jsonb;latest_sale jsonb;latest_meg jsonb;last_payment timestamptz;
 fact numeric:=0;cash numeric:=0;amount numeric;iva numeric;tc numeric;ars numeric;sgn integer;effective boolean;opening_fact numeric;opening_cash numeric;
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

revoke all on function public.leads_ghl_derive(public.leads_raw) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
