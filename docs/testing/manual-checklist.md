## Manual checklist (быстрая демонстрация)

### Подготовка (production-mode для headers/CSP)
- `npm run build`
- `npm run start`
- Открыть приложение в браузере

---

### 1) Login / Logout
- [ ] **Login**: войти тестовым пользователем → попадаем на `/dashboard`
- [ ] **Logout**: нажать «Выйти» → редирект на `/login`

---

### 2) MFA
- [ ] Открыть `/settings/mfa`
- [ ] Сгенерировать секрет, подтвердить валидным кодом → MFA включена

---

### 3) Documents
- [ ] `/documents`: отображается список документов текущего пользователя
- [ ] `/documents/new`: создать документ → открыть `/documents/[id]`
- [ ] `/documents/[id]`: просмотр документа (контент, версии)
- [ ] `/documents/[id]/edit`: отредактировать DRAFT → версия увеличилась

---

### 4) Access control
- [ ] Попытка открыть чужой документ `/documents/[foreignId]` → 404-safe
- [ ] Попытка открыть `/audit` под EMPLOYEE/MANAGER → 404-safe
- [ ] Под AUDITOR `/documents/new` → 404-safe (и создание недоступно)

---

### 5) Audit log
- [ ] Под ADMIN/AUDITOR открыть `/audit` → видны события
- [ ] После действий появляются события (достаточно факта появления):
  - `LOGIN_SUCCESS`
  - `LOGOUT_SUCCESS`
  - `MFA_ENABLED`
  - `DOCUMENT_CREATED`
  - `DOCUMENT_UPDATED`
  - `DOCUMENT_VIEWED`
  - `DOCUMENT_*_DENIED` (если были попытки запрещённых действий)

---

### 6) Secure headers / CSP
- [ ] DevTools → Network → Response Headers:
  - secure headers присутствуют
  - CSP есть (в production) и UI не ломается (нет критичных CSP ошибок)

---

### 7) Rate limiting
- [ ] Сделать 20+ POST запросов на один из:
  - `/api/auth/callback/credentials`
  - `/api/mfa/setup`
  - `/api/mfa/confirm`
- [ ] Получить `429` + `Retry-After`

