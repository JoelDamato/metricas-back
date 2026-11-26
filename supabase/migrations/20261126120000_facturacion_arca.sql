-- Facturación ARCA (Conciliación): tilde de «ya facturado» por comprobante de cuenta propia.
-- Aditiva: reusa facturacion_arca y fecha_facturado (heredadas de Notion) y suma quién lo marcó.
begin;
alter table public.comprobantes add column if not exists facturado_arca_por text;

create or replace function public.metricas_set_arca_billed(p_ids text[], p_billed boolean, p_author text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_rows jsonb;
begin
 if p_ids is null or cardinality(p_ids)=0 or cardinality(p_ids)>200 or p_billed is null
    or nullif(trim(p_author),'') is null or length(p_author)>200 then
  raise exception 'Selección de facturación ARCA inválida';
 end if;
 perform set_config('metricas.receipt_write','on',true);
 with changed as (
  update comprobantes set
   facturacion_arca=case when p_billed then 'true' else null end,
   fecha_facturado=case when p_billed then now() else null end,
   facturado_arca_por=case when p_billed then trim(p_author) else null end
  where id=any(p_ids) and tipo_banco='Propia'
  returning id,facturacion_arca,fecha_facturado,facturado_arca_por
 ), logged as (
  insert into comprobantes_eventos_v2(comprobante_id,actor_email,action,after_row)
  select id,trim(p_author),case when p_billed then 'arca_facturado' else 'arca_pendiente' end,to_jsonb(changed) from changed
  returning 1
 )
 -- Los CTE que escriben corren siempre; el evento queda aunque no se lea «logged».
 select coalesce(jsonb_agg(to_jsonb(changed)),'[]'::jsonb) into v_rows from changed;
 return jsonb_build_object('rows',v_rows);
end;$$;

revoke all on function public.metricas_set_arca_billed(text[],boolean,text) from public,anon,authenticated;
grant execute on function public.metricas_set_arca_billed(text[],boolean,text) to service_role;
commit;
