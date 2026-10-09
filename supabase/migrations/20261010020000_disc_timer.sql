begin;
alter table public.training_disc_submissions add column started_at timestamptz, add column completion_status text not null default 'completed' check(completion_status in ('completed','incomplete'));
create table public.training_disc_attempts (
 attempt_key uuid primary key default gen_random_uuid(),
 email text not null unique,
 nombre text not null,
 started_at timestamptz not null default now(),
 deadline_at timestamptz not null default now()+interval '1 hour',
 answers jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb,
 revision integer not null default 0,
 finalized boolean not null default false
);
create index training_disc_expiry_idx on public.training_disc_attempts(deadline_at) where finalized=false;
alter table public.training_disc_attempts enable row level security;
revoke all on public.training_disc_attempts from public,anon,authenticated;
grant select,insert on public.training_disc_attempts to service_role;
create or replace function public.disc_attempt_save(p_key uuid,p_answers jsonb default null,p_revision integer default 0,p_finish boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a training_disc_attempts%rowtype; counts jsonb; pct jsonb; dominant jsonb; n integer; mx integer; k text; expired boolean; result training_disc_submissions%rowtype;
begin
 select * into a from training_disc_attempts where attempt_key=p_key for update;
 if not found then raise exception 'Intento no encontrado';end if;
 expired:=clock_timestamp()>=a.deadline_at;
 if not a.finalized and not expired and p_answers is not null then
  if jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)<>30 or exists(select 1 from jsonb_array_elements(p_answers) v where v not in ('"D"'::jsonb,'"I"'::jsonb,'"S"'::jsonb,'"C"'::jsonb,'null'::jsonb)) then raise exception 'Respuestas inválidas';end if;
  if p_revision>a.revision then a.answers:=p_answers;a.revision:=p_revision;end if;
 end if;
 if not a.finalized and (expired or p_finish) then
  if not expired and exists(select 1 from jsonb_array_elements(a.answers) v where v='null'::jsonb) then raise exception 'Completá las 30 preguntas';end if;
  counts:='{}';pct:='{}';mx:=0;
  foreach k in array array['D','I','S','C'] loop
   select count(*) into n from jsonb_array_elements_text(a.answers) v where v=k;
   counts:=counts||jsonb_build_object(k,n);pct:=pct||jsonb_build_object(k,round(n*100.0/30,1));mx:=greatest(mx,n);
  end loop;
  select coalesce(jsonb_agg(key),'[]') into dominant from jsonb_each_text(counts) where value::integer=mx and mx>0;
  insert into training_disc_submissions(submission_key,email,nombre,answers,scores,percentages,predominant,test_version,started_at,completion_status,submitted_at)
  values(a.attempt_key,a.email,a.nombre,a.answers,counts,pct,dominant,'disc-v1',a.started_at,case when expired then 'incomplete' else 'completed' end,clock_timestamp())
  on conflict(email) do nothing;
  a.finalized:=true;
 end if;
 update training_disc_attempts set answers=a.answers,revision=a.revision,finalized=a.finalized where attempt_key=p_key;
 select * into result from training_disc_submissions where submission_key=p_key;
 return jsonb_build_object('startedAt',a.started_at,'deadlineAt',a.deadline_at,'answers',a.answers,'revision',a.revision,'finalized',a.finalized,'completionStatus',result.completion_status,'submittedAt',result.submitted_at,'serverNow',clock_timestamp());
end $$;
revoke all on function public.disc_attempt_save(uuid,jsonb,integer,boolean) from public,anon,authenticated;
grant execute on function public.disc_attempt_save(uuid,jsonb,integer,boolean) to service_role;
commit;
