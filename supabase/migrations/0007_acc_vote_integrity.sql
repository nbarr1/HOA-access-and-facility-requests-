alter table public.acc_committee_members
  drop constraint if exists acc_committee_ended_when_inactive;

update public.acc_committee_members
set ended_at = null
where is_active = true
  and ended_at is not null;

alter table public.acc_committee_members
  add constraint acc_committee_ended_when_inactive
  check (is_active = (ended_at is null));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'acc_committee_members_id_profile_id_key'
      and conrelid = 'public.acc_committee_members'::regclass
  ) then
    alter table public.acc_committee_members
      add constraint acc_committee_members_id_profile_id_key unique (id, profile_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'acc_request_votes_member_fkey'
      and conrelid = 'public.acc_request_votes'::regclass
  ) then
    alter table public.acc_request_votes
      drop constraint if exists acc_request_votes_committee_member_id_fkey;

    alter table public.acc_request_votes
      add constraint acc_request_votes_member_fkey
      foreign key (committee_member_id, voter_profile_id)
      references public.acc_committee_members(id, profile_id)
      on delete cascade;
  end if;
end $$;
