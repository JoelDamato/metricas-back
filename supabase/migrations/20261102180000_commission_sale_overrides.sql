begin;
create table public.commission_sale_overrides (
 sale_id text primary key references public.comprobantes(id) on delete cascade,
 closer_pct numeric check(closer_pct between 0 and 1),
 setter_pct numeric check(setter_pct between 0 and 1),
 reason text not null check(length(btrim(reason)) between 3 and 500),
 revision integer not null default 1,
 updated_by text not null,
 updated_at timestamptz not null default now()
);
create table public.commission_sale_override_audit (
 id bigint generated always as identity primary key,
 sale_id text not null,
 receipt_id text not null,
 actor text not null,
 at timestamptz not null default now(),
 before_row jsonb,
 after_row jsonb not null
);
alter table public.commission_sale_overrides enable row level security;
alter table public.commission_sale_override_audit enable row level security;
revoke all on public.commission_sale_overrides, public.commission_sale_override_audit from public, anon, authenticated;
grant select on public.commission_sale_overrides to service_role;

-- Use only an explicit, unambiguous relationship. Never guess by client or date.
create function public.commission_receipt_sale_id(p_id text) returns text
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare original comprobantes%rowtype; item comprobantes%rowtype; seen text[]:='{}'; ids text[]; next_id text:=p_id;
begin
 select * into original from comprobantes where id=p_id;
 if not found then return null; end if;
 loop
  if next_id is null or next_id=any(seen) or cardinality(seen)>=32 then return null; end if;
  select * into item from comprobantes where id=next_id;
  if not found then return null; end if;
  if item.id<>original.id and not (
   (nullif(original.ghlid,'') is not null and original.ghlid=item.ghlid)
   or (nullif(original.cliente,'') is not null and original.cliente=item.cliente)
  ) then return null; end if;
  if lower(item.tipo)='venta' then return item.id; end if;
  if lower(item.tipo)<>'cobranza' then return null; end if;
  seen:=array_append(seen,next_id);
  select array_agg(distinct lower(m[1])) into ids from regexp_matches(
   coalesce(nullif(item.venta_relacionada,''),item.cobranza_relacionada,''),
   '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})','g') m;
  if cardinality(ids) is distinct from 1 then return null; end if;
  next_id:=ids[1];
 end loop;
end $$;
create function public.commission_sale_override_context(p_receipt_id text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_sale_id text; sale comprobantes%rowtype; item commission_sale_overrides%rowtype;
begin
 v_sale_id:=commission_receipt_sale_id(p_receipt_id);
 if v_sale_id is null then raise exception 'No hay una venta vinculada inequívoca. Corregí la relación antes de cambiar la comisión.'; end if;
 select * into sale from comprobantes where id=v_sale_id;
 select * into item from commission_sale_overrides o where o.sale_id=sale.id;
 return jsonb_build_object('sale_id',sale.id,'client_name',sale.cliente_format,'product',sale.producto_format,
  'closer',sale.responsable_venta,'setter',sale.setter,'closer_pct',item.closer_pct,'setter_pct',item.setter_pct,
  'reason',item.reason,'revision',coalesce(item.revision,0));
end $$;
create function public.commission_sale_override_write(p_receipt_id text,p_actor text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_sale_id text; before_item commission_sale_overrides%rowtype; after_item commission_sale_overrides%rowtype; v_closer numeric; v_setter numeric;
begin
 if lower(btrim(coalesce(p_actor,'')))<>'nadia.cavallini@gmail.com' then raise exception 'Sólo Nadia puede modificar los porcentajes especiales por venta'; end if;
 if not (p_data ?& array['closer_pct','setter_pct','revision','reason']) then raise exception 'Faltan datos del porcentaje especial'; end if;
 v_closer:=(p_data->>'closer_pct')::numeric; v_setter:=(p_data->>'setter_pct')::numeric;
 if coalesce(v_closer not between 0 and 1,false) or coalesce(v_setter not between 0 and 1,false) then raise exception 'Porcentaje inválido'; end if;
 if length(btrim(coalesce(p_data->>'reason',''))) not between 3 and 500 then raise exception 'Indicá el motivo del cambio'; end if;
 v_sale_id:=commission_receipt_sale_id(p_receipt_id);
 if v_sale_id is null then raise exception 'No hay una venta vinculada inequívoca'; end if;
 perform 1 from comprobantes where id=v_sale_id for update;
 -- Serialize against month locking; a change cannot alter a closed settlement.
 if to_regclass('public.commission_month_snapshots') is not null then
 lock table commission_month_snapshots in share mode;
 if exists(select 1 from comprobantes c join commission_month_snapshots s
  on s.month_key=left(c.f_acreditacion::text,7) and s.locked
  where commission_receipt_sale_id(c.id)=v_sale_id) then
  raise exception 'La venta tiene comprobantes en un mes bloqueado. No se puede modificar su porcentaje.';
 end if;
 end if;
 select * into before_item from commission_sale_overrides o where o.sale_id=v_sale_id;
 if coalesce(before_item.revision,0) is distinct from (p_data->>'revision')::integer then raise exception 'El porcentaje cambió; volvé a abrirlo antes de guardar'; end if;
 insert into commission_sale_overrides(sale_id,closer_pct,setter_pct,reason,revision,updated_by)
 values(v_sale_id,v_closer,v_setter,btrim(p_data->>'reason'),coalesce(before_item.revision,0)+1,lower(btrim(p_actor)))
 on conflict on constraint commission_sale_overrides_pkey do update set
 closer_pct=excluded.closer_pct,setter_pct=excluded.setter_pct,reason=excluded.reason,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now()
 returning * into after_item;
 insert into commission_sale_override_audit(sale_id,receipt_id,actor,before_row,after_row)
 values(v_sale_id,p_receipt_id,p_actor,to_jsonb(before_item),to_jsonb(after_item));
 return commission_sale_override_context(p_receipt_id);
end $$;
revoke all on function public.commission_receipt_sale_id(text),public.commission_sale_override_context(text),public.commission_sale_override_write(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.commission_sale_override_context(text),public.commission_sale_override_write(text,text,jsonb) to service_role;
commit;
