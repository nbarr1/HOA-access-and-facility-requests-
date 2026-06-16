create type public.acc_request_status as enum ('submitted', 'under_review', 'approved', 'denied', 'withdrawn', 'closed');
create type public.acc_vote_value as enum ('approve', 'deny', 'abstain', 'needs_more_information');

create table public.acc_committee_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  is_active boolean not null default true,
  appointed_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (profile_id)
);

create table public.acc_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  property_address text not null,
  unit_address text,
  requester_name text not null,
  requester_email text,
  requester_phone text,
  title text not null,
  summary text not null default '',
  status public.acc_request_status not null default 'submitted',
  final_disposition text,
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
  voted_at timestamptz not null default now(),
  unique (request_id, committee_member_id)
);

alter table public.acc_committee_members enable row level security;
alter table public.acc_requests enable row level security;
alter table public.acc_request_votes enable row level security;

create or replace function public.is_active_acc_committee_member(profile uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.acc_committee_members where profile_id = profile and is_active = true) $$;

create policy "board and committee can read acc members" on public.acc_committee_members for select using (public.current_app_role() in ('board_admin', 'board_member') or public.is_active_acc_committee_member(auth.uid()));
create policy "admins manage acc members" on public.acc_committee_members for all using (public.current_app_role() = 'board_admin') with check (public.current_app_role() = 'board_admin');

create policy "board and acc committee can read acc requests" on public.acc_requests for select using (public.current_app_role() in ('board_admin', 'board_member') or public.is_active_acc_committee_member(auth.uid()));
create policy "service manages acc requests" on public.acc_requests for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "board and acc committee can read acc votes" on public.acc_request_votes for select using (public.current_app_role() in ('board_admin', 'board_member') or public.is_active_acc_committee_member(auth.uid()));
create policy "active committee inserts own acc votes" on public.acc_request_votes for insert with check (voter_profile_id = auth.uid() and public.is_active_acc_committee_member(auth.uid()));
create policy "active committee updates own acc votes" on public.acc_request_votes for update using (voter_profile_id = auth.uid() and public.is_active_acc_committee_member(auth.uid())) with check (voter_profile_id = auth.uid() and public.is_active_acc_committee_member(auth.uid()));
create policy "service manages acc votes" on public.acc_request_votes for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
