# HireOS Resume Screening Backend Implementation Plan

## 1. 文档目的

本文是 `hireos-screening` 后端的整体实施计划，目标是：

- 参考 `hireos-interview/job-Interview-backend/`，采用同样的 NestJS + PostgreSQL + Prisma 架构；
- 为现有 `resume-screening-front` 提供真实 API；
- 保留现有前端页面、路由、领域对象和交互语义，逐步替换 `src/data/api/*` 中的内存 mock；
- 落实 Resume Screening PRD v1.3、Interface Spec v1.1 和 Prototype Design Brief v1.0 中已确认的完整功能；
- 保证候选人、简历、岗位、推荐、Application、筛选评估、人工决定和交付状态可追溯、可重试、可审计。

本文是工程实施计划。当前 Phase 0 至 Phase 6 已完成本地真实后端闭环；
真实供应商、认证、邮件、PNG/PDF 渲染器和下游系统连接仍不视为已完成。

## 2. 需求与架构基线

### 2.1 权威文档

| 文档 | 用途 |
|---|---|
| `Resume_Screening_PRD_v1.3.md` | 产品范围、流程、权限、决策和边界 |
| `Resume_Screening_Interface_Spec_v1.1.md` | 实体、字段、状态、版本、幂等、审计和交接契约 |
| `Resume_Screening_Prototype_Design_Brief_v1.0.md` | 页面、交互、演示数据和 DB-01 至 DB-20 验收场景 |
| `hireos-interview/job-Interview-backend/` | NestJS/Prisma、异步解析、引用校验、乐观锁和测试模式 |

### 2.2 当前前端基线

当前前端位于：

`hireos-screening/resume-screening-front/`

现有结构已经形成较清晰的前后端替换边界：

- 页面：`src/pages/*`
- 领域 API mock：`src/data/api/*`
- 内存数据源：`src/data/db.ts`
- 领域 fixture：`src/data/fixtures/*`
- 评分规则：`src/lib/scoring.ts`
- 路由入口：`src/App.tsx`
- Vite `/api` 代理尚未启用

实施时优先保留 `src/data/api/*` 的函数接口和页面调用方式，仅替换其内部实现为 HTTP client；这样可以降低页面层改动，并确保前端仍然使用单一的领域数据契约。

### 2.3 推荐后端目录

建议新建：

```text
hireos-screening/job-Resume-Screening-backend/
```

基础目录：

```text
job-Resume-Screening-backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.cjs
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── health/
│   ├── persistence/
│   │   └── prisma.service.ts
│   ├── auth/
│   │   └── workspace.guard.ts
│   ├── intake/
│   ├── library/
│   ├── duplicates/
│   ├── discovery/
│   ├── linking/
│   ├── screening/
│   ├── comparison/
│   ├── tasks/
│   ├── decisions/
│   ├── deliveries/
│   ├── files/
│   ├── preferences/
│   ├── ai-models/
│   ├── audit/
│   └── shared/
└── test/
```

每个业务模块采用 Interview backend 已验证的模式：

```text
<module>.module.ts
<module>.controller.ts
<module>.service.ts
contracts.ts
```

控制器负责 HTTP 路由和身份上下文传递；Service 负责业务规则、事务、版本校验和安全边界；Zod contract 负责输入和 AI 输出校验；Prisma 负责持久化。

## 3. 总体业务流程

```text
材料输入
  ↓
文件校验 / 解析 / 安全状态
  ↓
重复识别与身份复核
  ↓
Candidate / Profile / ResumeVersion / LibraryEntry
  ↓
岗位发现与逐岗 PreLinkMatchEvaluation
  ↓
CandidateJobRecommendation
  ↓ human confirm
Application
  ↓
ScreeningEvaluation / Evidence / Concern / VerificationItem
  ↓
RankingSnapshot / ComparisonSnapshot
  ↓
ScreeningDecision
  ↓
HandoffPackage / DeliveryAttempt / Receipt
```

必须保持以下边界：

1. ResumeVersion 是材料版本，Candidate 是人，Application 是候选人与岗位的正式关系。
2. Recommendation 不是 Application；AI 推荐不能直接建立正式岗位关联。
3. LinkDecision 和 Next-step Decision 是两个独立动作。
4. AI Recommendation 不是人工决定；AI 失败不能写成 `no_match` 或 `do_not_advance`。
5. Unknown、Insufficient Evidence、Not Evaluated 不得转成 0 分。
6. 同一岗位、同一候选人的新评估生成新版本，不能覆盖历史评估。
7. 包生成、发送、目标接收、目标执行是不同状态，不得合并。

## 4. 参考 Interview Backend 的架构原则

### 4.1 NestJS 应用入口

沿用 Interview backend：

- `ConfigModule.forRoot({ isGlobal: true })`
- `app.setGlobalPrefix('api')`
- 全局 `ValidationPipe`
- `enableCors`
- `enableShutdownHooks`
- `HealthModule`
- `PrismaService`
- 默认绑定 `127.0.0.1`
- 生产环境在真实身份接入前拒绝开发身份

### 4.2 WorkspaceGuard

第一阶段继续提供本地开发身份：

```ts
type Identity = {
  workspaceId: string;
  actorId: string;
  roles?: string[];
};
```

与 Interview backend 一样，`DEV_AUTH_ENABLED=true` 只用于本地开发和测试。生产环境没有真实认证与 Workspace ACL 时，返回 `AUTH_REQUIRED`。

所有查询和写入都必须带 `workspaceId` 条件，禁止只按实体 ID 查询。

### 4.3 Prisma Service

沿用 `src/persistence/prisma.service.ts` 的生命周期管理。数据库使用独立 PostgreSQL：

- Screening 本地开发数据库与 Interview 数据库分离；
- 不直接读取 Interview 数据库表；
- 集成模式通过外部引用和映射表通信；
- 以后可使用事件/outbox 或显式 handoff API，而不是跨模块写表。

### 4.4 异步任务 Worker

参考 Interview 的 `ParseJob + ParsingService`：

- 所有解析、岗位发现、匹配、筛选、对比摘要和交付任务持久化；
- 任务状态至少包含 `queued/running/succeeded/failed/cancelled`；
- 使用 `leaseToken + leaseUntil + attempt` 防止重复执行；
- 使用 compare-and-set 领取任务；
- 过期租约可以恢复；
- 结果写入时再次检查 fencing token；
- retry 只重试失败任务，不重复创建 Application、决定或交付；
- 前端通过任务详情接口轮询或后续增加 SSE。

建议不要立即复制出多个 Worker。第一阶段使用一个共享 `ProcessingService`，通过 `job.type` 分发不同 AI/非 AI 任务。

## 5. 领域模块拆分

### 5.1 `intake`

职责：

- 上传 PDF/DOCX/TXT；
- 文本提取和分段；
- 材料哈希；
- 材料可用性和失败状态；
- 结构化 Profile / JD 粘贴入口；
- 保存原始来源和导入批次；
- 创建 Parse/Processing job。

参考：

- Interview `MaterialsService`
- Interview `JobsService`
- Interview `ParsingService`

主要状态：

```text
pending → available
        ↘ failed
        ↘ quarantined
```

第一阶段明确支持：

- 10 MB 或配置化文件大小限制；
- PDF 文本提取；
- DOCX 文本提取；
- TXT；
- 扫描 PDF 返回 `OCR_REQUIRED`；
- 不可读文件不进入 AI；
- 文件原文和解析段落分开保存；
- 不返回 `storageKey`。

### 5.2 `library`

职责：

- Candidate；
- CandidateProfile；
- ResumeVersion；
- CandidateSource；
- LibraryEntry；
- 简历库列表、过滤、详情；
- 无岗位候选人的保留和检索；
- Profile correction 产生新版本；
- 资料更新后标记相关评估 `stale`。

关键约束：

- 不按姓名自动合并 Candidate；
- 同一 Candidate 可以拥有多个 ResumeVersion；
- 同一 Candidate 可以关联多个 Job；
- 简历库状态不能与 Application 互斥；
- 删除或受限资料不能继续自动匹配。

### 5.3 `duplicates`

职责：

- 文件 hash 去重；
- 规范化文本重复；
- 疑似同人识别；
- DuplicateCheck；
- DuplicateResolution；
- 人工复核和纠正/拆分；
- 并发上传原子去重。

检测顺序：

1. 文件内容 hash；
2. 解析文本规范化 hash；
3. 多信号疑似同人；
4. 人工处理。

不能用单一姓名、文件名或 AI 判断直接合并身份。

### 5.4 `jobs`

职责：

- ScreeningProject；
- Job；
- RoleCriteriaSnapshot；
- JobRequirement；
- MatchDimension；
- RubricSnapshot；
- WorkflowPolicySnapshot；
- JD 导入、编辑、确认、版本；
- 开放/暂停/关闭状态；
- JD 变化后触发新的标准版本和重新匹配。

确认岗位标准之前：

- 可以保存 JD；
- 可以编辑草稿；
- 可以查看解析结果；
- 不能运行正式 Screening；
- 不能生成有效 Ranking。

确认后标准不可变，修改必须产生新版本。

### 5.5 `discovery`

职责：

- JobDiscoveryRun；
- 可访问开放岗位集合快照；
- CandidateJobRecommendation；
- PreLinkMatchEvaluation；
- `no_match/no_open_jobs/insufficient_data/failed` 状态；
- 岗位或 Profile 更新后的重新匹配；
- 推荐结果的幂等和版本化。

岗位发现必须与正式 Screening 分开。关联前评估：

- 只需要 Candidate + Job；
- 不允许写入 Application；
- 不允许触发下游交付；
- 可以被人工拒绝、暂缓或确认；
- 推荐过期时必须阻止旧版本直接确认。

### 5.6 `linking`

职责：

- LinkDecision；
- 推荐确认、拒绝、暂缓；
- 手动选岗；
- Application 创建或复用；
- 并发确认；
- 关联后生成 Screening Review Task。

事务要求：

1. 重新核验 Job 状态；
2. 重新核验 Candidate/Profile 版本；
3. 核验当前用户权限；
4. 通过唯一约束查找或创建 Application；
5. 写入 LinkDecision；
6. 创建 Task；
7. 写入 AuditRecord。

重复请求必须返回现有 Application，而不是创建第二个周期。新申请周期必须显式创建。

### 5.7 `screening`

职责：

- ScreeningSession；
- ScreeningEvaluation；
- EligibilityResult；
- DimensionScore；
- AIClaim；
- EvidenceItem；
- EvidenceLink；
- Concern；
- VerificationItem；
- ScreeningRecommendation；
- HumanAssessment；
- ScreeningDecision 读模型；
- 评估重跑、刷新和人工覆盖。

核心计算规则：

```text
coverage =
  已评价且适用维度权重之和 /
  全部适用维度权重之和
```

当 `coverage < minCoverage` 时：

- `overallScore = null`
- `evaluationStatus = insufficient_evidence`
- 仍展示已评价维度；
- 创建或保留 VerificationItem；
- 不自动生成低分或拒绝。

默认 `minCoverage = 0.70`，但必须写入策略版本。

Eligibility 聚合顺序：

```text
not_met → not_eligible
unknown/conflicting → needs_verification
provisionally_met → likely_eligible
全部满足 → eligible
```

AI 结果先保存为未确认结果，人工字段单独存储；任何人工改分都要记录理由和操作者。

### 5.8 `comparison`

职责：

- ComparisonSet；
- ComparisonSnapshot；
- RankingSnapshot；
- Key Differences；
- 批注；
- 同阶段/跨阶段限制；
- 对比导出任务。

限制：

- 只比较同一 Job 下已确认 Application；
- 不混合不同岗位、不同 criteria、不同 policy 或不同 model baseline；
- 新增候选人产生新 snapshot；
- 刷新不会删除历史 snapshot；
- 没有 overall 的成员不强行排名；
- 导出按用户权限裁剪。

### 5.9 `tasks`

职责：

- 公共人工任务；
- 领取、转派、暂缓、恢复；
- 任务状态和截止时间；
- 我的任务、可领取任务、团队统计；
- 任务与业务动作绑定；
- 业务动作成功后才能完成任务。

建议沿用 Interview 的“业务服务负责实际动作，Task service 只维护任务状态”的边界。AI 运行任务仍由 Processing job 管理，不与人工 Task 数量混淆。

### 5.10 `decisions`

职责：

- ScreeningDecision；
- 普通推进；
- Hold；
- Do not advance；
- Request information；
- 例外审批；
- Assessment/Interview 路由校验；
- 决定版本和审计。

AI Recommendation 只能作为建议。人工决定至少需要：

- outcome；
- reason；
- actor；
- current evaluation ref；
- policy ref；
- optional override ref；
- next-step target；
- approval 状态。

明确硬条件未满足时：

- 阻止推进，或；
- 按 WorkflowPolicy 创建例外审批；
- 不通过修改分数来掩盖例外。

### 5.11 `deliveries`

职责：

- HandoffPackage；
- DeliveryAttempt；
- Receipt；
- 邮件/文件/API 适配器；
- 交付状态；
- 重试；
- 版本；
- 无 ACK 的明确展示。

状态建议：

```text
package_ready
→ queued
→ submitted
→ delivered
→ received
→ imported
```

失败状态可以重试交付，不重新执行评估、关联或决定。

### 5.12 `files`

职责：

- 文件列表、预览、下载；
- Email / Folder / API connection；
- 读取检查点；
- 部分失败；
- 授权失效；
- 活动历史。

第一阶段可以使用本地适配器模拟连接，但数据结构和状态要与真实连接一致。连接读取不能自动等价于导入成功。

### 5.13 `preferences`

职责：

- PreferenceProfile；
- PreferenceSignal；
- FeedbackEvent；
- 个人/团队/岗位/组织范围；
- Proposal；
- 激活、回滚、版本比较。

个人偏好不得改变团队标准。共享偏好必须经过授权审核，并使用明确 allowlist，禁止使用受保护属性或其代理特征。

### 5.14 `ai-models`

职责：

- 模型目录；
- Provider adapter；
- Task policy；
- 预算、延迟、质量门槛；
- 数据区域和数据约束；
- 回退；
- 调用历史；
- 评测和回归；
- 失败告警。

模型调用仍由共享 AI/Processing 基础设施执行，但 Screening 拥有匹配、评估和业务结果语义。模型变化不能静默改写历史评估。

### 5.15 `audit`

职责：

- AuditRecord；
- 输入版本；
- AI Run；
- 人工修改；
- LinkDecision；
- ScreeningDecision；
- 审批；
- 包和交付；
- 访问与导出；
- 保留和删除事件。

所有会改变业务状态的 mutation 必须留审计。

## 6. Prisma 数据模型规划

### 6.1 核心对象

建议初始模型至少包含：

```text
WorkspaceProjection
UserProjection
ScreeningProject
Job
RoleCriteriaSnapshot
JobRequirement
MatchDimension
RubricSnapshot
WorkflowPolicySnapshot
Candidate
CandidateProfile
Resume
ResumeVersion
CandidateSource
LibraryEntry
Material
DuplicateCheck
DuplicateResolution
JobDiscoveryRun
PreLinkMatchEvaluation
CandidateJobRecommendation
LinkDecision
Application
ScreeningSession
ScreeningEvaluation
EligibilityResult
DimensionScore
CriterionResult
EvidenceItem
EvidenceLink
AIClaim
Concern
VerificationItem
Recommendation
HumanAssessment
ScreeningDecision
RankingSnapshot
ComparisonSet
ComparisonSnapshot
ComparisonAnnotation
Task
ProcessingJob
AIModel
AITaskPolicy
AIRun
PreferenceProfile
PreferenceSignal
FeedbackEvent
HandoffPackage
DeliveryAttempt
Receipt
ExternalIdentityMap
AuditRecord
Revision
```

### 6.2 建模原则

1. 所有业务表包含 `workspaceId`。
2. 所有版本化实体包含 `version` 或 `versionNumber`。
3. 外部系统引用使用 `ExternalIdentityMap`，不把外部 ID 当本地主键。
4. Evaluation、Recommendation、Decision 和 Package 使用精确输入引用。
5. `Json` 仅用于稳定的嵌套 value object、快照和供应商 usage；可查询的业务关系使用独立表。
6. 不用多态字符串外键替代必要的关系约束。
7. 通过唯一约束保证：
   - 同一 workspace 的 material hash 去重；
   - 同一 Job/Candidate/active cycle 不重复 Application；
   - 同一 evaluation/dimension 不重复当前 DimensionScore；
   - 同一 processing job 不被重复物化；
   - 同一 delivery attempt 幂等。
8. 删除策略默认保留证据和审计，不级联删除历史业务事实；材料删除以受控状态为主。

### 6.3 与 Interview 后端的关系

Screening 不应直接复用 Interview 的 Prisma 表。两模块之间只通过稳定契约交互：

- Screening → Interview：`HandoffPackage`；
- Interview → Screening：可选的 `VerificationResolution` 或阶段结果事件；
- 双方保留本地 ID；
- 使用 `ExternalIdentityMap` 建立映射；
- 发送方、接收方、目标执行分别记录状态。

## 7. API 规划

所有路径默认带 `/api` 前缀，并由 WorkspaceGuard 保护；Webhook 或未来外部入口必须单独设计签名验证，不能绕过安全边界。

### 7.1 Health

```text
GET /api/health
```

### 7.2 Materials and Intake

```text
POST /api/materials
GET  /api/materials/:id
POST /api/imports
GET  /api/imports/:id
POST /api/imports/:id/retry
GET  /api/processing-jobs/:id
POST /api/processing-jobs/:id/retry
```

### 7.3 Library and Candidates

```text
GET  /api/library
GET  /api/candidates/:id
POST /api/candidates
PATCH /api/candidates/:id/profile
GET  /api/candidates/:id/resume-versions
POST /api/candidates/:id/match
GET  /api/candidates/:id/recommendations
```

### 7.4 Duplicates

```text
GET  /api/duplicates
GET  /api/duplicates/:id
POST /api/duplicates/:id/resolve
POST /api/duplicates/:id/split
```

### 7.5 Jobs and Criteria

```text
GET  /api/jobs
POST /api/jobs
GET  /api/jobs/:id
PATCH /api/jobs/:id
GET  /api/jobs/:id/criteria
PATCH /api/jobs/:id/criteria
POST /api/jobs/:id/criteria/confirm
POST /api/jobs/:id/criteria/new-version
POST /api/jobs/:id/match
```

### 7.6 Recommendations and Linking

```text
GET  /api/recommendations/:id
POST /api/recommendations/:id/confirm-link
POST /api/recommendations/:id/dismiss
POST /api/recommendations/:id/defer
POST /api/candidates/:candidateId/jobs/:jobId/recommend
```

### 7.7 Screening

```text
GET  /api/jobs/:id/screening
POST /api/applications/:id/screen
GET  /api/applications/:id
GET  /api/applications/:id/evaluations
GET  /api/evaluations/:id
POST /api/evaluations/:id/refresh
PATCH /api/evaluations/:id/human-assessments
POST /api/concerns/:id/resolve
POST /api/verification-items/:id/assign
POST /api/verification-items/:id/resolve
```

### 7.8 Tasks

```text
GET  /api/tasks
GET  /api/tasks/:id
POST /api/tasks/:id/claim
POST /api/tasks/:id/reassign
POST /api/tasks/:id/defer
POST /api/tasks/:id/complete
```

### 7.9 Comparison and Ranking

```text
POST /api/comparisons
GET  /api/comparisons/:id
POST /api/comparisons/:id/members
POST /api/comparisons/:id/refresh
POST /api/comparisons/:id/annotations
POST /api/comparisons/:id/export
```

### 7.10 Decisions and Deliveries

```text
GET  /api/applications/:id/decision
POST /api/applications/:id/decision
POST /api/applications/:id/decision-draft
POST /api/applications/:id/review-only-package
GET  /api/deliveries
GET  /api/deliveries/:id
POST /api/deliveries/:id/send
POST /api/deliveries/:id/retry
GET  /api/deliveries/:id/receipts
```

### 7.11 Shared and Admin

```text
GET  /api/files
GET  /api/files/:id
GET  /api/connections
POST /api/connections/:id/read
POST /api/connections/:id/reconnect
POST /api/connections/:id/pause
GET  /api/preferences
POST /api/preferences/proposals/:id/activate
POST /api/preferences/proposals/:id/reject
POST /api/preferences/versions/:id/rollback
GET  /api/ai-models
GET  /api/ai-models/activity
GET  /api/audit
```

所有 mutation 需要：

- 输入 contract；
- workspace/权限校验；
- 幂等策略；
- 版本或前置条件；
- 统一错误码；
- 审计记录；
- 返回更新后的安全读模型。

## 8. AI 处理与引用校验

### 8.1 任务类型

建议第一批支持：

```text
jd_parse
resume_parse
duplicate_assist
job_discovery
prelink_match
screening_evaluation
comparison_summary
decision_draft
```

后续可增加：

```text
evidence_normalization
preference_signal
export_comparison
```

### 8.2 AI Contract

每一种 AI 输出都必须拥有自己的 `contracts.ts`：

- Zod schema；
- system prompt；
- 输出数量限制；
- citation/ref collector；
- 状态和错误映射；
- prompt/schema 版本。

沿用 Interview `AiService` 的引用验证策略：

1. 模型只能引用输入 manifest 中的 segment；
2. quote 必须在对应 segment 中出现；
3. 无法验证引用时任务失败；
4. 不自动写入人工确认字段；
5. 文档中的指令视为不可信内容；
6. AI 输出不能推断受保护属性、人格或录用概率。

### 8.3 模型配置

第一阶段可沿用：

```dotenv
HIREOS_AI_BASE_URL=
HIREOS_AI_API_KEY=
HIREOS_AI_MODEL=
HIREOS_AI_TIMEOUT_SECONDS=120
HIREOS_AI_SEARCH_TOTAL_TIMEOUT_SECONDS=720
HIREOS_AI_MIN_CONFIDENCE=0.85
```

但 Screening 的长期实现应迁移到 `AIModel` + `AITaskPolicy` 数据模型，环境变量只作为本地默认配置，不作为业务事实。

未配置模型时：

- 材料仍可保存；
- 任务明确显示 `AI_NOT_CONFIGURED`；
- 可以走人工路径；
- 不返回伪造的 AI 成功。

## 9. 前端接入计划

### 9.1 保持页面和路由不变

第一阶段不重写以下页面：

- Tasks
- Library
- Import
- Duplicate Review
- Candidate Profile
- Job Recommendations
- Jobs / Criteria
- Screening Workspace / Detail
- Compare
- Decision
- Deliveries
- Files
- Preferences
- AI Models

后端接入完成后，页面仍使用现有路由和领域组件。

### 9.2 替换 mock API 层

为 `src/data/api/shared.ts` 增加真实 HTTP client：

- `apiFetch`
- JSON 错误解析；
- multipart 上传；
- `ApiError` 保留现有 error code；
- `Idempotency-Key`；
- `If-Match` 或 body version；
- `Cache-Control: no-store` 用于任务/评估/交付状态；
- 统一 loading/retry 行为。

各 API 文件逐步替换：

```text
src/data/api/imports.ts
src/data/api/library.ts
src/data/api/candidates.ts
src/data/api/jobs.ts
src/data/api/screening.ts
src/data/api/comparisons.ts
src/data/api/tasks.ts
src/data/api/decisions.ts
src/data/api/deliveries.ts
src/data/api/files.ts
src/data/api/preferences.ts
src/data/api/aiModels.ts
```

fixture 保留为：

- 单元测试数据；
- 后端不可用时的显式 demo 模式；
- 端到端测试 seed 对照；
- 不再作为生产页面的默认数据源。

### 9.3 Vite 代理

启用现有 `vite.config.ts` 中预留的代理：

```ts
proxy: {
  "/api": {
    target: process.env.API_PROXY_TARGET || "http://127.0.0.1:3002",
    changeOrigin: true,
  },
}
```

前端开发端口保持 `5174`，Screening backend 默认使用 `3002`，避免与 Interview backend `3001` 冲突。

### 9.4 前端状态刷新

以下动作完成后必须刷新相关读模型：

- 上传完成：Import、Library、Duplicate Tasks；
- 确认 Job criteria：Job、Recommendations、Screening；
- Confirm link：Recommendations、Application、Tasks；
- Screening 完成：Detail、Workspace、Ranking；
- Decision 提交：Decision、Tasks、Deliveries；
- Delivery retry：Delivery detail、Activity；
- Profile correction：Candidate、Evaluation freshness、Tasks。

第一阶段使用轮询；后续可增加 SSE 或 WebSocket，不改变 API 数据契约。

## 10. 分阶段实施顺序

### Phase 0：工程初始化和契约冻结

交付：

- 新建 NestJS backend；
- 复制并调整 Interview backend 的基础配置；
- Prisma、PostgreSQL、Config、Health、WorkspaceGuard；
- 错误码、分页、版本、幂等约定；
- 初始 README 和 `.env.example`；
- 前端 API client 骨架；
- 确认后端端口 `3002`。

验收：

- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `GET /api/health`
- 前端仍可用 mock 模式运行。

### Phase 1：材料、导入、简历库和去重

交付：

- Material；
- 文件文本提取；
- Intake batch；
- Candidate/Profile/ResumeVersion；
- LibraryEntry；
- DuplicateCheck/Resolution；
- Library、Import、Candidate、Duplicate 页面接入真实 API。

验收重点：

- Resume-only 可入库；
- 无岗位不创建虚拟 Job/Application；
- 相同文件幂等；
- 同名不同人不自动合并；
- 解析失败明确；
- 文件存储路径不泄露；
- 跨 workspace 访问返回 404/403。

### Phase 2：Job、Criteria、岗位发现和推荐

交付：

- Job 和 RoleCriteriaSnapshot；
- Requirement/Dimension/Rubric；
- JobDiscoveryRun；
- PreLinkMatchEvaluation；
- CandidateJobRecommendation；
- Jobs、Criteria、Recommendations 页面接入；
- AI 岗位发现任务。

验收重点：

- 只有 confirmed criteria 可运行正式匹配；
- `no_match`、`no_open_jobs`、`insufficient_data`、`failed` 可区分；
- 推荐不创建 Application；
- 岗位标准更新产生新版本；
- 旧推荐变 stale，不可直接确认。

### Phase 3：人工关联和任务系统

交付：

- LinkDecision；
- Application；
- Task；
- claim/reassign/defer/complete；
- My Tasks、Job Workspace、Candidate Recommendations 接入。

验收重点：

- 只有人工确认创建/复用 Application；
- 并发确认不重复创建；
- 关联和下一步处理分离；
- 业务动作成功才完成任务；
- 暂缓任务不计完成；
- 无负责人任务进入待分配队列。

### Phase 4：正式 Screening、证据和人工复核

交付：

- ScreeningSession/Evaluation；
- Eligibility；
- DimensionScore；
- Evidence；
- Concern；
- VerificationItem；
- HumanAssessment；
- Screening Detail 和 Workspace 接入。

验收重点：

- overall/coverage 计算与 Interface Spec 一致；
- Unknown 不等于 0；
- low coverage 时 overall 为 null；
- AI 结果和人工覆盖分离；
- 证据可下钻到来源版本和定位；
- 人工改分留理由；
- 旧结果不被新评估覆盖。

### Phase 5：Ranking、Comparison 和导出

交付：

- RankingSnapshot；
- ComparisonSet/Snapshot；
- Key Differences；
- annotation；
- PNG/PDF 或结构化导出任务；
- Compare 页面接入。

验收重点：

- 只比较同一岗位、同一 baseline；
- 无 overall 不强制排名；
- 新 snapshot 不删除旧 snapshot；
- 2–4 人并排、更多人滚动/分页；
- 无权限证据不导出；
- “暂无明显全面领先者”可作为合法结论。

当前实现状态：

- 已完成 `RankingSnapshot`、`ComparisonSet`、`ComparisonMember`、
  `ComparisonSnapshot`、`ComparisonAnnotation`；
- 已完成同岗位、同 criteria baseline 校验；
- `overall=null` 的 Application 保留在比较中但不分配 rank；
- 刷新追加新 snapshot，旧 snapshot 标记 stale；
- 已完成批注和结构化导出任务，受限证据不会进入导出 payload；
- PNG/PDF 实际渲染 worker 留到生产适配阶段。

### Phase 6：Decision、Package、Delivery

交付：

- ScreeningDecision；
- 例外审批；
- HandoffPackage；
- DeliveryAttempt；
- Receipt；
- Decision、Deliveries 页面接入。

验收重点：

- AI 建议不能直接变成人工决定；
- required assessment 未完成时正确阻断或走例外；
- Hold/Reject 可以生成 review-only package；
- 交付重试不重复评估、关联或邀请；
- 无 ACK 显示 awaiting confirmation；
- 目标接收和目标执行分开。

当前实现状态：

- 已完成 `ScreeningDecision`、`DecisionExceptionApproval`、
  `HandoffPackage`、`DeliveryAttempt` 和 `Receipt` 持久化模型；
- 决定和筛选评估分离，AI/筛选结果不会自动升级为人工决定；
- 支持 `send_assessment`、`move_to_interview`、`hold`、`reject`、
  `review_only` 等本地决策和交付路径；
- 岗位可声明 `assessmentRequired`，未完成测评时阻断推进面试；开发模式下
  只有显式记录 HR 与 Hiring Manager 两个例外审批才可继续；
- 交付发送、重试、回执导入和下载均有独立状态，重试不会重跑评估、关联或邀请；
- 当前使用本地结构化交付适配器，尚未接入真实邮件、测评、面试供应商和
  PNG/PDF 渲染 worker。

### Phase 7：Files、Preferences、AI Models、Audit

交付：

- Files/Connections；
- Preferences/Feedback；
- AI Models/Policies；
- Audit；
- 公共设置和 Activity 页面接入；
- 真实供应商以 adapter 方式接入。

验收重点：

- 个人偏好不修改团队标准；
- 模型变化不改写历史；
- 预算/区域/超时/回退有明确状态；
- 连接失权可恢复；
- 所有 mutation 有审计记录。

当前实现状态：

- 已完成 `GET /api/materials`，从后端 `Material` 记录返回文件列表，不暴露
  `storageKey` 或服务器路径；
- 已完成 `SourceConnection`，支持 email/folder/api 三类连接的读取、暂停、
  恢复和 `authorization_required` 状态；
- 已完成 `WorkspaceSetting` 版本化文档，Preferences 支持提案激活、拒绝、
  回滚，个人偏好数据与团队规则分层保存；
- 已完成 AI Models 目录、任务策略、预算、区域、质量门槛、用量和事件的
  只读策略视图；
- Files、Connections、Preferences、AI Models 前端真实 API 已接入；
- Activity 复用现有追加式 `AuditRecord`，连接和偏好 mutation 会写审计；
- 当前仍使用本地结构化连接/模型 adapter，真实供应商凭据、邮箱/文件夹读取、
  自动价格同步和真实模型调用留到 Phase 8。

### Phase 8：真实认证、集成和部署加固

交付：

- 真实身份；
- Workspace/role ACL；
- 外部系统 ID mapping；
- Outbox/inbox；
- 对接 Assessment/Interview；
- 对象存储、病毒扫描、OCR worker；
- 生产部署和监控。

## 11. 测试计划

### 11.1 后端单元测试

覆盖：

- contract 校验；
- eligibility 聚合；
- coverage/overall 聚合；
- ranking；
- 推荐状态机；
- Application 幂等；
- 任务状态；
- 交付状态；
- 受保护字段拒绝；
- citation 验证。

### 11.2 后端集成测试

参考 Interview `test/*.test.cjs`：

- 每个测试使用独立 PostgreSQL schema；
- 运行 migrations；
- 使用本地模拟 AI server；
- 不调用真实付费模型；
- 测试完成后删除 schema 和临时文件。

第一批必须覆盖：

1. 文件上传和文本提取；
2. PDF OCR_REQUIRED；
3. hash 幂等；
4. 解析失败和 retry；
5. AI 输出 JSON 错误；
6. AI 引用不匹配；
7. 过期 lease 恢复；
8. workspace 隔离；
9. 乐观锁冲突；
10. 推荐不创建 Application；
11. 并发 confirm link；
12. coverage gate；
13. 旧评估不被覆盖；
14. delivery retry 不重复业务动作。

### 11.3 前端测试

保留现有：

```text
npm run build
npm run typecheck
npm run lint
npm run test:smoke
```

新增：

- mock API contract tests；
- real backend API smoke；
- 关键 DB-01 至 DB-20 Playwright 流程；
- 桌面 1440×900；
- 笔记本 1366×768；
- 移动视口 390×844；
- 断网、401、409、422、500、任务失败状态。

### 11.4 契约测试

建议以后引入 OpenAPI 或生成式 TypeScript contract，但第一阶段可以先由：

- 后端 Zod schema；
- 前端 domain types；
- API response fixtures；
- 集成测试响应断言；

共同维护。接口稳定后再生成前端类型，避免一开始就引入过重工具链。

## 12. 风险与处理策略

| 风险 | 处理 |
|---|---|
| 需求范围大，容易只做页面演示 | 按 Phase 拆分，但不能删减已确认业务语义；每阶段都覆盖真实状态 |
| 前端 fixture 与 Interface Spec 字段不完全一致 | 先建立 DTO mapping，逐步迁移，不直接把 fixture 当数据库 schema |
| Screening 和 Interview 共享 Candidate/Job 语义 | 不共享数据库表；使用版本化 handoff 和 ExternalIdentityMap |
| AI 供应商不支持严格 JSON Schema | provider adapter 明确能力；失败返回配置/供应商错误，不伪造结果 |
| 解析、AI、导出耗时长 | 统一持久化 ProcessingJob，租约恢复和 retry |
| 并发确认导致重复 Application | 数据库唯一约束 + 事务 + P2002 外部恢复 |
| 资料更新导致旧结果误用 | Profile/criteria/policy/model 变化触发 stale，提交时重新校验 freshness |
| 误把未知当不合格 | 所有 score nullable，聚合和 UI 同时保留 Unknown 语义 |
| 真实认证尚未接入 | 生产 fail-closed；前端 demo role 不授予后端权限 |
| 文件安全能力不足 | 第一阶段明确限制；生产前增加隔离、扫描、对象存储和权限控制 |
| 交付状态被误报为下游完成 | 分开 Package/Submitted/Delivered/Received/Imported |

## 13. 第一阶段建议优先落地的文件

后端：

```text
src/main.ts
src/app.module.ts
src/health/*
src/persistence/prisma.service.ts
src/auth/workspace.guard.ts
src/shared/errors.ts
src/shared/idempotency.ts
src/intake/*
src/library/*
src/duplicates/*
prisma/schema.prisma
test/intake.test.cjs
test/library.test.cjs
test/duplicates.test.cjs
```

前端：

```text
src/data/api/shared.ts
src/data/api/imports.ts
src/data/api/library.ts
src/data/api/candidates.ts
src/data/api/jobs.ts
src/data/api/tasks.ts
src/features/*
vite.config.ts
```

## 14. 完成定义

整体后端达到以下条件，才认为 Screening 从 prototype mock 进入可联调阶段：

- 前端不依赖内存 `db` 才能完成主流程；
- `/api` 真实请求覆盖上传、简历库、岗位、推荐、关联、任务和筛选详情；
- 所有关键实体在 PostgreSQL 中持久化；
- 处理任务可查询、失败可重试、过期租约可恢复；
- workspace 隔离、乐观锁、幂等和审计可验证；
- AI 引用校验有效；
- Unknown、stale、failed、awaiting confirmation 等状态不会被 UI 隐藏；
- 至少 DB-01 至 DB-08 可使用真实后端完成；
- DB-09 至 DB-20 在对应 Phase 完成后逐步切换；
- 运行 `npm test`、前端 build/typecheck/lint/smoke 均通过；
- README、`.env.example`、migration、seed 和运行端口文档齐全；
- 文档明确哪些是真实能力、哪些是 adapter/mock、哪些仍需要生产加固。

## 15. 推荐的第一步

下一步建议直接执行 Phase 0：

1. 新建 `hireos-screening/job-Resume-Screening-backend`；
2. 从 Interview backend 复制 NestJS/Prisma 基础结构，但不复制 Interview 领域表；
3. 先实现 `Material + IntakeBatch + Candidate + ResumeVersion + LibraryEntry + DuplicateCheck`；
4. 为前端开启 `/api` 代理；
5. 只替换 Import、Library、Candidate、Duplicate 页面对应的 mock API；
6. 用真实 PostgreSQL 集成测试验证 DB-01、DB-02、DB-03、DB-16；
7. 第一阶段稳定后再进入 Job Criteria 和岗位推荐。
