create type public.vantaca_review_status as enum ('pending', 'approved', 'ignored', 'error');

create table public.vantaca_balance_reviews (
  id uuid primary key default gen_random_uuid(),
  import_key text not null unique,
  external_billing_id text,
  unit_address text,
  resident_name text,
  email text,
  balance numeric(12, 2) not null default 0,
  dues_status public.dues_status not null,
  balance_reference text not null default '',
  source text not null default 'manual-import',
  matched_resident_id uuid references public.residents(id),
  status public.vantaca_review_status not null default 'pending',
  error_message text,
  imported_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

alter table public.vantaca_balance_reviews enable row level security;

create policy "board can read vantaca reviews" on public.vantaca_balance_reviews for select using (public.current_app_role() in ('board_admin', 'board_member'));
create policy "board can update vantaca reviews" on public.vantaca_balance_reviews for update using (public.current_app_role() in ('board_admin', 'board_member')) with check (public.current_app_role() in ('board_admin', 'board_member'));
create policy "service inserts vantaca reviews" on public.vantaca_balance_reviews for insert with check (auth.role() = 'service_role');
create policy "service updates vantaca reviews" on public.vantaca_balance_reviews for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
