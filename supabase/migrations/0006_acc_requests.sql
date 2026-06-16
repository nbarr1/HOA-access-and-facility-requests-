create type public.acc_request_status as enum ('submitted', 'under_review', 'approved', 'denied', 'withdrawn');
create type public.acc_vote_value as enum ('approve', 'deny', 'abstain');

create table public.acc_committee_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.acc_requests (
  id uuid primary key default gen_random_uuid(),
  submitter_name text not null,
  submitter_email text,
  submitter_phone text,
  property_address text not null,
  unit_address text,
  title text not null,
  summary text not null default '',
  source_email text,
  source_request_identifier text,
  status public.acc_request_status not null default 'submitted',
  disposition text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.acc_request_votes (
  id uuid primary key default gen_random_uuid(),
  acc_request_id uuid not null references public.acc_requests(id) on delete cascade,
  committee_member_profile_id uuid not null references public.profiles(id) on delete cascade,
  vote public.acc_vote_value not null,
  comment text not null default '',
  voted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint acc_request_votes_one_vote_per_member unique (acc_request_id, committee_member_profile_id)
);

create index acc_committee_members_active_profile_idx
on public.acc_committee_members (profile_id)
where is_active;

create index acc_requests_status_submitted_at_idx
on public.acc_requests (status, submitted_at desc);

create index acc_request_votes_request_id_idx
on public.acc_request_votes (acc_request_id);

create unique index acc_requests_source_request_identifier_idx
on public.acc_requests (source_request_identifier)
where source_request_identifier is not null;

create or replace function public.is_active_acc_committee_member(p_profile_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.acc_committee_members
    where acc_committee_members.profile_id = p_profile_id
      and acc_committee_members.is_active = true
  )
$$;

alter table public.acc_committee_members enable row level security;
alter table public.acc_requests enable row level security;
alter table public.acc_request_votes enable row level security;

create policy "board can read acc committee members" on public.acc_committee_members for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "active acc committee members can read acc committee members" on public.acc_committee_members for select using (public.is_active_acc_committee_member());
create policy "service manages acc committee members" on public.acc_committee_members for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "board can read acc requests" on public.acc_requests for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "active acc committee members can read acc requests" on public.acc_requests for select using (public.is_active_acc_committee_member());
create policy "service inserts acc requests" on public.acc_requests for insert with check (auth.role() = 'service_role');
create policy "service updates acc requests" on public.acc_requests for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "board can read acc request votes" on public.acc_request_votes for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "active acc committee members can read acc request votes" on public.acc_request_votes for select using (public.is_active_acc_committee_member());
create policy "active acc committee members create own votes" on public.acc_request_votes for insert with check (
  public.is_active_acc_committee_member()
  and committee_member_profile_id = auth.uid()
);
create policy "active acc committee members update own votes" on public.acc_request_votes for update using (
  public.is_active_acc_committee_member()
  and committee_member_profile_id = auth.uid()
) with check (
  public.is_active_acc_committee_member()
  and committee_member_profile_id = auth.uid()
);
create policy "service inserts acc request votes" on public.acc_request_votes for insert with check (auth.role() = 'service_role');
create policy "service updates acc request votes" on public.acc_request_votes for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
