# Backend Handoff: IELTS / English Requirement Tracking (v1)

This is a frontend-led contract. Backend implementation is **not** included in frontend repo changes.

## 1) Scope

- Module: IELTS Academic only (v1)
- User groups:
  - Student self view/edit
  - Teacher view/edit by studentId
- Business output:
  - Frontend derives tracking status from raw facts:
    - `GREEN_STRICT_PASS`
    - `GREEN_COMMON_PASS_WITH_WARNING`
    - `YELLOW_NEEDS_PREPARATION`

## 2) Required APIs (P0)

### Student APIs

1. `GET /api/student/ielts-module`
2. `PUT /api/student/ielts-module/records`
3. `PUT /api/student/ielts-module/preparation-intent`

### Teacher APIs

4. `GET /api/teacher/students/{studentId}/ielts-module`
5. `PUT /api/teacher/students/{studentId}/ielts-module`

## 3) Recommended API (P1)

6. `GET /api/teacher/students/{studentId}/ielts-summary`

Used by teacher list/detail to avoid repeated frontend derivation + reduce N+1 calls.

## 4) Canonical DTO (v1)

### `StudentIeltsModuleState`

```json
{
  "studentId": 2,
  "graduationYear": 2027,
  "hasTakenIeltsAcademic": true,
  "preparationIntent": "UNSET",
  "records": [
    {
      "recordId": "r-1",
      "testDate": "2025-10-12",
      "listening": 6.5,
      "reading": 6.5,
      "writing": 6.0,
      "speaking": 6.0
    }
  ],
  "languageRisk": {
    "shouldShowIeltsModule": true,
    "languageRiskFlag": "RISK",
    "firstLanguage": "Chinese",
    "citizenship": "China (Mainland)",
    "canadaStudyYears": 3,
    "hasCanadianHighSchoolExperience": true,
    "profileCompleteness": "COMPLETE",
    "riskReasonCodes": ["NON_ENGLISH_PRIMARY_LANGUAGE"]
  },
  "updatedAt": "2026-03-30T10:20:00Z"
}
```

### `PUT /records` request body

```json
{
  "hasTakenIeltsAcademic": true,
  "records": [
    {
      "recordId": "r-1",
      "testDate": "2025-10-12",
      "listening": 6.5,
      "reading": 6.5,
      "writing": 6.0,
      "speaking": 6.0
    }
  ]
}
```

### `PUT /preparation-intent` request body

```json
{
  "hasTakenIeltsAcademic": false,
  "preparationIntent": "PREPARING"
}
```

Allowed `preparationIntent`: `PREPARING | NOT_PREPARING | UNSET`

## 5) Backend data required by frontend

- `graduationYear` (required for validity cutoff calculation)
- `languageRisk.shouldShowIeltsModule` (recommended hard boolean)
- If no hard boolean, frontend fallback uses:
  - `languageRiskFlag`
  - `firstLanguage`
  - `citizenship`
  - `canadaStudyYears`
  - `hasCanadianHighSchoolExperience`
  - `profileCompleteness`

## 6) Validation expectations

- `testDate` format: `YYYY-MM-DD`
- IELTS bands: `0.0` to `9.0`, step `0.5`
- Reject malformed records with `400 BAD_REQUEST` and field details

## 7) Auth & permission

- Student APIs: authenticated `STUDENT`
- Teacher APIs: authenticated `TEACHER` or `ADMIN`
- Teacher can access by route studentId according to current permission model

## 8) Error model

Return consistent payload:

```json
{
  "status": 400,
  "code": "BAD_REQUEST",
  "message": "Validation failed.",
  "details": [
    { "field": "records[0].testDate", "message": "is required" }
  ]
}
```

## 9) Priority

- P0: Implement APIs #1~#5 with stable DTO above
- P1: Implement summary API #6
- P2: Support rule-set version delivery from backend (optional; frontend currently uses local config)
