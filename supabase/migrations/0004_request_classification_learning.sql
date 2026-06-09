alter table public.requests
add column category_confidence numeric(4, 3) not null default 0,
add column categorization_note text not null default '',
add column needs_category_review boolean not null default false;

create table public.request_classification_feedback (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete set null,
  from_category public.request_category not null,
  to_category public.request_category not null,
  from_priority public.request_priority not null,
  to_priority public.request_priority not null,
  from_action_needed public.request_action_needed not null,
  to_action_needed public.request_action_needed not null,
  subject text not null,
  sanitized_body text not null default '',
  tokens text[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.request_classification_feedback enable row level security;

create policy "board can read classification feedback" on public.request_classification_feedback for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "service manages classification feedback" on public.request_classification_feedback for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
