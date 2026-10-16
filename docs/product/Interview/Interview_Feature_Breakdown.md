# Interview 功能拆分

| 属性 | 内容 |
|---|---|
| 依据 | [Interview PRD v1.5](HireOS_Command_Interview_PRD_v1.5.md)、[任务列表状态与排序 PRD v1.0](HireOS_Command_Interview_Task_List_Status_and_Sorting_PRD_v1.0.md)、[原型](../../design/Interview/index.html)、[UI Guidelines v0.1](HireOS_Command_Interview_UI_Guidelines_v0.1.md)、[Prototype Design Brief v1.0](HireOS_Command_Interview_Prototype_Design_Brief_v1.0.md)（背景） |
| 日期 | 2026-10-14 |
| 用途 | 把面试模块拆成可独立立项、实现和验收的功能单元，作为后续创建 Issue 的底稿 |

> 拆分原则：按原型的页面和 PRD §5 的八个阶段（Intake → Brief → Plan → Schedule → Execute → Review → Debrief → Handoff）切分，每个功能对应一个能独立验收的小闭环。顺序只表示业务和工程依赖，不表示删减或延后范围；P0 / P1 / P2 沿用 PRD §6。
> 「现状」一栏只按代码目录、路由和接口做了初步核对，**没有逐项验证 AC**，立项时需要重新确认。
> 编号用 `I` 前缀，避免与 Screening 的 F01–F19、Written Test 的 W01–W19、PRD 中的 INT-xx / HOME-ACxx / FILE-ACxx 混淆。

## 1. 总览

主流程：创建项目（JD 即可）→ 关联候选人与材料 → 确认要求与评分标准 → 制定面试计划 → 排期 → 面试 Brief → 实时面试与记录 → 面后评审与 Scorecard → 跨轮 Debrief 与补证 → 面试阶段决定与 HR / HM 双方确认 → 评估包与 Offer 交接。首页任务列表与统计读取主流程的状态；Files & Integrations、外观与字号是 PRD 中标为 SHARED 的公共能力，Interview 先就地定义。

| 编号 | 功能 | 类别 | PRD（v1.5） | 原型页面 | 后端接口 | 前端页面 | 验收 |
|---|---|---|---|---|---|---|---|
| I01 | 创建项目与 JD 接入 | 主流程 | §3.4、§5 阶段 1、§6 INT-01 | 新建项目弹窗（Upload manually / Import from folder / Import from email） | `materials`、`external-jobs`、`jobs/attach`、`jobs/:id/tasks`、`screening-handoff`、`parsing-jobs` | `Modals`（经 `StoreContext`） | §12 独立闭环、缺可选资料、JD 与权限 |
| I02 | 项目概览与候选人关联 | 主流程 | §3.2、§8.1 详情界面 | Overview；Link candidate 弹窗；Resume 抽屉 | `tasks/:id`、`tasks/:id/intake`、`tasks/:id/materials` | `ProjectOverviewPage`、`ProjectShell` | §12 缺可选资料 |
| I03 | 要求与评分标准 | 主流程 | §4.1、§7、INT-03（部分） | Requirements & Rubric | `jobs/:id/capability-cards`、`jobs/:id/rubric`（GET / PATCH / confirm / new-version） | `RubricPage` | §12 JD 与权限、JD 更新 |
| I04 | 面试计划 | 主流程 | §5 阶段 3、INT-03 | Interview Plan；轮次设置抽屉 | `tasks/:id/rounds`、`rounds/:id`、`tasks/:id/plan/confirm`、`interviewers` | `PlanPage` | §12 独立闭环 |
| I05 | 排期与会议邀请 | 主流程 | §5 阶段 4、INT-04 | Schedule；排期编辑抽屉 | `rounds/:id/schedule`；`meetings/host/*`（Zoom） | `SchedulePage` | §12 独立闭环 |
| I06 | 面试 Brief | 主流程 | §5 阶段 2、INT-02 | Interview Brief | `jobs/:id/brief-questions` | `BriefPage` | §12 缺可选资料 |
| I07 | 实时面试与记录 | 主流程 | §4.8、§5 阶段 5、INT-05、INT-06、INT-13（P1） | Live Interview | `tasks/:id/interview-sessions`、`interview-sessions/:id/record`、`rounds/:id/transcript`、`rounds/:id/complete`、`meetings/*` | `LivePage`、`features/live-interview/*` | §12 拒绝录制 / 转写失败 |
| I08 | 面后评审与 Scorecard | 主流程 | §4.2–4.4、§7、INT-07、INT-08 | Review；证据追溯抽屉 | `rounds/:id/scores`、`rounds/:id/ai-scores`、`rounds/:id/summary`、`rounds/:id/recommendation` | `ReviewPage`、`Drawers` | §12 AI 与人工差异 |
| I09 | 跨轮 Debrief 与补证 | 主流程 | §4.5–4.6、§7、INT-09、INT-10 | Debrief；Request more evidence 弹窗 | `tasks/:id/debrief`、`tasks/:id/debrief-draft` | `DebriefPage` | §12 多轮分歧、无证据的 Must-have |
| I10 | 面试阶段决定与双方确认 | 主流程 / SHARED-09 | §3.3、§7、INT-11 | Decision & Next Steps | `tasks/:id/decision`、`tasks/:id/decision-draft`、`tasks/:id/package/confirm` | `DecisionPage` | §12 Hold / Reject / 补证、HOME-AC02 |
| I11 | 评估包与 Offer 交接 | 主流程 | §3.3、§3.5、§10、INT-11、INT-12 | Evaluation Package | `tasks/:id/package`、`tasks/:id/package/offer` | `PackagePage` | §12 重复 / 乱序交接、JD 更新 / 数据撤回；FILE-AC08 |
| I12 | 首页、任务列表与统计 | 主流程 / SHARED-08 | §8.2、§8.6、INT-17–19；任务列表 PRD | Interview Home | `jobs`、`tasks`（统计在前端计算） | `Home` | HOME-AC01–07、AC13；任务列表 PRD §15 |
| I13 | Files & Integrations | 公共能力 SHARED-04/05/06/07 | §8.7、INT-23–26 | Files & Integrations（Files / Connections / Activity） | 仅 `materials` 上传；邮件、文件夹、下载、操作历史**缺失** | **缺失**（原型有） | FILE-AC01–15 |
| I14 | 外观、字号与偏好 | 公共能力 SHARED-02/03/08 | §8.3–8.5、INT-20–22 | Appearance 弹层 | 无（偏好未持久化到服务端） | `AppearanceModal`、`AppearancePanel`、`SettingsPage` | HOME-AC08–12、AC14 |
| I15 | 身份、角色权限与审计 | 支撑（SHARED-01/10） | §3.8、§10、INT-12 | 角色切换（HR / Business Interviewer） | `workspace.guard`（只有 Workspace 校验，无业务角色校验） | `lib/session`、`MembersSection` | §12 JD 与权限 |
| I16 | AI 生成追溯与质量指标 | 支撑 | §10、§11 | `agent_run` 标识 | `intake/ai.service`（无 AiRun 追溯记录） | — | §11 AI 质量 |
| I17 | 增强能力（P1 / P2） | 后续 | INT-13（实时部分）、INT-14、INT-15、INT-16 | 部分问题建议已在原型 | — | — | — |

I01–I14 各建一个文件夹，放一份 `PRD.md`；I15–I17 是支撑或后续能力，暂不建文件夹，相关约束在各功能 PRD 的「权限」和「待确认」中引用。

## 2. 功能明细

### I01 创建项目与 JD 接入

- **目标**：只要有 JD 就能创建面试项目；简历、筛选、测评资料可以之后再补。
- **范围**：三种来源（手动上传、文件夹、邮件）调用 I13；直接粘贴 JD；可选候选人材料；没有 JD 不能创建；JD-only 创建出草稿项目；从 JD Management 关联已有岗位；Screening 交接入口。
- **数据**：Job（JD 版本）、InterviewTask（项目）、Material / TaskMaterial、ParseJob。
- **依赖**：I13（文件接入）、Core Record（材料主档）。

### I02 项目概览与候选人关联

- **目标**：在一个页面看清项目的岗位、候选人、材料、要求覆盖和轮次，并完成候选人关联。
- **范围**：Source materials（JD / 简历 / 筛选 / 测评，缺失显示 Unknown）、Requirement coverage、Interview rounds、People、Recent activity；Link candidate（选候选人 + 可选上传简历）；重复材料处理、未归类附件 Triage；按项目进度显示下一步提示和步骤门槛。
- **数据**：InterviewTask、Candidate、Resume、TaskMaterial。
- **依赖**：I01、I03。

### I03 要求与评分标准

- **目标**：从 JD 起草能力要求和 1–5 行为锚点，人确认后才能评分。
- **范围**：AI 抽取能力（原型 6 项）；Must-have、要求等级、权重（合计 100%）；每级行为锚点；能力验证卡（JD 职责 → 所需证据 → 简历中的对应经历 → STAR 追问）；编辑、确认、新版本；已有评分时锁定当前版本。
- **数据**：RubricVersion、CapabilityCard、InterviewQuestion。
- **依赖**：I01（JD 解析）。

### I04 面试计划

- **目标**：把确认的标准落到轮次上：每轮的目标、能力、面试官、题目数和必问题。
- **范围**：两种规划方式（一次规划全部轮次 / 逐轮规划）；轮次设置抽屉；能力覆盖检查；批准计划；已完成轮次锁定，修改未来轮次生成新计划版本；从 Debrief 追加补证轮。
- **数据**：InterviewPlan（当前存于 InterviewTask）、InterviewRound、Interviewer。
- **依赖**：I03。

### I05 排期与会议邀请

- **目标**：为每轮安排时间、面试官和会议，邀请状态可见，失败可重试。
- **范围**：日期时间、时区说明、面试官、会议链接（Google Meet 优先，Zoom 可选）；改期、取消、缺席记录；邀请投递失败（如邮箱满）提示和重试；补面轮；重复请求不重复建会。
- **数据**：InterviewRound（scheduledAt、timezone、meetingLink）、邀请投递记录。
- **依赖**：I04；会议 / 日历连接器。

### I06 面试 Brief

- **目标**：面试官开面前快速知道已知、未知、矛盾项和本轮重点。
- **范围**：背景摘要（Known / supported、Unknown / needs verification、Claims to verify）；按轮次的推荐重点；HR 与业务面试官的分工；按轮次生成的历史快照；未关联候选人时只显示岗位要求。
- **数据**：Brief 快照、能力验证卡、前序证据引用。
- **依赖**：I02、I03、I04。

### I07 实时面试与记录

- **目标**：面试官按计划提问并留下可追溯的问答记录；录制或转写不可用时仍能手工记录。
- **范围**：会议区（原型模拟 Google Meet，现有实现为 Zoom）；当前问题、目标能力、下一题 / 跳过 / 追问；笔记自动保存；录制授权、拒绝录制、转写失败的回退；AI 问题建议（只有人选择后才生效）；证据缺口提示；结束场次进入评审。
- **数据**：InterviewSession、RecordNote、TranscriptLine、Question / Answer。
- **依赖**：I04、I05、I06。

### I08 面后评审与 Scorecard

- **目标**：AI 草稿和人工评分分开保存，每个分数都能追到证据原文。
- **范围**：AI 摘要；逐项 AI 草稿分 vs 人工分；证据列表（时间码、来源类型、原始回答）；Unknown 不记 0 分；改分理由；本轮面试官推荐；提交与修订版本；证据追溯链（Rubric → AI 草稿 → 人工分 → 理由 → 原始证据）。
- **数据**：CardScore（AI / 人工）、EvidenceItem / EvidenceLink、Round summary、Round recommendation。
- **依赖**：I07。

### I09 跨轮 Debrief 与补证

- **目标**：汇总多轮结果，看清分歧、底线和缺口，必要时发起补证。
- **范围**：部分评估与加权覆盖率；Must-have 状态单独突出；AI 与人工相差 ≥ 2 级的维度；反证和未完成轮次；Request more evidence（负责人、形式、截止日期）→ 生成补证轮回到 I04 / I05。
- **数据**：Debrief、RequirementEvaluation、补证请求。
- **依赖**：I08。

### I10 面试阶段决定与双方确认

- **目标**：记录面试阶段的人工决定；最终结论和底线例外由 HR 与 Hiring Manager 分别确认。
- **范围**：推荐动作与结论草稿；Continue to next round / Recommend for offer / Hold / Do not proceed（PRD 另有 Request More Evidence）；底线例外与理由；HR、HM 各自确认，只有一方确认时为 pending；补证未完成时不能确认最终结论。
- **数据**：Human Stage Decision、Exception、HR / HM 确认记录。
- **依赖**：I09。

### I11 评估包与 Offer 交接

- **目标**：双方确认后生成版本化的 Hiring Evaluation Package，可导出，连接 Offer 时可靠交接。
- **范围**：包内容（Rubric、分数、证据清单、交接限制、人工复核、建议下一步）；导出 PDF；Offer 交接状态（未发送 / 已确认接收 / 失败可重试）；幂等与版本顺序；JD 更新或数据撤回时标记失效。
- **数据**：HiringEvaluationPackage、ExportArtifactRef、Offer ACK。
- **依赖**：I10；Offer 模块（集成路径）、I13（下载通道）。

### I12 首页、任务列表与统计

- **目标**：首页先回答「我接下来要做什么」，再回答「团队面试规模如何」。
- **范围**：My Work（M01–M06）、Workspace Overview（G01–G10）、T1 / T2 / T3 折叠；Task list 与 Cluster by JD 两种视图；13 个任务状态、点击跳转、默认「待处理优先」排序、快捷筛选；简历预览抽屉；HR 与面试官看到不同的个人工作、相同的全局数字。
- **数据**：HomepageStatsSnapshot、HomepagePreference、RoleIdentity。
- **依赖**：读取 I01–I11 产生的状态。

### I13 Files & Integrations

- **目标**：独立的材料接入、下载和操作历史模块，不依赖任何面试项目存在。
- **范围**：Files（Drive 式列表、上传、预览、下载、详情）、Connections（邮件、文件夹的连接、规则、Read now / Scan now、暂停 / 恢复、重新授权）、Activity（统一历史、批次、尝试时间线、重试）；材料可用 / 业务消费 / 产物生成 / 下载四类状态分离。
- **数据**：SourceConnection、RuleVersion、Material / MaterialVersion、ReadRun、Operation / Attempt、DownloadAttempt。
- **依赖**：I15（授权）；被 I01、I02、I11 调用。

### I14 外观、字号与偏好

- **目标**：Light / Dark / Deep / System 主题、强调色和三档字号，即时生效且跨页、刷新、重登保留。
- **范围**：Appearance 入口；主题、强调色、字号三项独立；Reset to defaults；首页折叠偏好按用户 + Workspace + 模块保存；1366 × 768、Large、200% 缩放和键盘可用。
- **数据**：DisplayPreference、HomepagePreference。
- **依赖**：Account & System Configuration（个人偏好）。

## 3. 现状与 PRD 的主要差异

| 项 | PRD / 原型 | 现有实现 |
|---|---|---|
| 会议 | Google Meet 为偏好，Zoom 为备选 | 只接了 Zoom（OAuth、Host、RTMS 转写） |
| 角色 | HR、Hiring Manager、Interviewer、Hiring Committee；原型有 HR（editor）与 Business Interviewer（assignee）两种权限视图 | 只有 Workspace 校验；HR / HM 确认只记录当前身份点了哪一方，不校验角色 |
| 文件接入 | 手动 / 文件夹 / 邮件三种来源，独立 Files & Integrations | 只有单文件上传（PDF / DOCX / TXT）和 Screening 交接；没有 Files 页面 |
| Offer 交接 | ACK、失败重试、版本顺序 | 仅本地把 `offerState` 置为 sent，没有真实下游 |
| 首页统计 | 服务端聚合读模型，所有雇主用户同口径 | 前端用 `/jobs`、`/tasks` 结果计算 |
| 评分标准 | 项目内版本（独立模式） | 按 Job 保存，同岗位的多个候选人项目共用 |

## 4. 说明

- 原型里只有 Senior Backend Engineer / Elena Torres 一条数据完整走通，其余行是静态示例。
- 原型与 PRD 的冲突（会议供应商、决定枚举、角色模型等）已在各 PRD「待确认」中列出，需要用户决定后回写到 PRD 或 Issue。
