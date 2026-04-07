# Backend Handoff: Student Selector Column Order Preference (V1)

## Document Info

- Date: 2026-04-07
- Frontend project: `student-management-frontend`
- Scope: `Teacher Preference API` 增强（支持字段顺序持久化）
- Related frontend page key:
  - `goal-management.create-goal.student-selector-columns`

## Background

前端已支持在“选择学生”表格中拖拽列头调整字段顺序（不仅是显示/隐藏）。

当前前端会在保存偏好时提交两类数据：

1. `visibleColumnKeys`：哪些字段可见  
2. `orderedColumnKeys`：字段展示顺序

为了保证跨浏览器、跨设备一致，后端需要持久化并返回 `orderedColumnKeys`。

## P0 Tasks (Must)

1. 扩展偏好 DTO，支持 `orderedColumnKeys`
   - `GET /api/teacher/preferences/{pageKey}` 响应新增可选字段：`orderedColumnKeys: string[]`
   - `PUT /api/teacher/preferences/{pageKey}` 请求新增可选字段：`orderedColumnKeys: string[]`

2. 存储层支持 `orderedColumnKeys`
   - 与 `visibleColumnKeys` 一样按 `teacher + pageKey` 维度持久化
   - 旧记录没有该字段时，不应报错

3. 校验与兼容策略
   - `orderedColumnKeys` 可选；缺失时保持兼容
   - 若提供则应为字符串数组，建议去重+trim
   - 不因新增字段导致老客户端请求失败（避免 strict DTO 导致 400）

## Recommended Request/Response Shape

### PUT

```json
{
  "version": "v2",
  "visibleColumnKeys": [
    "name",
    "email",
    "phone",
    "graduation",
    "schoolBoard",
    "city",
    "teacherNote",
    "status",
    "selectable"
  ],
  "orderedColumnKeys": [
    "name",
    "schoolBoard",
    "city",
    "graduation",
    "email",
    "phone",
    "teacherNote",
    "status",
    "selectable"
  ]
}
```

### GET

```json
{
  "pageKey": "goal-management.create-goal.student-selector-columns",
  "version": "v2",
  "visibleColumnKeys": [
    "name",
    "email",
    "phone",
    "graduation",
    "schoolBoard",
    "city",
    "teacherNote",
    "status",
    "selectable"
  ],
  "orderedColumnKeys": [
    "name",
    "schoolBoard",
    "city",
    "graduation",
    "email",
    "phone",
    "teacherNote",
    "status",
    "selectable"
  ],
  "updatedAt": "2026-04-07T00:00:00Z"
}
```

## Acceptance Checklist

1. 前端 `PUT` 带 `orderedColumnKeys` 时，后端可成功保存且返回 2xx。  
2. 前端 `GET` 可读回同一顺序，刷新后顺序不变。  
3. 对旧数据（仅有 `visibleColumnKeys`）读取不报错。  
4. 旧客户端（不传 `orderedColumnKeys`）写入不报错。  
5. 同一教师、同一 `pageKey` 的偏好隔离生效。  

## Notes

- 这是向后兼容增强，不应影响已有 `visibleColumnKeys` 功能。  
- 如果后端当前对请求体做严格字段白名单校验，请先放开或补充新字段。  
