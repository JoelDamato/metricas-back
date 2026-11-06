-- Una sola copia del contacto de GHL por fila: `fields` (ordenado, con tipos) conserva todos los valores;
-- `latest_payload` guarda únicamente lo que NO está espejado en `fields` (p. ej. `contact` y `customData`).
-- Ningún valor se pierde: lo recortado es idéntico a fields[clave].value. Respaldo exacto previo en
-- ~/backups/matias-supabase-20261106 (scripts/restore_ghl_tables.js).
create or replace function public.ghl_payload_stub(p jsonb, f jsonb) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' or f is null or jsonb_typeof(f) <> 'object' then p
    else coalesce((select jsonb_object_agg(e.key,
        case when e.key = 'data' and jsonb_typeof(e.value) = 'object'
             then (select coalesce(jsonb_object_agg(d.key, d.value), '{}'::jsonb) from jsonb_each(e.value) d
                   where not (f ? d.key and f->d.key->'value' = d.value))
             else e.value end)
      from jsonb_each(p) e
      where e.key = 'data' or not (f ? e.key and f->e.key->'value' = e.value)), '{}'::jsonb)
  end $$;

create or replace function public.ghl_trim_payload() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.latest_payload := public.ghl_payload_stub(new.latest_payload, new.fields);
  return new;
end $$;

drop trigger if exists ab_trim_payload on public.leads_ghl_contacts_store;
create trigger ab_trim_payload before insert or update of fields, latest_payload on public.leads_ghl_contacts_store
  for each row execute function public.ghl_trim_payload();
drop trigger if exists ab_trim_payload on public.csm_ghl_contacts_store;
create trigger ab_trim_payload before insert or update of fields, latest_payload on public.csm_ghl_contacts_store
  for each row execute function public.ghl_trim_payload();
