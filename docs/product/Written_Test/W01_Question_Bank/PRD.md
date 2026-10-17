# W01 产品文档：题库与题目版本

| 项 | 内容 |
|---|---|
| 模块 | W01 / 准备阶段第 1 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter、Hiring Manager / Reviewer（出题、审阅、发布）；Admin |
| 原型路由 | `#/question-bank`、`#/questions/:id`（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🟡 后端 `questions` 提供列表、新建、修改、删除、收藏；`Question` 只有一个整数 `version` 字段，没有独立的版本记录、材料、Rubric、内部答案、岗位映射表；前端 `QuestionBankPage`、`QuestionDetailPage` 已接真实接口。ZIP 导入、Candidate preview、发布 / 停用流程未确认。未逐项验证 AC |
| 依据 | [PRD v1.4 §4](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §5](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §5.2、P01、P02](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md) |

## 1. 背景与目标

同一道题经常用于多个岗位、考察多种能力。如果每个岗位各存一份、或者改题后已经发出去的内容跟着变，评分就无法追溯，候选人之间也不可比。

**目标**：题库是独立主导航，每道题有稳定编号和版本，可映射多个岗位和能力；已发送的内容固定在发送时的版本；内部答案永远不出现在候选人视图。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 题目列表：搜索、岗位 / 能力过滤、收藏、标签、列表 / 卡片切换 | 组卷与 AI 出题（W02） |
| 题目详情 Prompt / Materials / Rubric / Usage / Versions 五个 tab | 把题目加入候选人计划（W04） |
| Candidate preview（只渲染候选人可见字段） | 发送题目给候选人（W05） |
| 手工创建、克隆、模板、编辑生成派生版本 | 修改上游 JD |
| ZIP 导入：区分材料、题目、内部答案、旧候选人提交 | |
| 发布、停用、版本历史 | |
| 已见题 / 提示记录（Usage） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 列表默认显示 Code、Title、Role tags、Competencies、Type、Difficulty、Version、Status；可切换卡片视图 |
| FR-2 | 支持按标题 / 编号搜索，按岗位、能力过滤；无结果时显示「No questions match these filters.」 |
| FR-3 | 选中题目后右侧预览，列表页不提供直接发送给候选人的动作；页面说明「发布题目不等于发送，邀请是单独一步」 |
| FR-4 | 题目字段：稳定编号、版本、使用方式（书面 / 文件 / 口头）、语言、难度、预计时长、提示、材料、交付清单、能力 / 岗位映射、Rubric、内部答案、AI 指令、作者、来源、质量审阅结果、发布状态 |
| FR-5 | 详情页 Rubric tab 中的内部答案旁标 **Reviewer only — never shown to candidates** |
| FR-6 | **Preview candidate view** 打开独立预览，只显示题目、候选人可见材料和交付清单，不含 Rubric、内部 notes、答案 |
| FR-7 | Usage tab 列出用到该题的 Case、看过该版本的候选人、岗位映射；没有外部记录的显示 Unknown |
| FR-8 | Versions tab 列出 Current / Earlier revision、Published / Superseded；编辑已发布题目生成新的派生版本 |
| FR-9 | **Import ZIP** 先解析并预览：题目、材料、内部答案分别列出；人工确认内部答案和旧候选人提交不会外发后才导入 |
| FR-10 | 支持 **Create question**、克隆、从模板创建 |
| FR-11 | 发布、停用操作留历史；停用的题不能被新计划选用，已发送的不受影响 |
| FR-12 | 概念题（如 FIN-009 / FIN-010，Prompt、材料、Rubric 未定义）标为草稿，详情页提示「Draft the assessment before inviting candidates」，所有邀请入口禁用并说明原因 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 一道题可映射多个 RoleProfile / Job、测试多个 Competency；QuestionRoleMapping 描述适用性，ScoringProfile 描述该岗位怎么评 |
| BR-2 | 试卷和计划引用精确的 QuestionVersion 和 ScoringProfile；修改题库不影响已发送内容 |
| BR-3 | 已发布的 QuestionVersion 不可原地修改，只能生成新版本 |
| BR-4 | 主观题必须有 criterion 和 anchors；评分标准未定义的题不能发出，不允许「先邀请后补标准」 |
| BR-5 | ZIP 中的旧候选人提交只能作为历史参考，永远不重新导出给候选人 |
| BR-6 | 岗位引用 Core Job，材料引用 Core FileVersion，题库不复制 JD 作为可写主档 |
| BR-7 | FIN-001/002/004/008 是参考案例；FIN-003 是 follow-up guide；FIN-009/010 是概念题，不能直接发送 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Core Job / RoleDefinitionVersion | job_id、role 版本 |
| 输入 | Core FileVersion | 材料文件 |
| 输出 | Question / QuestionVersion | 编号、版本号、状态（draft / published / deprecated）、字段见 FR-4 |
| 输出 | QuestionRoleMapping | question_version、job_ref、能力列表 |
| 输出 | ScoringProfile | criterion、满分、能力分配、anchors |
| 输出 | QuestionExposure | 候选人、版本、见过的提示 |

## 6. 权限

- 内部答案、Rubric、AI 指令只对员工可见；候选人视图（包括 Candidate preview 的渲染数据）不得包含这些字段。
- 发布 / 停用的权限范围见「待确认」第 1 条。

## 7. 非功能要求

- 双击发布只生成一个版本。
- 两人同时编辑同一题时有冲突提示，不静默覆盖。
- 长标题、长文件名在所有主题和字号下可读。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 同一题映射两个岗位、三种能力，在两个岗位的题库过滤中都能找到 | A、Brief P01 |
| AC-2 | 编辑已发布题目生成新版本；已发送邀请仍显示原版本内容 | A、Brief §5.2 |
| AC-3 | Candidate preview 和候选人页面的 DOM / 数据中不含 Rubric、内部答案、notes | Brief P02 |
| AC-4 | ZIP 导入的预览把内部答案和旧候选人提交单独标出，未确认前不入库 | Brief P02 |
| AC-5 | 概念题的所有邀请入口禁用，并显示原因 | A、Brief P02 |
| AC-6 | 停用的题不能被新计划选用；已发送的邀请不受影响 | A |
| AC-7 | Usage 中没有外部记录的显示 Unknown，不显示 0 | PRD §4 |

## 9. 依赖与实现

- 后端：`src/questions`（`questions.service.ts`、`questions.controller.ts`）。
- 前端：`QuestionBankPage`、`QuestionDetailPage`、`QuestionCreateDrawer`。
- 依赖：Core Job / File（W18）。下游 W02、W04。

## 10. 待确认

1. 已由 Owner 在 #365 确认直接发布，不新增审批队列；不在本轮扩展身份、角色及权限模型。
2. #365 先落地 QuestionVersion，RoleMapping、ScoringProfile 不随本轮重构。
3. 题目语言默认值：后端默认「中文」，PRD §14 要求英文界面；题目内容语言与界面语言是否分开。
4. 收藏是个人偏好还是团队共享（后端 `favorite` 字段在题目上，即团队共享）。

## 11. #368 停用契约（2026-10-17）

- Owner 确认 Estimate 5，沿用工作区访问规则，不扩展角色权限。
- `POST /api/questions/:id/deprecate` 携带 `expectedRevision`，仅停用当前已发布版本；原子保存状态与 `QuestionDeprecation`（操作者、版本、时间）。同版本重复停用返回 replay，过期修订返回 409。
- `GET /api/questions/:id/deprecations` 返回当前工作区题目的停用历史。新计划 UI 排除停用题，服务端同时拒绝引用；旧邀请保留原有快照。
- 停用后不能直接重新发布旧修订，必须编辑保存为新草稿，再显式发布新版本。历史版本及停用记录不变。
- 部署先执行 `20261017230000_question_deprecations`，再更新服务。回滚时保留审计表并暂停题库写入，避免旧代码绕过停用状态保护。

## 12. #365 实施边界（2026-10-17）

- 新建题目保存为草稿（存储值 `draft_review`），首次发布前版本号为 0；详情可复核提示与能力占比，然后直接发布。标题、题干和非空能力列表必填，能力占比必须为正且总和为 100%。
- `Question.revision` 是可变草稿的并发令牌，`Question.version` 是最近发布版本号。内容编辑必须携带 `expectedRevision`，保存后递增修订号并回到草稿；收藏不改变修订号或发布状态。
- `POST /api/questions/:id/publish` 携带 `expectedRevision`，锁定题目后生成不可变 `QuestionVersion`；重复发布同一修订返回 `replayed: true`，不生成第二份。过期修订返回 409，失败事务不留下半发布状态。
- `GET /api/questions/:id/versions` 返回版本内容、发布人和时间。编辑没有修改版本快照的接口；删除题目为软删除，不删除计划或版本记录。
- 新增题库计划项必须携带 `bankQuestionId` 与 `bankQuestionVersion`。服务端校验当前已发布版本，使用服务器快照内容并保存 `bankQuestionVersionId`，拒绝草稿、过期版本及跨工作区引用。已有计划和邀请继续保留各自快照，不随题库编辑变化。
- 迁移 `20261017210000_question_versions` 仅保留现存已发布内容，标记 `historicalBaseline`；原发布人和时间未知时保持空值，不生成虚构旧版本。历史计划不反推版本外键。迁移基线的创建时间不等于原发布时间。
- 本轮没有补全 W01 全部长期范围，例如 ZIP、材料与内部答案建模、停用工作流、RoleMapping/ScoringProfile；#365 的验收范围以上述已确认行为为准。
- 部署须先备份并执行兼容迁移，再启动新后端与前端；不要只更新前端。回滚应用不能删除已产生的版本快照，旧应用会绕过草稿发布约束，因此需暂停题库写入后回滚，恢复版本感知代码前保持只读。
