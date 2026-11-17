-- Jazba: занятия ментора и ограничение частоты генерации.
--
-- Доступ к таблицам — только с сервера приложения по ключу service role
-- (он обходит RLS). RLS включён без политик: по публичному anon-ключу
-- ни прочитать, ни изменить данные нельзя.

-- ---------------------------------------------------------------------
-- Занятия
-- ---------------------------------------------------------------------
create table if not exists public.lessons (
  -- Секретный ID редактора (32 символа base64url) и публичный slug для студентов
  edit_id            text primary key check (edit_id ~ '^[A-Za-z0-9_-]{32}$'),
  slug               text not null unique check (slug ~ '^[a-z0-9]{10}$'),
  status             text not null default 'draft' check (status in ('draft', 'published')),
  materials          jsonb not null,
  transcript         text not null,              -- обезличенный транскрипт
  recording_url      text,
  language           text not null check (language in ('ru', 'kk')),
  mock               boolean not null default false,
  started_at         timestamptz not null,       -- ментор загрузил транскрипт
  created_at         timestamptz not null default now(),
  generated_at       timestamptz not null,
  updated_at         timestamptz not null default now(),
  published_at       timestamptz,
  first_published_at timestamptz,
  prep_duration_ms   bigint check (prep_duration_ms is null or prep_duration_ms >= 0)
);

create index if not exists lessons_created_at_idx on public.lessons (created_at desc);

alter table public.lessons enable row level security;
revoke all on table public.lessons from anon, authenticated;

-- ---------------------------------------------------------------------
-- Ограничение частоты (rate limit) — общее для всех серверных экземпляров
-- ---------------------------------------------------------------------
create table if not exists public.rate_limit_events (
  id         bigint generated always as identity primary key,
  key        text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_key_created_idx
  on public.rate_limit_events (key, created_at desc);

alter table public.rate_limit_events enable row level security;
revoke all on table public.rate_limit_events from anon, authenticated;

-- Атомарно: если за последние p_window_seconds по ключу меньше p_limit событий —
-- записывает новое и возвращает true; иначе возвращает false.
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  -- Сериализуем параллельные вызовы с одним ключом
  perform pg_advisory_xact_lock(hashtext(p_key));

  -- Подчищаем старые записи этого ключа
  delete from public.rate_limit_events
   where key = p_key and created_at < now() - make_interval(secs => p_window_seconds * 2);

  select count(*) into recent
    from public.rate_limit_events
   where key = p_key and created_at > now() - make_interval(secs => p_window_seconds);

  if recent >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_events (key) values (p_key);
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
