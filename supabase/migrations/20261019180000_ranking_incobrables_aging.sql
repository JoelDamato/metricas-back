-- Ranking uses the same client-level 60-day clock as CRM. Receipt balances stay intact.
begin;
set local lock_timeout='5s';
create or replace view public.ranking_ultimo_pago_cliente with (security_invoker=true) as
with identities as (
 select c.id,
 coalesce('ghl:'||nullif(btrim(s.ghlid),''),'ghl:'||nullif(btrim(sl.ghlid),''),
          'ghl:'||nullif(btrim(c.ghlid),''),'ghl:'||nullif(btrim(l.ghlid),''),
          'lead:'||nullif(s.cliente,''),'lead:'||nullif(c.cliente,''),'sale:'||coalesce(s.id,c.id)) as client_key,
 c.tipo,c.estado,c.rebotar_pago,c.cash_collected,c.f_acreditacion
 from public.comprobantes c
 left join public.comprobantes s on s.id=c.venta_relacionada and lower(btrim(s.tipo))='venta'
 left join public.leads_raw l on l.id=c.cliente
 left join public.leads_raw sl on sl.id=s.cliente
), payments as (
 select client_key,max(f_acreditacion) as last_payment
 from identities
 where lower(btrim(coalesce(estado,'')))='conciliado'
 and lower(coalesce(rebotar_pago::text,'false')) not in ('true','1')
 and lower(btrim(coalesce(tipo,''))) in ('venta','cobranza')
 and coalesce(cash_collected,0)>0
 and f_acreditacion is not null
 and (f_acreditacion at time zone 'America/Argentina/Buenos_Aires')::date <= (now() at time zone 'America/Argentina/Buenos_Aires')::date
 group by client_key
)
select i.id,p.last_payment from identities i left join payments p using(client_key);

do $$
declare cols text;definition text;
begin
 select string_agg(case when attname='monto_incobrable' then
 'case when lower(btrim(coalesce(c.tipo, ''''))) = ''venta'' and p.last_payment is not null and (now() at time zone ''America/Argentina/Buenos_Aires'')::date - (p.last_payment at time zone ''America/Argentina/Buenos_Aires'')::date > 60 then greatest(coalesce(c.monto_incobrable,0),0) else 0::numeric end as monto_incobrable'
 else format('c.%I',attname) end, ', ' order by attnum) into cols
 from pg_attribute where attrelid='public.comprobantes_cash_metricas'::regclass and attnum>0 and not attisdropped;
 execute 'create or replace view public.comprobantes_ranking_metricas with (security_invoker=true) as select '||cols||' from public.comprobantes_cash_metricas c left join public.ranking_ultimo_pago_cliente p on p.id=c.id';
 definition:=pg_get_viewdef('public.ranking_closers_mensual'::regclass,true);
 if definition ~ '\mcomprobantes_cash_metricas\M' then
  definition:=regexp_replace(definition,'\mcomprobantes_cash_metricas\M','comprobantes_ranking_metricas','g');
  execute 'create or replace view public.ranking_closers_mensual as '||definition;
 elsif definition !~ '\mcomprobantes_ranking_metricas\M' then
  raise exception 'Fuente inesperada en ranking_closers_mensual';
 end if;
end;$$;
revoke all on public.ranking_ultimo_pago_cliente,public.comprobantes_ranking_metricas from public,anon,authenticated;
grant select on public.ranking_ultimo_pago_cliente,public.comprobantes_ranking_metricas to service_role;
comment on view public.comprobantes_ranking_metricas is 'Ranking: incobrable sólo en ventas con saldo positivo y más de 60 días desde el último pago conciliado del cliente. Sin fecha de pago verificable no se clasifica automáticamente. No altera saldos ni comprobantes.';
notify pgrst,'reload schema';
commit;
