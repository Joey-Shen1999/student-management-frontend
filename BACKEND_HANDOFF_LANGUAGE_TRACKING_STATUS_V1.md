# Backend Handoff: Language Tracking Status (v2, Independent Teacher Field)

## Goal

Add an independent field `languageTrackingManualStatus` in both:
- Student Account Management list
- IELTS Tracking page

This field must be teacher-editable.
Priority rule:
- Teacher manual status has highest priority.
- Exception: once student updates IELTS-related data, backend should clear manual override and recalculate from latest student IELTS state.

## Frontend Behavior (already implemented)

1. `languageTrackingManualStatus` is a teacher override value.
2. Teacher can select one of 4 statuses directly:
   - `TEACHER_REVIEW_APPROVED` (green)
   - `AUTO_PASS_ALL_SCHOOLS` (green)
   - `AUTO_PASS_PARTIAL_SCHOOLS` (yellow)
   - `NEEDS_TRACKING` (yellow, default)
3. Student Management now has a separate `Language Tracking` column (not embedded inside IELTS column).
4. IELTS page teacher mode also uses the same selectable field.
5. Saving either page sends `languageTrackingManualStatus` to teacher update API.
6. If backend clears manual status (`null`) after student update, frontend should display auto-derived status from IELTS tracking.

## API Contract

### 1) `GET /api/teacher/students/{studentId}/ielts-module`

Must return:

```json
{
  "studentId": 123,
  "languageTrackingManualStatus": "NEEDS_TRACKING"
}
```

Allowed values:
- `TEACHER_REVIEW_APPROVED`
- `AUTO_PASS_ALL_SCHOOLS`
- `AUTO_PASS_PARTIAL_SCHOOLS`
- `NEEDS_TRACKING`
- `null` (optional for backward compatibility, FE will fallback to `NEEDS_TRACKING`)

### 2) `PUT /api/teacher/students/{studentId}/ielts-module`

Request supports:

```json
{
  "languageTrackingManualStatus": "AUTO_PASS_PARTIAL_SCHOOLS"
}
```

### 3) Summary endpoint (if used)

`GET /api/teacher/students/{studentId}/ielts-summary`

Summary object should include:

```json
{
  "summary": {
    "languageTrackingStatus": "AUTO_PASS_PARTIAL_SCHOOLS"
  }
}
```

## Backend Rules

1. If `languageTrackingManualStatus` is set (non-null), `languageTrackingStatus` must equal manual status.
2. If `languageTrackingManualStatus` is null, derive by IELTS tracking result:
   - `GREEN_STRICT_PASS` -> `AUTO_PASS_ALL_SCHOOLS`
   - `GREEN_COMMON_PASS_WITH_WARNING` -> `AUTO_PASS_PARTIAL_SCHOOLS`
   - `YELLOW_NEEDS_PREPARATION` -> `NEEDS_TRACKING`
3. When student updates IELTS state (records / hasTaken / preparation), clear manual override first (`languageTrackingManualStatus = null`) and then recalculate `languageTrackingStatus`.
4. Unknown enum value should return `400 BAD_REQUEST`.
5. Permissions:
   - `TEACHER`/`ADMIN`: can update this field
   - `STUDENT`: cannot update this field

## Data Model

Column (if not present):
- `language_tracking_manual_status` VARCHAR(64) NULL

Recommended enum/check:
- `TEACHER_REVIEW_APPROVED`
- `AUTO_PASS_ALL_SCHOOLS`
- `AUTO_PASS_PARTIAL_SCHOOLS`
- `NEEDS_TRACKING`

## Migration / Backfill

For existing rows:
- set `language_tracking_manual_status = null`
- let `languageTrackingStatus` be derived from existing IELTS tracking status

## Copyable Backend Task List

1. Extend IELTS module entity/DTO with `languageTrackingManualStatus` enum (4 values above).
2. Update teacher IELTS module PUT endpoint validation to accept the 4 enum values.
3. Persist teacher-selected `languageTrackingManualStatus` to DB.
4. On student IELTS update endpoints, clear `languageTrackingManualStatus` to null.
5. Implement derivation: manual first, else IELTS-based mapping.
6. Update IELTS module GET response mapping to return `languageTrackingManualStatus`.
7. Update summary mapping so `summary.languageTrackingStatus` returns final derived status.
8. Add role guard so only teacher/admin can modify this field.
9. Add unit/integration tests for enum validation, permission, manual-priority, and student-update-clear behavior.
