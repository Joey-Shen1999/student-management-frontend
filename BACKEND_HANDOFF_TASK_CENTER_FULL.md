# BACKEND_HANDOFF_TASK_CENTER_FULL

## 0. Priority & Scope
- P0: Goal（已在前端联调，后端需保证稳定和验收）
- P1: Info + Tag（前端已用 mock 跑通，等待后端接口落地）
- P2: DLL（先给最小模板能力和预留自动化创建入口）

## 1. Global Rules
- Auth: `Authorization: Bearer <accessToken>`
- Time: ISO 8601 UTC
- Enum: uppercase
- Error format (frontend uses `message` directly):

```json
{
  "code": "SOME_ERROR_CODE",
  "message": "Human-readable message",
  "status": 400,
  "details": []
}
```

---

## 2. P0 Goal (Must)

### 2.1 Student list goals
`GET /api/student/tasks?type=GOAL&status=&keyword=&page=&size=`

### 2.2 Teacher list goals
`GET /api/teacher/tasks?type=GOAL&studentId=&status=&keyword=&page=&size=`

Response: `GoalListResponseDto`

### 2.3 Teacher create goal
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

Response: `GoalTaskDto`

### 2.4 Student update goal status
`PATCH /api/student/tasks/{goalId}/status`

### 2.5 Teacher update goal status
`PATCH /api/teacher/tasks/{goalId}/status`

Request:

```json
{
  "status": "IN_PROGRESS",
  "progressNote": "已开始处理"
}
```

Response: `GoalTaskDto`

### 2.6 Teacher assignable students
`GET /api/teacher/tasks/assignable-students`

Response: `AssignableStudentDto[]`

### 2.7 Goal DTO contract

```json
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
```

### 2.8 P0 acceptance
- 401 会被前端拦截器处理并跳转登录
- 空列表必须返回分页对象，不可 `null`
- 关键筛选（status/keyword/studentId）生效
- 状态更新后返回最新任务对象

---

## 3. P1 Info + Tag (Next)

> 前端已实现页面、筛选、创建、列表；当前使用 mock，切后端只需替换接口。

### 3.1 Student list infos
`GET /api/student/tasks?type=INFO&category=&tag=&keyword=&unreadOnly=&page=&size=`

### 3.2 Student mark info read
`PATCH /api/student/tasks/{infoId}/read`

Request body: `{}`

### 3.3 Teacher list infos
`GET /api/teacher/tasks?type=INFO&category=&tag=&keyword=&page=&size=`

### 3.4 Teacher create info
`POST /api/teacher/tasks/infos`

Request:

```json
{
  "title": "义工活动报名通知",
  "content": "请在周五前完成报名。",
  "category": "VOLUNTEER",
  "tags": ["Volunteer", "Grade12"]
}
```

Response: `InfoTaskDto`

### 3.5 Info DTO contract

```json
{
  "id": 5001,
  "type": "INFO",
  "title": "3 月大学开放日汇总",
  "content": "本周末有 3 所学校开放日，请尽快预约并回传行程安排。",
  "category": "ACTIVITY",
  "tags": ["University", "OpenDay", "Grade12"],
  "targetStudentCount": 46,
  "publishedByTeacherId": 9001,
  "publishedByTeacherName": "Ms. Chen",
  "createdAt": "2026-03-09T09:00:00Z",
  "updatedAt": "2026-03-09T09:00:00Z",
  "read": false,
  "readAt": null
}
```

### 3.6 Info list response

```json
{
  "items": ["...InfoTaskDto"],
  "total": 1,
  "page": 1,
  "size": 20
}
```

### 3.7 P1 acceptance
- category/tag/keyword/unreadOnly 筛选生效
- 标记已读后 `read=true` 且返回最新对象
- 前端直接显示 `message`，错误结构保持统一

---

## 4. P2 DLL (Reserve)

### 4.1 Minimal endpoints
- `POST /api/teacher/tasks/dll-templates`
- `GET /api/teacher/tasks?type=DLL&page=&size=`
- `POST /api/teacher/tasks/dll-templates/{templateId}/instantiate` (manual trigger)

### 4.2 DTO (minimal)
- `DllTemplateDto`: id, name, description, payloadSchema, createdAt, updatedAt
- `DllTaskDto`: id, templateId, title, status, assignedStudentId, createdAt

### 4.3 P2 note
- 本期先不做调度系统；先提供手动 instantiate，后续再接自动化规则。

---

## 5. Backend Task Breakdown (for issue tracking)
1. P0-Goal: 完成并验收 6 个 Goal 接口（见第 2 节）
2. P0-Goal: 权限校验（学生仅自己、老师仅自己可见范围、Admin 全局）
3. P0-Goal: 统一异常输出（code/message/status/details）
4. P1-Info: 新增 4 个 Info 接口（见第 3 节）
5. P1-Info: 支持 tag/category/unread 查询索引与分页
6. P2-DLL: 模板 CRUD 最小闭环 + instantiate 接口预留
