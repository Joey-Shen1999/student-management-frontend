# 后端任务表：学生管理-教师内部备注

## 1. 需求摘要

前端已完成教师备注 UI，当前行为如下：

- 页面：`/teacher/students`
- 位置：学生管理列表内的 `教师备注（学生不可见）` 列
- 交互：单行输入框，自动保存（无“保存按钮”）
- 字段：前端写入 `teacherNote`（string）
- 安全要求：学生端绝对不可见

## 2. 接口契约（必须满足）

1. 读取教师视角学生档案
   - `GET /api/teacher/students/{studentId}/profile`
   - 返回中应包含：`profile.teacherNote`

2. 保存教师视角学生档案
   - `PUT /api/teacher/students/{studentId}/profile`
   - 请求中支持：`teacherNote`
   - 返回中应回传持久化后的：`profile.teacherNote`

3. 学生端接口隔离
   - `GET /api/student/profile` 不得返回 `teacherNote`（及别名）
   - `PUT /api/student/profile` 若收到 `teacherNote`，必须忽略或拒绝，且不得落库

## 3. 任务表

| ID | 模块 | 任务 | 交付物 | 优先级 | 状态 |
|---|---|---|---|---|---|
| BE-01 | DB | 设计并落库教师备注字段（建议统一 canonical 字段：`teacher_note`） | migration SQL + 实体字段 | P0 | TODO |
| BE-02 | API | `GET /api/teacher/students/{id}/profile` 增加 `teacherNote` 返回 | controller/service/DTO | P0 | TODO |
| BE-03 | API | `PUT /api/teacher/students/{id}/profile` 支持保存 `teacherNote` | controller/service/DTO | P0 | TODO |
| BE-04 | Auth | 教师/管理员可访问；学生禁止访问教师接口（403） | 权限策略代码 | P0 | TODO |
| BE-05 | Scope | 教师仅可操作已分配学生（未分配返回 403/404） | 关系校验逻辑 | P0 | TODO |
| BE-06 | Validation | 备注长度限制（建议 5000），空字符串允许（清空） | 校验规则与错误码 | P1 | TODO |
| BE-07 | Security | 学生端 profile 接口彻底屏蔽 `teacherNote` 读写 | DTO 白名单/黑名单 | P0 | TODO |
| BE-08 | Audit | 记录 `teacherNote` 更新人、更新时间 | 审计字段或日志 | P1 | TODO |
| BE-09 | Test | 单元+集成测试覆盖读写、权限、隔离 | 测试代码与报告 | P0 | TODO |
| BE-10 | Docs | 更新 Swagger/OpenAPI 与错误码文档 | API 文档 | P1 | TODO |

## 4. 联调验收清单

1. 教师 A 给学生 X 写备注，刷新后仍可读到。
2. 教师 B（同样有权限）看到与教师 A 一致的备注内容。
3. 学生 X 获取自己的 profile 时，看不到任何教师备注字段。
4. 学生 X 提交 `teacherNote` 到学生端保存接口，不会落库。
5. 备注清空（空字符串）后，教师再次读取应为空。
6. 超长备注触发明确错误（HTTP `400` + 可读错误信息）。

## 5. 建议响应示例

### GET（教师端）

```json
{
  "profile": {
    "legalFirstName": "Jane",
    "legalLastName": "Doe",
    "teacherNote": "Follow up transcript in April"
  }
}
```

### PUT（教师端）

请求：

```json
{
  "teacherNote": "Follow up transcript in April"
}
```

响应：

```json
{
  "profile": {
    "teacherNote": "Follow up transcript in April"
  }
}
```

## 6. 完成定义（DoD）

- 上述 P0 任务全部完成并通过测试。
- 联调验收 6 条全部通过。
- 文档更新并可用于后续维护与排查。

