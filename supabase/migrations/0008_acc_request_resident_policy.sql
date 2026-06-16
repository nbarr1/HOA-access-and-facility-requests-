create or replace function public.current_user_owns_resident(resident uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select resident is null or exists (
    select 1
    from public.residents r
    where r.id = resident
      and lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

drop policy if exists "residents can submit their acc requests" on public.acc_requests;

create policy "residents can submit their acc requests" on public.acc_requests
  for insert
  with check (submitted_by = auth.uid() and public.current_user_owns_resident(resident_id));
