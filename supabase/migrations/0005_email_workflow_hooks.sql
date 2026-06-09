alter table public.requests
add column inbound_source text not null default 'email-webhook',
add column external_message_id text,
add column workflow_started_at timestamptz;

create unique index requests_external_message_id_idx
on public.requests (external_message_id)
where external_message_id is not null;
