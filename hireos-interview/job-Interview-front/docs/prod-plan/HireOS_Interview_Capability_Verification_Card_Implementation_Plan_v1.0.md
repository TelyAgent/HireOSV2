# 能力验证卡与要求评分标准 / 面试提要实现计划

日期：2026-09-15
状态：待评审的实施方案；本文不表示功能已经实现。
范围：Requirements & Rubric（岗位要求与评分标准）生成、Capability Verification Card（能力验证卡）JD 级基线与候选人级匹配、Interview Brief（面试提要）问题生成。不含 Live/Review/Debrief/Decision/Package 后端接入。

## 1. 需求依据与结论

依据以下文档及当前代码：

- [PRD v1.5](../HireOS_Command_Interview_PRD_v1.5.md)：Section 4（Claim 不等于事实验证、Unknown 用空分数不用 0/1、AI 与人工分离）、Section 6 INT-02/INT-03/INT-07/INT-08、Section 7（1–5 Rubric、证据强度与置信度独立、Must-have 不可被其他高分抵消）、Section 9 domain model（EvidenceItem ↔ EvidenceLink ↔ RequirementEvaluation）。
- [Interface Spec v1.0](../HireOS_Command_Interview_Interface_Spec_v1.0.md)：来源引用、版本化确认的既有约定。
- [Capability Verification Cards Addendum v0.1](/Users/qmk/work/HireOS-command/Interview/HireOS_Command_Interview_Capability_Verification_Cards_Addendum_v0.1.md)（CMD-INT-003）：定义能力验证卡对象、职责类型（主导/协同/配合）与 Card-P0/P1/P2 优先级、JD-only 与候选人关联两阶段生成、HR 与业务面试官分工。

**结论**：能力验证卡是 Requirement / Competency / Rubric 之上的面试准备读模型，不替代 Rubric，也不替代 Evidence（Addendum §9.1）。同一 JD 的能力验证卡与 Rubric 只在 JD 级生成一次；候选人关联简历后，系统另外生成该候选人的经历匹配结果，二者分表存储，避免不同候选人互相覆盖同一份岗位标准。Card-P0/P1/P2 仅用于职责验证优先级，产品文案与数据字段严格与既有 INT-P0/P1/P2（研发优先级）隔离（Addendum §4、§9.2）。

生成流程复用 Intake 模块已落地的两段式基础设施：`ParsingService` 的租约式异步队列（`job-Interview-backend/src/intake/parsing.service.ts:9`）与 `AiService.extract`（`job-Interview-backend/src/intake/ai.service.ts:11`）的 JSON Schema 结构化输出、来源引用校验模式。新增生成类型接入同一张 `ParseJob` 表，不新建第二套调度实现。

## 2. 当前实现与缺口

| 位置 | 当前行为 | 本阶段改造 |
|---|---|---|
| `src/pages/project/RubricPage.tsx` | 渲染 `src/data/comps.ts` 中的 `COMPS` 静态数组；`rubricExtracted`/`rubricConfirmed`/`rubricVersion` 是全局 Store 布尔值，与具体 Task 无关，刷新或切换任务不隔离 | 改为按当前 Job 拉取真实 `CapabilityCard`/`RubricVersion`；确认、编辑、新建版本均调用真实接口并带乐观锁 |
| `src/pages/project/BriefPage.tsx` | 渲染 `src/data/evidence.ts` 中按 `jdOnlyDraft`/`r1Done`/`r2Done` 分支拼出的固定证据行；无候选人经历匹配、无 STAR 问题生成 | 改为按当前 Task 与选中 Round 拉取真实 `CandidateCardMatch` 与生成的 `InterviewQuestion` |
| `src/pages/project/PlanPage.tsx` | 已真实：按 `taskId` 拉取 `InterviewRound`，Drawer 编辑走乐观锁版本 API（`RoundDraft`/`loadRounds`） | 作为本次新增页面接入模式的参照，不改动 |
| `job-Interview-backend/prisma/schema.prisma` | 有 `Job`/`Candidate`/`Resume`/`InterviewTask`/`InterviewRound`/`Interviewer`/`Material`/`ParseJob`/`Revision`；没有任何 Rubric/Card/Question 相关表 | 新增 `RubricVersion`/`CapabilityCard`/`CandidateCardMatch`/`InterviewQuestion` |
| `job-Interview-backend/src/intake/contracts.ts` | `extractionSchema` 只覆盖 JD/简历字段级抽取（title/name/email/facts） | 新增 `cardGenerationSchema`、`cardMatchSchema`、`questionGenerationSchema` |
| `job-Interview-backend/src/intake/ai.service.ts` | `extract(type, input)` 硬编码 `extractionSchema` 与固定 system prompt，`type` 参数目前只影响提示词末尾一句话 | 需要按 `type` 选择 schema 与 prompt（见第 5.3 节），否则新生成类型无法复用同一服务 |
| `job-Interview-backend/src/intake/parsing.service.ts` | `tick()` 对所有 `ParseJob` 一视同仁地调用 `ai.extract`，结果写回 `result` 字段后状态置为 `needs_review` | 沿用不改结构；仅需确认新 `type` 值的结果落地由各自 Service 消费 `needs_review` 状态并转正式记录 |

沿用现有页面布局、Drawer 交互、Pill 组件（`src/utils/status.tsx`）与中英文双语体系，不重新设计视觉，仅将数据源从 Store 全局 mock 切换为按 Job/Task 的真实接口。

## 3. 分期边界

### 本阶段交付

1. JD 确认后，可在 Requirements & Rubric 页生成 JD 级能力验证卡与 Rubric 草稿（5.1 JD-only 阶段）；此时 `Matched Resume Experience` 为空，`Evidence Status` 为 Unknown。
2. 能力验证卡与 Rubric 人工编辑、确认、创建新版本，确认后的版本号绑定后续所有引用（复用 `InterviewRound` 已有的乐观锁模式）。
3. 候选人关联简历后，异步生成该候选人对同一套能力验证卡的经历匹配（5.2 阶段）：匹配置信度、来源引用（简历文件/段落/原文摘录）、未匹配 Card-P0 的明显提示。
4. Interview Brief 按 Round 生成 STAR 问法建议，来源为该 Round 的 `competencies` 与匹配到的能力验证卡；未匹配部分展示为 Unknown，不臆造经历。
5. RubricPage.tsx、BriefPage.tsx 从全局 mock 状态改为按 `currentTaskId`/`job` 的真实接口读取。

### 后续阶段

- HR Brief 与 Interviewer Brief 的界面拆分（Addendum §7.3、§9.5）；本阶段先生成统一的能力验证卡与问题集合，角色过滤留待后续。
- Live Interview 中当前问题区域展示能力卡、Evidence Gap 提醒（Addendum §7.4）；Review/Debrief 从分数回溯能力卡的链路（Addendum §7.5）；均依赖尚未建模的 `EvidenceItem`/Scorecard，不在本阶段范围。
- Candidate Resume Drawer 的“Matched to capability cards”专属区域（Addendum §7.2）；本阶段先在 Brief 页展示匹配结果，抽屉内嵌入 UI 留待后续，避免同一批改动跨过多页面。
- AI 建议追问、Evidence Gap 检测、面试官校准（PRD INT-13/INT-14，P1）。

## 4. 用户流程与输入规则

1. Rubric 页在 Job 处于 `reviewed` 状态后可触发“从 JD 生成能力验证卡”，等价于现有“从 JD 中提取要求”入口，但输出对象是 `CapabilityCard[]` + `RubricVersion` 草稿，而不是 `RubricPage.tsx` 现有的布尔标志。
2. 草稿展示后必须人工确认才能进入 Plan；未确认时 Plan/Schedule/Brief 均不得读取草稿版本作为最终标准（沿用 PRD Section 4 原则 1、4）。
3. 编辑草稿中的等级要求、权重或新增/删除卡片，均视为人工修订；确认后生成新的 `RubricVersion`，历史版本只读，已有 Round/Brief 引用旧版本号不被静默改写。
4. 候选人（Resume）关联到某个 Task 后，系统排队一个候选人级匹配任务；只有存在已确认的 `RubricVersion` 时才允许排队，避免匹配结果绑定尚未定稿的卡片集合。
5. 匹配结果不自动产生分数或推荐；找不到对应经历的卡片必须显示“未找到相关经历”，不得留空当作已验证（Addendum 原则 3）。
6. Brief 页的问题生成以 Round 为单位：读取该 Round 的 `competencies` 标签，筛选出对应的已确认能力验证卡及其（若有）候选人匹配结果，生成 STAR 问法草稿；候选人未关联或匹配未完成时，问题生成仍可运行，但仅基于卡片本身的 `Expected Evidence`，不能假造候选人经历。

## 5. AI 处理契约

### 5.1 三类生成任务分层

| 环节 | 归属对象 | 输入 | 输出 |
|---|---|---|---|
| JD 级能力验证卡 + Rubric 草稿 | `Job`（`ParseJob.jobId`） | JD 分段文本 | `CapabilityCard[]`（不含匹配字段）+ `RubricVersion` 草稿（等级锚点、权重） |
| 候选人经历匹配 | `InterviewTask`（`ParseJob.taskId`） | 已确认能力验证卡列表 + 候选人简历分段 | 每张卡的 `matchedExperience`/`confidence`/`sourceRefs`，或保持 Unknown |
| Brief 问题生成 | `InterviewTask` + `InterviewRound`（`ParseJob.taskId`） | 该 Round 的 `competencies`、匹配到的能力验证卡 | 每张卡的 STAR 问法草稿（背景/任务/行动/结果） |

三者均复用 `ParseJob` 的 `jobId?/resumeId?/taskId?` 多态外键设计；新增 `type` 枚举值：`capability_cards`、`resume_card_match`、`brief_questions`。

### 5.2 结构化输出 Schema

- `cardGenerationSchema`：每条 fact 包含 `requirement`（JD Requirement 原文）、`responsibilityType`（lead/collaborate/support）、`cardPriority`（P0/P1/P2，前端渲染为 Card-P0/P1/P2，绝不复用 `INT-P0` 文案）、`competencyTags[]`、`expectedEvidence`、`ruleLevel1..5`（Rubric 行为锚点）、`weight`，以及沿用现有 `fact` 结构的 `segmentId`/`quote` 来源引用。不是每份 JD 都含三种职责类型，允许卡片集合缺少某一类（Addendum §4）。
- `cardMatchSchema`：每条结果包含 `cardId`、`matchedExperience`（可空）、`confidence`（high/medium/low，可空）、`evidenceStatus` 初始固定为 `unknown` 或 `self_reported`（不允许生成阶段直接产出 `interview_verified`/`contradicted`，这两个状态只能由人工在 Live/Review 阶段写入），来源引用同现有 `quote`/`segmentId` 校验。
- `questionGenerationSchema`：每条包含 `cardId`、`situationPrompt`/`taskPrompt`/`actionPrompt`/`resultPrompt` 四段 STAR 问法、`mandatory`（是否必问，默认 Card-P0 为 true）。

三类 schema 均追加到 `contracts.ts`，校验方式与现有 `extractionSchema`（`contracts.ts:55`）一致：`z.toJSONSchema` 传给 `response_format.json_schema`，返回后再用 zod 二次解析，并对每条 fact 校验 `segments.some(s => s.id === f.segmentId && s.text.includes(f.quote))`（复用 `ai.service.ts:43` 的校验逻辑，抽成可复用函数而不是三处复制）。

### 5.3 AiService 改造

`ai.service.ts` 当前 `extract(type, input)` 的 schema 与 system prompt 是写死的单一版本，无法支撑上述三类新任务。需要将 `extractionSchema` 与 prompt 文案按 `type` 建立一张映射表（`Record<string, { schema, promptForType }>`），`type` 取值扩展为 `jd`/`resume`/`requirements`（已有）加 `capability_cards`/`resume_card_match`/`brief_questions`（新增）。超时、重试、限流、输入长度上限、来源校验、模型/用量记录等既有机制原样复用，不重复实现。

失败处理沿用 `ParseFailure` 分类（`AI_NOT_CONFIGURED`/`AI_TIMEOUT`/`AI_OUTPUT_INVALID`/`AI_SOURCE_INVALID` 等），`ParsingService.tick()` 的重试与退避策略不变。

## 6. 后端架构与存储

新增 Prisma 模型，命名与既有 `InterviewRound`/`Interviewer` 风格一致，均带 `workspaceId` 与 `@@index`：

| 模型 | 关键字段 | 关系 |
|---|---|---|
| RubricVersion | `id`、`workspaceId`、`jobId`、`version`、`status`（draft/confirmed）、`confirmedBy`、`confirmedAt`、`createdAt` | `Job` 1-N；`@@unique([jobId, version])` |
| CapabilityCard | `id`、`workspaceId`、`rubricVersionId`、`requirement`、`responsibilityType`（lead/collaborate/support）、`cardPriority`（P0/P1/P2）、`competencyTags`（逗号分隔，沿用 `InterviewRound.competencies` 的既有做法）、`expectedEvidence`、`levelAnchors`（Json，1–5 各一段文字）、`weight`、`sourceRefs`（Json） | `RubricVersion` 1-N |
| CandidateCardMatch | `id`、`workspaceId`、`taskId`、`cardId`、`matchedExperience`、`confidence`（high/medium/low，可空）、`evidenceStatus`（unknown/self_reported/interview_verified/contradicted）、`sourceRefs`（Json） | `InterviewTask` 1-N，`CapabilityCard` 1-N；`@@unique([taskId, cardId])` |
| InterviewQuestion | `id`、`workspaceId`、`roundId`、`cardId`、`situationPrompt`、`taskPrompt`、`actionPrompt`、`resultPrompt`、`mandatory` | `InterviewRound` 1-N，`CapabilityCard` 1-N |

`ParseJob` 沿用现有多态外键，不新增列；`type` 枚举扩展见 5.1。`evidenceStatus` 的 `interview_verified`/`contradicted` 两个值本阶段只建表结构，写入逻辑留给尚未实现的 Live/Review（第 3 节已声明后续阶段），本阶段生成任务只产出 `unknown`/`self_reported`。

新增 `RubricModule`（对应 `RubricVersion`/`CapabilityCard` 的生成、编辑、确认）与 `BriefModule`（对应 `CandidateCardMatch`/`InterviewQuestion` 的生成、查询），挂在现有 `intake` 目录下，复用 `PrismaService`、`AiService`、`ParsingService`，不建第二套持久化层。

## 7. 建议 API 与状态

| 方法与路径 | 作用 |
|---|---|
| POST `/api/jobs/:jobId/capability-cards` | 触发 JD 级能力验证卡 + Rubric 草稿生成，排队 `capability_cards` 类型 `ParseJob` |
| GET `/api/jobs/:jobId/rubric` | 返回当前草稿或已确认 `RubricVersion` 及其 `CapabilityCard[]` |
| PATCH `/api/jobs/:jobId/rubric` | 带 `version` 的人工编辑（等级、权重、卡片增删）；沿用 `InterviewRound.update` 的乐观锁模式 |
| POST `/api/jobs/:jobId/rubric/confirm` | 带 `version`，确认当前草稿，写入 `confirmedBy`/`confirmedAt` |
| POST `/api/jobs/:jobId/rubric/new-version` | 已确认版本上创建新草稿（对应 RubricPage 现有“Create new version”按钮语义） |
| POST `/api/tasks/:taskId/card-matches` | 候选人简历就绪后触发候选人级匹配，排队 `resume_card_match` 类型 `ParseJob`；要求已存在 `confirmed` 状态的 `RubricVersion`，否则 409 |
| GET `/api/tasks/:taskId/card-matches` | 返回该候选人对每张卡片的匹配结果 |
| POST `/api/tasks/:taskId/rounds/:roundId/questions` | 生成该 Round 的 STAR 问题草稿，排队 `brief_questions` 类型 `ParseJob` |
| GET `/api/tasks/:taskId/rounds/:roundId/questions` | 返回该 Round 已生成的问题列表，供 BriefPage 渲染 |

命名与错误码风格沿用 `intake/contracts.ts`：`validate()` 抛 `BadRequestException({code:'INVALID_INPUT', fieldErrors})`，版本冲突抛 `ConflictException({code:'VERSION_CONFLICT'})`。新增错误码至少覆盖 `RUBRIC_NOT_CONFIRMED`（候选人匹配请求缺少已确认版本时）、`NO_CAPABILITY_CARDS`（JD 尚未生成卡片时请求匹配或问题生成）。

## 8. 前端接入计划

- `src/features/project-intake/api.ts` 新增类型：`RubricVersion`、`CapabilityCard`、`CandidateCardMatch`、`InterviewQuestion`，风格与现有 `Round`/`Interviewer` 类型一致。
- 新增 `useRubric(jobId)`、`useCardMatches(taskId)`、`useBriefQuestions(taskId, roundId)` 三个 hook，结构照搬 `useTask.ts` 的 `{data, loading, error, reload}` 模式。
- `RubricPage.tsx` 改造：移除 `src/data/comps.ts` 的 `COMPS` 引用，改为 `useRubric(job.id)`；`rubricExtracted`/`rubricConfirmed`/`rubricVersion` 三个 Store 布尔值不再驱动这个页面（其余仍引用它们的页面本阶段不动，避免连带回归）。卡片渲染需新增 Card-P0/P1/P2 徽标，与现有 Must-have/Standard 徽标区分样式，Card-P0 默认展开或高亮（Addendum §7.1）。
- `BriefPage.tsx` 改造：移除 `src/data/evidence.ts` 依赖，按当前 Round 调用 `useCardMatches`/`useBriefQuestions`；"Known/Supported" 区块渲染有匹配经历的卡片，"Unknown/Needs evidence" 区块渲染 Unknown 或未匹配的 Card-P0（明显提示），STAR 问法展示在原有 "Recommended focus" 位置附近。
- 新增中英文词条：`cardPriorityP0/P1/P2` 显示文案（建议界面呈现 Lead/Collaborate/Support 或 Must verify/Selective/Optional，见 Addendum §10 建议），`evidenceStatusUnknown/SelfReported/InterviewVerified/Contradicted`，`noMatchingExperience`。补充到 `src/data/i18n.ts` 的 `en`/`zh` 两侧，保持 key 集合一致（现有 TS 类型约束）。
- 生成过程中的等待态复用 `PlanPage.tsx` 已验证过的 loading/error 处理方式，不新发明一套状态机。

## 9. 实施顺序与验收

| 阶段 | 工作 | 完成条件 |
|---|---|---|
| A：数据与契约基础 | 新增 4 张 Prisma 表并迁移；`contracts.ts` 新增三类 schema；`AiService` 按 `type` 分发 schema/prompt | 迁移可跑通；新 schema 单测覆盖来源校验失败场景 |
| B：JD 级卡片与 Rubric 生成 | `RubricModule` 生成、编辑、确认、新建版本接口；`ParsingService` 消费 `capability_cards` 类型 | 真实 JD 输入生成可追溯草稿，确认后版本号锁定，编辑产生新版本不覆盖旧版本 |
| C：RubricPage 真实接入 | 前端改造第 8 节所述部分 | 按 Job 打开页面显示真实卡片，刷新后状态不丢失，不同 Job 数据不串 |
| D：候选人级匹配 | `BriefModule` 匹配接口；`resume_card_match` 类型排队与结果落地 | 未关联候选人不可触发；找不到经历的卡片显示 Unknown，不自动打分；未匹配 Card-P0 有明显提示 |
| E：Brief 问题生成与页面接入 | 问题生成接口 + `BriefPage.tsx` 改造 | 按 Round 生成 STAR 问法，候选人未关联时仍可基于卡片本身生成 |
| F：回归与验收 | 端到端验证、双语核对 | 满足下列验收场景 |

关键验收场景：

1. 只有 JD、未关联候选人时可生成能力验证卡与 Rubric 草稿，所有卡片 `evidenceStatus` 为 Unknown，无候选人经历被臆造。
2. Rubric 草稿编辑等级/权重后确认，生成新版本号；旧版本仍可查询，已引用旧版本的数据不被覆盖。
3. 候选人关联简历触发匹配前，若 Rubric 未确认，接口返回 `RUBRIC_NOT_CONFIRMED`，不产生匹配结果。
4. 匹配结果保留来源引用（文件/段落/原文摘录）；找不到对应经历的卡片显示“未找到相关经历”，不转为负面评分。
5. 未匹配的 Card-P0 在 Brief 页与（若已做）Rubric 页有明显提示，区别于 Card-P1/P2 的提示强度。
6. Round 层面生成的 STAR 问题可追溯到具体能力验证卡；候选人未关联时问题生成不报错，也不引用不存在的经历。
7. 界面文案全程使用 Card-P0/P1/P2 或其本地化文案，不与既有 INT-P0/P1/P2 混用；中英文切换后两套文案均正确。
8. AI 生成失败（超时、Schema 校验失败、来源校验失败）后草稿/匹配/问题记录不丢失，可重试，不产生半截数据。
9. 跨 Workspace 或跨 Job/Task 查询卡片、匹配、问题均被拒绝。
10. 同一 JD 下两个不同候选人分别匹配，互不覆盖对方的 `CandidateCardMatch`，但共享同一套 `CapabilityCard`。

测试分层：Schema 校验与来源引用单元测试；生成、确认、版本冲突、跨 Task 隔离的集成测试；RubricPage/BriefPage 浏览器流程测试（JD-only 与候选人已关联两种路径分别跑一遍）。AI 离线回归使用固定中英文样本 JD/简历，真实供应商冒烟测试单独运行。

## 10. 实施前配置项

本计划复用现有 `HIREOS_AI_BASE_URL`/`HIREOS_AI_API_KEY`/`HIREOS_AI_MODEL`/`HIREOS_AI_TIMEOUT_SECONDS` 配置，不引入新的外部依赖。落地前需要确定：

- Card-P0/P1/P2 在界面上的最终中英文文案（Addendum §10 给出两种备选，需产品侧拍板）。
- `AiService` 按 `type` 分发 schema/prompt 的具体代码组织方式（映射表 vs 子类），在 Phase A 开始前定下，避免和 Phase B 并行返工。
- `levelAnchors`/`weight` 等 Rubric 字段是否需要 JD 侧预置默认权重求和为 100% 的校验规则（现有 Prototype 文案提到“Weights sum to 100%”），需要在 Phase A schema 设计时一并确认。

本次交付仅为实施计划，未修改业务代码或接通任何外部服务。
