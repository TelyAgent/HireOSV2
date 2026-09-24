# HireOS 会议记录实现计划 v1.0

日期：2026-09-11  
状态：待确认方案；本文不代表功能已实现。

## 1. 目标与范围

在现有实时面试右侧“笔记 / 转写 / AI 建议”区域接入真实会议记录，保持原有页面结构和视觉样式。转写按截图呈现时间、说话人、正文，但不得保留模拟记录或把模拟状态显示成真实录制。

推荐首期范围：

- 人工笔记自动保存，刷新和重新入会后可恢复。
- 获得有效授权后启动 Zoom RTMS，接收双方实时转写。
- 按面试场次保存转写、说话人引用、来源时间和记录中断信息。
- 浏览器断线后恢复已入库记录；停止转写后仍能查看历史。
- 完成记录时保留人工笔记与机器转写的来源差异。

首期不做：音视频文件保存或回放、云录制、AI 摘要/建议、自动评分、自动录用决定、其他页面重构。AI 建议保留原标签和不可用状态，不填充虚构内容。

“转写中”与“录制中”必须区分：首期没有保存录音文件，因此不能用截图里的“录制中”表示转写服务运行。

## 2. 当前项目现状

已核对以下实现：

| 位置 | 当前能力 | 本次相关缺口 |
| --- | --- | --- |
| `src/pages/project/LivePage.tsx`（前端） | 三个标签、临时 textarea、离页确认 | 笔记只在 React state，转写为空，完成按钮禁用 |
| `src/features/live-interview/ZoomHostPanel.tsx`（前端） | OAuth 连接、创建/复用主持会议 | 尚未传递真实场次标识 |
| `public/zoom-meeting/meeting.js`（前端） | 独立 iframe 中运行 Meeting SDK | 负责会议 UI，不作为转写数据抓取接口 |
| `src/meetings/zoom-host.service.ts`（后端） | OAuth、创建会议、ZAK、主持签名 | 当前按开发用户保存一场会议，没有项目/轮次绑定 |
| `prisma/schema.prisma`（后端） | PostgreSQL、Project、Material、ParseJob、Revision | 没有场次、笔记、转写、RTMS 任务模型 |

现有鉴权仍为开发身份，Zoom 令牌保存在本地加密文件中。可继续用于隔离的本地验证，但不应作为多人生产环境权限模型。不能把示例项目或页面上的“第 2 轮”直接当成真实数据库关联。

PRD 对应约束：INT-05 要求有效授权后启用录制/转写；拒绝或失败时仍支持手工问答与笔记；AI 与人工分离；记录可追溯、可中断、可恢复。

## 3. 技术选型

### 3.1 推荐链路

```text
Zoom Meeting SDK iframe：会议 UI、音视频交互
                  （与记录通道分离）
用户开始转写 -> NestJS 权限/授权校验 -> Zoom RTMS 控制 REST API
Zoom webhook -> 验签/持久化事件 -> RTMS worker
RTMS 信令及媒体 WebSocket -> 转写适配器 -> PostgreSQL
PostgreSQL 记录事件 -> SSE -> React 转写面板
React 笔记编辑 -> NestJS 版本校验 -> PostgreSQL
```

Zoom RTMS 提供服务端实时转写流；当前官方指南支持通过 REST 控制启动/停止，再经 webhook 建立 WebSocket 数据连接。首期只申请 transcript 数据，不申请音频/视频流。[官方快速开始](https://developers.zoom.us/docs/rtms/meetings/quickstart-rest-api/)

不使用 DOM 抓取 Zoom 字幕，也不使用浏览器麦克风录音冒充完整会议记录：本地麦克风不能可靠覆盖远端音频。会后云录制转写不是实时转写的替代品。

### 3.2 是否需要额外 AI

首期优先使用 Zoom 提供的转写文本，不额外把音频发往第三方 ASR。现有 `HIREOS_AI_MODEL` 是材料解析的配置，不直接作为语音识别配置。

如 RTMS 原生转写的中英文质量不达标，再单独评估“RTMS 音频 + ASR”，重新确认数据处理授权、权限、成本、说话人映射和延迟。不得在原生转写失败时静默切换到另一家服务。

AI 摘要留到下一期：必须引用 transcript segment ID，保留输入版本、模型/提示版本和人工修改记录，不自动产生最终评分。

## 4. P0：先验证外部条件

实施前必须通过一个真实双端会议 PoC，不能只凭 SDK 已能入会就认为 RTMS 可用。

1. 核对 Zoom Developer Pack credits、账户/管理员策略及 RTMS 功能可用性。实际额度、价格与账户限制按后台和当日官方政策核实，不预设免费可用。[接入条件](https://developers.zoom.us/docs/rtms/meetings/add-features/)
2. General App 增加 `meeting:read:meeting_transcript`；控制接口按应用授权类型核对 `meeting:update:participant_rtms_app_status` 或对应 admin scope，不为方便而申请全部管理员权限。新增 scopes 后重新授权。
3. 订阅 `meeting.started`、`meeting.ended`、`meeting.rtms_started`、`meeting.rtms_stopped`，核对各事件需要的权限。
4. 分别核对 OAuth Public Client ID、RTMS 应用 Client ID/Secret、webhook Secret Token。RTMS 握手凭据不能用 Public Client ID 或 ZAK 代替；本项目 PKCE 用户授权是否可用于该应用的 RTMS 控制必须实测。
5. 提供 Zoom 可访问的 HTTPS webhook 地址。现有随机 loopback OAuth callback 不能接收 Zoom 服务端 webhook。
6. 本地联调只公开独立 webhook 接收入口；禁止把带开发身份的整个 NestJS API 暴露到公网。公网入口必须验签，其他路径拒绝访问。
7. 双方轮流说中文、英文及混合内容，验证说话人、时间单位、消息是否修订、重复包、首条延迟、停止事件和重连行为。

PoC 通过标准：收到两位真实参与者的文本，能区分发言人，停止后不再采集；形成脱敏协议样例与测试记录。若权限或原生转写不可用，明确阻塞原因，笔记功能可独立实施，但不把会后转写宣称为实时完成。

## 5. 场次与数据模型

先增加最小场次模型，不重做面试计划/排期页面。进入记录功能必须取得真实 `projectId` 与 `sessionId`；开发演示使用明确标记的测试场次。

| 新模型 | 核心字段与约束 |
| --- | --- |
| InterviewSession | id、workspaceId、projectId、roundKey、status、hostActorId、zoomAccountId、zoomMeetingNumber、zoomMeetingUuid、startedAt、endedAt |
| MeetingRecord | id、sessionId、captureStatus、completeness、consentVersion、retentionUntil、version；每场次唯一 |
| RecordConsent | recordId、participantRef、scope、status、actorId、noticeVersion、timestamp、evidenceRef；追加保存授权与撤回历史 |
| RecordNote | recordId、authorId、content、version、updatedAt；每作者一份笔记，默认仅作者可读写 |
| TranscriptSegment | id、recordId、streamId、sourceKey、speakerRef、speakerNameSnapshot、sourceTimestamp、offsetMs、text、revision、receivedAt |
| TranscriptCorrection | segmentId、editorId、text、reason、version、createdAt；保留机器原文，不覆盖来源 |
| RtmsRun | recordId、streamId、status、leaseOwner、leaseUntil、lastPacketAt、errorCode、startedAt、stoppedAt |
| RecordEvent | recordId、sequence、type、payload、createdAt；持久 SSE 游标，与业务写入同事务 |
| WebhookInbox | dedupeKey、eventType、processingStatus、attempt、receivedAt；短期受控保存必要载荷 |

会议号不是一次会议的唯一标识：复用会议号、重新开会可能产生不同 UUID。场次关联必须核对账户、会议号、会议实例 UUID，不能只按 displayName 或 meetingNumber 路由。

说话人采用 provider participant ID + meeting UUID；同名不合并，重入映射需可追溯，未知身份标记“未知发言人”，不根据声音或姓名猜测候选人身份。

转写协议字段按 PoC 核对：官方事件结构包含文本、说话人及时间相关字段，但不能臆造稳定 segment ID 或 partial/final 标记。无来源唯一 ID 时，将 stream、说话人、原始时间、内容摘要组合成去重键；不能仅按文本去重，以免丢掉重复说出的相同句子。[RTMS 事件参考](https://developers.zoom.us/docs/rtms/event-reference/)

## 6. 状态与一致性

记录采集状态：

```text
idle -> awaiting_consent -> starting -> active -> stopping -> stopped
                                |         |
                                v         v
                              failed   interrupted -> starting
```

- POST 启动返回成功只表示已受理，不能立即显示“转写中”。握手成功、数据通道就绪后才进入 active；静音无文字不等于断线，用连接与心跳判断。
- 停止、撤回授权或会议结束时立即禁止写入新采集内容，关闭对应连接并请求上游停止；上游停止失败要重试和告警，不能谎报远端已停止。
- 浏览器离开会议不等于结束整个会议，不能单靠 iframe 的 closed 事件封存所有人的记录。记录状态由服务端会议/RTMS 事件及显式操作驱动。
- 重连恢复新流时保留旧片段，标记缺失时间区间。SSE 重放只能补发已入库文本，不能恢复 Zoom 未交付的音频或文本。
- 结束会话后留出有限的迟到消息处理窗口，并明确封存截止点；重复结束和乱序开始事件不得重新启动已封存场次。
- worker 使用数据库租约；同一个 stream 只能有一个连接所有者。进程崩溃后接管并核实上游状态，避免重复收费与重复文本。

笔记保存使用 debounce（建议 800ms）与 version 乐观锁；冲突返回 409，保留本地未保存内容，禁止静默覆盖。默认不把敏感笔记长期写入 localStorage；离页时如尚未成功保存，明确提示，不能仅依赖 beforeunload 异步请求。

## 7. 后端模块和接口

建议新增 `src/meeting-records/`，拆分 controller、service、repository、notes、transcript adapter、SSE service；`src/meetings/rtms/` 放 RTMS control、webhook、worker。复用现有 Prisma 和 OAuth 刷新能力，暂不新增 Redis/Kafka。

后端 worker 可先与 NestJS 同进程部署，但长连接与 HTTP 控制逻辑分开，后续可独立进程运行。使用持久任务/租约，不能照搬一次性材料解析任务的生命周期。

以下为拟定内部 API，均以 `/api` 为前缀：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/projects/:projectId/interview-sessions` | 幂等创建真实场次，验证项目访问权限 |
| GET | `/interview-sessions/:sessionId/record` | 状态、权限、完整性、快照游标 |
| POST | `/interview-sessions/:sessionId/record/consents` | 记录授权/撤回，不允许面试官伪造他人确认 |
| POST | `/interview-sessions/:sessionId/record/start` | 校验主持身份、有效授权与会议关联后启动 |
| POST | `/interview-sessions/:sessionId/record/stop` | 幂等停止采集，不结束 Zoom 会议 |
| GET/PUT | `/interview-sessions/:sessionId/record/notes/me` | 本人笔记读取/版本化保存 |
| GET | `/interview-sessions/:sessionId/record/transcript?cursor=...` | 分页历史 |
| GET | `/interview-sessions/:sessionId/record/events` | SSE 增量流 |
| POST | `/interview-sessions/:sessionId/record/complete` | 封存记录；不等于结束会议或提交评分 |
| POST | `/integrations/zoom/webhook` | 唯一外部回调；验签，不使用开发 WorkspaceGuard |

现有 host/start 需要接收并验证 sessionId，在服务端加载会议关联；不能允许客户端传任意 meetingNumber 启动采集。OAuth 账户不能继续只保存一个全局 meeting 字段作为场次数据源。

SSE 使用同源已认证会话，不能将长期令牌放 URL。事件包括 `record.status`、`transcript.upsert`、`record.gap`、`record.completed`；每条带 sequence。先取一致性快照和游标，再订阅游标之后的事件；断线使用 Last-Event-ID 重放，游标过期则重取快照。代理禁用缓冲，发送心跳并限制单用户连接数。

错误码至少区分：`CONSENT_REQUIRED`、`ZOOM_SCOPE_REQUIRED`、`RTMS_UNAVAILABLE`、`MEETING_NOT_ACTIVE`、`RECORD_FORBIDDEN`、`RTMS_CONNECTION_FAILED`、`NOTE_VERSION_CONFLICT`。服务端错误不得泄露 token、完整 webhook 或会议口令。

## 8. 前端组件与交互

在现有 `src/features/live-interview/` 内新增：

- `MeetingRecordPanel.tsx`：协调右侧标签、记录状态和权限。
- `MeetingNotes.tsx`：自动保存、保存中/失败/冲突状态。
- `MeetingTranscript.tsx`：历史分页、时间戳、发言人、增量更新。
- `RecordConsentDialog.tsx`：告知采集范围和参与者授权状态。
- `useMeetingRecord.ts`：API、SSE 重连、游标、状态同步和清理。

LivePage 只负责传 sessionId 和协调布局；不继续堆积网络/转写逻辑。沿用现有颜色、宽度、标签和中英文机制，不改其他详情页。

转写列表仅在用户位于底部时自动跟随；用户上翻查看历史时保留位置，显示新内容数量。正文按文本渲染，禁止执行 HTML。UI 语言切换只翻译控件，不翻译或覆盖原始发言文本。

授权未确认、启动中、等待发言、转写中、已停止、连接中断、权限不足均有真实状态。拒绝转写时笔记仍可用。不要重新引入模拟发言来填充空状态。

## 9. 安全与数据治理

- 采集前明确告知用途、范围、处理服务与保留规则；Zoom 主持人权限不自动等于所有参与者同意。授权机制和上线地区要求需产品/合规确认，本文不作法律结论。
- 后加入参与者也需覆盖授权流程；无有效授权时按既定策略暂停采集，不能只记录首次会议启动的勾选。
- webhook 按 Zoom 官方规范完成 URL validation、原始请求体验签、时间窗口校验和重放去重；确认事件所属账户/会议。收到后先持久化再快速应答，异步处理。[Webhook 文档](https://developers.zoom.us/docs/api/webhooks/)
- webhook 中 WebSocket URL 不能直接信任：限制协议及已核实的 Zoom 服务目标，拒绝私网/本地目标并校验证书，防止 SSRF。
- 所有查询、SSE、笔记保存按工作区与场次授权；仅知道 sessionId 不获得读取权。笔记默认私有，转写仅授权面试参与者访问。
- 日志记录技术状态与计数，不记录转写正文、候选人资料或握手密钥。必要原始包仅在隔离测试中短期脱敏保存。
- 数据保留期必须可配置且上线前确定；清理覆盖正文、修订、缓存、事件重放和备份生命周期。先保留最小审计，不无限期保留转写副本。
- 对外部署前替换开发鉴权，完成令牌安全存储和项目权限校验；在此之前仅做隔离开发联调。

## 10. 实施顺序与交付门槛

| 阶段 | 工作 | 通过标准 |
| --- | --- | --- |
| P0 能力验证 | RTMS 权限、凭据、webhook、真实双端转写 | 中英文双方发言到达、身份/时间可解释、启停有效 |
| P1 数据基础 | 场次绑定、记录模型、笔记 API/前端 | 刷新不丢笔记、版本冲突可处理、不同场次不串数据 |
| P2 服务端采集 | RTMS worker、验签、入库、状态机、租约 | 重复/乱序/重连/撤回不重复采集或误启动 |
| P3 实时展示 | SSE、分页、滚动、中英文状态 | 新文本实时出现、刷新恢复、滚动稳定、无模拟内容 |
| P4 验收 | 真实会议、权限、故障、保留清理 | 全部安全和端到端用例通过并记录实测结果 |

不在 P0 通过前承诺正式排期；外部权限确认后再按任务拆分估时。P1 的笔记持久化可独立交付。

## 11. 测试与验收

- 单元：协议适配、时间归一化、重复话语不误删、修订处理、状态迁移、权限、笔记冲突。
- 集成：webhook 验签/过期/重放、事务与 SSE 游标、租约接管、乱序事件、停止重试、多场次隔离。
- 前端：标签切换、语言切换、分页、上翻不跳动、断网重连、保存失败、离页提示。
- 真实双端：同一场会议双方发言/同时说话、摄像头关闭但音频开启、中英文混说、迟到准入、重入、撤回授权、主持人离开但会议继续、结束会议。
- 不完整性：worker 断线期间丢失内容明确标记，不伪造补齐；转写失败不影响人工笔记。
- 性能目标：Zoom 消息到达服务端后，持久化并推送到前端的 P95 延迟目标小于 2 秒；从实际说话到文本出现的总延迟另行实测，不能把前者当端到端承诺。
- 验收记录区分 mock 与真实结果。没有看到双方真实发言及可靠停止结果，不标记实时转写完成。

## 12. 开始前需确认

建议采用“仅笔记 + 实时转写、不保存音视频文件”的首期范围。随后确认：Zoom RTMS 权限与额度、公网 webhook 联调入口、有效授权取得方式、真实项目/轮次关联、数据保留规则。除此之外不扩展 AI 建议和其他页面。
