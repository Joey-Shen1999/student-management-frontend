# Backend Handoff: Teacher Internal Note (Student Hidden)

## Document Info

- Date: 2026-03-23
- Frontend project: `student-management-frontend`
- Feature: Student Management Teacher-Only Note

## Goal

在学生管理中新增“教师内部备注”能力：

1. 教师可直接输入并保存备注（字符串文本，可较长）。
2. 同一学生的不同教师看到同一份备注（共享视图）。
3. 学生端绝对不可见该备注。

## Frontend Contract (Already Implemented)

Frontend currently reads/writes note through teacher profile APIs:

1. Read:
   - `GET /api/teacher/students/{studentId}/profile`
2. Save:
   - `PUT /api/teacher/students/{studentId}/profile`
3. Field used by frontend on save:
   - `teacherNote` (string)

Notes:

- Frontend may read note from compatibility keys (`teacherNote`, `teacherNotes`, `note`, `remark`, `remarks`, `internalNote`), but write only `teacherNote`.
- UI is a textarea in teacher page (`/teacher/students`) and is intended for internal communication only.

## Required Backend Behavior

### 1) Teacher Profile API: include internal note

`GET /api/teacher/students/{studentId}/profile`

Response should include:

```json
{
  "profile": {
    "legalFirstName": "Jane",
    "legalLastName": "Doe",
    "teacherNote": "Needs transcript follow-up in April."
  }
}
```

### 2) Teacher Profile API: persist internal note

`PUT /api/teacher/students/{studentId}/profile`

Request example:

```json
{
  "legalFirstName": "Jane",
  "legalLastName": "Doe",
  "teacherNote": "Needs transcript follow-up in April."
}
```

Response should return persisted value:

```json
{
  "profile": {
    "teacherNote": "Needs transcript follow-up in April."
  }
}
```

### 3) Student APIs must never expose internal note

`GET /api/student/profile`:

- Must NOT return `teacherNote` (or any internal-note alias).

`PUT /api/student/profile`:

- If request contains `teacherNote` (or aliases), backend must ignore or reject; must not persist via student endpoint.

## Auth & Permission

1. `GET/PUT /api/teacher/students/{studentId}/profile`:
   - Role: `TEACHER` / `ADMIN` only.
2. Teacher access must be scoped:
   - Teacher can only access assigned students.
3. Student role on teacher endpoint:
   - Return `403`.

## Data Model Recommendation

Use one canonical internal-note field in backend domain, for example:

1. `TeacherStudent.note` (shared note per teacher-student assignment set), or
2. `StudentProfile.teacherNote` (shared note per student, teacher-only exposed).

Recommended constraints:

- Type: text/string
- Max length: `5000` chars (or backend standard long-text limit)
- Normalize on save: trim leading/trailing whitespace
- Store `updatedAt`, `updatedBy` for audit

## Validation & Error Handling

1. Non-existent student: `404`.
2. Unauthorized relationship: `403`.
3. Note too long: `400` with clear error code/message.
4. Empty string is allowed (means clear note).

## Acceptance Checklist

1. Teacher A saves note for student X; reload still returns same note.
2. Teacher B (also assigned to student X) can read the same note.
3. Student X calls `GET /api/student/profile`; no internal note field in payload.
4. Student X submits `teacherNote` to `PUT /api/student/profile`; field not persisted.
5. Teacher updates note to empty string; subsequent teacher read returns empty value.

