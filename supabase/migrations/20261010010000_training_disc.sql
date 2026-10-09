begin;
create table public.training_disc_submissions (
 id uuid primary key default gen_random_uuid(),
 submission_key uuid not null unique,
 email text not null unique check(email=lower(btrim(email)) and length(email) between 3 and 254),
 nombre text not null check(length(nombre) between 2 and 150),
 answers jsonb not null check(jsonb_typeof(answers)='array' and jsonb_array_length(answers)=30),
 scores jsonb not null,
 percentages jsonb not null,
 predominant jsonb not null,
 test_version text not null default 'disc-v1',
 submitted_at timestamptz not null default now()
);
create index training_disc_date_idx on public.training_disc_submissions(submitted_at desc,id desc);
alter table public.training_disc_submissions enable row level security;
revoke all on public.training_disc_submissions from public,anon,authenticated;
grant select,insert on public.training_disc_submissions to service_role;
commit;
