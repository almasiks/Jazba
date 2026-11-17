# Jazba

ИИ-помощник ментора Tech Orda: из транскрипта занятия — в конспект, тест, домашнее задание, FAQ и глоссарий. Описание проекта — в [PROJECT.MD](PROJECT.MD).

- [Запуск на своём компьютере](#запуск-на-своём-компьютере)
- [Деплой в интернет: Supabase + Vercel (пошагово)](#деплой-в-интернет-supabase--vercel)
- [Как проверить](#как-проверить)
- [Безопасность](#безопасность)
- [Структура проекта](#структура-проекта)

## Запуск на своём компьютере

Нужен Node.js 22+.

```bash
npm install
cp .env.example .env.local   # впишите AI_PROVIDER и AI_API_KEY (или оставьте демо-режим)
npm run dev                  # http://localhost:3000
npm test                     # тесты
```

По умолчанию локально:

- занятия хранятся в файлах `data/lessons/<editId>.json` (`STORAGE=local`, папка в .gitignore);
- если `MENTOR_PASSWORD` не задан, страницы ментора открыты без входа (только при `npm run dev`).

**ИИ: OpenAI, Gemini или OpenRouter.** `AI_PROVIDER=openai` (по умолчанию), `gemini` или `openrouter`, ключ — в `AI_API_KEY`, модель — в `AI_MODEL` (по умолчанию `gpt-5-mini` / `gemini-3.8-flash`). Ключ Gemini бесплатно выдаёт [Google AI Studio](https://aistudio.google.com/apikey) — он начинается с `AIza`. Ключ [OpenRouter](https://openrouter.ai/keys) начинается с `sk-or-`; с ним провайдер выбирается автоматически, а модель пишется с владельцем (`google/gemini-3.8-flash`, `openai/gpt-5-mini` — по умолчанию; `gemini-…` и `gpt-…` дополняются сами). Старые `OPENAI_API_KEY` и `OPENAI_MODEL` тоже работают.

**Демо-режим без ИИ.** Если ключа нет или стоит `MOCK_GENERATION=true`, ИИ не вызывается — для любого транскрипта создаётся занятие с готовыми материалами из `samples/mock-materials.json`. В интерфейсе видна плашка «Демо-режим: без ИИ». Удобно для показа и проверки без трат.

---

## Деплой в интернет: Supabase + Vercel

Займёт около 30 минут. Понадобятся: аккаунт GitHub, ключ OpenAI или Gemini (можно позже — сначала задеплоить в демо-режиме).

### Шаг 1. Создайте базу в Supabase

1. Зайдите на [supabase.com](https://supabase.com) → **Start your project** → войдите через GitHub.
2. **New project**:
   - *Name* — `jazba`;
   - *Database Password* — нажмите **Generate a password** и сохраните его в менеджер паролей (для приложения он не нужен, но пригодится для администрирования);
   - *Region* — ближайший к Казахстану, например **Central EU (Frankfurt)**;
   - **Create new project** и подождите 1–2 минуты.

### Шаг 2. Примените миграцию (создайте таблицы)

1. В левом меню откройте **SQL Editor** → **New query**.
2. Откройте в проекте файл [`supabase/migrations/20261109000000_lessons.sql`](supabase/migrations/20261109000000_lessons.sql), скопируйте его **целиком** и вставьте в редактор.
3. Нажмите **Run**. Должно появиться *Success. No rows returned*.
4. Так же, новым запросом, выполните [`supabase/migrations/20261110000000_active_prep_time.sql`](supabase/migrations/20261110000000_active_prep_time.sql) — колонка для активного времени подготовки. **Если база уже была создана раньше, выполните только этот файл.**
5. Проверьте: в **Table Editor** появились таблицы `lessons` (с колонкой `active_prep_ms`) и `rate_limit_events`.

> Если пользуетесь Supabase CLI: `supabase link --project-ref <ref>` и `supabase db push` — результат тот же.

### Шаг 3. Скопируйте адрес и секретный ключ Supabase

1. **Project Settings** (шестерёнка внизу слева) → **Data API** → скопируйте **Project URL** (вида `https://abcdefgh.supabase.co`) — это `SUPABASE_URL`.
2. **Project Settings** → **API Keys** → скопируйте **секретный ключ**: *Secret key* (`sb_secret_…`), а в старых проектах — *service_role* на вкладке *Legacy API Keys*. Это `SUPABASE_SERVICE_ROLE_KEY`.

> ⚠️ Секретный ключ даёт полный доступ к базе. Не публикуйте его, не отправляйте в чаты, не называйте переменную `NEXT_PUBLIC_…` (приложение откажется так работать). *Publishable / anon*-ключ приложению не нужен.

### Шаг 4. Загрузите код на GitHub

```bash
git init
git add .
git commit -m "Jazba"
```

Создайте пустой **приватный** репозиторий на [github.com/new](https://github.com/new) и выполните команды, которые GitHub покажет в разделе *…or push an existing repository* (`git remote add origin …` и `git push -u origin main`).

Перед `git add` убедитесь, что `.env.local` и `data/` не попадут в репозиторий: `git status` не должен их показывать (они в `.gitignore`).

### Шаг 5. Задеплойте на Vercel

1. Зайдите на [vercel.com](https://vercel.com) → войдите через GitHub.
2. **Add New… → Project** → найдите репозиторий → **Import**.
3. *Framework Preset* определится сам (**Next.js**), остальное не трогайте.
4. Раскройте **Environment Variables** и добавьте переменные из таблицы ниже.
5. **Deploy**. Через 1–2 минуты получите адрес вида `https://jazba-xxx.vercel.app`.

| Переменная | Значение | Обязательна |
|---|---|---|
| `STORAGE` | `supabase` | да |
| `SUPABASE_URL` | Project URL из шага 3 | да |
| `SUPABASE_SERVICE_ROLE_KEY` | секретный ключ из шага 3 | да |
| `MENTOR_PASSWORD` | придумайте длинный пароль (12+ символов) — его вы дадите менторам | да |
| `SESSION_SECRET` | случайная строка: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | рекомендуется |
| `AI_PROVIDER` | `openai`, `gemini` или `openrouter` | для ИИ |
| `AI_API_KEY` | ключ OpenAI ([platform.openai.com/api-keys](https://platform.openai.com/api-keys)) или Gemini ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) | для ИИ |
| `AI_MODEL` | необязательно: по умолчанию `gpt-5-mini` / `gemini-3.8-flash` | для ИИ |
| `MOCK_GENERATION` | `true` — демо без трат; `false` — настоящий ИИ | нет |
| `GENERATION_LIMIT_PER_HOUR` | общий лимит генераций в час (по умолчанию 30) | нет |
| `GENERATION_LIMIT_PER_MINUTE` | лимит с одного IP в минуту (по умолчанию 3) | нет |

> Без `MENTOR_PASSWORD` в продакшене страницы ментора закрыты совсем — это защита от случайно открытого доступа.

**Изменили переменные?** Vercel применяет их только к новым деплоям: **Deployments** → у последнего **⋯ → Redeploy**.

**Обновили код?** `git push` — Vercel сам соберёт и выкатит новую версию.

### Шаг 6. Проверьте, что всё работает

1. Откройте адрес сайта → вас перекинет на **«Вход для ментора»** → введите `MENTOR_PASSWORD`.
2. Создайте занятие из примера .vtt (см. [Как проверить](#как-проверить)) → откроется редактор.
3. В Supabase → **Table Editor → lessons** появилась строка — значит, база подключена.
4. Опубликуйте занятие, откройте ссылку для студентов **в режиме инкогнито или с телефона** — она должна открыться без пароля.
5. Включите ИИ: задайте `AI_PROVIDER`, `AI_API_KEY`, `MOCK_GENERATION=false` → Redeploy → сгенерируйте занятие из своего транскрипта.
6. В [OpenAI → Limits](https://platform.openai.com/settings/organization/limits) поставьте месячный лимит расходов — вторая линия защиты баланса.

### Если что-то не так

| Симптом | Причина и решение |
|---|---|
| «Вход не настроен: … MENTOR_PASSWORD» | Не задан `MENTOR_PASSWORD` → добавьте и сделайте Redeploy |
| «Не удалось … ошибка базы данных» | Не применена миграция (шаг 2) или неверный `SUPABASE_URL` / ключ. Подробности — Vercel → проект → **Logs** |
| «На Vercel нельзя хранить занятия в файлах» | Задайте `STORAGE=supabase` и ключи Supabase |
| «Ключ OpenAI/Gemini/OpenRouter недействителен» | Проверьте `AI_API_KEY` и `AI_PROVIDER`, затем Redeploy |
| «Достигнут лимит генераций» | Сработала защита баланса. Подождите или увеличьте `GENERATION_LIMIT_PER_HOUR` |
| Плашка «Демо-режим» не исчезает | Нет `AI_API_KEY` или `MOCK_GENERATION=true` → исправьте и Redeploy |

---

## Как проверить

1. **Новое занятие:** вкладка «Загрузить .vtt из Zoom» → «Загрузить пример .vtt» → выберите «Ерлан Сапаров» → вставьте ссылку YouTube → «Сгенерировать». Занятие сохранится черновиком, и откроется редактор.
2. **Редактор** (`/lessons/<editId>`): правьте любой блок, добавляйте, удаляйте, двигайте элементы — сверху «Сохранено». Сотрите текст варианта ответа — появится список ошибок, сохранение остановится. «Перегенерировать» меняет только текущий блок.
3. **Публикация:** «Опубликовать» → «Скопировать ссылку для студентов». Появится «Материалы подготовлены за N мин».
4. **Студент** (`/s/<slug>`): откройте ссылку (можно с телефона). После ответа в тесте — объяснение, при ошибке — «Пересмотри с мм:сс», в конце — итог и темы для повторения. До публикации — «Материалы пока не опубликованы».
5. **PDF:** «Скачать PDF» у студента или «PDF: Для студентов / Для ментора» в редакторе → «Сохранить как PDF».
6. **Список** (`/lessons`): все занятия со статусами и временем подготовки.

Интеграционные тесты хранилища на настоящем Supabase (по желанию, на **отдельном тестовом** проекте с применённой миграцией):

```bash
SUPABASE_TEST_URL=https://….supabase.co SUPABASE_TEST_SERVICE_ROLE_KEY=sb_secret_… npm test
```

## Безопасность

- **Ментор** входит по общему паролю `MENTOR_PASSWORD`; сессия — подписанная httpOnly-cookie на 30 дней. Смена пароля (или `SESSION_SECRET`) разлогинивает всех. Вход ограничен 10 попытками за 15 минут с одного IP.
- **Студенты** открывают `/s/<slug>` без входа и видят только опубликованные материалы — без транскрипта, имён и критериев проверки.
- **Две ссылки на занятие:** `editId` (32 символа) открывает редактор и требует входа; `slug` (10 символов) — для студентов. По slug редактор не открыть.
- **Ключ Supabase service role** читается только на сервере (`lib/server/*` с `import "server-only"`), в браузерный код не попадает. В базе включён RLS без политик: по публичному anon-ключу таблицы недоступны.
- **Баланс OpenAI** защищён лимитами генерации (общий в час и на IP в минуту, хранятся в Supabase — общие для всех серверов Vercel) и месячным лимитом в кабинете OpenAI.

## Структура проекта

```
app/(mentor)/                — страницы ментора: новое занятие, /lessons, редактор
app/s/[slug]/page.tsx        — страница студента (открыта)
app/login/page.tsx           — вход ментора
app/api/                     — generate, lessons/[editId] (сохранение, публикация, перегенерация), login, logout
proxy.ts                     — вход ментора и 404 для ID неверного формата (правила — lib/access-rules.ts)
lib/server/                  — только сервер: хранилище, Supabase-клиент, проверки доступа
lib/storage.ts               — интерфейс LessonStorage + JSON-файлы
lib/storage-supabase.ts      — LessonStorage на Supabase
lib/config.ts                — переменные окружения: STORAGE, Supabase, пароль, лимиты
lib/auth.ts                  — сессия ментора (подписанная cookie)
lib/rate-limit.ts            — ограничение частоты (память / Supabase)
lib/schema.ts                — zod-схемы: ответ модели, редактор, занятие
lib/lessons.ts               — доступ ментора/студента, публикация, метрика
lib/generation.ts, prompts.ts, mock.ts — генерация, промпты, демо-режим
lib/vtt.ts, timecode.ts, recording.ts  — .vtt, таймкоды, ссылки на запись
components/                  — форма, редактор, страница студента, печать (PDF)
supabase/migrations/         — SQL-миграции
samples/                     — тестовые транскрипты (.txt, .vtt) и mock-materials.json
```
