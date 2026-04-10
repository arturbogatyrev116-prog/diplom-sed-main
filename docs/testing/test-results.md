## Test Results — шаблон (для диплома)

### Условия
- Дата/время: `YYYY-MM-DD HH:MM`
- Версия прототипа: (указать commit/tag вручную)
- Среда: Windows / Node / Браузер
- Режим: для headers/CSP — `npm run build` + `npm run start`
- Ограничение rate limiting (MVP): **in-memory**, **single-instance**, сброс после рестарта процесса

---

## Таблица результатов

| Test ID | Expected | Actual | Status | Notes |
|--------:|----------|--------|--------|------|
| AUTH-01 | Успешный вход, событие `LOGIN_SUCCESS` появляется в `/audit` | (заполнить) | (passed/failed) | |
| SEC-01  | Secure headers присутствуют в production Response Headers | (заполнить) | (passed/failed) | |

---

## Пример заполнения (2 строки)

| Test ID | Expected | Actual | Status | Notes |
|--------:|----------|--------|--------|------|
| AUTH-02 | Logout: редирект на `/login`, `LOGOUT_SUCCESS` появляется в `/audit` | После нажатия «Выйти» редирект на `/login`; в `/audit` появилась запись `LOGOUT_SUCCESS` | passed | Проверено в Chrome |
| DOC-04  | Edit DRAFT: `currentVersion` увеличивается; `DOCUMENT_UPDATED` появляется в `/audit` | После сохранения `currentVersion` вырос с 1 до 2; в `/audit` появилась запись `DOCUMENT_UPDATED` с `versionNumber:2` | passed | |

