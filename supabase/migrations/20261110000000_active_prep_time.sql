-- Jazba: активное время подготовки занятия (см. lib/active-time.ts).
-- Копится до первой публикации; null — занятие создано до появления этого учёта.
alter table public.lessons add column if not exists
  active_prep_ms bigint check (active_prep_ms is null or active_prep_ms >= 0);
