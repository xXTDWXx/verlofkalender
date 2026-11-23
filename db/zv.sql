-- Applied migration: add_zv_105_days_2027.
-- ZV is a separate allowance in days, for 2027 only.
alter table public.entries add column days numeric(6,2);
alter table public.entries drop constraint entries_entry_type_check;
alter table public.entries add constraint entries_entry_type_check
  check (entry_type in ('leave', 'overtime', 'vov', 'zv'));
alter table public.entries drop constraint entries_hours_check;
alter table public.entries add constraint entries_hours_check
  check (
    (entry_type = 'zv' and hours = 0 and days is not null and days > 0 and days <= 1)
    or (entry_type <> 'zv' and hours > 0 and days is null)
  );
alter table public.entries add constraint entries_zv_date_check
  check (entry_type <> 'zv' or entry_date between date '2027-01-01' and date '2027-12-31');

create or replace function public.check_zv_allowance()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  used_days numeric;
  day_used numeric;
begin
  if new.entry_type = 'zv' then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 1052027));
    select coalesce(sum(e.days), 0),
           coalesce(sum(e.days) filter (where e.entry_date = new.entry_date), 0)
      into used_days, day_used
      from public.entries e
      where e.user_id = new.user_id and e.entry_type = 'zv' and e.id <> new.id;
    if used_days + new.days > 105 then
      raise exception 'ZV: maximaal 105 dagen voor 2027.' using errcode = '23514';
    end if;
    if day_used + new.days > 1 then
      raise exception 'ZV: maximaal 1 dag per kalenderdag.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

create trigger entries_check_zv_allowance
  before insert or update on public.entries
  for each row execute function public.check_zv_allowance();
