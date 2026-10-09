begin;
create table if not exists public.csm_followup_notes (
 ghlid text primary key, note text not null default '' check(length(note)<=4000),
 revision integer not null default 1, updated_by text not null,
 updated_at timestamptz not null default now()
);
alter table public.csm_followup_notes enable row level security;
revoke all on public.csm_followup_notes from public,anon,authenticated;
grant select on public.csm_followup_notes to service_role;
create or replace function public.metricas_csm_followup_note(p_ghlid text,p_note text,p_revision integer,p_actor text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_note csm_followup_notes%rowtype;
begin
 if length(p_ghlid)>100 or p_ghlid !~ '^[a-zA-Z0-9]+$' or length(p_note)>4000 or nullif(p_actor,'') is null then raise exception 'Datos inválidos'; end if;
 perform pg_advisory_xact_lock(hashtextextended('csm-note:'||p_ghlid,0));
 if not exists(select 1 from csm where ghlid=p_ghlid) then raise exception 'Cliente inexistente'; end if;
 select * into current_note from csm_followup_notes where ghlid=p_ghlid;
 if coalesce(current_note.revision,0)<>p_revision then return jsonb_build_object('conflict',true,'current',to_jsonb(current_note));end if;
 insert into csm_followup_notes(ghlid,note,updated_by) values(p_ghlid,p_note,p_actor)
 on conflict(ghlid) do update set note=excluded.note,updated_by=excluded.updated_by,revision=csm_followup_notes.revision+1,updated_at=now()
 returning * into current_note;
 return to_jsonb(current_note);
end;$$;
revoke all on function public.metricas_csm_followup_note(text,text,integer,text) from public,anon,authenticated;
grant execute on function public.metricas_csm_followup_note(text,text,integer,text) to service_role;
create or replace view public.csm_followup_profiles as select ghlid,
 latest_payload->>'Fecha de inicio estimado' as fecha_inicio_estimada,
 latest_payload->>'F. inicio renovacion' as fecha_inicio_renovacion,
 coalesce(nullif(latest_payload->>'Rubro',''),nullif(latest_payload->>'rubro','')) as rubro
 from public.csm_ghl_contacts;
revoke all on public.csm_followup_profiles from public,anon,authenticated;
grant select on public.csm_followup_profiles to service_role;
create table if not exists public.csm_followup_rules (
 stage text primary key check(stage ~ '^(w[1-9]|s[0-3])$'),
 yellow integer not null check(yellow>=0), red integer not null check(red>yellow),
 revision integer not null default 1, updated_by text not null, updated_at timestamptz not null default now()
);
alter table public.csm_followup_rules enable row level security;
revoke all on public.csm_followup_rules from public,anon,authenticated;
grant select on public.csm_followup_rules to service_role;
create or replace function public.metricas_csm_followup_rule(p_stage text,p_yellow integer,p_red integer,p_revision integer,p_actor text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_rule csm_followup_rules%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('csm-rule:'||p_stage,0));
 select * into current_rule from csm_followup_rules where stage=p_stage;
 if coalesce(current_rule.revision,0)<>p_revision then return jsonb_build_object('conflict',true);end if;
 insert into csm_followup_rules(stage,yellow,red,updated_by) values(p_stage,p_yellow,p_red,p_actor)
 on conflict(stage) do update set yellow=excluded.yellow,red=excluded.red,updated_by=excluded.updated_by,revision=csm_followup_rules.revision+1,updated_at=now()
 returning * into current_rule;
 return to_jsonb(current_rule);
end;$$;
revoke all on function public.metricas_csm_followup_rule(text,integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.metricas_csm_followup_rule(text,integer,integer,integer,text) to service_role;
notify pgrst,'reload schema';
commit;
