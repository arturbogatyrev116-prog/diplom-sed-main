# Diplom SED (прототип)

Прототип защищённой автоматизированной информационной системы электронного документооборота (СЭД) для дипломной работы.

На **Этапе 1** реализован только scaffold проекта, инфраструктура для PostgreSQL (Docker) и визуальные страницы-заглушки (`/login`, `/dashboard`) без реальной безопасности и бизнес-логики.

## Требования

- Node.js: **20 LTS+**
- npm: **9+**
- Docker Desktop (для запуска через compose)

## Локальный запуск (без Docker)

1) Установить зависимости:

```bash
npm install
```

2) Создать `.env` на основе `.env.example`:

```bash
copy .env.example .env
```

3) Запустить dev server:

```bash
npm run dev
```

Открыть:
- `http://localhost:3000` (редиректит на `/login`)
- `http://localhost:3000/api/health`

## Запуск через Docker Compose

```bash
docker compose up --build
```

Открыть:
- `http://localhost:3000`

## Полезные команды

```bash
npm run lint
npm run build
npm start
```

## Структура проекта (кратко)

```text
app/
  (auth)/login/              # UI-заглушка страницы входа
  (protected)/dashboard/      # визуальный каркас dashboard (placeholder)
  api/health/                 # минимальный health-check
prisma/
  schema.prisma               # только generator+datasource (без моделей на Этапе 1)
docker-compose.yml            # web + postgres
Dockerfile                    # production build (standalone)
.env.example                  # пример переменных окружения без секретов
```

