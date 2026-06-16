create table if not exists public.contacto_instagram_webhook (
  id text primary key,
  name text,
  email text,
  phone text,
  instagram text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_contacto_instagram_webhook_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contacto_instagram_webhook_updated_at on public.contacto_instagram_webhook;
create trigger trg_contacto_instagram_webhook_updated_at
before update on public.contacto_instagram_webhook
for each row execute function public.set_contacto_instagram_webhook_updated_at();
