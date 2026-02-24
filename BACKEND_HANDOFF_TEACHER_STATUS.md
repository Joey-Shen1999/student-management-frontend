# Backend Handoff: Teacher Account Active/Archive

## Context
The Teacher Management page now uses an **Active** toggle as both display and action.

- Toggle ON means account status = `ACTIVE`
- Toggle OFF means account status = `ARCHIVED`
- Archived account must not be able to log in
- Admin can re-enable by setting status back to `ACTIVE`

## Required Backend APIs

### 1) List teacher accounts

`GET /api/teacher/accounts`

Return each teacher with status data.

Preferred response field:

```json
{
  "teacherId": 101,
  "username": "teacher101",
  "role": "TEACHER",
  "status": "ACTIVE"
}
```

Frontend can temporarily read fallback fields (`accountStatus`, `userStatus`, `archived`, `active`, `enabled`, `disabled`), but backend should standardize on `status`.

### 2) Update teacher account status

`PATCH /api/teacher/accounts/{teacherId}/status`

- Auth: admin only
- Request body:

```json
{ "status": "ACTIVE" }
```

or

```json
{ "status": "ARCHIVED" }
```

- Success response (`200`):

```json
{
  "teacherId": 101,
  "username": "teacher101",
  "status": "ARCHIVED"
}
```

- Error responses:
  - `401` unauthenticated
  - `403` forbidden (not admin)
  - `404` teacher account not found
  - `400` invalid status

Recommended error payload format:

```json
{
  "status": 400,
  "code": "BAD_REQUEST",
  "message": "Invalid account status. Expected ACTIVE or ARCHIVED."
}
```

### 3) Login block for archived accounts

`POST /api/auth/login`

If account status is `ARCHIVED`:

- Reject login (recommended `403`)
- Do **not** issue tokens
- Return code:
  - preferred: `ACCOUNT_ARCHIVED`
  - accepted by frontend: `ACCOUNT_ARCHIVED`, `USER_ARCHIVED`, `TEACHER_ARCHIVED`

Recommended response:

```json
{
  "status": 403,
  "code": "ACCOUNT_ARCHIVED",
  "message": "This account has been archived. Please contact an admin to enable it."
}
```

## Data Model Tasks

1. Add account status field (example: enum `ACTIVE` / `ARCHIVED`).
2. Set default = `ACTIVE`.
3. Backfill existing teacher/admin accounts to `ACTIVE`.
4. Optional but recommended audit fields:
   - `statusUpdatedAt`
   - `statusUpdatedBy`

## Permission and Business Rules

1. Only admin can change teacher status.
2. Archived account cannot log in.
3. Re-enabled account can log in immediately.

## Backend Acceptance Checklist

1. Admin archives a teacher via `PATCH /status` and list shows `ARCHIVED`.
2. Archived teacher login fails with archived error code.
3. Admin enables same teacher and list shows `ACTIVE`.
4. Teacher can log in again.
5. Non-admin calling `PATCH /status` gets `403`.

## Frontend Integration Note

For this iteration, limit/filter/search is handled in frontend. Backend does not need to add list query params yet.
