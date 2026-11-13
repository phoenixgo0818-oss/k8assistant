-- =============================================================================
-- K8assistant — Phase 3.2 (revised): to-dos become dated events on the board
--
-- An optional time of day, so "Tech call 14:00" and "Send prep pack" (any
-- time that day) sort correctly in the upcoming list. No time = all day.
-- =============================================================================
alter table public.todos add column due_time time;

-- A time only makes sense on a day
alter table public.todos add constraint todos_time_needs_date check (due_time is null or due_date is not null);
