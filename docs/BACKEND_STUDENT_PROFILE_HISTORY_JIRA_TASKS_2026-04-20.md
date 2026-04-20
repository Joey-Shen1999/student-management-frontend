# Backend Jira Subtasks - Student Profile History (2026-04-20)

This breakdown follows the current frontend integration blockers:

- `GET /api/student/profile/history?size=20` -> currently `404`
- `GET /api/teacher/students/{studentId}/profile/history?size=20` -> currently `404`

## Epic

Student Profile Audit History (Teacher/Student editable profile)

## Backend Group

### BE-1 P0 - Implement self history endpoint

- Summary: Implement `GET /api/student/profile/history?page=0&size=20`
- Owner: Backend
- Estimate: `1d`
- Scope:
1. Add controller/service endpoint.
2. Use authenticated user as target student.
3. Return `200` with stable envelope:
```json
{ "items": [], "total": 0, "page": 0, "size": 20 }
```
4. Support `page` and `size` query params.
- Acceptance:
1. Endpoint no longer returns `404`.
2. Response includes `items/total/page/size` in all cases.
3. Unauthorized requests return `401/403` (not `404`).

### BE-2 P0 - Implement teacher-managed history endpoint

- Summary: Implement `GET /api/teacher/students/{studentId}/profile/history?page=0&size=20`
- Owner: Backend
- Estimate: `1d`
- Scope:
1. Add controller/service endpoint.
2. Enforce teacher authorization for target student.
3. Reuse same response envelope as self endpoint.
- Acceptance:
1. Endpoint no longer returns `404`.
2. Unauthorized teacher or unassigned student returns `403`.
3. Response shape remains stable.

### BE-3 P0 - Enforce output field contract

- Summary: Standardize response item fields and enums.
- Owner: Backend
- Estimate: `0.5d`
- Scope:
1. `changeSource` only:
   - `manual_save`
   - `auto_save`
   - `file_upload`
   - `version_restore`
2. `changedFields` only:
```json
{ "path": "", "label": "", "before": null, "after": null }
```
3. Remove alias output (`oldValue/newValue/from/to`).
- Acceptance:
1. Payload validates against schema.
2. Frontend mapping no longer needs fallback aliases.

### BE-4 P0 - Write history and version in save transaction

- Summary: Persist audit records on student/teacher profile update.
- Owner: Backend
- Estimate: `2d`
- Scope:
1. Student save and teacher-managed save both create history entries.
2. Single transaction:
   - update profile
   - insert change event
   - insert version snapshot
3. Skip history insert when effective diff is empty.
- Acceptance:
1. Meaningful edits produce history rows.
2. No-op autosave does not generate duplicate history noise.

### BE-5 P0 - Version conflict handling

- Summary: Add optimistic concurrency for profile save.
- Owner: Backend
- Estimate: `1d`
- Scope:
1. Profile includes `version`.
2. On stale update return:
   - HTTP `409`
   - `code = PROFILE_VERSION_CONFLICT`
   - `currentVersion`
- Acceptance:
1. Conflict responses are deterministic and machine-readable.
2. Frontend can trigger refresh-and-retry flow.

### BE-6 P0 - Security and data protection

- Summary: Secure read and redact sensitive history fields.
- Owner: Backend
- Estimate: `1d`
- Scope:
1. Student can read own history only.
2. Teacher can read authorized student history only.
3. Redact sensitive fields in response:
   - OEN
   - phone
   - address
   - identity documents
4. Actor/time/diff are computed server-side.
- Acceptance:
1. Permission checks covered by tests.
2. Sensitive data is not leaked in history payload.

### BE-7 P1 - File upload audit integration

- Summary: Include transcript/identity-file operations in history.
- Owner: Backend
- Estimate: `1.5d`
- Scope:
1. Upload events create `file_upload` history items.
2. File replacement keeps old records (logical replacement, no hard overwrite).
- Acceptance:
1. History shows file upload timeline.
2. Previous file references remain auditable.

## DB Group

### DB-1 P0 - Add version and audit tables

- Summary: Introduce storage for profile versions and change events.
- Owner: DB/Backend
- Estimate: `1d`
- Scope:
1. Add profile `version` column.
2. Add tables for:
   - profile version snapshots
   - profile change events
3. Add indexes on `student_id`, `created_at`, `to_version`.
- Acceptance:
1. Migrations are repeatable and reversible.
2. Query performance meets pagination use.

### DB-2 P1 - Data retention and tamper-evidence baseline

- Summary: Define retention and optional hash-chain strategy.
- Owner: DB/Security
- Estimate: `0.5d`
- Scope:
1. Retention policy for audit/history tables.
2. Optional hash chain fields for tamper evidence.
- Acceptance:
1. Policy documented and approved.
2. Schema supports later verification jobs.

## QA/Test Group

### QA-1 P0 - API contract and auth tests

- Summary: Validate endpoint availability and contract.
- Owner: QA/Backend
- Estimate: `1d`
- Scope:
1. Verify both history endpoints return `200`, not `404`.
2. Validate envelope: `items/total/page/size`.
3. Validate enum and `changedFields` contract.
4. Validate auth boundaries for student/teacher roles.
- Acceptance:
1. Automated contract tests pass.
2. Negative auth scenarios pass.

### QA-2 P0 - Conflict tests

- Summary: Validate optimistic locking conflict behavior.
- Owner: QA/Backend
- Estimate: `0.5d`
- Scope:
1. Simulate stale version save.
2. Verify `409 + PROFILE_VERSION_CONFLICT + currentVersion`.
- Acceptance:
1. Deterministic conflict response confirmed.

### QA-3 P1 - File audit tests

- Summary: Validate file upload audit events.
- Owner: QA/Backend
- Estimate: `0.5d`
- Scope:
1. Transcript upload writes `file_upload`.
2. Identity file upload writes `file_upload`.
3. Replacement preserves old reference chain.
- Acceptance:
1. Upload history timeline is complete and ordered.

## Definition of Done (Global)

1. Both history GET endpoints are available and no longer `404`.
2. Frontend history panel renders list and summary (`shown x / total y`).
3. `changeSource` and `changedFields` follow strict contract.
4. Save conflicts return `409 + PROFILE_VERSION_CONFLICT + currentVersion`.
