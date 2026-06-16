create type public.acc_request_status as enum ('submitted', 'under_review', 'approved', 'denied', 'withdrawn', 'closed');
create type public.acc_vote_value as enum ('approve', 'deny', 'abstain', 'needs_more_information');

create table public.acc_committee_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  is_active boolean not null default true,
  appointed_by uuid references public.profiles(id),
  appointed_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint acc_committee_ended_when_inactive check (is_active or ended_at is not null),
  unique (profile_id)
);

create table public.acc_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete set null,
  external_message_id text,
  resident_id uuid references public.residents(id) on delete set null,
  submitted_by uuid references public.profiles(id) on delete set null,
  from_email text not null default '',
  requester_name text not null default '',
  requester_email text,
  requester_phone text,
  property_address text not null default '',
  unit_address text,
  subject text not null default '',
  title text not null default '',
  description text not null default '',
  summary text not null default '',
  body_text text not null default '',
  sanitized_body text not null default '',
  status public.acc_request_status not null default 'submitted',
  final_disposition text,
  decision_reason text,
  committee_notes text not null default '',
  quorum_met boolean,
  source text not null default 'email-webhook',
  received_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  disposition_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.acc_request_votes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.acc_requests(id) on delete cascade,
  committee_member_id uuid not null references public.acc_committee_members(id) on delete cascade,
  voter_profile_id uuid not null references public.profiles(id) on delete cascade,
  vote_value public.acc_vote_value not null,
  comment text not null default '',
  rationale text not null default '',
  voted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, committee_member_id)
);

create unique index acc_requests_request_id_idx
on public.acc_requests (request_id)
where request_id is not null;

create unique index acc_requests_external_message_id_idx
on public.acc_requests (external_message_id)
where external_message_id is not null;

alter table public.acc_committee_members enable row level security;
alter table public.acc_requests enable row level security;
alter table public.acc_request_votes enable row level security;

create or replace function public.is_active_acc_committee_member(profile uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.acc_committee_members
    where profile_id = profile
      and is_active = true
  )
$$;

create or replace function public.current_is_acc_committee_member()
returns boolean
language sql stable security definer
set search_path = public
as $$ select public.is_active_acc_committee_member(auth.uid()) $$;

create policy "board and committee can read acc members" on public.acc_committee_members
  for select
  using (public.current_app_role() in ('board_admin', 'board_member') or public.current_is_acc_committee_member());

create policy "admins manage acc members" on public.acc_committee_members
  for all
  using (public.current_app_role() = 'board_admin')
  with check (public.current_app_role() = 'board_admin');

create policy "board and acc committee can read acc requests" on public.acc_requests
  for select
  using (public.current_app_role() in ('board_admin', 'board_member') or public.current_is_acc_committee_member());

create policy "active committee updates acc requests" on public.acc_requests
  for update
  using (public.current_is_acc_committee_member())
  with check (public.current_is_acc_committee_member());

create policy "residents can submit their acc requests" on public.acc_requests
  for insert
  with check (submitted_by = auth.uid());

create policy "service manages acc requests" on public.acc_requests
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "board and acc committee can read acc votes" on public.acc_request_votes
  for select
  using (public.current_app_role() in ('board_admin', 'board_member') or public.current_is_acc_committee_member());

create policy "active committee inserts own acc votes" on public.acc_request_votes
  for insert
  with check (voter_profile_id = auth.uid() and public.current_is_acc_committee_member());

create policy "active committee updates own acc votes" on public.acc_request_votes
  for update
  using (voter_profile_id = auth.uid() and public.current_is_acc_committee_member())
  with check (voter_profile_id = auth.uid() and public.current_is_acc_committee_member());

create policy "service manages acc votes" on public.acc_request_votes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create view public.acc_votes
with (security_invoker = true)
as
select
  v.id,
  v.request_id,
  m.display_name as committee_member_name,
  m.display_name as member_name,
  p.full_name as voter_name,
  v.vote_value as vote,
  v.voted_at as created_at
from public.acc_request_votes v
join public.acc_committee_members m on m.id = v.committee_member_id
join public.profiles p on p.id = v.voter_profile_id;
