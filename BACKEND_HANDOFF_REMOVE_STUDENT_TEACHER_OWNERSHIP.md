# Backend Handoff: Remove Student-Teacher Ownership

## 背景
- 日期: 2026-03-18
- 需求: 取消“学生归属某个老师”的设定，改为“老师可管理全部学生”。
- 前端已完成:
  - 学生管理页移除“选择教师 ID/刷新教师列表”。
  - `POST /api/teacher/student-invites` 不再传 `teacherId`。
  - 注册页不再展示邀请所属教师信息。

## 后端完整任务表

| ID | 优先级 | 模块 | 任务 | 交付结果 / 验收标准 |
|---|---|---|---|---|
| B1 | P0 | Invite API | 调整 `POST /api/teacher/student-invites`：请求体不再要求 `teacherId`，支持空对象 `{}`。 | 老师/管理员调用成功返回邀请链接或 token；不传 `teacherId` 不报错。 |
| B2 | P0 | Invite Domain | 停止在“学生邀请/注册”链路中写入学生归属老师关系。 | 新注册学生不再绑定 owner teacher。 |
| B3 | P0 | Student Account Permission | 放开老师权限范围：`GET /api/teacher/student-accounts` 返回全部学生（不再按 teacher 过滤）。 | 任意老师登录可看到全量学生列表。 |
| B4 | P0 | Student Account Permission | 放开老师权限范围：`POST /api/teacher/student-accounts/{id}/reset-password` 对任意学生可执行。 | 老师可重置任意学生密码，不再因非归属关系报 403。 |
| B5 | P0 | Student Account Permission | 放开老师权限范围：`PATCH /api/teacher/student-accounts/{id}/status` 对任意学生可执行。 | 老师可归档/启用任意学生，不再因非归属关系报 403。 |
| B6 | P0 | Student Profile Permission | 放开老师权限范围：`GET/PUT /api/teacher/students/{studentId}/profile` 不再依赖 teacher-student ownership 校验。 | 老师可查看/编辑任意学生档案。 |
| B7 | P1 | Invite Preview API | `GET /api/auth/student-invites/{inviteToken}` 可继续返回 `expiresAt/valid/status`；`teacherId/teacherName` 可移除。 | 前端注册页正常预览过期时间，不依赖教师字段。 |
| B8 | P1 | Data Migration | 若有 `owner_teacher_id` 或 `teacher_student` 绑定表，改为“非权限依据”；可保留历史数据但不参与鉴权。 | 线上老数据不阻塞新权限模型；无历史数据破坏。 |
| B9 | P1 | Code Cleanup | 清理服务层/仓储层中“按老师归属过滤学生”的代码路径与单测。 | 权限逻辑统一为 role-based（TEACHER/ADMIN），不再 ownership-based。 |
| B10 | P1 | Documentation | 更新后端 API 文档与权限说明。 | 文档中明确：老师可管理全部学生，学生不再绑定老师。 |

## 接口约定（更新后）

### 1) 创建学生邀请

`POST /api/teacher/student-invites`

Request:
```json
{}
```

Response（示例）:
```json
{
  "inviteToken": "invite-abc",
  "inviteUrl": "https://xxx/register?inviteToken=invite-abc",
  "expiresAt": "2026-03-31T23:59:59Z"
}
```

### 2) 学生邀请预览

`GET /api/auth/student-invites/{inviteToken}`

Response（示例）:
```json
{
  "valid": true,
  "status": "ACTIVE",
  "expiresAt": "2026-03-31T23:59:59Z"
}
```

### 3) 学生管理（老师全量可管理）

- `GET /api/teacher/student-accounts`
- `POST /api/teacher/student-accounts/{studentId}/reset-password`
- `PATCH /api/teacher/student-accounts/{studentId}/status`
- `GET /api/teacher/students/{studentId}/profile`
- `PUT /api/teacher/students/{studentId}/profile`

统一权限:
- `TEACHER`、`ADMIN`: allowed
- `STUDENT`: `403`
- 未登录: `401`

## 回归测试清单（后端）

1. 老师A可查看学生列表中的学生X（原本不归属A）。
2. 老师A可重置学生X密码。
3. 老师A可归档/启用学生X。
4. 老师A可读取并保存学生X档案。
5. 创建学生邀请时不传 `teacherId` 仍成功。
6. 学生通过邀请注册链接注册成功，不产生老师归属关系。
7. 学生端登录与资料流程不受影响。

## 上线注意事项

1. 若数据库存在 ownership 外键或非空约束，需先做兼容迁移（改可空或停止写入）。
2. 若缓存中存有“老师-学生可见范围”，上线前需清理相关缓存键。
3. 先在 staging 验证“跨老师操作任意学生”后再灰度上线。
