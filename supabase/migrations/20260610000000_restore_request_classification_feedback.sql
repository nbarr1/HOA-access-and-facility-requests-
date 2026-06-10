-- Remedial migration for production projects where the learning table is absent
-- even though later application code expects it. This migration creates new
-- objects only; it does not alter any existing HOA access-management tables.

create table if not exists public.request_classification_feedback (
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

create index if not exists request_classification_feedback_created_at_idx
  on public.request_classification_feedback (created_at desc);

create index if not exists request_classification_feedback_request_id_idx
  on public.request_classification_feedback (request_id);

create index if not exists request_classification_feedback_tokens_idx
  on public.request_classification_feedback using gin (tokens);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'request_classification_feedback'
      and policyname = 'board can read classification feedback'
  ) then
    create policy "board can read classification feedback"
      on public.request_classification_feedback
      for select
      using (public.current_app_role() in ('board_admin', 'board_member'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'request_classification_feedback'
      and policyname = 'service manages classification feedback'
  ) then
    create policy "service manages classification feedback"
      on public.request_classification_feedback
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

notify pgrst, 'reload schema';
