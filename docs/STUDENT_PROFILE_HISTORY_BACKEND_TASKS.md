# Student Profile History Backend Tasks

## Goal

Record every meaningful student profile change made by a student, teacher, or admin. The backend must create the audit record. The frontend can display history, but it must not be trusted to create actor, timestamp, diff, or version data.

## Core Backend Scope

1. Add `student_profile_versions` and `student_profile_change_events`.
2. Write profile version + change event in the same transaction as profile save.
3. Resolve actor/role/timestamp/diff on backend only. Do not trust frontend-provided audit data.
4. Add profile `version` with `409 Conflict` protection for concurrent edits.
5. Include transcript and identity-file upload events in audit history.
6. Return redacted sensitive fields in history APIs and encrypt full snapshot at rest.
7. Build tamper-evidence chain with `snapshot_hash + previous_hash`.
8. Enforce history read permissions separately for student, teacher, and admin.

## API Contract

### Read history for current student

`GET /api/student/profile/history?size=20`

Response:

```json
{
  "items": [
    {
      "id": 10001,
      "studentId": 123,
      "fromVersion": 4,
      "toVersion": 5,
      "changeSource": "manual_save",
      "actorRole": "TEACHER",
      "actorName": "Wang",
      "changedAt": "2026-04-18T14:30:00Z",
      "changedFields": [
        {
          "path": "phone",
          "label": "联系电话",
          "before": "***3333",
          "after": "***7788"
        }
      ]
    }
  ],
  "total": 1,
  "page": 0,
  "size": 20
}
```

### Read history for teacher-managed student

`GET /api/teacher/students/{studentId}/profile/history?size=20`

Use the same response shape as the student endpoint.

Frontend expectations:

- Always return stable `total`, `page`, and `size` values for pagination and summary text.
- Use `items` as the canonical list field. The frontend currently tolerates `entries`, `history`, and raw arrays only for transition compatibility.
- Use stable `changeSource` enum values: `manual_save`, `auto_save`, `file_upload`, `version_restore`.
- Use stable field change objects: `{ "path": "...", "label": "...", "before": "...", "after": "..." }`.

### Optional version read and restore endpoints

`GET /api/teacher/students/{studentId}/profile/history/{version}`

`POST /api/teacher/students/{studentId}/profile/history/{version}/restore`

Restore must create a new version and a new change event. Do not delete or overwrite old history.

## Database Tasks

1. Add `version` to the canonical student profile record.
2. Add `student_profile_versions`.

```sql
student_profile_versions (
  id,
  student_id,
  version,
  profile_snapshot_json,
  snapshot_hash,
  previous_hash,
  changed_by_user_id,
  changed_by_role,
  changed_at,
  change_event_id,
  request_id
)
```

3. Add `student_profile_change_events`.

```sql
student_profile_change_events (
  id,
  student_id,
  from_version,
  to_version,
  change_source,
  changed_paths_json,
  actor_user_id,
  actor_role,
  actor_name,
  ip_hash,
  user_agent_hash,
  created_at,
  request_id
)
```

4. Add indexes on `student_id`, `created_at`, `to_version`, and `actor_user_id`.
5. Make audit/version tables append-only at application level. No public update/delete endpoints.

## Save Flow

1. Authenticate request and resolve actor from server-side session/token.
2. Authorize that actor can edit the target student profile.
3. Load current canonical profile and current `version`.
4. Normalize incoming payload with the same canonical rules used by the profile save logic.
5. Compare normalized current profile with normalized incoming profile.
6. If no real diff exists, return current profile without creating a history record.
7. If diff exists, run in one database transaction:
   - insert `student_profile_change_events`
   - update canonical profile and increment `version`
   - insert `student_profile_versions` with the new full snapshot
8. Return updated profile and version.

## Concurrency

Support optimistic concurrency:

- Frontend may send `If-Match: {version}` or payload `version`.
- If incoming version is stale, return `409 Conflict`.
- Response should include `code: "PROFILE_VERSION_CONFLICT"` and `currentVersion`.

## Field Diff Rules

1. Use allowlisted profile fields only.
2. Diff nested fields with stable paths such as `address.city`, `schools[0].schoolName`, `externalCourses[1].courseCode`.
3. Do not log access tokens, raw file bytes, passwords, or session data.
4. Redact sensitive values in the history API:
   - OEN
   - birthday
   - phone
   - email
   - address
   - identity file metadata
5. Store full snapshots encrypted if they contain PII.

## File Upload Audit

Audit these endpoints too:

- `POST /api/student/profile/identity-files`
- `POST /api/teacher/students/{studentId}/profile/identity-files`
- `POST /api/student/profile/schools/{schoolRecordId}/transcript`
- `POST /api/teacher/students/{studentId}/profile/schools/{schoolRecordId}/transcript`

Recommended file history fields:

```sql
student_profile_files (
  id,
  student_id,
  file_type,
  school_record_id,
  file_key,
  original_filename,
  content_type,
  size_bytes,
  file_hash,
  uploaded_by_user_id,
  uploaded_by_role,
  uploaded_at,
  replaced_file_id,
  visible
)
```

Uploading a new file should not physically remove the old file. Mark the old file as replaced and write a change event.

## Tamper Evidence

For each version record:

```text
snapshot_hash = HMAC_SHA256(server_secret, canonical_snapshot_json)
previous_hash = previous_version.snapshot_hash
```

This creates a verifiable chain. Add an internal admin job or script to verify the chain for a student.

## Security Requirements

1. Never accept actor, role, timestamp, or diff from the frontend.
2. Audit history reads should also be permission checked.
3. Students can read their own safe/redacted history.
4. Teachers can read assigned/authorized students only.
5. Admin restore should require elevated permission.
6. Store IP and user agent as hashes if needed for investigation.
7. Define retention policy before production rollout.

## Frontend Already Prepared

The frontend now calls:

- `GET /api/student/profile/history?size=20`
- `GET /api/teacher/students/{studentId}/profile/history?size=20`

The UI expects `items`, `entries`, `history`, or a raw array. Preferred response is `items`.
