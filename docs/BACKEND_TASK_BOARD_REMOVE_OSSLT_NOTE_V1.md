# Backend Task Board: Remove OSSLT Teacher Note V1

Date: 2026-04-06  
Owner: Backend  
Related frontend change: `/teacher/osslt` no longer shows or submits `teacherNote`.

## Goal
- 删除 OSSLT 模块中的 `teacherNote`（教师备注）能力。
- 保留并仅保留 3 个老师跟进状态：`WAITING_UPDATE` / `NEEDS_TRACKING` / `PASSED`。

## API Contract Changes
1. `GET /api/teacher/students/{studentId}/osslt-module`
- 响应移除字段：`teacherNote`。

2. `PUT /api/teacher/students/{studentId}/osslt-module`
- 请求体不再接受：`teacherNote`。
- 仅允许更新：`ossltTrackingManualStatus`（以及历史已支持的 OSSLT 成绩相关字段，如果仍在范围内）。

3. `GET /api/student/osslt-module`
- 响应移除字段：`teacherNote`（若曾暴露过）。

4. `PUT /api/student/osslt-module`
- 保持现有学生可写范围，不新增任何备注字段。

## Task List
| ID | Task | Priority | DoD |
|---|---|---|---|
| BE-NOTE-01 | DTO/Schema 移除 `teacherNote` | P0 | OSSLT DTO、序列化层、OpenAPI 全部删除该字段 |
| BE-NOTE-02 | Service 层停用备注写入 | P0 | 任何 OSSLT 更新流程不再写入备注字段 |
| BE-NOTE-03 | 数据层迁移 | P1 | 数据表中 OSSLT 备注列标记弃用并制定清理迁移（可先保留列但不读写） |
| BE-NOTE-04 | 兼容策略 | P0 | 对旧客户端传入 `teacherNote`：统一处理（推荐忽略并记录 warning，避免联调中断） |
| BE-NOTE-05 | 权限与审计回归 | P0 | 确认 teacher/admin/student 权限行为不变，审计日志不再包含 OSSLT 备注 |
| BE-NOTE-06 | 测试补齐 | P0 | 覆盖 GET 无备注字段、PUT 备注入参兼容处理、状态更新回归 |
| BE-NOTE-07 | 文档更新 | P0 | 后端 handoff、OpenAPI、错误码说明同步更新 |

## Validation Checklist
- 老师端 OSSLT 详情页只保存 `ossltTrackingManualStatus`，接口 200。
- 拉取 OSSLT 模块数据时不再返回 `teacherNote`。
- 批量/单体 OSSLT summary 行为不受影响。
- 语言成绩跟踪(`languageScoreTracking*`)不受此变更影响。

## Rollout Suggestion
1. 先上后端兼容版本（接收旧字段但忽略）。  
2. 前端全量发布后，清理后端兼容分支与废弃字段。  
3. 在下一个里程碑移除数据列（如需要）。
