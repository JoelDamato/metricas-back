begin;
do $$begin
 for n in 1..10 loop
  execute format('alter table public.csm add column if not exists modulo_%s_fin date',n);
 end loop;
end$$;
-- Restore only end dates already present in captured GHL payloads; do not replay old contact states.
do $$declare rec record;n integer;k text;value text;d date;
begin
 perform set_config('metricas.csm_ghl_write','on',true);
 for rec in select csm_id,coalesce(latest_payload->'data',latest_payload) p from public.csm_ghl_contacts loop
  for n in 1..10 loop
   k:='F. Fin '||case when n<=7 then 'M'||n else 'MP'||(n-7) end;
   value:=coalesce(nullif(rec.p->'customData'->>k,''),nullif(rec.p->>k,''));
   if value ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
     d:=value::date;
     execute format('update public.csm set modulo_%s_fin=$1 where id=$2 and modulo_%s_fin is null',n,n) using d,rec.csm_id;
    exception when invalid_datetime_format or datetime_field_overflow then null;
    end;
   end if;
  end loop;
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
