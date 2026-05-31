create type public.app_role as enum ('board_admin', 'board_member', 'resident');
create type public.dues_status as enum ('paid', 'lapsed', 'unknown');
create type public.access_status as enum ('pending', 'granted', 'revoked', 'hold');
create type public.request_category as enum ('access', 'facilities', 'vendor', 'invoice', 'other');
create type public.request_priority as enum ('urgent', 'high', 'normal', 'low');
create type public.request_status as enum ('new', 'in_progress', 'done');
create type public.manual_task_status as enum ('pending', 'done', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'resident',
  created_at timestamptz not null default now()
);

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_address text not null,
  email text not null unique,
  dues_status public.dues_status not null default 'unknown',
  access_status public.access_status not null default 'pending',
  external_access_id text,
  external_billing_id text,
  last_synced_at timestamptz,
  override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text not null default 'system',
  actor_type text not null check (actor_type in ('system', 'user')),
  action text not null,
  target_resident_id uuid references public.residents(id),
  reason text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.manual_tasks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  resident_id uuid references public.residents(id),
  action text not null,
  instructions text not null,
  status public.manual_task_status not null default 'pending',
  created_by_audit_id uuid references public.audit_log(id),
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  from_email text not null,
  subject text not null,
  body_text text not null default '',
  sanitized_body text not null default '',
  category public.request_category not null default 'other',
  priority public.request_priority not null default 'normal',
  status public.request_status not null default 'new',
  classification_reason text not null default '',
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.idempotency_keys (
  key text primary key,
  created_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

alter table public.profiles enable row level security;
alter table public.residents enable row level security;
alter table public.audit_log enable row level security;
alter table public.manual_tasks enable row level security;
alter table public.requests enable row level security;
alter table public.idempotency_keys enable row level security;

create policy "board can read profiles" on public.profiles for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "admins manage profiles" on public.profiles for all using (public.current_app_role() = 'board_admin') with check (public.current_app_role() = 'board_admin');

create policy "board can read residents" on public.residents for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "board can update residents" on public.residents for update using (public.current_app_role() in ('board_admin', 'board_member')) with check (public.current_app_role() in ('board_admin', 'board_member'));
create policy "admins insert residents" on public.residents for insert with check (public.current_app_role() = 'board_admin');

create policy "board can read audit" on public.audit_log for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "service inserts audit" on public.audit_log for insert with check (auth.role() = 'service_role');

create policy "board can read tasks" on public.manual_tasks for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "board can complete tasks" on public.manual_tasks for update using (public.current_app_role() in ('board_admin', 'board_member')) with check (public.current_app_role() in ('board_admin', 'board_member'));

create policy "board can read requests" on public.requests for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "board can update requests" on public.requests for update using (public.current_app_role() in ('board_admin', 'board_member')) with check (public.current_app_role() in ('board_admin', 'board_member'));
create policy "service inserts requests" on public.requests for insert with check (auth.role() = 'service_role');
