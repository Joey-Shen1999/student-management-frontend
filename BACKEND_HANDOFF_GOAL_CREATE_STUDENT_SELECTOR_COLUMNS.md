# Backend Handoff: Goal Create Student Selector (Configurable Columns)

## Document Info

- Date: 2026-03-26
- Frontend project: `student-management-frontend`
- Feature scope: `Goal 发布与管理 -> Create Goal -> 选择学生`

## Goal

Frontend has implemented configurable student columns in Goal creation, aligned with the Student Management page behavior:

1. Teacher can show/hide student fields while selecting students.
2. Column visibility preference is persisted per user/teacher (local + teacher preference API).
3. Goal creation flow remains unchanged (`studentId[] -> create goal`), but selection context is richer.

## Current Frontend Data Sources

Frontend currently merges data from:

1. `GET /api/teacher/tasks/assignable-students`
2. `GET /api/teacher/student-accounts`
3. `GET /api/teacher/students/{studentId}/profile` (fallback / missing-field hydration)

This works but may cause additional profile calls when many rows are visible.

## Column Set in Goal Student Selector

Configurable columns now include:

- `name` (required)
- `email`
- `phone`
- `graduation`
- `schoolName`
- `canadaIdentity`
- `gender`
- `nationality`
- `firstLanguage`
- `schoolBoard`
- `country`
- `province`
- `city`
- `teacherNote`
- `status` (archive state)
- `selectable` (derived from status, archived => locked)

## Backend Collaboration Tasks

### P0 (Must)

1. Confirm canonical field mapping for Goal selector summary fields
   - Please confirm where each field should come from in backend domain/DTO:
   - `schoolName`, `schoolBoard`, `country`, `province`, `city`
   - `canadaIdentity`
   - `gender`, `nationality`, `firstLanguage`
   - `graduation` (recommended normalized `YYYY-MM`)
2. Provide `status` / assignable signal in student list payload
   - Frontend currently treats `ARCHIVED` as non-selectable.
   - Need stable field from backend:
   - `status: ACTIVE | ARCHIVED` and/or `selectable: boolean`.
3. Avoid N+1 profile fetch for column display
   - Preferred: enrich existing assignable list API with summary fields.
   - Alternative: provide dedicated batch summary endpoint for selector scene.

### P1 (Should)

1. Recommended API shape for Goal selector summary

`GET /api/teacher/tasks/assignable-students`

```json
[
  {
    "studentId": 20001,
    "studentName": "Jane Doe",
    "username": "jane01",
    "email": "jane@example.com",
    "phone": "+1-647-xxx-xxxx",
    "graduation": "2027-06",
    "schoolName": "Example High School",
    "schoolBoard": "TDSB",
    "country": "Canada",
    "province": "Ontario",
    "city": "Toronto",
    "canadaIdentity": "Study Permit",
    "gender": "Female",
    "nationality": "Chinese",
    "firstLanguage": "Mandarin",
    "teacherNote": "prefers STEM",
    "status": "ACTIVE",
    "selectable": true
  }
]
```

2. If enriching existing API is not possible, add dedicated endpoint

`POST /api/teacher/students/summary`

Request:

```json
{ "studentIds": [20001, 20002, 20003] }
```

Response:

```json
{ "items": [/* same summary shape as above */] }
```

### P2 (Optimization)

1. Optional server-side filters for summary endpoint
   - country / province / city / schoolBoard / graduationSeason / keyword
2. Optional sort hints (by studentId, name, graduation, etc.)

## Teacher Preference (Column Visibility)

Frontend uses teacher preference API with page key:

- `goal-management.create-goal.student-selector-columns`
- payload:

```json
{
  "version": "v1",
  "visibleColumnKeys": ["name", "email", "phone", "graduation", "schoolBoard", "city", "teacherNote", "status", "selectable"]
}
```

Please confirm this page key can be stored the same way as existing preference pages.

## Open Questions for Backend Confirmation

1. Is there already a reusable student summary DTO in backend that includes these fields?
2. Should `teacherNote` be included in list/summary APIs, or remain profile-only?
3. For archived students:
   - should they appear in assignable list with `selectable=false`, or be excluded entirely?
4. Which field is canonical for graduation in selector scene:
   - exact date, year-month, or season (`2027 Fall`)?

## Acceptance Checklist

1. Goal create selector can render required fields without per-row profile fetch dependency.
2. Archived/non-selectable status is explicit and consistent with backend policy.
3. Column visibility preference persists with page key above.
4. Data field semantics are stable and documented for frontend/backend consistency.
