# IELTS / English Requirement Tracking v1 (Frontend-led)

## 第 1 部分：现有项目接入分析

- 现有路由结构已区分学生与老师上下文：
  - 学生档案：`/student/profile`
  - 老师代管档案：`/teacher/students/:studentId/profile`
  - 参考：[src/app/app.routes.ts](src/app/app.routes.ts)
- 本次新增路由（已落地）：
  - 学生：`/student/ielts`
  - 老师：`/teacher/students/:studentId/ielts`
  - 参考：[src/app/app.routes.ts](src/app/app.routes.ts)
- 学生端入口建议：
  - Dashboard 快捷按钮（已加）
  - Student Profile 顶部操作区（已加）
- 老师端入口建议：
  - Student Management 列表行内快捷按钮（已加）
  - 未来可在学生详情页增加 IELTS 摘要卡（v1 已在 IELTS 页面实现）
- 复用点：
  - 学生基本档案字段与老师代管模式复用 `StudentProfileService`
  - `StudentProfile` 本身已支持 self/managed 模式切换，IELTS 页面沿用同样的 route context 逻辑
  - 老师列表页行内按钮模式与“编辑档案”一致（降低学习成本）

## 第 2 部分：页面与交互流程

### 学生端填写流程
1. 进入 IELTS 页面，先展示 tracking summary（基于当前事实 + 规则派生）。
2. 问题 1：`Have you taken IELTS Academic?`（Yes/No）。
3. Yes：
   - 填写 1..n 条记录：`testDate/listening/reading/writing/speaking`
   - overall 自动计算（只读，不可手填）
   - 每条记录显示派生标签：`Latest record / Latest valid record / Expired / Outside graduation window`
4. No：
   - 问题 2：`Are you preparing for IELTS?`（Yes/No）
   - 形成可存档状态（`PREPARING` 或 `NOT_PREPARING`）

### 老师端查看/编辑流程
1. 老师在学生列表点击 `IELTS` 进入 `/teacher/students/:studentId/ielts`。
2. 页面结构与学生端相同，但在 teacher context 下可直接编辑并保存。
3. 进入/返回路径保持与现有“编辑档案”一致，减少额外培训成本。

### 列表页/详情页展示建议
- v1（已落地）：
  - 列表页提供 IELTS 快捷入口按钮。
  - IELTS 详情页展示多条记录及状态派生标签。
- v1.1 建议（未落地）：
  - Student Management 增加一列 `IELTS Tracking`（例如 `Strict/Common/Yellow`）
  - 支持按 trackingStatus 过滤风险学生。

### 空状态/错误状态/未完成状态/过期状态
- 空状态：未填记录时提示 “Add at least one test record.”
- 错误状态：接口失败显示 banner。
- 未完成状态：未选择 Yes/No 或 No 但未选 prep intent 时阻止保存。
- 过期状态：显示 `Expired` 标签，不参与最终 strict/common 判定。

## 第 3 部分：状态机与业务规则

### 原始事实 vs 系统判断
- 原始事实（用户输入/后端持久化）：
  - `hasTakenIeltsAcademic`
  - `preparationIntent`
  - `records[]`（testDate + 4 个单项）
- 系统判断（前端派生，不回填为原始事实）：
  - `validityStatus`（VALID/EXPIRED/OUTSIDE_GRADUATION_WINDOW/INVALID_DATE）
  - `thresholdMatch`（STRICT_PASS/COMMON_PASS/BELOW_COMMON）
  - `trackingStatus`（GREEN_STRICT_PASS/GREEN_COMMON_PASS_WITH_WARNING/YELLOW_NEEDS_PREPARATION）
  - `latestRecord`、`latestValidRecord`

### 状态机（文字版）
1. `ENTRY` -> 根据 `shouldShowIeltsModule` 决定展示或隐藏入口内容。
2. `HAS_TAKEN = NO`：
   - `PREPARING` -> `YELLOW_NEEDS_PREPARATION`
   - `NOT_PREPARING` -> `YELLOW_NEEDS_PREPARATION`（文案区分）
3. `HAS_TAKEN = YES`：
   - 无有效成绩 -> `YELLOW_NEEDS_PREPARATION`
   - 有效成绩命中 strict line -> `GREEN_STRICT_PASS`
   - 有效成绩命中 common line（未命中 strict）-> `GREEN_COMMON_PASS_WITH_WARNING`
   - 其余 -> `YELLOW_NEEDS_PREPARATION`

### 多条成绩选取规则
- `latest record`：按 testDate 最新。
- `latest valid record`：在业务有效窗口内按 testDate 最新。
- 判定 trackingStatus 只基于 `latest valid record`。

### 有效期业务规则（已实现）
- 输入：`graduationYear`
- 计算：
  - `anchorDate = graduationYear-05-31`
  - `cutoffDate = (graduationYear - 2)-05-31`
- 有效条件：`cutoffDate <= testDate <= anchorDate`

### 规则配置化（已实现）
- 统一放在 `src/app/features/ielts/ielts-rules.ts`
- 不在组件散写阈值/文案/颜色。

## 第 4 部分：阈值调研任务（官方页面样本）

> 说明：以下是“代表性样本调研”，不是“全加拿大穷尽覆盖”。  
> 因此 v1 命名使用保守术语：`common admission line` 与 `conservative internal strict line`。

### 样本结论（IELTS Academic）
- 常见本科 baseline（大量学校）：`Overall 6.5 + 单项不低于 6.0`
  - UBC：6.5 overall，no part < 6.0（单次成绩）  
  - U of T Mississauga：6.5 overall，no band < 6.0  
  - Queen’s：6.5 overall，no band < 6.0  
  - Western：6.5 overall，each >= 6.0  
  - Carleton：6.5，each >= 6.0  
  - Manitoba：6.5 overall，each >= 6.0
- 更严格线（存在项目/学院差异）：
  - Waterloo：常规即要求写作 6.5、口语 6.5（其余 6.0）
  - York：明确“部分专业要求更高”，示例中 Nursing/Schulich 到 7.0
  - UNB：部分本科项目要求 IELTS 7.0
  - uOttawa Telfer BCom FAQ：6.5 overall + writing >= 6.5

### v1 前端阈值建议（已实现）
- `common admission line`：
  - overall >= 6.5
  - L/R/W/S >= 6.0
- `conservative internal strict line`：
  - overall >= 7.0
  - L/R/W/S >= 6.5

### 命名严谨性
- 不使用 “guaranteed pass” 等误导术语。
- `GREEN_*` 文案明确：用于内部追踪，不等同所有学校所有专业无条件满足。

## 第 5 部分：TypeScript 类型设计

类型均已落在 `src/app/features/ielts/ielts-types.ts`：

- 原始数据：
  - `IeltsRecordFormValue`
  - `IeltsPreparationIntent`
  - `StudentLanguageRiskSnapshot`
  - `StudentIeltsModuleState`
  - `UpdateStudentIeltsPayload`
- 派生数据：
  - `DerivedValidityStatus`
  - `DerivedThresholdMatch`
  - `IeltsTrackingStatus`
- 视图模型：
  - `IeltsRecordViewModel`
  - `IeltsSummaryViewModel`
  - `TeacherStudentIeltsSummary`

## 第 6 部分：mock 数据与本地开发方案

- mock 数据文件：`src/app/features/ielts/ielts-mock-data.ts`
- 覆盖场景（已覆盖）：
  - 没考过，准备考（20001）
  - 没考过，不准备考（20002）
  - 考过但过期（20003）
  - 考过，达到 common line（20004）
  - 考过，达到 strict line（20005）
  - 多条记录：旧记录过期、最新有效（20006）
  - 多条记录：最新在毕业窗口外、较早记录仍有效（20007）
  - 非风险样本（入口隐藏，20008）
- 当前 service 默认 `useMock = true`（`src/app/services/ielts-tracking.service.ts`）。
- 切换真实 API：
  - 将 `useMock` 改为 `false`
  - 后端按第 7 部分契约提供接口即可联调。

## 第 7 部分：Angular service 与 API 契约

### 前端 service 方法（已实现签名）
- `getStudentIeltsModuleState(studentId)`
- `saveStudentIeltsRecords(studentId, payload)`
- `saveStudentIeltsPreparationIntent(studentId, intent)`
- `getTeacherStudentIeltsSummary(studentId)`
- `updateTeacherStudentIeltsData(studentId, payload)`

文件：`src/app/services/ielts-tracking.service.ts`

### 前端需要后端返回的既有字段
- 用于入口显示：
  - `shouldShowIeltsModule`（推荐后端直接返回）
  - 或 `languageRiskFlag` + 既有档案字段组合
- 用于有效期计算：
  - `graduationYear`（或可解析出毕业年月的字段）
- 风险快照建议字段：
  - `firstLanguage`、`citizenship`、`canadaStudyYears`、`hasCanadianHighSchoolExperience`

### 最小 API 契约 v1（建议）
- `GET /api/student/ielts-module`
- `PUT /api/student/ielts-module/records`
- `PUT /api/student/ielts-module/preparation-intent`
- `GET /api/teacher/students/{studentId}/ielts-module`
- `PUT /api/teacher/students/{studentId}/ielts-module`
- `GET /api/teacher/students/{studentId}/ielts-summary`

响应主体建议统一为 `StudentIeltsModuleState`，summary 可单独接口或由前端派生。

## 第 8 部分：前端驱动后端清单（P0/P1/P2）

### P0（前端联调阻塞项）
- 返回 `shouldShowIeltsModule` 或等价风险布尔。
- 返回 `graduationYear`（或可稳定解析）。
- 提供 `GET/PUT student ielts-module` 基础读写。

### P1（提升老师端效率）
- 提供 `teacher summary`（含 latest valid record + trackingStatus）。
- 列表聚合接口支持批量 studentId，避免 N+1。

### P2（增强阶段）
- 规则版本化下发（前端读 ruleSet，而不是内置常量）。
- 项目/专业维度阈值覆盖（如 nursing/business/engineering profile）。
- 操作审计字段（`updatedByRole`, `updatedByUserId`）。

---

## 已落地代码文件（MVP）

- 路由与入口：
  - `src/app/app.routes.ts`
  - `src/app/pages/dashboard/dashboard.component.ts`
  - `src/app/pages/student-profile/student-profile.ts`
  - `src/app/pages/student-profile/student-profile.html`
  - `src/app/pages/student-management/student-management.component.ts`
- IELTS 领域：
  - `src/app/features/ielts/ielts-types.ts`
  - `src/app/features/ielts/ielts-rules.ts`
  - `src/app/features/ielts/ielts-derive.ts`
  - `src/app/features/ielts/ielts-mock-data.ts`
  - `src/app/services/ielts-tracking.service.ts`
  - `src/app/pages/ielts-tracking/ielts-tracking.component.ts`
  - `src/app/pages/ielts-tracking/ielts-tracking.component.scss`

## 官方页面参考（调研来源）

- UBC English competency: https://you.ubc.ca/applying-ubc/requirements/english-language-competency/
- Waterloo English language requirements: https://uwaterloo.ca/future-students/admissions/english-language-requirements
- U of T Mississauga English requirements: https://www.utm.utoronto.ca/future-students/admissions/english-language-requirements
- Queen’s English proficiency: https://www.queensu.ca/admission/applicants/english-proficiency
- Western English proficiency: https://welcome.uwo.ca/next-steps/requirements/english-language-proficiency.html
- York language tests: https://futurestudents.yorku.ca/requirements/language-tests
- University of Manitoba English proficiency: https://umanitoba.ca/explore/undergraduate-admissions/requirements/english-language-proficiency-requirements
- Dalhousie English requirements: https://www.dal.ca/admissions/how-to-apply/undergraduate-admissions/international-applicants/english-language-requirements.html
- Carleton ESL/English requirements: https://admissions.carleton.ca/esl/
- UNB English requirements: https://www.unb.ca/international/admission/english.html
- uOttawa Telfer BCom international FAQ: https://telfer.uottawa.ca/en/bcom/faq/international-students/
