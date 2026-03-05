# Backend Handoff: Student First Login -> Profile Onboarding

## Goal

For newly created student accounts, after successful login, guide users directly to profile completion instead of student dashboard.

Frontend has already implemented this behavior.

## Confirmed Login Contract (2026-03-05)

Backend confirmed response shape:

```json
{
  "userId": 7,
  "role": "STUDENT",
  "studentId": 2,
  "teacherId": null,
  "mustChangePassword": false,
  "requiresProfileCompletion": true,
  "accessToken": "xxx",
  "tokenType": "Bearer",
  "tokenExpiresAt": "2026-03-05T23:22:22.695Z"
}
```

Confirmed key field rules:

1. `mustChangePassword`: unchanged existing logic.
2. `requiresProfileCompletion`:
   - Student + no `student_profile` yet => `true`
   - Student + profile has been saved before => `false`
   - Teacher/Admin => `false`

Frontend priority order:

1. `mustChangePassword`
2. `requiresProfileCompletion`

## Frontend Behavior (already live)

Login redirect priority:

1. If `mustChangePassword === true`, redirect to `/change-password` first.
2. Else if role is `STUDENT` and profile onboarding is required, redirect to:
   - `/student/profile?onboarding=1`
3. Else normal student redirect:
   - `/dashboard`

Profile page behavior:

1. When query param `onboarding=1` is present on self profile route, profile opens directly in edit mode.
2. Teacher-managed student profile (`/teacher/students/:studentId/profile`) is not affected.

## Backend Tasks

## P0: Return an explicit onboarding signal in login response

Endpoint:

- `POST /api/auth/login`

Recommended canonical field:

- `requiresProfileCompletion: boolean`

Frontend compatibility already supports the following fields (any one is enough):

- `requiresProfileCompletion === true`
- `mustCompleteProfile === true`
- `firstLogin === true`
- `isFirstLogin === true`
- `profileCompleted === false`
- `isProfileCompleted === false`
- `onboardingState === "FIRST_LOGIN"` or `"PROFILE_REQUIRED"`

Recommended response example:

```json
{
  "userId": 7,
  "role": "STUDENT",
  "studentId": 2,
  "teacherId": null,
  "mustChangePassword": false,
  "requiresProfileCompletion": true,
  "accessToken": "...",
  "tokenType": "Bearer",
  "tokenExpiresAt": "2026-03-05T23:22:22.695Z"
}
```

## P0: Define backend rule for when onboarding is required

Choose one stable rule, for example:

1. Newly created student has not submitted required base profile fields.
2. Student profile record is missing or marked incomplete.

When student profile is considered complete, login response must stop returning onboarding-required signal.

## P1 (recommended): Expose completion state explicitly

Optional endpoint:

- `GET /api/student/profile/completion-status`

Example response:

```json
{
  "profileCompleted": false,
  "missingRequiredFields": [
    "legalFirstName",
    "legalLastName",
    "schools[0].schoolName"
  ]
}
```

This is not required for current frontend redirect, but helps observability and admin tooling.

## Acceptance Checklist

1. New student logs in:
   - `mustChangePassword=false`
   - onboarding-required signal=true
   - frontend lands on `/student/profile?onboarding=1` and opens edit mode.
2. Student completes profile and saves successfully.
3. Student logs in again:
   - onboarding-required signal=false
   - frontend lands on `/dashboard`.
4. If `mustChangePassword=true`, password flow has higher priority and still works.
5. Teacher/Admin login behavior remains unchanged.
