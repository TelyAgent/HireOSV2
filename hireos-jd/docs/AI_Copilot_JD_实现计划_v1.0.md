# AI 对话式创建 JD（Copilot）实现计划

版本：v1.0
日期：2026-09-21
承接文档：`AI_Copilot_JD_迁移分析报告_v1.0.md`

## 0. 范围与关键决策（已与用户确认）

| 决策项 | 结论 |
|---|---|
| 语音识别 | 复用字节跳动豆包实时 ASR 协议，但**在 NestJS 内用 Node 重新实现** WS 网关（不桥接旧 Python 服务） |
| 后端架构 | **不桥接旧 Python HireOSAgent**，AI 编排全部在 NestJS 内重写 |
| 编排/意图范围 | **只做"对话式创建 JD"这一个场景**，不迁移旧项目 ServiceCenter 那种覆盖招聘全链路的通用任务路由 |
| LLM 供应商 | **OpenAI**，已在 `hireos-jd-backend/.env` 配置好 `HIREOS_AI_API_KEY`/`HIREOS_AI_BASE_URL`/`HIREOS_AI_MODEL`（沿用旧项目的环境变量命名习惯），第 8 节风险清单原第 4 条已解决 |

**本期不做（Non-goals）**：
- 不实现 Interface Spec v1.3 §16 的"文档级 Copilot 修订"体系（`CopilotEditRequest`/`DocumentSuggestion`/`TextAnchor` 等选区建议+人工 Accept 的协同编辑能力）——那是对**已存在** JD 文档做局部改写建议的能力，属于后续里程碑，不在"从 0 创建一份新 JD"这个场景内。
- 不实现 PRD SHARED-11 完整的模型路由/预算/审计治理框架，先以最小可用埋点替代，留待独立迭代。
- 不实现候选人匹配、简历导入、邮件发送等旧项目里与 JD 创建耦合在一起但本质属于其他业务域的能力。

## 1. 关键架构约束（重要，影响任务顺序）

现有 `hireos-jd-backend` 的 `DraftsController`（`src/drafts/drafts.controller.ts`）路由是 `jobs/:jobId/drafts/*`，即**创建/更新草稿的前提是 `jobId` 已经存在**。`DraftsService.create()` 会调用 `CoreRecordClient.createRoleVersion(identity, jobId, ...)`，这个 Core 服务（`CORE_RECORD_BASE_URL`，默认 `127.0.0.1:3004`）是本仓库之外的权威数据源，**本仓库当前没有任何"创建一个新 Job（分配 jobId）"的接口**。

这意味着："对话生成 JD 草稿"和"确认发布成一个真正的 Job"之间，缺一环——谁来分配 `jobId`。这是**开发前必须确认的阻塞依赖**，见第 8 节风险清单第 1 条。本计划按"先假设存在一个 `JobsFacade.ensureJob()` 可调用点，具体由谁实现待确认"来设计，不阻塞其余部分的开发。

## 2. 总体架构

```
[hireos-jd-front]
  NewJobPage → GeminiPanel（对话面板）
       │  REST + SSE
       ▼
[hireos-jd-backend]
  CopilotModule
    ├─ CopilotController        (会话/消息/附件/确认 的 HTTP+SSE 入口)
    ├─ CopilotService           (会话生命周期、phase 状态机、字段合并)
    ├─ LlmProvider (interface)  (可插拔的 LLM 调用抽象)
    ├─ PromptRegistry            (加载 skills/jd-intake/instructions.md + job-standard-v1.json)
    ├─ VoiceGateway (WS)         (豆包协议 Node 实现)
    └─ AttachmentsService        (文件上传解析)
  DraftsModule（已存在，复用）
  CoreRecordClient（已存在，复用）
```

- 前端与后端之间：普通消息用一次 SSE 请求（`fetch` + 手动 reader，参考旧项目 `copilot-stream.mts` 的思路，但事件类型大幅简化）。
- 会话状态的"权威落点"只有一个：每次 `messages` 调用结束后落库的 `CopilotMessage` + `CopilotConversation.fields/phase`；流式增量只做前端视觉呈现，绝不是唯一数据源（沿用旧项目已验证的设计原则）。

## 3. 数据模型（Prisma schema 新增）

沿用现有 `JobDraft`/`IdempotencyKey` 的命名与风格（camelCase、`workspaceId` 隔离、JSON 字段存结构化内容）：

```prisma
model CopilotConversation {
  id             String   @id @default(uuid())
  workspaceId    String
  actorId        String
  jobId          String?           // 未绑定 Job 前为空
  phase          String   @default("intake") // intake | drafting | ready_to_confirm | completed
  fields         Json     @default("{}")     // 已收集的结构化字段（roleSummary/responsibilities/requirements等）
  missingFields  Json     @default("[]")     // 待澄清字段列表，驱动下一轮追问
  stateRevision  Int      @default(0)        // 乐观锁，配合 Idempotency-Key 使用
  summary        String?                     // 长对话滚动摘要（超过阈值轮次后生成）
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  messages CopilotMessage[]
  runs     AiRun[]

  @@index([workspaceId, actorId, updatedAt])
}

model CopilotMessage {
  id             String   @id @default(uuid())
  conversationId String
  sequence       Int
  role           String   // user | assistant
  text           String?
  attachments    Json?
  idempotencyKey String?
  createdAt      DateTime @default(now())

  conversation CopilotConversation @relation(fields: [conversationId], references: [id])

  @@unique([conversationId, sequence])
}

model AiRun {
  id             String   @id @default(uuid())
  workspaceId    String
  conversationId String?
  capabilityCode String   // jd_intake_turn | jd_parse_attachment | jd_generate_draft
  status         String   @default("Queued") // Queued|Running|Succeeded|Failed
  resultJson     Json?
  failureCode    String?
  idempotencyKey String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([workspaceId, capabilityCode, status])
}
```

字段设计依据（对应迁移分析报告第 2.2 节）：`stateRevision` 对齐旧项目 `ai_conversation_sessions.workspace_state_revision` 的乐观锁语义；`AiRun` 对齐旧项目 `ai_runs` 的 capability/status/result/failure_code 结构；`fields/missingFields` 是旧项目 `JDIntentPreview.fields/missing_fields` 的简化落地。

## 4. 后端模块任务分解

### 4.1 `CopilotModule` 骨架
- [ ] `copilot.module.ts` / `copilot.controller.ts` / `copilot.service.ts`，路由前缀 `copilot/conversations`，`@UseGuards(WorkspaceGuard)` 与 `DraftsController` 保持一致
- [ ] Prisma migration：新增上述三张表
- [ ] 接口：
  - `POST /copilot/conversations` — 创建会话（幂等）
  - `GET /copilot/conversations/:id` — 获取会话详情（含 messages、phase、fields）
  - `GET /copilot/conversations` — 历史列表（按 `workspaceId+actorId`）
  - `POST /copilot/conversations/:id/messages` — 发送一条消息，`Accept: text/event-stream` 时走流式，否则同步返回（便于 M1 先不做流式也能联调）
  - `POST /copilot/conversations/:id/attachments` — 上传文件（multipart，NestJS 内置 `FileInterceptor` 即可，不需要旧项目那种 prepare/complete 两步直传设计，量级不需要）
  - `POST /copilot/conversations/:id:confirm-draft` — 确认生成，内部调用 `JobsFacade.ensureJob()` 拿到 `jobId` 后转调 `DraftsService.create()`，返回 `jobId` + `draftId`

### 4.2 `LlmProvider` 抽象
- [ ] 定义接口 `LlmProvider { completeStream(input): AsyncIterable<Delta> }`，实现基于 **OpenAI Node SDK**（`openai` npm 包），仍保留接口抽象以便后续替换/新增供应商，不把 SDK 类型泄漏到 `CopilotService` 之外
- [ ] 用 NestJS `ConfigService` 读取已在 `.env` 配置好的变量：`HIREOS_AI_API_KEY` / `HIREOS_AI_BASE_URL`（`https://api.openai.com/v1`）/ `HIREOS_AI_MODEL`（当前为 `gpt-5.6-luna`，需要与业务方确认这是否是账号下实际可用的模型名，是否要在 Copilot 场景用同一个模型或换更便宜的模型）/ `HIREOS_AI_TIMEOUT_SECONDS`
- [ ] 复用官方 SDK 的流式接口（`stream: true`）产出 token 级 delta，桥接到 4.4 节的 SSE 推送
- [ ] `.env.example` 需要同步补上这些变量名（当前 `.env.example` 里没有，只有 `.env` 有实际值），避免其他开发者拉取仓库后不知道要配置什么

### 4.3 `PromptRegistry`（Prompt 资产迁移，成本最低的一步）
- [ ] 从旧仓库 `heri_server/app/ai/HireOSAgent/skills/jd-intake/` 和 `jd-completion/` 拷贝 `instructions.md` + `job-standard-v1.json`，放入 `hireos-jd-backend/src/copilot/skills/jd-intake/`，按新项目字段命名做一次映射调整（旧字段名 vs `JobDraft` 现有字段名需要对照表，见第 8 节风险第 3 条）
- [ ] 精简旧项目 9 阶段状态机为 3 阶段：`intake`（澄清追问）→ `drafting`（AI 已能生成完整字段草稿，等待用户确认/微调）→ `ready_to_confirm`

### 4.4 每轮消息处理逻辑（`CopilotService.sendMessage`）
1. 校验 `Idempotency-Key`，复用现有 `records.ts` 的 `findIdempotent`/`storeIdempotency` 模式
2. 追加 user `CopilotMessage`（`sequence` 递增）
3. 组装上下文：历史消息（超过阈值轮数用 `summary` 折叠） + 当前 `fields`
4. 调 `LlmProvider`，要求结构化输出：`{ fields_patch, missing_fields, assistant_reply, phase_suggestion }`
5. 合并 `fields_patch` 到 `CopilotConversation.fields`，更新 `phase`/`missingFields`/`stateRevision += 1`
6. 落库 assistant `CopilotMessage`；流式模式下逐 token emit `assistant.delta`，结束时 emit 一次 `conversation.committed`（携带最终 fields/phase，前端以此为准，不信任累积的 delta）
7. 记录一条 `AiRun`（`capabilityCode="jd_intake_turn"`），便于后续观测失败率

### 4.5 `confirm-draft` 接口
- [ ] 校验 `phase === "ready_to_confirm"` 且 `missingFields` 为空
- [ ] 调用 `JobsFacade.ensureJob(identity, conversation)` 取得 `jobId`（**该方法内部实现依赖第 8 节开放问题的结论**）
- [ ] 调用现有 `DraftsService.create(identity, jobId, fields, meta)`，复用已验证的 Core 写入 + 幂等事务逻辑
- [ ] 更新 `CopilotConversation.phase = "completed"`，`jobId` 回填

### 4.6 附件解析（`AttachmentsService`）
- [ ] 接收 PDF/DOCX/TXT，用现成的文本抽取库（如 `pdf-parse`/`mammoth`）转纯文本，不追求还原版式
- [ ] 调 LLM 按 `job-standard-v1.json` schema 做结构化抽取，结果作为 `fields_patch` 合并进会话，走 4.4 相同的合并/落库路径

## 5. 语音输入（Node 重写豆包协议）

- [ ] 新建 `VoiceGatewayModule`，用 `ws` 库在 NestJS 里起一个 WebSocket 端点（`/copilot/voice-stream`）
- [ ] 参照旧项目 `heri_server/app/doubaoinput/provider.py` 的二进制帧协议（protocol version、消息类型、gzip 压缩、JSON payload）用 Node `zlib` + `Buffer` 复刻编解码逻辑
- [ ] 参照 `tickets.py` 的短时 ticket 鉴权逻辑，在 Node 侧重新实现（生成短时 token，前端连接时携带）
- [ ] 需要与旧项目/平台侧确认豆包账号、API Key、额度是否可共用（见第 8 节风险第 2 条）
- [ ] 前端 `VoiceInputButton` 组件：从旧项目移植 `getUserMedia` + PCM 采集逻辑，去除 Next.js 特有依赖，改造为纯 React 组件，替换 `GeminiPanel.tsx` 里 `sampleTranscript()` 的模拟逻辑

## 6. 前端实现任务分解（`hireos-jd-front`）

- [ ] 新增 `src/features/copilot/copilotApi.ts`：封装 `createConversation` / `getConversation` / `sendMessage`（SSE，参考旧 `copilot-stream.mts` 简化实现：`fetch` + 手动 reader 解析 `event:`/`data:` 帧）/ `uploadAttachment` / `confirmDraft`
- [ ] 新增 `src/features/copilot/useCopilotConversation.ts`：状态管理 hook，替代散落在 `geminiLogic.ts` 里的 mock 逻辑。**不需要旧项目 `copilot-machine.ts` 那种四层正交状态机**（那是因为旧系统要同时管理"会话"和"已绑定 JD 文档的协同编辑"两个资源；本次场景里 JD 只在 `confirm-draft` 成功后才产生，之前只有单一会话生命周期），只需维护：`conversationId / messages / phase / fields / busy / error`
- [ ] 改造 `GeminiPanel.tsx`：
  - 删除 `geminiLogic.ts` 里的正则 `KB` 匹配和 `friendlyRewrite`/`shortenText` 规则改写
  - 接入真实流式渲染（assistant 消息逐字追加，`conversation.committed` 到达后用服务端权威内容覆盖）
  - 发送失败时的重试 UI（参考旧项目 `delivery:"Failed"` + 重试按钮的思路，但不需要复刻其 `retry_state_revision` 的复杂度，简单起见失败即整轮重发）
  - "生成 JD 草稿"确认卡片（对应旧项目 `CopilotJdCreationCard` 的简化版）：展示已收集字段摘要 + "确认创建岗位"按钮 → 调 `confirmDraft` → 跳转到新建的 job 详情页
- [ ] 文件上传卡片（`CreateModal(mode="upload")`）接入真实 `uploadAttachment`，把硬编码的 Uploading→Checking→Extracting→Ready 进度条换成真实状态轮询/回调
- [ ] 语音按钮接入 `VoiceGatewayModule` 的 WebSocket，替换打字机模拟

## 7. 里程碑

| 里程碑 | 目标 | 主要产出 |
|---|---|---|
| **M1 对话闭环（无流式/无语音/无文件）** | 验证"文字对话 → LLM 结构化字段 → 落库"链路可用 | Prisma 新表、`LlmProvider` 抽象、`jd-intake` prompt 迁移、`POST conversations/:id/messages` 同步版、前端替换 mock 为真实 API（非流式，等回复后一次性渲染） |
| **M2 流式 + 确认发布** | 完整走通"聊出一份 JD → 确认 → 生成 Job/Draft"全流程 | SSE 实现、3 阶段状态机、`confirm-draft` 接口（依赖第 8 节 jobId 分配问题先解决）、前端流式渲染 + 确认卡片 |
| **M3 语音输入** | 语音描述岗位需求可用 | Node 版豆包网关、`VoiceInputButton` 移植 |
| **M4 文件解析** | 上传 JD/JD相关文档可自动抽取字段 | `AttachmentsService`、前端上传进度接入真实状态 |
| **M5 观测与加固** | 具备基本可观测性和异常兜底 | `AiRun` 失败率看板/日志、断线重连测试、并发冲突测试 |

## 8. 风险与开放问题（需在对应里程碑开始前确认）

1. **【阻塞 M2】jobId 分配机制未定**：本仓库当前没有"创建新 Job"的接口，`DraftsService.create()` 要求 `jobId` 已存在。需要确认：是由外部 Core/Screening 服务提供创建接口（本仓库调用），还是需要在本仓库内新增一个"最小化建岗"接口占位？这直接决定 `JobsFacade.ensureJob()` 怎么实现，**必须在 M2 开始前拍板**。
2. **语音服务账号/合规**：复用豆包协议需要确认能否复用旧项目的豆包账号/API Key/额度，是否需要新申请，是否有合同/合规限制。
3. **字段 schema 映射**：旧项目 `job-standard-v1.json` 定义的字段命名与新项目 `JobDraft` 现有字段（`roleSummary/responsibilities/requirements/dimensions/hiringContext/successCriteria/internalCompensation/publicCompensation`）需要做一次逐字段映射表，避免 LLM 输出结构无法直接写入。
4. ~~LLM 供应商选型未定~~ **已解决**：确定为 OpenAI，Key/BaseURL/Model 已在 `.env` 配置（见第 0 节）。遗留小问题：`HIREOS_AI_MODEL=gpt-5.6-luna` 是否为该账号下真实可调用的模型名需要在 M1 联调时第一时间验证，避免模型名不存在导致调用失败。
5. **鉴权**：`WorkspaceGuard` 目前是开发态占位，生产环境直接拒绝所有请求；Copilot 功能上线前需要真实鉴权体系同步到位。

## 9. 验收标准（MVP，对应 M1+M2）

- 用户在 New Job 页面通过文字对话，多轮追问后能得到一份包含 `roleSummary`/`responsibilities`/`requirements` 的结构化字段集合
- 点击"确认创建岗位"后，能成功生成一条 `JobDraft` 记录并跳转到对应详情页（前提：第 8 节第 1 条已有明确方案）
- 网络中断重连后，不会产生重复的 assistant 消息，也不会丢失已收集的字段（`conversation.committed` 落库前的部分允许丢失，但已落库部分必须可恢复）
- 相同 `Idempotency-Key` 重复提交同一条消息，不会产生重复的 `CopilotMessage`/`AiRun` 记录
