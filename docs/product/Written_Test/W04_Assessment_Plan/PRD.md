# W04 产品文档：候选人测评计划

| 项 | 内容 |
|---|---|
| 模块 | W04 / 主闭环第 2 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter、Hiring Manager |
| 原型路由 | `#/cases/:id/plan`（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🟡 后端 `plan-items` 提供某 Case 的计划项增删改（快照题目内容，含 `customPrompt`、`kind`、`competencies`、`deliverables`）；前端 `PlanPage` 和 `AssessmentQuestionDrawer` 已接真实接口。计划版本、前置条件、计划批准未实现。未逐项验证 AC |
| 依据 | [PRD v1.4 §5、§9](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §5](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §4、P12](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md) |

## 1. 背景与目标

一个候选人可能要做多项测试：必评、选评、为补证据加的题，以及看过提示后的修订。如果这些混在一起、或者新计划覆盖了已完成的作答，就无法判断候选人到底在什么条件下做了什么。

**目标**：每个 Case 有一份带版本的测评计划，逐项区分类型和状态；确认后冻结成待发送版本；新版本不覆盖已完成的 Attempt。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 计划页四个 tab：Assessment plan / Submission / Comprehensive evaluation / Evaluation result | Submission、评分、结果 tab 的具体功能（W07、W08、W09） |
| 验证目标、负责人（Owner）、提交截止时间 | 发送邀请（W05） |
| 添加题目：从题库选择 / AI 生成 | 题库维护（W01） |
| 编辑、删除未发送的计划项 | |
| PlanItem 类型：必评、选评、补证、修订 | |
| 前置条件（串行 / 并行） | |
| 计划版本与历史 | |
| 跨岗位复用原作答 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 计划页顶部显示候选人、岗位、当前状态和面包屑（从 My Tasks 进入时返回 My Tasks） |
| FR-2 | 未确认招聘关系时显示「Confirm the candidate's role link first」，发送按钮禁用 |
| FR-3 | 显示验证目标（如「通过本岗位测评验证候选人是否具备……核心能力」）、Owner（未设置时默认发起人）、提交截止时间 |
| FR-4 | **Add assessment question** 打开抽屉，两种来源：From Question Bank、AI-generated；AI 生成需填写 Test focus，并给出基于岗位要求的建议 |
| FR-5 | 从题库选择时显示「Approved v1；下方修改只作用于该候选人的草稿，不改变岗位预设」 |
| FR-6 | 每个计划项显示编号、标题、类型（必评 / 选评 / 补证 / 修订）、方式（timed 分钟数 / deadline only）、状态；已发送的项显示 Sent，不可编辑或删除 |
| FR-7 | 未发送的计划项可 **Edit question**、**Delete question** |
| FR-8 | 页面说明「确认后冻结为待发送版本，不会立即发给候选人」 |
| FR-9 | PlanItem 可设置前置条件（串行或并行）；前置满足时只生成待确认任务，不自动发送 |
| FR-10 | 计划修改生成新的计划版本，可查看 History；已完成的 Attempt 保留在原版本下 |
| FR-11 | 收到上传但未正式提交时提示「Answers uploaded — awaiting candidate submission」，说明尚未评分 |
| FR-12 | 无计划项时显示空状态和「Add assessment question」入口 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | AssessmentProject 管目标，Assessment 是一份发布的测评，AssessmentPlan 管某个 Case 的多项测试 |
| BR-2 | 新计划版本不覆盖已完成的 Attempt |
| BR-3 | 前置条件满足只生成待确认任务，不自动推进 |
| BR-4 | 参考组合：Finance 为 FIN-001 + FIN-002；SIA 为 FIN-004 + FIN-008；Hybrid 按必要性选择，不强制四题 |
| BR-5 | 跨岗位复用原作答需要权限，并用新岗位的标准重新评价；岗位转看只产生关联提案，不替换原 Case |
| BR-6 | 计划项保存题目的精确版本快照，题库修改不影响计划项 |
| BR-7 | 概念题不能加入可发送的计划项 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Case（W03）、QuestionVersion（W01）、Assessment（W02） | |
| 输出 | AssessmentPlan | case、版本号、状态、Owner、验证目标、截止时间 |
| 输出 | PlanItem | question_version、ScoringProfile、类型、前置条件、状态、候选人级别调整 |
| 输出 | PlanReview | 审阅人、结果、时间 |

## 6. 权限

- 能访问该 Case 的员工可编辑未发送的计划项。
- 计划是否需要批准见「待确认」第 1 条。

## 7. 非功能要求

- 双击 Add / Delete 只生效一次。
- 刷新页面后计划项不丢失（已由后端快照保证）。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 未确认招聘关系时不能发送，提示原因 | A、Brief F03 |
| AC-2 | 从题库添加题目后修改内容，题库原题不变 | A、Brief §5.2 |
| AC-3 | 已发送的计划项不能编辑或删除 | A |
| AC-4 | 修改计划生成新版本，已完成的 Attempt 仍在原版本下可见 | PRD §5 |
| AC-5 | 前置条件满足后生成待确认任务，没有自动发出邀请 | PRD §5 |
| AC-6 | 按未测能力添加 FIN-002 / FIN-008 作补测，生成新的 PlanItem，不改变旧分数 | Brief P12 |

## 9. 依赖与实现

- 后端：`src/plan-items`、`src/cases`。
- 前端：`PlanPage`、`AssessmentQuestionDrawer`、`data/realPlanItemsMerge.ts`。
- 依赖：W01、W02、W03。下游 W05。

## 10. 待确认

1. PRD §12 有「计划批准」任务、Brief 有 Approve plan 动作，原型 Settings 则写明没有审批队列。计划是否需要批准，由谁批准？
2. 原型允许针对单个候选人修改题目内容（后端 `customPrompt`），与 PRD「试卷选择精确 QuestionVersion」是否冲突：修改后的题目是否算新版本、能否与其他候选人比较？
3. 后端 `PlanItem.kind` 目前只有 required / optional，补证和修订类型如何表示。
