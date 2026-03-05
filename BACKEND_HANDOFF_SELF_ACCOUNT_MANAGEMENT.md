# 后端任务单：账号管理（学生 + 老师）

## 一、背景
前端已完成“账号管理”入口与页面，支持学生和老师/管理员修改自己的密码。

前端已接入路由如下：

- 学生账号管理：`/account`
- 老师/管理员账号管理：`/teacher/account`
- 首次登录强制改密（已有流程）：
  - 学生：`/change-password`
  - 老师/管理员：`/teacher/change-password`

## 二、后端 P0 任务（必须）

### 1) 自助修改密码接口

`POST /api/auth/change-password`

- 鉴权：必须登录（Bearer Token）
- 角色：`STUDENT` / `TEACHER` / `ADMIN` 均可访问
- 行为：仅修改“当前登录用户”的密码，不能改他人密码

请求体：

```json
{
  "oldPassword": "Old#Password1",
  "newPassword": "New#Password1"
}
```

成功响应：

```json
{
  "success": true,
  "message": "Password changed successfully."
}
```

### 2) 错误码与响应格式统一

建议统一格式：

```json
{
  "status": 400,
  "code": "WEAK_PASSWORD",
  "message": "Password does not meet policy.",
  "details": [
    { "field": "newPassword", "message": "must contain uppercase letter" }
  ]
}
```

建议错误码：

- `401 UNAUTHENTICATED`：未登录或 token 失效
- `400 INVALID_OLD_PASSWORD`：旧密码错误
- `400 SAME_AS_OLD_PASSWORD`：新旧密码相同
- `400 WEAK_PASSWORD`：新密码不符合规则
- `400 VALIDATION_ERROR`：字段缺失或格式不正确

### 3) 密码策略与前端保持一致

`newPassword` 最少满足：

- 长度 >= 8
- 包含大写字母
- 包含小写字母
- 包含数字
- 包含特殊字符
- 不包含空格
- （建议）不能包含用户名

## 三、后端 P1 任务（建议）

### 1) 当前用户信息接口（可选）

`GET /api/auth/me`

用于后续账号管理页展示账号信息（用户名、角色、邮箱、最近改密时间等）。

示例响应：

```json
{
  "userId": 1,
  "username": "teacher001",
  "role": "TEACHER",
  "teacherId": 12,
  "studentId": null,
  "displayName": "Teacher A",
  "email": "teacher@example.com",
  "passwordUpdatedAt": "2026-03-04T13:20:00Z"
}
```

### 2) 安全增强（建议）

- 修改密码成功后，失效该用户其他在线 token/session（至少可配置）
- 针对旧密码连续错误增加限流/锁定策略
- 记录审计日志：`userId`、时间、IP、UA、结果（成功/失败）

## 四、数据库任务

至少确认以下字段存在并正确维护：

- `users.password_hash`
- `users.password_updated_at`（修改密码后更新）

如有审计要求，新增审计表（或接入日志系统）：

- `user_password_change_logs`（示例）

## 五、验收清单（QA）

1. 学生在 `/account` 可成功修改自己的密码。
2. 老师/管理员在 `/teacher/account` 可成功修改自己的密码。
3. 旧密码错误时，返回 `INVALID_OLD_PASSWORD`，且密码不被修改。
4. 弱密码返回 `WEAK_PASSWORD`，并附带 `details`。
5. 改密成功后，旧密码登录失败，新密码登录成功。
6. 首次登录强制改密流程（`/api/auth/set-password`）不受影响。
7. 鉴权失效时返回 `401 UNAUTHENTICATED`，前端能正确跳登录。

## 六、给后端 Codex 的提示词（可直接复制）

```text
请在后端实现“自助账号管理改密”能力，要求如下：

1. 新增/完善接口 POST /api/auth/change-password
   - 仅允许已登录用户修改自己的密码
   - 请求体: { oldPassword, newPassword }
   - 成功返回: { success: true, message: "Password changed successfully." }

2. 统一错误响应结构:
   { status, code, message, details[] }
   并至少支持:
   - 401 UNAUTHENTICATED
   - 400 INVALID_OLD_PASSWORD
   - 400 SAME_AS_OLD_PASSWORD
   - 400 WEAK_PASSWORD
   - 400 VALIDATION_ERROR

3. 密码策略与前端一致:
   - >= 8 位
   - 大小写字母 + 数字 + 特殊字符
   - 不含空格
   - 建议不能包含用户名

4. 数据库与安全:
   - 仅存 password_hash
   - 更新 password_updated_at
   - 建议增加审计日志和连续失败限流
   - 建议改密后使其他会话失效

5. 保证现有首次登录强制改密 set-password 流程不被破坏。

请提交：
- 控制器/服务/验证器代码
- 迁移脚本（如有）
- 单元测试与集成测试
- API 文档更新
```
