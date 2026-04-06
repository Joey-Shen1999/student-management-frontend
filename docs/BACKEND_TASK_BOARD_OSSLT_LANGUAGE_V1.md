# Backend Task Board: OSSLT + Language Score Tracking V1

Date: 2026-04-06  
Scope: Backend implementation + frontend integration support  
Related specs:
- `student-management-server/docs/FRONTEND_HANDOFF_OSSLT_AND_LANGUAGE_TRACKING_V1.md`
- `student-management-server/docs/osslt-language-tracking-openapi.yaml`

## Status Legend
- `TODO`: 未开始
- `IN_PROGRESS`: 进行中
- `BLOCKED`: 被依赖阻塞
- `READY_FOR_QA`: 开发完成，待验证
- `DONE`: 验证通过

## Task Board
| ID | 模块 | 任务 | Priority | Owner | ETA | 依赖 | 状态 | DoD（完成标准） |
|---|---|---|---|---|---|---|---|---|
| BE-01 | OSSLT API | 实现 `GET /api/teacher/students/{studentId}/osslt-module` | P0 | Backend API | 0.5d | 无 | TODO | 返回字段与 handoff 一致：`latestOssltResult/latestOssltDate/ossltTrackingManualStatus/ossltTrackingStatus/teacherNote/updatedAt` |
| BE-02 | OSSLT API | 实现 `PUT /api/teacher/students/{studentId}/osslt-module`（PATCH 语义） | P0 | Backend API | 0.5d | BE-01 | TODO | 只更新传入字段；支持 `null/""` 清空 `latestOssltDate`、`ossltTrackingManualStatus`、`teacherNote` |
| BE-03 | OSSLT API | 实现 `GET /api/teacher/students/osslt-summary?studentIds=...` 批量接口 | P0 | Backend API | 0.5d | BE-01 | TODO | 支持逗号分隔 IDs；返回数组；无效 ID 处理策略明确且可测试 |
| BE-04 | OSSLT Domain | 固化 OSSLT 状态计算规则（自动 + 手动覆盖） | P0 | Backend Domain | 0.5d | BE-01, BE-02 | TODO | 规则符合文档：`PASS->PASSED`；其余自动 `WAITING_UPDATE`；手动状态非空时覆盖自动状态 |
| BE-05 | IELTS Compatibility | `languageScoreTracking*` 新字段上线 + 旧字段兼容读写 | P0 | Backend API | 1d | 无 | TODO | 请求可接受 `languageScoreTrackingManualStatus` 与 `languageTrackingManualStatus`；响应同时返回新旧字段 |
| BE-06 | Validation & Error | DTO 校验与统一错误结构（400/403/404） | P0 | Backend API | 0.5d | BE-01~BE-05 | TODO | 非法枚举/日期返回 `400`；权限不足 `403`；学生不存在 `404`；错误体含 `status/message/code/details` |
| BE-07 | AuthZ | 角色权限收口（`TEACHER/ADMIN` 可访问，`STUDENT` 禁止） | P0 | Backend Auth | 0.5d | BE-01~BE-03 | TODO | 3 个 OSSLT 接口均生效；回归不影响既有 teacher/admin 接口 |
| BE-08 | Data | 历史数据默认值和迁移策略 | P1 | Backend Data | 0.5d | BE-04, BE-05 | TODO | 老数据无 OSSLT 记录时可返回可用默认状态；不破坏历史 IELTS 数据 |
| BE-09 | Testing | 单测 + 集成测试 + 回归用例补齐 | P0 | Backend QA/Dev | 1d | BE-01~BE-08 | TODO | 覆盖成功/失败/权限/校验/兼容字段路径；CI 通过 |
| BE-10 | Integration | 与前端联调并产出验收记录 | P0 | Backend + Frontend | 0.5d | BE-01~BE-09 | TODO | 联调样例全通过；接口行为与 handoff 一致；问题清单清零或有明确修复计划 |

## API Contract Checklist
- OSSLT 跟踪状态仅允许：
  - `WAITING_UPDATE`
  - `NEEDS_TRACKING`
  - `PASSED`
- OSSLT 最近考试结果仅允许：
  - `PASS`
  - `FAIL`
  - `UNKNOWN`
- Language 与 OSSLT 跟进语义必须分离：
  - 语言：`languageScoreTrackingStatus` / `languageScoreTrackingManualStatus`
  - OSSLT：`ossltTrackingStatus` / `ossltTrackingManualStatus`

## Suggested Execution Order
1. BE-01, BE-02, BE-04（先打通单学生 OSSLT 读写）
2. BE-03, BE-07（批量列表 + 权限）
3. BE-05, BE-06（语言兼容 + 统一校验错误）
4. BE-08（默认值与迁移）
5. BE-09, BE-10（测试与联调验收）

## Integration Exit Criteria
- 前端老师列表页可展示 OSSLT 三态，详情页可保存并刷新回显。
- 前端语言成绩页优先使用 `languageScoreTracking*`，旧字段仅兜底。
- 权限与错误码行为与文档一致，无歧义。
