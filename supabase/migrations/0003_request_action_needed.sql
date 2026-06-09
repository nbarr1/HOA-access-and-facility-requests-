create type public.request_action_needed as enum (
  'emergency_response',
  'access_follow_up',
  'facility_repair',
  'vendor_follow_up',
  'invoice_review',
  'board_review'
);

alter table public.requests
add column action_needed public.request_action_needed not null default 'board_review';
