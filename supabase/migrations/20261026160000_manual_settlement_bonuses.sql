-- Nadia and Mati can record manual bonuses; calculated bonuses retain their approval policy.
begin;
create or replace function public.commission_movement_write(p_action text,p_actor text,p_data jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item commission_movements%rowtype;locked boolean;
begin
 p_actor:=lower(btrim(p_actor));
 if p_action='create' then
  if p_data->>'kind'='bono' then
   if coalesce(p_data->>'source_key','') like 'manual:%' then
    if p_actor not in ('nadia.cavallini@gmail.com','matirandazzo@gmail.com') then raise exception 'Sólo Administración carga bonos manuales';end if;
   elsif p_actor not in ('leonardoalaniz19@gmail.com','matirandazzo@gmail.com') then raise exception 'Sólo Leo o Mati aprueban bonos';end if;
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
  if item.kind='bono' and p_actor not in ('leonardoalaniz19@gmail.com','matirandazzo@gmail.com') and not (coalesce(item.source_key,'') like 'manual:%' and p_actor='nadia.cavallini@gmail.com') then raise exception 'Sólo Leo o Mati anulan bonos';end if;
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

commit;
