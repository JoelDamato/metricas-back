begin;
alter table public.comprobantes add column if not exists nota_conciliacion text;
alter table public.comprobantes add column if not exists nota_conciliacion_revision integer not null default 0;
alter table public.comprobantes add column if not exists nota_conciliacion_autor text;
alter table public.comprobantes add column if not exists nota_conciliacion_fecha timestamptz;
create or replace function public.metricas_reconciliation_note(p_id text,p_note text,p_revision integer,p_author text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare receipt public.comprobantes%rowtype;
begin
 if p_note is null or length(p_note)>4000 or p_revision is null or p_revision<0 or nullif(trim(p_author),'') is null then raise exception 'Nota inválida';end if;
 select * into receipt from comprobantes where id=p_id for update;
 if not found or receipt.nota_conciliacion_revision<>p_revision then return jsonb_build_object('conflict',true);end if;
 perform set_config('metricas.receipt_write','on',true);
 update comprobantes set nota_conciliacion=nullif(trim(p_note),''),nota_conciliacion_revision=p_revision+1,
 nota_conciliacion_autor=p_author,nota_conciliacion_fecha=now() where id=p_id returning * into receipt;
 return jsonb_build_object('row',to_jsonb(receipt));
end;$$;
revoke all on function public.metricas_reconciliation_note(text,text,integer,text) from public,anon,authenticated;
grant execute on function public.metricas_reconciliation_note(text,text,integer,text) to service_role;
commit;
