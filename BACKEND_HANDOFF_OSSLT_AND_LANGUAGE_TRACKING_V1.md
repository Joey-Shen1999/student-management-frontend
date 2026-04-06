# Backend Task Plan: OSSLT Tracking v1 + Language Score Tracking Namespace

Date: 2026-04-06  
Audience: Backend, Frontend, QA

## 1) Goal

Deliver two backend streams in parallel:

1. Keep current language-score tracking working, but explicitly namespace it to avoid collision with upcoming OSSLT tracking.
2. Launch OSSLT teacher-side tracking (no student reminder flow in this phase).

## 2) Scope (This Phase)

Included:

1. Teacher-side OSSLT tracking status with 3 statuses:
   - `WAITING_UPDATE`
   - `NEEDS_TRACKING`
   - `PASSED`
2. Clear API naming separation:
   - Language score tracking: `languageScoreTracking*`
   - OSSLT tracking: `ossltTracking*`
3. Backward-compatible support for existing language fields during transition.

Excluded:

1. Student reminder/notification to fill OSSLT result.
2. OSSLT scheduling/next exam prediction automation.
3. Complex OSSLT non-participation statuses (exempt/deferred/etc.).

## 3) Naming Decision (Must Do First)

Current language tracking fields are too generic and will conflict with OSSLT.

Adopt these canonical names:

1. `languageScoreTrackingStatus`
2. `languageScoreTrackingManualStatus`

For OSSLT:

1. `ossltTrackingStatus`
2. `ossltTrackingManualStatus`

Compatibility window:

1. Continue accepting old input key:
   - `languageTrackingManualStatus`
2. Continue returning old output keys for old frontend versions:
   - `languageTrackingStatus`
   - `languageTrackingManualStatus`
3. Canonical storage and new DTO should use `languageScoreTracking*`.

## 4) Data Model Tasks

## 4.1 Language Score Tracking (Migration)

1. Add new columns (or equivalent DTO fields if stored elsewhere):
   - `language_score_tracking_status`
   - `language_score_tracking_manual_status`
2. Backfill from old fields if they exist:
   - `language_tracking_status` -> `language_score_tracking_status`
   - `language_tracking_manual_status` -> `language_score_tracking_manual_status`
3. Keep old columns readable during transition.

## 4.2 OSSLT Tracking (New)

Minimum fields per student:

1. `latest_osslt_result` enum: `PASS | FAIL | UNKNOWN`
2. `latest_osslt_date` date nullable
3. `osslt_tracking_manual_status` enum nullable:
   - `WAITING_UPDATE | NEEDS_TRACKING | PASSED`
4. `osslt_tracking_status` enum not null (derived/final visible status)
5. `osslt_teacher_note` text nullable
6. `osslt_updated_at` timestamp

## 5) Business Rules

## 5.1 Language Score Tracking

Keep current behavior:

1. If manual status exists, manual status wins.
2. If manual status is null, derive from language-score result.
3. Student language-score update can clear manual override (current existing policy).

## 5.2 OSSLT Tracking (v1 simple rule)

1. Base auto status from `latest_osslt_result`:
   - `PASS` -> `PASSED`
   - `FAIL` -> `WAITING_UPDATE`
   - `UNKNOWN` or null -> `WAITING_UPDATE`
2. Final status:
   - if `osslt_tracking_manual_status` is not null, use manual
   - else use auto status
3. This phase does not model deferred/exempt/etc.

## 6) API Tasks

## 6.1 Existing Language Endpoints (Compatibility Upgrade)

Upgrade these existing endpoints to return both new and old language keys:

1. `GET /api/teacher/students/{studentId}/ielts-module`
2. `PUT /api/teacher/students/{studentId}/ielts-module`
3. `GET /api/student/ielts-module`
4. `PUT /api/student/ielts-module/records`
5. `PUT /api/student/ielts-module/preparation-intent`
6. `GET /api/teacher/students/{studentId}/ielts-summary`

Request compatibility:

1. Accept `languageTrackingManualStatus` as alias of `languageScoreTrackingManualStatus`.

Response compatibility:

1. Return canonical:
   - `languageScoreTrackingStatus`
   - `languageScoreTrackingManualStatus`
2. Also return legacy aliases during transition:
   - `languageTrackingStatus`
   - `languageTrackingManualStatus`

## 6.2 New OSSLT Endpoints (Teacher Side)

Required:

1. `GET /api/teacher/students/{studentId}/osslt-module`
2. `PUT /api/teacher/students/{studentId}/osslt-module`

Recommended for list performance:

1. `GET /api/teacher/students/osslt-summary?studentIds=1,2,3`

### GET response example

```json
{
  "studentId": 1001,
  "graduationYear": 2028,
  "latestOssltResult": "UNKNOWN",
  "latestOssltDate": null,
  "ossltTrackingManualStatus": null,
  "ossltTrackingStatus": "WAITING_UPDATE",
  "teacherNote": null,
  "updatedAt": "2026-04-06T14:10:00Z"
}
```

### PUT request example

```json
{
  "ossltTrackingManualStatus": "NEEDS_TRACKING",
  "teacherNote": "Need update from school counselor."
}
```

## 7) Auth & Permission

1. OSSLT teacher endpoints:
   - allow `TEACHER` and `ADMIN`
   - forbid `STUDENT`
2. Language-score endpoints keep existing auth model.

## 8) Validation

1. Reject unknown enum values with `400 BAD_REQUEST`.
2. Validate date format as `YYYY-MM-DD` when provided.
3. Normalize empty string manual status to `null`.

## 9) Test Tasks (Backend)

Must-have automated tests:

1. Language compatibility:
   - old request key writes new canonical field
   - response returns both old and new keys
2. OSSLT derive logic:
   - PASS -> PASSED
   - FAIL/UNKNOWN -> WAITING_UPDATE
   - manual override wins
3. Permission tests:
   - teacher/admin allowed
   - student denied
4. Validation tests:
   - invalid enum/date returns 400

## 10) Rollout Plan

Phase A:

1. Deploy DB migration + compatibility fields + language API dual-key support.

Phase B:

1. Deploy OSSLT endpoints.
2. Frontend starts integrating OSSLT pages and new naming.

Phase C:

1. After frontend full rollout, deprecate old language keys in response.

## 11) Backend Work Breakdown (Execution Checklist)

1. Migration script: add canonical language-score fields + OSSLT fields.
2. Data backfill: copy old language values into canonical fields.
3. DTO update: add canonical + transitional alias serialization.
4. Service layer update: normalize old/new language manual status input keys.
5. Add OSSLT service/repository + derive function.
6. Implement `GET/PUT /teacher/students/{studentId}/osslt-module`.
7. Implement optional batch OSSLT summary endpoint.
8. Add auth guards and enum validation.
9. Add unit/integration tests.
10. Publish OpenAPI/Swagger updates for frontend alignment.
