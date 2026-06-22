create table public.sent_email_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete set null,
  external_message_id text not null unique,
  source text not null default 'sent-email-webhook',
  from_email text not null,
  to_emails text[] not null default '{}',
  subject text not null,
  body_text text not null default '',
  sent_at timestamptz not null default now(),
  in_reply_to text,
  references text[] not null default '{}',
  action_taken text not null check (action_taken in ('reply_sent', 'completion_indicated', 'no_match')),
  resulting_status public.request_status,
  created_at timestamptz not null default now()
);

create index sent_email_actions_request_id_idx on public.sent_email_actions (request_id);
create index sent_email_actions_in_reply_to_idx on public.sent_email_actions (in_reply_to);

alter table public.sent_email_actions enable row level security;

create policy "board can read sent email actions" on public.sent_email_actions for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "service inserts sent email actions" on public.sent_email_actions for insert with check (auth.role() = 'service_role');
