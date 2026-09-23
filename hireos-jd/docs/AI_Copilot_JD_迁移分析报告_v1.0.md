# AI 对话式创建 JD（Copilot）能力迁移分析报告

版本：v1.0
日期：2026-09-21
范围：评估将 `HireOSV2/hireOS`（旧项目，`heri_web` + `heri_server`）中成熟的"对话式创建 JD"能力，迁移到 `HireOS/hireos-jd`（新项目，`hireos-jd-front` + `hireos-jd-backend`）的可行性、差距与路径。本报告为技术调研结论，不涉及代码改动。

---

## 1. 结论摘要（TL;DR）

1. **新项目当前的 "Ask Copilot" 面板是一个纯前端、确定性的 UI 原型**：聊天记录有状态管理，但 AI 回复是正则关键词库 + `setTimeout` 模拟，语音输入是预置文案打字机动画，前后端完全未打通，后端没有任何 AI/LLM 集成。
2. **旧项目的 Copilot 是一套体量很大、高度成熟的生产级子系统**：前端约 10,300+ 行（45+ 文件），后端 JD 专属编排代码约 17,600 行 + 依赖的通用编排框架（ServiceCenter）约 11,400 行，覆盖真实 LLM 对话、SSE 流式响应、真实语音转写（豆包 ASR）、文件解析、发布审核三部曲等完整能力。
3. **两边技术栈完全不同**：旧后端是 Python/FastAPI + `openai-agents` SDK + SQLAlchemy 原生 SQL；新后端是 NestJS + Prisma + zod。**代码不可能直接搬运**，只能参考架构重新实现，或短期以微服务桥接方式复用旧后端。
4. **好消息是新项目 `docs/` 目录下已有一套完整的 v1.3 目标架构规范**（PRD / Design Brief / Interface Spec），定义了比旧项目更规范的接口契约（`CopilotEditRequest`、`ModelTaskRequest` 等）和治理框架（模型路由、预算、审计、AI 权限边界）。**迁移不是"照搬旧代码"，而应以新项目已有的 v1.3 规范为目标契约，用旧项目的成熟实现做架构参考和 Prompt 资产复用。**
5. 可以低成本直接复用的资产：旧项目的 **Prompt/技能包文本**（`instructions.md` + JSON schema）、**核心数据表设计**（`job_documents` 版本链、`ai_runs` capability/run 抽象、`ai_conversation_sessions` 乐观锁字段）、**状态机的 phase 语义**（intake/drafting/outtake/publish_review...）。需要重写而非搬运的部分：几乎全部后端编排代码（语言切换）、前端 `UnifiedCopilotPanel`/`DraftEditor` 两个巨型组件（高耦合，建议先拆分再迁移而非整体搬运）。

---

## 2. 旧项目能力现状（heri_web + heri_server）

### 2.1 前端：`heri_web/src/components/workspace-shell.tsx` 等

- **核心文件**：`workspace-shell.tsx`（2795 行，`UnifiedCopilotPanel` 占约 90%）+ `features/jobs.tsx`（2795 行，`DraftEditor` JD 画布编辑器）+ 43 个配套模块（`copilot-*.mts/ts`、`jd-*.mts`、`filetake-*`、`file-analysis-*`、`doubaoinput-stream.mts` 等），**合计约 10,300+ 行、45+ 文件**。
- **状态机**：`copilot-machine.ts`（304 行）手写四层正交状态：
  - `session`: `initializing | ready | switching | failed`
  - `resource`: `unbound | bound | stale`（当前绑定的 JD 草稿版本）
  - `operation`: `idle | running | retrying | failed`，附带 `kind`（submit-message/resume-run/preview-jd/create-jd/apply-jd/publish-jd/open-resource）及请求快照（requestId/sessionEpoch/conversationId/resourceId/resourceVersion），防止过期异步响应覆盖状态
  - `ui`（`copilot-layout.ts`）: mode(chat/jd)、layout(docked/split/fullscreen)
- **前后端交互模式**：**"HTTP 请求 + 手写 SSE 流式分片渲染 + 一次性权威提交"混合模式**（非 EventSource，用 `fetch` + 手动 reader 解析 SSE 帧，`lib/copilot-stream.mts`）：
  - 流式事件：`assistant.start/delta/replace`（打字机）、`intake.patch/outtake.patch`（结构化澄清增量）、`conversation.committed`（终态，唯一写入持久状态的事件，流式增量只做视觉呈现）
  - 传统轮询兜底：`GET /api/v1/copilot/runs/{runId}`（1.2s × 20 次）
- **JD 创建/发布主流程 API**（节选，均在 `/api/v1/...` 或 `/api/platform/...` 下）：
  1. `POST /api/v1/copilot/conversations`（新建对话）/ `GET .../current`（恢复）
  2. `POST /api/platform/servicecenter/turns:stream`（未绑定 JD 时发消息，SSE）
  3. `POST /api/platform/copilot/conversations/{id}:apply-stream`（已绑定 JD 草稿时发消息，带 `expected_state_revision` 乐观并发控制）
  4. `POST /api/v1/jd-intents:preview` / `:confirm`（意图预览确认创建，独立于会话流）
  5. `POST /api/v1/uploads:prepare` → 直传 → `POST /api/v1/copilot/attachments:complete`（文件上传解析）
  6. `POST /api/v1/copilot/conversations/{id}:apply-manual-patch`（画布手动编辑写回）
  7. 发布审核三部曲：`POST /api/v1/jd-drafts/{id}:prepare-output-review` → `GET .../output-review` → `PATCH .../output-reviews/{run_id}/public-jd` → `POST .../{id}:confirm-output-review`（生成对外 JD + 招聘画像 + FAQ，确认发布）
- **数据模型**（前端类型）：`CopilotConversation{messages[],workspace?,filetake?}`、`CopilotMessage`（含 idempotency_key、retry_kind/retry_state_revision、流式字段）、`CopilotWorkspace{phase, state_revision, allowed_actions[], document?}`，`phase` 枚举正是 `intake→drafting→outtake→post_intake_details→skill_review→publish_review→mode_selection→autotake`。
- **支持能力**：
  - **语音输入是真实 STT**（非模拟）：`voice-input-button.tsx` + `doubaoinput-stream.mts` + `voice-audio-capture.mts`，`getUserMedia` 采集 → PCM → WebSocket 连字节跳动豆包语音识别，支持 partial/final 转写、10 秒静音自动结束。
  - **文件解析**：批量上传 → AI 分类 JD/Resume/Unknown → 结构化字段抽取 → 支持"从解析创建岗位"/"简历匹配"等后续动作。
  - **模板/克隆创建**、**候选人匹配查询**（`action:"view_candidate_matches"`）。
- **健壮性设计**：乐观更新（按会话 ID 分桶存 ref）、断线重连一致性校验（`hasCommittedCopilotTurn` 按 idempotency_key 判断服务端是否已提交，避免重复/误报）、`STALE_WORKSPACE_STATE`(409) 并发冲突自动拉取最新版本重试、多会话历史 + localStorage 记忆、15 秒被动轮询刷新。
- **复杂度/可迁移性判断**：状态机、流处理、消息呈现纯函数、语音输入、文件解析模型这几类**边界清晰、无 UI 副作用**，迁移成本较低；但 `UnifiedCopilotPanel`（单函数体跨约 2100 行）和 `DraftEditor` 把"UI 渲染 + 状态编排 + 路由联动 + 多业务分支"糅合在单文件单函数里，深度依赖 Next.js 路由/上下文/自有 design-system，**基本等同于重写，不建议原样搬运，建议先做组件拆分再迁移**。

### 2.2 后端：`heri_server`（Python / FastAPI）

- **技术栈**：FastAPI 0.139.2，Python 3.14；LLM SDK 用 **OpenAI 官方 `openai-agents` SDK**（`gpt-5.6-terra`/`gpt-5-mini` 按输入长度路由，`app/ai/model_routing.py`），未用 Anthropic/通义等其他 SDK；DB 用 SQLAlchemy Core 原生 SQL + PostgreSQL + Alembic；**无 Celery/Kafka**，用自建 `async_jobs` 表 + 轮询 worker；**无向量库/RAG**，模板/知识检索靠纯规则 JSON。
- **JD 状态机后端实现**：`app/ai/HireOSAgent/jd_workspace_machine.py` 显式定义与前端一致的 9 个 phase，配套 `jd_intake*.py`（澄清追问）、`jd_outtake*.py`（对外版生成+校验）、`jd_checktake*.py`（校验纠错）、`jd_autotake*.py`（自动直出模式）。
- **意图分类是两套**：①`app/intents/jd.py`（133 行，纯正则快速抽取，非 LLM）；②`app/ai/ServiceCenter/task_routing/`（LLM 结构化输出的通用任务路由，覆盖招聘全链路 J/S/I/A/E，JD 只是其中一类目标）——**JD 意图识别与 ServiceCenter 通用编排框架强耦合，不是可孤立抽取的 JD 专属模块**。
- **AI 编排 Prompt 资产**：`app/ai/HireOSAgent/skills/{jd-intake,jd-outtake,checktake,autotake,jd-completion,fileanalyses,filetake,grill-with-docs}/` 下每个技能是 `instructions.md`（自然语言 Prompt）+ `skill.json` + `job-standard-v1.json`（字段 schema），**语言无关，是迁移成本最低、最值得直接复用的资产**。
- **Capability/Run 抽象**：`ai_runs` 表（`capability_code, status, result_json, recommendation_json, proposal_json, failure_code, retry_of_id, idempotency_*, lease_token`）与前端 `CopilotRun` 类型逐字段对应，是**设计最成熟、最值得在 Prisma 中照搬语义重建的一张表**。
- **核心数据表**（`database/001_initial_schema.sql` + 后续 89+ 迁移）：
  - `job_documents`：版本链模型（`document_key + revision_no` 唯一），状态 Template/Draft/Submitted/Confirmed/Cancelled，**无软删列，靠"新增修订版本"追加**。
  - `ai_conversation_sessions`：`workspace_state_json + workspace_state_revision`（即前端 state_revision）实现乐观锁；`summary_text` 做滚动摘要压缩长对话。
  - `ai_conversation_messages`：`(conversation_id, sequence_no)` 严格递增。
  - 多租户：`organization_id` 复合外键强约束，非行级 RLS。
  - "删除"是事件溯源式软删除（插入一条 `capability_code='...deleted'` 的 `ai_runs` 记录，查询侧过滤），非 `deleted_at` 列。
- **SSE 流式实现**：`app/ai/HireOSAgent/streaming.py` 用 `ContextVar` + 线程池 + `asyncio.Queue` 实现，**是相当 Python 特有的方案，无法照搬**，迁移到 Node/Nest 需重新设计为显式 Observable/EventEmitter 流水线。
- **幂等/并发控制**：全局 `Idempotency-Key` header + 命令回执重放模式；`If-Match` header + 各表 version/state_revision 乐观锁。**设计语义清晰，建议按同样语义在 NestJS 重新实现**（拦截器/守卫 + receipts 表），不建议照搬 SQL。
- **代码量级与耦合**：`HireOSAgent`（JD 专属）17,617 行 + `ServiceCenter`（通用编排）11,364 行 + `app/api/jobs.py` 单文件 12,367 行等，**JD 逻辑深度嵌入单体应用，与筛选/测评/邮件等模块共享基础设施表，不是一个可以整体拎出的独立服务**。

---

## 3. 新项目现状（hireos-jd）

### 3.1 前端 `hireos-jd-front`

- 技术栈：Vite + React 19 + react-router-dom v7（非 Next.js）+ Tailwind v4（实际样式主要靠自造 CSS 变量体系 `src/index.css`），无第三方组件库，UI 原语自造（`components/ui/Primitives.tsx` 等），状态管理是自造 Context+reducer（`store/`），无 Redux/Zustand。
- **Copilot 入口**：`pages/NewJobPage.tsx` → `features/copilot/GeminiPanel.tsx`（面板）+ `features/copilot/geminiLogic.ts`（逻辑）。
- **实现程度**：**有状态管理的确定性前端 mock**，不是纯静态占位——聊天记录持久化在 store 的 `geminiChats`，但：
  - 回复内容来自 5 条硬编码岗位模板的正则关键词匹配（`KB` 数组），非真实生成；
  - 语音输入是预设文案 + `setInterval` 打字机效果，界面明确提示"Voice input is simulated in this prototype"；
  - "Create job from this draft" 直接在前端 store 里 mutate 数据，**全程无任何网络请求**。

### 3.2 后端 `hireos-jd-backend`

- 技术栈：NestJS 11 + Prisma 6 + zod + class-validator。
- Prisma schema 只有两张表：`JobDraft`（结构化字段 JSON blob：roleSummary/responsibilities/requirements/dimensions/compensation 等）、`IdempotencyKey`。**没有对话消息表、session/thread 表、AI run 记录表**。
- 现有 `drafts.controller.ts` 只有结构化草稿的 CRUD + confirm/reopen，**没有任何 AI 生成/对话相关 endpoint**。
- `core-record.client.ts` 把 JD "权威数据"的创建/更新/确认转发给一个外部 "core record" 微服务（默认 `127.0.0.1:3004`），**该服务本身不在此仓库**，是尚未落地的服务边界。
- 全仓库 grep `openai|anthropic|LLM|whisper|SSE|WebSocket` 后端侧**零命中**；`WorkspaceGuard` 鉴权目前是开发态占位，生产环境直接拒绝所有请求。

### 3.3 新项目 `docs/` 下已有的目标规范（重要，非空白起点）

`docs/HireOS_Command_JD_Management_{PRD,Design_Brief,Interface_Spec}_v1.3.md` 已经定义了一套**比旧项目更规范**的目标架构：

- **产品体验**：Google Docs + Gemini 式体验，中央可编辑 JD 文档 + 右侧唯一活跃侧栏（Copilot/Comments/Changes 三选一），选区浮动条（Ask Copilot/Rewrite/Shorten/Clarify/Add comment），AI 建议以"Suggested"内联标记呈现，需人工 Accept 生效。
- **接口契约**：`CopilotEditRequest`（request_id、document_ref、base_revision、anchor_refs、scope、instruction、idempotency_key）+ `create-copilot-edit`/`list-suggestions`/`decide-suggestion`/`get-document-revisions` 等命令，AI 运行走 `POST /jd/v1/ai-actions` 返回 202 + run_ref。
- **模型治理框架（SHARED-11）**：`ModelTaskRequest`（task_type、subject_refs、input_manifest、policy_ref、data_classification、budget_ref、idempotency_key）+ `ModelRun`/`Attempt` 记录版本/prompt/用量/成本/回退；明确"无合格模型时返回 no_eligible_model，不生成虚构文本""AI 不能成为 approver""AI 权限 = 用户权限 ∩ Workspace AI Policy ∩ 工具白名单"等治理红线。

---

## 4. 差距对比表

| 能力 | 旧项目现状 | 新项目现状 | 差距 |
|---|---|---|---|
| 对话式 AI 生成 | 真实 LLM（openai-agents SDK） | 正则关键词库 mock | 需从零集成 LLM |
| 流式响应 | 手写 SSE，权威状态与视觉增量分离 | 无，`setTimeout` 一次性替换 | 需设计流式方案 |
| 语音输入 | 真实豆包 ASR，WebSocket 网关 | 预置文案打字机模拟 | 需接入 STT 服务 |
| 文件解析 | 真实上传+AI分类+结构化抽取 | UI 进度条硬编码，无解析 | 需实现解析管道 |
| 对话/会话数据模型 | `ai_conversation_sessions`/`ai_conversation_messages`/`ai_runs` 三表成熟设计 | 无对应表 | 需新建 schema |
| JD 状态机 | 9 阶段 phase，前后端一致 | 无 | 需设计（可参考旧项目语义） |
| 并发/乐观锁 | `state_revision` + `If-Match` + 幂等回执 | `IdempotencyKey` 表已有雏形，无 state_revision 概念 | 需扩展 |
| 发布审核（对外JD+画像+FAQ） | 三部曲 API 完整 | 无 | 需从零实现 |
| 意图分类 | 规则+LLM 两套，与通用编排框架耦合 | 无 | 需按 JD-only 场景重新设计（不建议照搬 ServiceCenter 全量） |
| 目标接口契约 | 无此层设计（旧项目本身没有 CopilotEditRequest 这类抽象） | **已有 v1.3 规范设计好** | 新项目目标契约更先进，应以其为准 |
| 模型治理（路由/预算/审计） | 有简单的模型路由（按长度选 model） | **PRD 已设计 SHARED-11 完整框架，未实现** | 需实现，可参考旧项目路由逻辑但按新规范治理 |

---

## 5. 迁移策略建议

### 5.1 总体原则

1. **不做整体代码搬运**，只做三类资产的迁移：① Prompt/技能包文本资产，② 数据表设计语义（不是 SQL 原样迁移，是按 Prisma 重建同等语义的字段和约束），③ 状态机 phase 划分与流程语义。
2. **以新项目 `docs/` 的 v1.3 规范为目标契约**，而不是以旧项目现有接口为目标——旧项目没有 `CopilotEditRequest`/`ModelTaskRequest` 这类抽象，新规范更先进，迁移应该"向新规范对齐"而不是"复刻旧接口"。
3. 后端语言切换（Python→TypeScript）意味着 AI 编排层必须重写；短期可评估是否值得把旧 `HireOSAgent` 作为独立 Python 微服务保留、通过内部 HTTP 桥接供新 NestJS 后端调用（绞杀者模式），但需注意它与 ServiceCenter/邮件/附件等横切模块深度耦合，桥接边界需要仔细裁剪，不能整体照搬。

### 5.2 建议的分阶段路线图

**阶段一（打通骨架）**：
- Prisma schema 新增会话/消息/AI run 三张表（参考 `ai_conversation_sessions`/`ai_conversation_messages`/`ai_runs` 字段设计，映射到新命名规范）。
- NestJS 后端接入一个 LLM Provider（Node 官方 SDK），实现最小闭环：接收一条消息 → 调 LLM → 落库 → 返回。先不做流式，用普通 HTTP 同步返回验证链路。
- 前端 `GeminiPanel`/`geminiLogic.ts` 替换 mock 逻辑为真实 API 调用，去掉 `KB` 正则库。

**阶段二（体验对齐 v1.3 规范）**：
- 按 Interface Spec 实现 `CopilotEditRequest`/`create-copilot-edit`/`list-suggestions`/`decide-suggestion` 等命令，落地"选区浮动条 + Suggested 内联建议 + Accept 确认"的编辑体验（这是新规范独有、旧项目没有的更优体验，不是从旧项目迁移而来）。
- 引入 JD 状态机（可直接借鉴旧项目 9 阶段 phase 语义，按实际需要精简，例如是否需要 `filetake`/`autotake` 这类旧项目里与其他业务耦合的阶段）。
- 实现流式响应（Node 侧用 SSE/Observable，不必照搬 Python 的 ContextVar 方案）。

**阶段三（补齐支持能力）**：
- 文件上传解析（可先复用旧项目 `job-standard-v1.json` 字段 schema 定义解析目标结构）。
- 语音输入：评估是否复用旧项目豆包 WS 网关（协议已文档化，可保留为独立服务或用 Node 重写），或改用其他 STT 方案。
- 发布审核三部曲（对外 JD / 招聘画像 / FAQ 生成）。

**阶段四（治理与规模化）**：
- 按 PRD SHARED-11 实现模型路由/预算/审计（旧项目只有简单的按长度路由，新规范要求更完整的治理，是新增能力而非迁移）。
- 幂等与并发控制：复用现有 `IdempotencyKey` 表并扩展乐观锁字段（参考旧项目 `state_revision` + `If-Match` 语义）。

### 5.3 关键决策点（需要用户/团队拍板）

1. **语音识别方案**：继续对接字节跳动豆包（协议已知，需评估合规/合同/成本），还是切换到其他 STT（如 Whisper API、阿里云等）？
2. **是否短期桥接旧 Python 服务**：如果 JD 上线时间紧，是否接受"新前端 + NestJS 网关 + 旧 Python HireOSAgent 桥接"的过渡架构？这需要评估旧服务的部署/运维成本是否能接受被两个系统共用。
3. **意图分类范围**：新项目是否只做 JD 创建（窄范围，建议独立轻量实现），还是要复刻旧项目 ServiceCenter 那种覆盖招聘全链路的通用任务路由（重范围，成本高很多）？—— 从新项目现状（仅 JD 管理域）判断，建议**只做 JD-only 的窄范围意图识别**，不迁移 ServiceCenter。

---

## 6. 关键文件路径速查

**旧前端**：`heri_web/src/components/workspace-shell.tsx`、`copilot-machine.ts`、`lib/copilot-stream.mts`、`lib/copilot-reconciliation.mts`、`features/jobs.tsx`、`features/jd-output-review.tsx`、`lib/file-analysis-model.mts`、`components/voice-input-button.tsx`、`lib/doubaoinput-stream.mts`、`lib/platform.ts`

**旧后端**：`heri_server/app/api/automation.py`、`app/api/jobs.py`（9536-9760 行 apply-stream 区间）、`app/ai/HireOSAgent/jd_workspace_machine.py`、`app/ai/HireOSAgent/skills/*/instructions.md`、`app/ai/HireOSAgent/streaming.py`、`app/intents/jd.py`、`app/ai/ServiceCenter/task_routing/`、`app/doubaoinput/{provider,agent,tickets}.py`、`database/001_initial_schema.sql`（`job_documents`、`ai_runs`、`ai_conversation_sessions` 表定义）

**新项目**：`hireos-jd-front/src/features/copilot/{GeminiPanel.tsx,geminiLogic.ts}`、`hireos-jd-front/src/pages/NewJobPage.tsx`、`hireos-jd-backend/src/drafts/*`、`hireos-jd-backend/src/auth/workspace.guard.ts`、`hireos-jd-backend/src/core/core-record.client.ts`、`hireos-jd-backend/prisma/schema.prisma`、`docs/HireOS_Command_JD_Management_{PRD,Design_Brief,Interface_Spec}_v1.3.md`
