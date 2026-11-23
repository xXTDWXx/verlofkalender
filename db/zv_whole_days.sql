alter table public.entries add constraint entries_zv_whole_day_check
  check (entry_type <> 'zv' or days = 1);
