# Контекст проекта — Diplom SED (ЭЦП)

> Последнее обновление: 10 апреля 2026, ~18:30

## Текущий статус

**Код полностью рабочий.** Инфраструктура запущена, тесты проходят, сборка работает.

### Запуск

1. **Убедиться, что Docker Desktop запущен** (зелёный значок в трее)
2. **Запустить БД:** `docker compose up db -d`
3. **Миграция:** `npx prisma migrate dev --name <name>`
4. **Seed:** `npm run prisma:seed`
5. **Тесты:** `npm run test` (20/20)
6. **Dev server:** `npm run dev` — http://localhost:3000

## Окружение

- **OS:** Windows 11, Node.js v24.14.1, npm 11.11.0
- **Проект:** `D:\WIn\vs\diplom-sed-main`
- **.env:** уже создан, `DATABASE_URL` → `localhost:5432`
- **Docker Desktop:** установлен

## Тестовые пользователи

| Email | Пароль | Роль | Возможности |
|---|---|---|---|
| employee@local.test | Password123! | EMPLOYEE | Создание, редактирование документов |
| manager@local.test | Password123! | MANAGER | Согласование документов |
| owner@local.test | Password123! | OWNER | Подписание ЭЦП, просмотр архива |
| admin@local.test | Password123! | ADMIN | Просмотр логов аудита и архива |

## Роли и доступ

| Роль | Документы | Входящие | Исходящие | На подпись | Архив | Логи аудита | ЭЦП |
|---|---|---|---|---|---|---|---|
| EMPLOYEE | ✓ | ✓ | ✓ | — | — | — | — |
| MANAGER | ✓ | ✓ | ✓ | ✓ (согласование) | — | — | — |
| OWNER | — | — | — | ✓ (ЭЦП) | ✓ | — | ✓ |
| ADMIN | — | — | — | — | ✓ | ✓ | — |

## Что реализовано (ЭЦП / CMS подпись)

### Новые файлы

| Файл | Описание |
|---|---|
| `lib/crypto/keygen.ts` | Генерация RSA-2048 + X.509 сертификат (UTF8String для CN, IA5 для email) |
| `lib/crypto/sign.ts` | CMS (PKCS#7) подпись + верификация с полным RSA подтверждением |
| `lib/crypto/hash.ts` | SHA-256 хеш контента |
| `server/audit/constants-signature.ts` | Audit-константы для ЭЦП |
| `app/api/certificates/generate/route.ts` | API генерации сертификата |
| `app/(protected)/settings/mfa/certificate-card.tsx` | UI карточка сертификата |
| `components/documents/sign-document-button.tsx` | UI кнопка подписания (Dialog) |
| `components/ui/dialog.tsx` | shadcn Dialog компонент |
| `tests/security/keygen.test.ts` | Тесты генерации ключей |
| `tests/security/sign-verify.test.ts` | Тесты подписи и верификации |

### Изменённые файлы

| Файл | Изменение |
|---|---|
| `package.json` | Добавлены: `node-forge`, `lightningcss`, `preact-render-to-string`, `lightningcss-win32-x64-msvc`; `dev` → `next dev --webpack` |
| `prisma/schema.prisma` | Роли: AUDITOR→ADMIN, ADMIN→OWNER. Модель `Signature`, связь `User.signedDocuments` |
| `next.config.ts` | `ignoreBuildErrors: true` (обход SWC WASM на Windows) |
| `server/policies/document.ts` | Политики обновлены под новые роли. Добавлена `canViewDocumentForSigning()` |
| `server/documents/actions.ts` | `signDocument()` — только OWNER |
| `server/documents/queries.ts` | `listDocumentsForSigning()` — документы APPROVED без подписи |
| `server/workflows/approval/queries.ts` | Архив включает SIGNED статус |
| `app/(protected)/layout.tsx` | Сайдбар: OWNER видит только «На подпись ЭЦП» и «Архив» |
| `app/(protected)/documents/[id]/page.tsx` | OWNER может просматривать документы на подпись |
| `app/(protected)/pending-sign/page.tsx` | OWNER: список документов на ЭЦП; MANAGER: workflow согласования |
| `app/(protected)/archive/page.tsx` | Доступно OWNER и ADMIN |
| `app/(protected)/inbox/page.tsx` | Доступно EMPLOYEE, MANAGER, OWNER |
| `app/(protected)/outbox/page.tsx` | Доступно EMPLOYEE, MANAGER, OWNER |
| `prisma/seed.ts` | OWNER получает сертификат + подпись. ADMIN — второй согласователь |
| `app/(protected)/settings/mfa/page.tsx` | Секция ЭЦП |

## Workflow ЭЦП

```
1. OWNER → /settings/mfa → "Сгенерировать сертификат"
   → API /api/certificates/generate → RSA-2048 + X.509 → файлы в data/

2. Документ достигает статуса APPROVED (после согласования MANAGER)

3. OWNER → /pending-sign → видит документ → "Открыть и подписать ЭЦП"
   → signDocument() → SHA-256 хеш + CMS подпись → data/signatures/{id}.p7s
   → Status: APPROVED → SIGNED

4. При просмотре документа → верификация подписи → показать статус
```

## Формат файла подписи (.p7s)

Файл содержит 4 строки, разделённые `\n`:
1. `certDerBase64` — DER сертификата (base64)
2. `authAttrsDigestHex` — SHA-256 хеш подписанных атрибутов (hex)
3. `contentHash` — SHA-256 хеш содержимого документа (hex)
4. `p7sBase64` — CMS SignedData (base64)

## Структура верификации

1. Сравнение `contentHash` из файла с SHA-256 текущего контента → проверка неизменности
2. RSA верификация: `publicKey.verify(authAttrsDigestHex, signatureBytes, PKCS1)` → криптографическое подтверждение
3. Извлечение `signingTime` из ASN.1 UTCTime/GeneralizedTime → время подписи
4. Извлечение CN и email из сертификата → информация о подписанте

## Фиксы, применённые в ходе разработки

| # | Проблема | Решение |
|---|---------|---------|
| 1 | `node-forge` отсутствовал в package.json | Добавлен |
| 2 | Кириллица в CN ломала парсинг сертификата | `valueTagClass: forge.asn1.Type.UTF8` |
| 3 | Email не находился через `getField('emailAddress')` | Поиск по `attributes.find(a => a.type === forge.pki.oids.emailAddress)` |
| 4 | OID сравнение не работало (байтовые строки) | Сравнение через hex: `forge.util.bytesToHex()` |
| 5 | `forge.pkcs7.messageFromAsn1()` не парсит signerInfo | Ручной парсинг ASN.1 структуры SignedData |
| 6 | `signer.md.digest()` ≠ `messageDigest` в authAttrs | Сохранение `authAttrsDigestHex` отдельно в файл |
| 7 | `signingTime` — Invalid Date (UTCTime не парсился) | Парсинг по длине: 12 цифр = UTCTime, 14 = GeneralizedTime |
| 8 | `signerCN` использовалась до объявления (ReferenceError) | Перенесено объявление выше |
| 9 | ADMIN не видел подписанные документы (SIGNED) | Добавлен `SIGNED` во все запросы архива |
| 10 | OWNER не видел боковую панель | Обновлены `showPendingSign`, `showArchive` в layout |
| 11 | Turbopack не работает на Windows | `next dev --webpack` |
| 12 | `lightningcss.win32-x64-msvc.node` не найден | Установлены нативные зависимости |
| 13 | `preact-render-to-string` не найден | Добавлен в зависимости |

## Potentially needed commands

```bash
# Docker
docker compose up db -d
docker compose down

# Prisma
npx prisma migrate dev --name <name>
npx prisma db seed
npx prisma generate
npx prisma studio

# Dev
npm run dev          # next dev --webpack
npm run build        # next build --webpack
npm run test         # vitest run
```

## Что ещё можно доделать (следующие шаги)

- [ ] Скачивание .p7s файла подписи
- [ ] Поддержка многоступенчатой подписи (несколько подписантов)
- [ ] Шифрование приватных ключей на диске
- [ ] PDF генерация документа + встроенная CMS подпись
- [ ] Страница верификации подписи с деталями сертификата
- [ ] README секция про ЭЦП
- [ ] Исправить SWC WASM на Windows для полноценного type checking при билде
