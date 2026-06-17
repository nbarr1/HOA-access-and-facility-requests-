create table if not exists public.request_categorization_rules (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('priority', 'category')),
  label text not null,
  pattern text not null,
  category public.request_category,
  priority public.request_priority,
  action_needed public.request_action_needed,
  is_active boolean not null default true,
  notes text not null default '',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_rule_has_category check (kind <> 'category' or category is not null),
  constraint priority_rule_has_priority check (kind <> 'priority' or priority is not null)
);

alter table public.request_categorization_rules enable row level security;

create policy "board can read categorization rules" on public.request_categorization_rules
for select using (public.current_app_role() in ('board_admin', 'board_member'));

create policy "admins manage categorization rules" on public.request_categorization_rules
for all using (public.current_app_role() = 'board_admin') with check (public.current_app_role() = 'board_admin');

create policy "service manages categorization rules" on public.request_categorization_rules
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into public.request_categorization_rules (kind, label, pattern, category, priority, action_needed, notes, sort_order) values
('priority', 'Urgent safety/access emergency', 'flood|fire|injur|broken gate|no access|locked out|security|emergency', null, 'urgent', 'emergency_response', 'Moves emergencies to the top of the queue.', 10),
('priority', 'High operational issue', 'pool closed|leak|gate|access|tennis|clubhouse|repair', null, 'high', null, 'Important operating issues that should be reviewed quickly.', 20),
('priority', 'Low informational message', 'fyi|newsletter|notice', null, 'low', null, 'Informational messages can be handled after active requests.', 30),
('category', 'Invoice and billing', 'invoice|bill|payment due|remittance', 'invoice', null, 'invoice_review', 'Routes payment documents to invoice review.', 40),
('category', 'Vendor communication', 'proposal|quote|vendor|contractor|w-9', 'vendor', null, 'vendor_follow_up', 'Routes vendor paperwork and proposals.', 50),
('category', 'Facility repair', 'pool|tennis|clubhouse|light|gate|landscap|repair|leak|broken', 'facilities', null, 'facility_repair', 'Routes common amenity and repair issues.', 60),
('category', 'Access credentials', 'access|key|fob|credential|gate code|locked out', 'access', null, 'access_follow_up', 'Routes resident access and credential issues.', 70)
on conflict do nothing;
