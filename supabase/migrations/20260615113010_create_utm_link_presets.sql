create table if not exists public.utm_link_presets (
  id bigserial primary key,
  preset_key text not null unique,
  display_name text not null,
  base_url text,
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_email text
);

create or replace function public.set_utm_link_presets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_utm_link_presets_updated_at on public.utm_link_presets;
create trigger trg_utm_link_presets_updated_at
before update on public.utm_link_presets
for each row execute function public.set_utm_link_presets_updated_at();
