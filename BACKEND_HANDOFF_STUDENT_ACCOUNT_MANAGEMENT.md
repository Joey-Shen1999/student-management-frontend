# Backend Handoff: Student Account Management

## Goal
Teacher/Admin can enter **Student Account Management** and perform:

1. View student account list
2. Reset student temporary password
3. Toggle student account active status (`ACTIVE` / `ARCHIVED`)

Archived student must not be able to log in until re-enabled.

## APIs Required

### 1) List student accounts

`GET /api/teacher/student-accounts`

Return either array or wrapped payload (`{ items: [] }` / `{ data: [] }`).

Each record should include:

```json
{
  "studentId": 1001,
  "username": "student1001",
  "displayName": "Student One",
  "email": "student1001@example.com",
  "status": "ACTIVE"
}
```

### 2) Reset student password

`POST /api/teacher/student-accounts/{studentId}/reset-password`

Request body: `{}`

Response:

```json
{
  "studentId": 1001,
  "username": "student1001",
  "tempPassword": "Ab12Cd34"
}
```

### 3) Update student account status

`PATCH /api/teacher/student-accounts/{studentId}/status`

Request:

```json
{ "status": "ARCHIVED" }
```

or

```json
{ "status": "ACTIVE" }
```

Response:

```json
{
  "studentId": 1001,
  "username": "student1001",
  "status": "ARCHIVED"
}
```

## Login Blocking Rule

`POST /api/auth/login`

If student account is `ARCHIVED`, reject login:

- HTTP `403` recommended
- code recommended: `ACCOUNT_ARCHIVED`
- message: `This account has been archived. Please contact an admin to enable it.`

## Auth & Permission

- All student-management APIs require auth token
- Teacher and Admin can access student-management APIs
- Student role should be forbidden (`403`)

## Data Model Tasks

1. Ensure student account has status enum: `ACTIVE | ARCHIVED`
2. Default new student status = `ACTIVE`
3. Backfill historical student accounts to `ACTIVE`

## Seed Data (Requested)

Please insert several student accounts for demo/testing.

Example SQL (adjust table/column names to backend schema):

```sql
-- users table assumed to hold login identity
INSERT INTO users (username, password_hash, role, status)
VALUES
  ('student_demo_01', '$2a$10$replace_me', 'STUDENT', 'ACTIVE'),
  ('student_demo_02', '$2a$10$replace_me', 'STUDENT', 'ACTIVE'),
  ('student_demo_03', '$2a$10$replace_me', 'STUDENT', 'ARCHIVED');

-- students profile table assumed to reference users.id
-- replace user_id mapping by your actual DB constraints
INSERT INTO students (user_id, display_name, email)
VALUES
  ((SELECT id FROM users WHERE username = 'student_demo_01'), 'Student Demo 01', 'student01@example.com'),
  ((SELECT id FROM users WHERE username = 'student_demo_02'), 'Student Demo 02', 'student02@example.com'),
  ((SELECT id FROM users WHERE username = 'student_demo_03'), 'Student Demo 03', 'student03@example.com');
```

## Acceptance Checklist

1. Teacher can open `/teacher/students` and see list.
2. Teacher can reset a student's password and receive temp password.
3. Teacher can set student to `ARCHIVED` and list reflects state.
4. Archived student login fails with archived error.
5. Teacher can set same student back to `ACTIVE` and login works again.
