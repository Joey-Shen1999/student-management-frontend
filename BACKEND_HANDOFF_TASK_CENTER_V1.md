# BACKEND_HANDOFF_TASK_CENTER_V1

## Scope
This handoff is for Task Center v1 (Goal-only API integration).
Info + Tag is currently frontend mock-driven and will be proposed in v2 contract.

## Base rules
- Auth: `Authorization: Bearer <accessToken>`
- Time format: ISO 8601 string in UTC (e.g. `2026-03-11T14:30:00Z`)
- Enum case: uppercase (e.g. `GOAL`, `NOT_STARTED`)
- Error payload (frontend consumes `message`):

```json
{
  "code": "SOME_ERROR_CODE",
  "message": "Human-readable message",
  "status": 400,
  "details": []
}
```

## 1) List goals
### Student
`GET /api/student/tasks`

Query params:
- `type=GOAL` (required)
- `status=NOT_STARTED|IN_PROGRESS|COMPLETED` (optional)
- `keyword` (optional)
- `page` (optional, default 1)
- `size` (optional, default 20)

### Teacher
`GET /api/teacher/tasks`

Query params:
- `type=GOAL` (required)
- `studentId` (optional)
- `status=NOT_STARTED|IN_PROGRESS|COMPLETED` (optional)
- `keyword` (optional)
- `page` (optional, default 1)
- `size` (optional, default 20)

Response DTO: `GoalListResponseDto`

```json
{
  "items": [
    {
      "id": 1001,
      "type": "GOAL",
      "title": "完成 OUAC 账户注册",
      "description": "本周内完成 OUAC 注册并截图上传。",
      "status": "NOT_STARTED",
      "dueAt": "2026-03-15",
      "assignedStudentId": 20001,
      "assignedStudentName": "张三",
      "assignedByTeacherId": 9001,
      "assignedByTeacherName": "Ms. Chen",
      "createdAt": "2026-03-08T10:00:00Z",
      "updatedAt": "2026-03-08T10:00:00Z",
      "completedAt": null,
      "progressNote": ""
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

## 2) Create goal
### Teacher
`POST /api/teacher/tasks/goals`

Request:

```json
{
  "studentId": 20001,
  "title": "完成 OUAC 账户注册",
  "description": "本周内完成 OUAC 注册并截图上传。",
  "dueAt": "2026-03-15"
}
```

Response DTO: `GoalTaskDto`

## 3) Update goal status
### Student updates own goal
`PATCH /api/student/tasks/{goalId}/status`

### Teacher updates assigned goal
`PATCH /api/teacher/tasks/{goalId}/status`

Request:

```json
{
  "status": "IN_PROGRESS",
  "progressNote": "已开始处理"
}
```

Response DTO: `GoalTaskDto`

## 4) List assignable students (teacher)
`GET /api/teacher/tasks/assignable-students`

Response DTO: `AssignableStudentDto[]`

```json
[
  {
    "studentId": 20001,
    "studentName": "张三",
    "username": "zhangsan"
  }
]
```

## Frontend expectation checklist
- 401: frontend interceptor clears local auth and redirects to `/login`.
- Non-2xx: frontend displays `message` from error payload directly.
- Empty list must return valid pagination shape, not `null`.
- `dueAt` supports `YYYY-MM-DD`.
- Goal status transitions are handled on frontend; backend only needs to validate and persist.

## Current frontend integration status
- `GET /api/student/tasks` integrated (live)
- `GET /api/teacher/tasks` integrated (live)
- `POST /api/teacher/tasks/goals` integrated (live)
- `PATCH /api/student/tasks/{id}/status` integrated (live)
- `PATCH /api/teacher/tasks/{id}/status` integrated (live)
- `GET /api/teacher/tasks/assignable-students` integrated (live)
