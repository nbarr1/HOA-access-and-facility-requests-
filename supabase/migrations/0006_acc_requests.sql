create type public.acc_request_status as enum ('new', 'in_review', 'closed');

create table public.acc_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete set null,
  external_message_id text,
  from_email text not null,
  subject text not null,
  body_text text not null default '',
  sanitized_body text not null default '',
  status public.acc_request_status not null default 'new',
  source text not null default 'email-webhook',
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index acc_requests_request_id_idx
on public.acc_requests (request_id)
where request_id is not null;

create unique index acc_requests_external_message_id_idx
on public.acc_requests (external_message_id)
where external_message_id is not null;

alter table public.acc_requests enable row level security;

create policy "board can read acc requests" on public.acc_requests for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "board can update acc requests" on public.acc_requests for update using (public.current_app_role() in ('board_admin', 'board_member')) with check (public.current_app_role() in ('board_admin', 'board_member'));
create policy "service inserts acc requests" on public.acc_requests for insert with check (auth.role() = 'service_role');
