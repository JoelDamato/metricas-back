begin;
-- Delete a single result and its attempt together so its email can be reused.
-- Lock the attempt first, matching disc_attempt_save, to prevent a concurrent
-- autosave/finalization from recreating the result after deletion.
create or replace function public.disc_delete_submission(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare attempt uuid; removed uuid;
begin
 select submission_key into attempt from training_disc_submissions where id=p_id;
 if not found then return jsonb_build_object('deleted',false);end if;
 perform 1 from training_disc_attempts where attempt_key=attempt for update;
 delete from training_disc_submissions where id=p_id returning id into removed;
 if removed is null then return jsonb_build_object('deleted',false);end if;
 delete from training_disc_attempts where attempt_key=attempt;
 return jsonb_build_object('deleted',true,'id',removed);
end;$$;
revoke all on function public.disc_delete_submission(uuid) from public,anon,authenticated;
grant execute on function public.disc_delete_submission(uuid) to service_role;
notify pgrst,'reload schema';
commit;
