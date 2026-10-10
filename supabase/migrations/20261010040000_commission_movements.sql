begin;
create table public.commission_movements (
 id uuid primary key default gen_random_uuid(),
 request_key uuid not null unique,
 month_key text not null check(month_key ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 person_email text not null check(person_email=lower(btrim(person_email))),
 person_name text not null,
 kind text not null check(kind in ('retiro','adelanto','bono')),
 amount numeric(16,2) not null check(amount>0),
 currency text not null check(currency in ('ARS','USD')),
 exchange_rate numeric(16,6) not null check(exchange_rate>0),
 amount_ars numeric(18,2) generated always as (round(amount*exchange_rate,2)) stored,
 effective_date date not null,
 concept text not null check(length(concept) between 1 and 500),
 source_key text,
 status text not null default 'approved' check(status in ('approved','void')),
 created_by text not null, created_at timestamptz not null default now(),
 voided_by text,voided_at timestamptz,void_reason text,
 check(currency<>'ARS' or exchange_rate=1),
 unique(month_key,person_email,source_key)
);
create index commission_movements_month_person on public.commission_movements(month_key,person_email,created_at);
alter table public.commission_movements enable row level security;
revoke all on public.commission_movements from public,anon,authenticated;
grant select on public.commission_movements to service_role;
create table public.commission_movement_audit(id bigint generated always as identity primary key,movement_id uuid not null references public.commission_movements(id),action text not null,actor text not null,at timestamptz not null default now(),snapshot jsonb not null);
alter table public.commission_movement_audit enable row level security;
revoke all on public.commission_movement_audit from public,anon,authenticated;
create function public.commission_movement_write(p_action text,p_actor text,p_data jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item commission_movements%rowtype;locked boolean;
begin
 p_actor:=lower(btrim(p_actor));
 if p_action='create' then
  if p_data->>'kind'='bono' then
   if p_actor not in ('leonardoalaniz19@gmail.com','matirandazzo@gmail.com') then raise exception 'Sólo Leo o Mati aprueban bonos';end if;
  elsif p_actor not in ('nadia.cavallini@gmail.com','matirandazzo@gmail.com') then raise exception 'Sólo Administración carga retiros';end if;
  select * into item from commission_movements where request_key=(p_data->>'request_key')::uuid;
  if found then
   if item.person_email<>p_data->>'person_email' or item.month_key<>p_data->>'month_key' or item.amount<>(p_data->>'amount')::numeric or item.currency<>p_data->>'currency' or item.kind<>p_data->>'kind' then raise exception 'La clave corresponde a otra operación';end if;
   return to_jsonb(item);
  end if;
  select coalesce(s.locked,false) into locked from commission_month_snapshots s where s.month_key=p_data->>'month_key' for share;
  if locked then raise exception 'El mes está bloqueado';end if;
  insert into commission_movements(request_key,month_key,person_email,person_name,kind,amount,currency,exchange_rate,effective_date,concept,source_key,created_by)
  values((p_data->>'request_key')::uuid,p_data->>'month_key',p_data->>'person_email',p_data->>'person_name',p_data->>'kind',(p_data->>'amount')::numeric,p_data->>'currency',(p_data->>'exchange_rate')::numeric,(p_data->>'effective_date')::date,p_data->>'concept',p_data->>'source_key',p_actor) returning * into item;
 elsif p_action='void' then
  select * into item from commission_movements where id=(p_data->>'id')::uuid for update;
  if not found then raise exception 'Movimiento no encontrado';end if;
  if item.kind='bono' and p_actor not in ('leonardoalaniz19@gmail.com','matirandazzo@gmail.com') then raise exception 'Sólo Leo o Mati anulan bonos';end if;
  if item.kind<>'bono' and p_actor not in ('nadia.cavallini@gmail.com','matirandazzo@gmail.com') then raise exception 'Sólo Administración anula retiros';end if;
  if length(btrim(coalesce(p_data->>'reason','')))<3 then raise exception 'Indicá el motivo de anulación';end if;
  if item.status='void' then return to_jsonb(item);end if;
  select coalesce(s.locked,false) into locked from commission_month_snapshots s where s.month_key=item.month_key for share;
  if locked then raise exception 'El mes está bloqueado';end if;
  update commission_movements set status='void',voided_by=p_actor,voided_at=now(),void_reason=p_data->>'reason' where id=item.id returning * into item;
 else raise exception 'Acción inválida';end if;
 insert into commission_movement_audit(movement_id,action,actor,snapshot) values(item.id,p_action,p_actor,to_jsonb(item));
 return to_jsonb(item);
end $$;
revoke all on function public.commission_movement_write(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.commission_movement_write(text,text,jsonb) to service_role;
commit;
