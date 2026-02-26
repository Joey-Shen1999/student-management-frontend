# Backend Handoff: Student Profile Management (UML-Aligned)

## Document Info

- Date: 2026-02-25
- Frontend project: `student-management-frontend`
- Purpose: hand off a complete backend implementation guide for student profile persistence (no local storage)

## Current Frontend Contract (Already Implemented)

The frontend has switched Student Profile to backend persistence only.

1. Load profile on page enter:
   - `GET /api/student/profile`
2. Save profile on click Save:
   - `PUT /api/student/profile`
3. No local draft storage remains in frontend.

Frontend references:

- `src/app/services/student-profile.service.ts`
- `src/app/pages/student-profile/student-profile.ts`
- `src/app/pages/student-profile/student-profile.html`

## Latest Field Update (2026-02-26)

`firstBoardingDate` has been relabeled in UI as:

- `第一次入境加拿大的时间`
- Helper text: `请填写入境登陆或者开始学习的时间，旅游不算。`

Backend integration requirement:

1. Frontend now sends both fields with the same value:
   - `firstEntryDateInCanada` (new preferred semantic name)
   - `firstBoardingDate` (legacy compatibility)
2. Frontend can read any of these response fields:
   - `firstEntryDateInCanada`
   - `firstEntryDate`
   - `firstArrivalDateInCanada`
   - `firstBoardingDate`
3. Backend should persist this as one canonical date and return at least `firstEntryDateInCanada` (recommended), while keeping legacy compatibility during migration.

## Country Standardization Update (2026-02-26)

Frontend now treats `address.country` as an English-standardized field.

Backend integration requirement:

1. Persist and return canonical English country names (for example: `Canada`, `China`, `United States`).
2. During migration, if backend receives legacy/localized values (for example Chinese aliases), normalize to the canonical English value before persistence.
3. Response payload should keep `address.country` in canonical English to avoid mixed-language data in UI and future edits.

## High School Address Update (2026-02-26)

Frontend now stores complete address fields for each high school entry.

Backend integration requirement:

1. `schools[]` should support and persist:
   - `schoolType` (`MAIN|OTHER`)
   - `schoolName`
   - `address.streetAddress`
   - `address.city`
   - `address.state`
   - `address.country`
   - `address.postal`
   - `startTime`
   - `endTime`
2. For compatibility during migration, frontend also submits flat fields (`streetAddress`, `city`, `state`, `country`, `postal`) in each `schools[]` item; backend can accept either nested `address` or flat fields.
3. Frontend keeps one default current high school record (`MAIN`) and additional historical schools as `OTHER`.

## Canadian High School Offline Lookup (Recommended Backend Ownership)

To support robust auto-fill for school addresses (including fuzzy input such as `Unionville` -> `Unionville High School`), this should be implemented on backend with an offline canonical dataset.

Recommended endpoint:

- `GET /api/reference/canadian-high-schools/search?q=...&limit=15`

Recommended response item:

```json
{
  "id": "ON-001234",
  "name": "Unionville High School",
  "streetAddress": "201 Town Centre Boulevard",
  "city": "Markham",
  "state": "Ontario",
  "country": "Canada",
  "postal": "L3R 8G5",
  "displayAddress": "201 Town Centre Boulevard, Markham, Ontario, L3R 8G5, Canada"
}
```

Matching requirements:

1. Support fuzzy search (not exact match only), including partial names, abbreviations, and common typos.
2. Rank by relevance (name similarity first, then city/province context).
3. Return stable, normalized addresses from offline data.

## Scope

## Phase 1 (must implement now)

1. Student can read own profile.
2. Student can update own profile.
3. Data is persisted to DB and available after refresh/re-login.

## Phase 2 (recommended next)

1. Teacher/Admin can read student profile by `studentId`.
2. Teacher/Admin can edit student profile by `studentId`.
3. Permission is enforced via `TeacherStudent` relationship and role.

## UML Object Inventory

1. `User`
   - `id`
   - `username`
   - `passwordHash`
   - `role` (`UserRole`)
   - `createdAt`
   - `lastLoginAt`

2. `Student`
   - `id`
   - `firstName`
   - `lastName`
   - `nickName`
   - `createdAt`
   - `updatedAt`
   - `profile` (`StudentProfile`)

3. `Teacher`
   - `id`
   - `name`
   - `user` (`User`)
   - `createdAt`
   - `updatedAt`

4. `TeacherStudent`
   - `id`
   - `teacher` (`Teacher`)
   - `student` (`Student`)
   - `assignedAt`
   - `status` (`ACTIVE|ARCHIVED`)
   - `note`

5. `StudentProfile`
   - `birthday`
   - `statusInCanada`
   - `address` (`Address`)
   - `phone`
   - `citizenship`
   - `firstLanguage`
   - `firstBoardingDate`
   - `otherCourses` (`List<CourseRecord>`)
   - `oenNumber` (nullable)
   - `ib`
   - `ap` (boolean)
   - `identity` (`StudentFile`)

6. `Address`
   - `streetAddress`
   - `streetAddressLine2`
   - `city`
   - `state`
   - `country`
   - `postal`

7. `School`
   - `name`
   - `address` (`Address`)

8. `SchoolRecord`
   - `school` (`School`)
   - `type` (`MAIN|OTHER`)
   - `gradeLevels` (`List<int>`)
   - `transcripts` (`List<StudentFile>`)
   - `startTime`
   - `endTime`

9. `CourseRecord`
   - `schoolType` (`MAIN|OTHER`)
   - `courseCode`
   - `school` (`School`)
   - `mark`
   - `gradeLevel`
   - `transcripts` (`List<StudentFile>`)
   - `startTime`
   - `endTime`

10. `StudentFile`
    - `id`
    - `storageKey`
    - `mimeType`
    - `size`
    - `uploadedAt`
    - `uploadedBy`

## Relationship Cardinality

1. `User` -> `Student`: `1 -> 0..1`
2. `User` -> `Teacher`: `1 -> 0..1`
3. `Student` -> `StudentProfile`: `1 -> 1`
4. `Student` -> `SchoolRecord`: `1 -> 0..*`
5. `StudentProfile` -> `CourseRecord`: `1 -> 0..*`
6. `Teacher` <-> `Student`: `M:N` via `TeacherStudent`
7. `SchoolRecord` -> `School`: `* -> 1`
8. `CourseRecord` -> `School`: `* -> 1`
9. `StudentProfile.identity` -> `StudentFile`: `1 -> 0..1`
10. Transcript attachments -> `StudentFile`: `0..*`

## Enum Definitions

1. `UserRole`: `STUDENT | TEACHER | ADMIN`
2. `TeacherStudent.status`: `ACTIVE | ARCHIVED`
3. `SchoolRecord.type`: `MAIN | OTHER`
4. `CourseRecord.schoolType`: `MAIN | OTHER`

## API Contract (Phase 1 - Required)

## 1) Get current student's profile

`GET /api/student/profile`

Rules:

1. Require auth token.
2. Resolve student identity from token/session only.
3. Do not accept student id from query/body.

Success response (`200`):

Backend may return either shape A or shape B.

Shape A (preferred):

```json
{
  "legalFirstName": "Amy",
  "legalLastName": "Chen",
  "preferredName": "Amy",
  "gender": "Female",
  "birthday": "2008-06-01",
  "phone": "(647) 111-2222",
  "email": "amy@example.com",
  "statusInCanada": "PR",
  "citizenship": "Canada",
  "firstLanguage": "English",
  "firstBoardingDate": "2024-09-01",
  "address": {
    "streetAddress": "123 Main St",
    "streetAddressLine2": "Unit 5",
    "city": "Toronto",
    "state": "ON",
    "country": "Canada",
    "postal": "M1M1M1"
  },
  "oenNumber": "123456789",
  "ib": "IB DP",
  "ap": true,
  "identityFileNote": "Passport on file",
  "otherCourses": [
    {
      "schoolType": "OTHER",
      "schoolName": "ABC Private School",
      "courseCode": "MHF4U",
      "mark": 93,
      "gradeLevel": 12,
      "startTime": "2025-02-01",
      "endTime": "2025-06-30"
    }
  ]
}
```

Shape B (also supported by current frontend):

```json
{
  "profile": {
    "...": "same fields as shape A"
  }
}
```

First-time behavior recommendation:

1. Return `200` with empty/default structure instead of `404`.
2. This avoids false error state for new students.

## 2) Save current student's profile

`PUT /api/student/profile`

Rules:

1. Require auth token.
2. Resolve student identity from token/session.
3. Ignore any identity fields in payload (if present).
4. Treat request as full profile update (replace semantics).

Request body:

```json
{
  "legalFirstName": "Amy",
  "legalLastName": "Chen",
  "preferredName": "Amy",
  "gender": "Female",
  "birthday": "2008-06-01",
  "phone": "(647) 111-2222",
  "email": "amy@example.com",
  "statusInCanada": "PR",
  "citizenship": "Canada",
  "firstLanguage": "English",
  "firstBoardingDate": "2024-09-01",
  "address": {
    "streetAddress": "123 Main St",
    "streetAddressLine2": "Unit 5",
    "city": "Toronto",
    "state": "ON",
    "country": "Canada",
    "postal": "M1M1M1"
  },
  "oenNumber": "123456789",
  "ib": "IB DP",
  "ap": true,
  "identityFileNote": "Passport on file",
  "otherCourses": [
    {
      "schoolType": "OTHER",
      "schoolName": "ABC Private School",
      "courseCode": "MHF4U",
      "mark": 93,
      "gradeLevel": 12,
      "startTime": "2025-02-01",
      "endTime": "2025-06-30"
    }
  ]
}
```

Success response (`200`):

1. Can return saved object directly (shape A).
2. Or wrapper `{ "profile": {...} }`.

## Field Mapping (Important)

Frontend currently sends:

1. `legalFirstName`
2. `legalLastName`
3. `preferredName`

UML student core has:

1. `firstName`
2. `lastName`
3. `nickName`

Recommended backend mapping:

1. `legalFirstName` <-> `Student.firstName`
2. `legalLastName` <-> `Student.lastName`
3. `preferredName` <-> `Student.nickName`

Compatibility note:

Current frontend read logic can also consume `firstName/lastName/nickName` from backend response.

## Validation Rules (Backend)

1. Trim all string inputs.
2. Date fields must be `YYYY-MM-DD` if provided:
   - `birthday`
   - `firstBoardingDate`
   - `otherCourses[].startTime`
   - `otherCourses[].endTime`
3. `otherCourses[].schoolType` must be `MAIN` or `OTHER`.
4. `otherCourses[].mark` range recommendation: `0-100`.
5. `otherCourses[].gradeLevel` range recommendation: `1-12`.
6. If both course dates present: `startTime <= endTime`.
7. `ap` must be boolean.

## Authorization & Permission (Phase 1)

1. Unauthenticated -> `401`.
2. `GET/PUT /api/student/profile` should be allowed for student role only.
3. `TEACHER/ADMIN` calling student-self endpoint -> `403`.

## Error Contract

Recommended error body:

```json
{
  "status": 400,
  "code": "BAD_REQUEST",
  "message": "birthday must be yyyy-mm-dd"
}
```

Recommended codes:

1. `UNAUTHENTICATED` (`401`)
2. `FORBIDDEN_ROLE` (`403`)
3. `BAD_REQUEST` (`400`)
4. `NOT_FOUND` (`404`, only when really needed)
5. `INTERNAL_ERROR` (`500`)

## Persistence Strategy

Recommended write flow for `PUT /api/student/profile`:

1. Begin transaction.
2. Resolve student by token identity.
3. Upsert `student_profile` row (1:1 by `student_id`).
4. Update student core name fields (`firstName/lastName/nickName`) from legal/preferred name fields.
5. Replace `other_courses` list for that student/profile:
   - delete existing rows for this profile
   - insert incoming list rows
6. Commit transaction.

## Suggested Table Design (Reference)

## `student_profile`

1. `student_id` (PK/FK unique)
2. `birthday` (DATE)
3. `status_in_canada` (VARCHAR)
4. `phone` (VARCHAR)
5. `citizenship` (VARCHAR)
6. `first_language` (VARCHAR)
7. `first_boarding_date` (DATE)
8. `oen_number` (VARCHAR, nullable)
9. `ib` (VARCHAR)
10. `ap` (BOOLEAN)
11. `identity_file_id` (nullable FK -> `student_file.id`)
12. `identity_file_note` (VARCHAR/TEXT)
13. `street_address` (VARCHAR)
14. `street_address_line2` (VARCHAR)
15. `city` (VARCHAR)
16. `state` (VARCHAR)
17. `country` (VARCHAR)
18. `postal` (VARCHAR)
19. `updated_at` (TIMESTAMP)
20. `updated_by` (BIGINT nullable)

## `student_course_record`

1. `id` (PK)
2. `student_id` (FK)
3. `school_type` (ENUM/VARCHAR: `MAIN|OTHER`)
4. `school_name` (VARCHAR)
5. `course_code` (VARCHAR)
6. `mark` (INT nullable)
7. `grade_level` (INT nullable)
8. `start_time` (DATE nullable)
9. `end_time` (DATE nullable)
10. `created_at` (TIMESTAMP)
11. `updated_at` (TIMESTAMP)

## Migration / Data Tasks

1. Create `student_profile` table.
2. Create `student_course_record` table.
3. Add unique constraint for one profile per student.
4. Add indexes:
   - `student_profile(student_id)`
   - `student_course_record(student_id)`
5. Backfill strategy:
   - Existing students can have empty/default profile rows on first read or lazy-create on first save.

## Phase 2 API (Teacher/Admin access, recommended)

To satisfy "teacher can call student information later", add:

1. `GET /api/teacher/students/{studentId}/profile`
2. `PUT /api/teacher/students/{studentId}/profile`

Permission rules:

1. `ADMIN`: all students.
2. `TEACHER`: only students linked via active `TeacherStudent` relationship.
3. `STUDENT`: forbidden.

## Acceptance Checklist (Phase 1)

1. Student opens `/student/profile` and data is loaded from DB.
2. Student saves changes and receives success response.
3. Browser refresh still shows saved data.
4. Re-login still shows saved data.
5. Invalid payload returns `400` with clear message.
6. Missing token returns `401`.
7. Teacher/Admin calling student-self endpoint returns `403`.

## Suggested Integration Tests (Backend)

1. `GET /api/student/profile` with valid student token -> `200`.
2. `PUT /api/student/profile` with valid body -> `200` and persisted.
3. `PUT /api/student/profile` invalid date -> `400`.
4. `GET /api/student/profile` without token -> `401`.
5. `GET /api/student/profile` with teacher token -> `403`.
6. Save with 2 courses then save with 1 course -> old extra course removed.

## Frontend Compatibility Notes

1. Frontend accepts response as either direct object or `{ profile: object }`.
2. Frontend expects `message` or `error` text in error payload for display.
3. Frontend currently submits full payload via `PUT` (not patch fields).

## Handoff Completion Criteria

Backend is considered complete when:

1. Phase 1 endpoints are deployed and verified against this contract.
2. Student profile page has no local save fallback and works end-to-end with backend data.
3. Acceptance checklist is fully passed.
