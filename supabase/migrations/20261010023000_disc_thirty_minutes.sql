begin;
alter table public.training_disc_attempts alter column deadline_at set default now()+interval '30 minutes';
commit;
