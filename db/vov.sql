-- VOV is one personal allowance across all organizations and both calendar years.
alter table public.entries drop constraint entries_entry_type_check;
alter table public.entries add constraint entries_entry_type_check
  check (entry_type in ('leave', 'overtime', 'vov'));
alter table public.entries add constraint entries_vov_date_check
  check (entry_type <> 'vov' or entry_date between date '2026-09-21' and date '2027-06-30');

create function public.check_vov_allowance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare used_hours numeric;
begin
  if new.entry_type = 'vov' then
    -- Serialize VOV writes for the same account, including different organizations.
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 120));
    select coalesce(sum(e.hours), 0) into used_hours
      from public.entries e
      where e.user_id = new.user_id
        and e.entry_type = 'vov'
        and e.id <> new.id;
    if used_hours + new.hours > 120 then
      raise exception 'VOV: maximaal 120 uur voor de volledige opleidingsperiode.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.check_vov_allowance() from public, anon, authenticated;
create trigger entries_check_vov_allowance
  before insert or update on public.entries
  for each row execute function public.check_vov_allowance();

