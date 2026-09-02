revoke insert on table public.incidents from authenticated;
drop policy if exists incidents_insert on public.incidents;
