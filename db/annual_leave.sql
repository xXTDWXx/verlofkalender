alter table public.organizations
  add column annual_leave_hours numeric check (annual_leave_hours >= 0);
