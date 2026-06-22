alter table public.requests
add column normalized_subject text;

update public.requests
set normalized_subject = lower(trim(regexp_replace(regexp_replace(subject, '^[[:space:]]*((re|fw|fwd)[[:space:]]*:[[:space:]]*)+', '', 'i'), '[[:space:]]+', ' ', 'g')))
where normalized_subject is null;

create index requests_normalized_subject_received_at_idx on public.requests (normalized_subject, received_at desc);

alter table public.manual_tasks
add column request_id uuid references public.requests(id) on delete set null;

with parsed_task_requests as (
  select task.id, substring(task.instructions from 'Request ID: ([0-9a-fA-F-]{36})')::uuid as parsed_request_id
  from public.manual_tasks task
  where task.provider = 'email-workflow'
    and task.request_id is null
    and substring(task.instructions from 'Request ID: ([0-9a-fA-F-]{36})') is not null
), valid_task_requests as (
  select parsed.id, parsed.parsed_request_id
  from parsed_task_requests parsed
  join public.requests request on request.id = parsed.parsed_request_id
)
update public.manual_tasks task
set request_id = valid.parsed_request_id
from valid_task_requests valid
where task.id = valid.id;

create index manual_tasks_request_id_status_idx on public.manual_tasks (request_id, status);

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
  reference_ids text[] not null default '{}',
  action_taken text not null check (action_taken in ('reply_sent', 'completion_indicated', 'no_match')),
  resulting_status public.request_status,
  created_at timestamptz not null default now()
);

create index sent_email_actions_request_id_idx on public.sent_email_actions (request_id);
create index sent_email_actions_in_reply_to_idx on public.sent_email_actions (in_reply_to);

alter table public.sent_email_actions enable row level security;

create policy "board can read sent email actions" on public.sent_email_actions for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "service inserts sent email actions" on public.sent_email_actions for insert with check (auth.role() = 'service_role');
