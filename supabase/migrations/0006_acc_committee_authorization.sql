create type public.acc_request_status as enum ('submitted', 'under_review', 'approved', 'denied', 'withdrawn');
create type public.acc_vote_value as enum ('approve', 'deny', 'abstain');

create table public.acc_committee_members (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  appointed_by uuid references public.profiles(id),
  active boolean not null default true,
  appointed_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint acc_committee_removed_when_inactive check (active or removed_at is not null)
);

create table public.acc_requests (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references public.residents(id),
  submitted_by uuid references public.profiles(id),
  title text not null,
  description text not null default '',
  status public.acc_request_status not null default 'submitted',
  decision_reason text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.acc_request_votes (
  request_id uuid not null references public.acc_requests(id) on delete cascade,
  committee_member_id uuid not null references public.acc_committee_members(profile_id) on delete cascade,
  vote public.acc_vote_value not null,
  rationale text not null default '',
  voted_at timestamptz not null default now(),
  primary key (request_id, committee_member_id)
);

create or replace function public.current_is_acc_committee_member()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.acc_committee_members
    where profile_id = auth.uid()
      and active = true
  )
$$;

alter table public.acc_committee_members enable row level security;
alter table public.acc_requests enable row level security;
alter table public.acc_request_votes enable row level security;

create policy "board can manage acc committee members" on public.acc_committee_members
  for all
  using (public.current_app_role() = 'board_admin')
  with check (public.current_app_role() = 'board_admin');

create policy "acc members can read their membership" on public.acc_committee_members
  for select
  using (profile_id = auth.uid() and active = true);

create policy "board can read acc requests" on public.acc_requests
  for select
  using (public.current_app_role() in ('board_admin', 'board_member'));

create policy "acc committee can read acc requests" on public.acc_requests
  for select
  using (public.current_is_acc_committee_member());

create policy "board can update acc requests" on public.acc_requests
  for update
  using (public.current_app_role() in ('board_admin', 'board_member'))
  with check (public.current_app_role() in ('board_admin', 'board_member'));

create policy "residents can submit their acc requests" on public.acc_requests
  for insert
  with check (submitted_by = auth.uid());

create policy "board can read acc votes" on public.acc_request_votes
  for select
  using (public.current_app_role() in ('board_admin', 'board_member'));

create policy "acc committee can read acc votes" on public.acc_request_votes
  for select
  using (public.current_is_acc_committee_member());

create policy "acc committee can cast own votes" on public.acc_request_votes
  for insert
  with check (committee_member_id = auth.uid() and public.current_is_acc_committee_member());

create policy "acc committee can update own votes" on public.acc_request_votes
  for update
  using (committee_member_id = auth.uid() and public.current_is_acc_committee_member())
  with check (committee_member_id = auth.uid() and public.current_is_acc_committee_member());
