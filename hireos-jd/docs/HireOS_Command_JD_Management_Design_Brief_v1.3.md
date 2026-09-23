# HireOS Command — JD Management Design Brief

> **v1.3 文档优先 Copilot 编辑版**：Settings、Appearance、首页、文件与连接、操作历史、任务/提醒、模型配置均必须在独立JD中提供完整页面、行为与验收；不得因标记为公共而省略。PRD已完整内嵌Resume Screening公共章节，并给出JD适用规则。

| 属性 | 内容 |
|---|---|
| 文档编号 / 版本 | CMD-JD-003 / v1.3 |
| 日期 / 用途 | 2026-09-11 / 可独立用于完整、高保真、可点击的雇主端原型设计 |
| 产品 / 模块 | HireOS Command / JD Management |
| 语言与设备 | 英文界面、桌面 Web、笔记本优先；文档说明为中文 |
| 视觉基线 | 延续 Interview / Resume Screening 的 Google Workspace 风格 |
| 配套规则 | [PRD](HireOS_Command_JD_Management_PRD_v1.3.md) · [Interface Spec](HireOS_Command_JD_Management_Interface_Spec_v1.3.md) |
| 交付状态 | 本文是设计要求与演示规格，不表示原型或真实连接已实现 |

## 1. 设计任务与依据

设计一个以 Job 为中心的招聘需求工作区：中央直接编辑JD文档，右侧Copilot与文档内选区、批注和修订联动；用户随时知道“谁提出了什么、哪些已应用、哪一版已批准、哪个版本正在招聘、哪份内容已对外发布”。岗位库与工作区同等重要，不能只做聊天窗口。

参考 [Interview Design Brief](../../HireOS_Command_Interview_Prototype_Design_Brief_v1.0.md)、[Resume Screening Design Brief](../../Resume_Screening_Prototype_Design_Brief_v1.0.md)、[Interview PRD v1.6](../../HireOS_Command_Interview_PRD_v1.6.md) 的公共体验。架构以 [Foundation v2.2](../../HireOS_Command_Shared_Foundation_Data_Integration_and_Build_Plan_v2.2.md) 为准：统一身份和 Core 主档为基础；JD 独立运行不依赖其他 L2 或 Shell，不复制本地正式 Job。

本稿的具体布局、尺寸、人物、文案和数据为设计默认，可在不改变产品与接口语义时调整。产品行为以同版 PRD 为准，字段/状态以同版 Interface Spec 为准。不得将旧 Brief 的独立账号、本地主档或“中央服务可完全没有”带入新设计。

## 2. 设计必须表达的关系

| 概念 | 用户可理解的表达 | 不可混淆 |
|---|---|---|
| Job | 一个具体招聘需求，有负责人和 HC | 长期 Position 模板 |
| Requirements | 正式岗位要求，修改有版本 | 评论、AI 想法、PDF 原文 |
| Working draft | 正在编辑的下一版 | 当前已生效标准 |
| Internal JD | 授权内部读者版本 | 所有人都能看限制字段 |
| External JD | 对候选人发布的独立版本 | 内部 JD 一键复制 |
| Approval | 对精确内容与范围的批准 | 自动生效、自动 open 或发邮件 |
| Active requirements | 当前用于新评估的版本 | 外部网站上正在展示的版本 |
| Snapshot | 某次评估采用的固定标准 | 自动随“最新版”改变 |
| Delivery | 已生成/提交/送达/被接收 | 一个通用 Done |

设计注释可标 SHARED-xx、实体名与状态；产品页面不要展示 Core、schema、outbox、aggregate 等实现词语。

## 3. 信息架构与页面范围

独立模块导航：**Home / My Tasks / Job Library / Templates**。公共入口：**Files & Integrations / Activity / Settings**。集成 Shell 时同一导航内容被注册装配，保留直接链接、返回位置、筛选与未提交草稿。

| 页面 / 建议路由 | 内容 | 必须可点击行为 |
|---|---|---|
| Home / | 我的下一步、个人/团队统计、最近岗位 | 改范围、展开趋势、进任务/岗位 |
| My Tasks /tasks | 补全、冲突、审批、影响复核、失败恢复 | 领取、开始、转派、暂缓、业务提交、历史 |
| Job Library /jobs | Table/Cards/Board/Organization、保存视图 | 搜索、筛选、排序、列设置、创建、开岗 |
| New Job /jobs/new | Chat、Upload、Paste notes、Template、Clone | 建立最小需求、查看提取、确认草稿 |
| Job Workspace /jobs/:id | Job header + tabs + AI | 切换编辑/阅读、版本、协作者、主要动作 |
| Requirements /jobs/:id/requirements | Blueprint、来源、质量与争议 | 编辑字段、提案接受/拒绝、解决冲突 |
| Internal JD /jobs/:id/internal-jd | 普通内部文档及受限信息入口 | 预览、生成、版本对比、受控导出 |
| External JD /jobs/:id/external-jd | 公开文档、检查、语言和版本 | 改写、公开预览、审阅、导出/发布 |
| Workflow & Approval /jobs/:id/approval | 精确候选版、步骤、任务、差异 | 提审、批准、退回、拒绝、撤回、激活 |
| Publication /jobs/:id/publication | 渠道、版本、交付状态、邮件 | 确认发布、预览邮件、发送、查询/重试/撤下 |
| Attachments /jobs/:id/attachments | 来源材料、读取及消费状态 | 上传、预览、检查来源、重新提取 |
| Activity /jobs/:id/activity | 人/AI/系统事实与筛选 | 展开变化、看确认、跳到历史版本 |
| Versions & Impact /jobs/:id/versions | JRP/内部/外部版本及影响 | 比较、选范围、请求重评、追踪回执 |
| Files & Integrations /files | Files / Connections / Activity | 邮箱/目录连接、Read now、监控、暂停、单项重试 |
| Settings /settings | Appearance、Workflow、权限、模型入口 | 配置/预览、保存、失败重试、恢复默认 |
| AI Models /settings/ai-models | Model catalog / Task policies / Compare & evaluate / Usage & cost / Activity & versions | 授权配置、测试、发布/回滚、预算与回退历史 |

页面可合并为 tabs 或 drawers，但完整动作、权限态、结果和返回路径不能省略。任务深链登录后返回原目标；无权限页不暴露敏感标题或数据。

## 4. 主布局与视觉层次

### 4.1 笔记本工作区

以1440×900为主画布，1366×768为主验收，附加1280×800。默认收起全局导航，文档占主体；左侧大纲可折叠，右侧约320–380px侧栏在Copilot / Comments / Changes间切换，避免同时铺开多个侧栏。较窄窗口可收起侧栏，仍保留行内标记和快速打开入口。

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Job title   Internal / External   Saved   Active v3 / Draft v4       │
│ Editing ▾   Formatting toolbar         People   History   Review    │
├──────────┬───────────────────────────────────┬────────────────────────┤
│ Outline  │ Editable JD document              │ Copilot | Comments     │
│ Summary  │                                   │         | Changes      │
│ Duties   │ [selected requirement]  Ask AI    │ Scope: Selected text   │
│ Skills   │ + Proposed addition               │ Why / Rewrite / Reply  │
│ ...      │ − Proposed deletion   [AI · 2]    │ Accept / Reject        │
│          │ [comment anchor] [unresolved]     │ View in document       │
└──────────┴───────────────────────────────────┴────────────────────────┘
```

Header 保留岗位名、owner/协作者、招聘状态、active 版本及新稿状态。主按钮跟随当前有效下一步，例如 Review missing details、Submit for approval、Review approval、Activate approved version；不要同时摆满所有按钮。

### 4.2 视觉语言

沿用轻量白底、清晰细边框、克制阴影、统一圆角和文本层次。正文默认约16px；表格密度可调但不能用极小字号解决拥挤。主要操作使用统一强调色，危险动作有文本说明；Draft、Pending、Approved、Open、Published 不仅靠颜色区分。

信息顺序：当前状态与下一步 → 变化和理由 → 具体字段和来源。不要用完整度环形图占据主要操作空间，不将 AI 生成的质量分数当作岗位“健康”事实。

## 5. Home 与 Job Library

Home T1 默认展示我的待办、待我审批、我负责的招聘中岗位；T2 为获授权团队汇总；T3 为可折叠趋势。每张卡有范围、时间与点击后的同口径列表。Loading、stale、unavailable、empty 分开；数值未知用破折号+说明，不显示0。

岗位库默认 Table：Job title、Hiring status、Active version、Draft/approval、Department、HM、Recruiter、Location、HC、Next action、Updated。候选人数为可选投影列，必须有来源与更新时间。内部薪资不作默认列表列。

- Cards：面向 HM，突出角色、负责人、下一步和审批，不复制全部表格字段。
- Board：按 hiring_status 分列；审批是独立 badge/filter。拖动触发有意义的状态动作，权限/门槛不满足时返回原列并解释。
- Organization：BU→Department→Team→Job；未知组织字段进入 Unassigned，不隐藏记录。
- 保存视图：All Jobs、My Jobs、Hiring Now、Needs My Attention、Drafts、Pending Approval、Recently Updated、Paused、Closed、Archived；允许个人自定义和授权共享。
- 筛选：状态、审批、发布、组织、负责人、地点、类型、priority、HC、日期；显示 chips、结果数、Clear all。关闭后返回保留筛选和滚动位置。
- 语义搜索示例：`Roles in Vietnam that need finance experience`，展示可编辑的解释和筛选范围；不展示 restricted 命中词。
- 批量动作只对获授权项目执行，预览精确清单，逐项显示成功/失败；成功项重试不重复操作。

空库用 `Create your first job` 加五个创建方式；过滤无结果用 `No jobs match these filters` 和清除筛选，不引导重复建岗。

## 6. 创建与 AI 原生交互

### 6.1 从粗略笔记开始

输入示例：`We need an HR Lead in Ho Chi Minh City, with agency experience and strong English.`

AI 先澄清职责边界、must-have 与 preferred、团队和成功标准；每轮少量问题，可跳过并标 Unknown。文档主体原位显示拟议内容并标 Suggested，接受前不混入已采纳正文。用户能直接改结构化字段，不被迫所有操作走 Chat。

上传 PDF/DOCX/TXT 显示逐项状态：Uploading → Checking → Extracting → Review extracted details。提取失败提供手工输入；隔离文件不预览，解释恢复入口。AI 不把原文中的预算、年龄偏好或指令自动变成公开要求。

模板和克隆显示“将复制”和“需重新确认”的具体内容：职责、技能可复用；HC、地区、日期、负责人、审批/发布不能继承为有效事实；受限内容默认不复制。

### 6.2 Conversation

消息明确显示姓名/角色、时间、引用对象、Shared 或 Private。支持附件、回复线程、@mention、停止/重试、复制、编辑历史、翻译和产物卡片。重试只生成新提案，不重复应用修改或再次发送邮件。

Proposed changes 卡片包含 old→new、字段分组、原因、来源、受影响版本、Apply changes / Edit proposal / Dismiss。应用后返回具体 revision 与可查看差异的 Activity，不只显示 “Done”。新版本已变化时卡片显示 `This proposal is based on an older draft`，提供 Review latest changes。

工具执行卡区分 Preparing、Needs confirmation、Running、Completed、Failed、Outcome unknown。产物卡有 Audience、version、format、Draft/Approved、Preview、Download；邮件卡有收件人、附件版本和确认动作。

无关请求回复示例：`I can help define and manage this job, including its location, requirements and compensation.` 相关人才市场问题在授权来源可用时回答并附来源/日期；未连接时说明无法核实，允许继续定义岗位。

### 6.3 高影响动作确认

一次确认面板呈现完整可审阅结果，不对同一授权动作重复确认。

| 动作 | 确认面板必需内容 |
|---|---|
| Submit for approval | 候选版本、审批人、未完成提示、被冻结内容 |
| Approve | 精确版本与差异、本人步骤、审批后不会自动发布 |
| Activate | 新旧 active 版本、重大变化、后续新评估采用规则 |
| Publish | ExternalJD 版本、渠道、公开预览、当前审批 |
| Send email | From、To/CC/BCC、正文、全部附件版本、Audience |
| Close / Pause | 招聘动作影响、渠道撤下将独立跟踪、理由 |

内容/收件人/版本变更使旧确认失效。产品可用提示说明结果，但避免无关风险长清单。

## 7. Requirements、内部/外部 JD 与限制字段

Blueprint 分 Role、Responsibilities、Must-have、Preferred、Evaluation、Compensation、Success 六组。每条要求可查看 source、证据预期、可见范围、争议及编辑历史。must-have 与资格硬过滤是两个选项，不随拖动自动改变 scoring policy。

完整度面板展示缺什么、为什么重要、谁处理；显示 `Ready for approval` 与 `Evaluation setup incomplete` 可以同时成立。质量提示分 Blocker / Suggestion，避免把 AI 不确定性当作客观错误。

Internal JD 页默认仅含用户可见信息。Restricted details 使用独立区域和用途说明；未授权人看不到具体字段值、占位长度或提示中的敏感摘要。必要时显示 `You do not have access to restricted details`，不展示“隐藏薪资为…”式泄露。

External JD 页常驻 `Candidate-facing version`、source version、language、review status。提供公开预览和来源差异；“剔除了内部信息”的说明只对有权作者可见。公开模型生成输入已经过滤，原型要通过结果体现，不在用户界面讲模型管线。

编辑 External JD 的语法可直接生成新表达草稿；改变责任、薪资或资格要求时提示 `This changes the job requirements` 并打开结构化提案。不能让外部编辑绕过 JRP。

导出 PDF/DOCX 使用适合打印的浅色布局，页眉标 audience/version；Draft 有水印。预览与下载是不同动作；下载演示不声称已经保存至用户指定路径。

## 8. 多人协作与冲突

Header 展示 collaborators 和在线状态；邀请支持 scope、有效期和角色，调用实际授权规则。审批人收到任务不必获得全部字段编辑权。@mention 不自动授予查看权限；目标无权时提示无法共享该内容。

必做冲突场景：HM 将 B2B SaaS 设置为 Must-have，Recruiter 建议 Preferred。AI 展示双方作者、原话、理由和可选折中；任何未经数据验证的候选池影响标为推测，不编造百分比。

冲突面板包含 Base / Current / Your proposal；允许 Keep current、Use my proposal（需权限）、Edit merged proposal。解决后记录是谁决定、什么内容进入标准。评论 resolved 不意味着要求变更；应用提案也不自动消除不相关讨论。

私有预算会话不可切成公开会话时自动保留敏感历史。共享摘要必须按受众重新生成，明确 preview 和确认范围。权限撤销后立即隐藏敏感内容并停止旧操作。

## 9. 审批、激活、发布与历史

Approval 页展示冻结 candidate 版本、内外表达、差异、当前步骤和等待原因。默认 HM→HR；预算步骤按演示政策出现，不套用 Interview 的最终评估流程。批准、退回、拒绝按钮有明确动作名称和理由输入。

pending 中编辑使用 `Create a revision`，旧请求撤回/被取代；已签署内容仍可按权限阅读。批准成功但尚未激活显示：

> Approved · Activation pending

Core 写入超时显示 `We’re checking whether this version became active`，提供 Check status；不鼓励重复创建版本。成功后 header 更新 active，Activity 保留审批和激活两条事实。

Publication 页按渠道展示外部 JD 版本、queued/publishing/published/failed/unknown/withdrawal_pending/withdrawn。发布失败不把 Job 改回 draft。邮件 submitted 和 delivered 分开，送达不显示“下游已接收”。未知结果主操作为 Check delivery status，不能直接默认重发。

Versions 页三个分组：Requirements、Internal JD、External JD。比较时明确 same audience；跨 audience 比较需相应权限。历史版本可阅读，不直接编辑；Restore as new draft 创建新稿。

## 10. 下游影响与独立运行

新标准重大变化后显示具体 requirement 差异和来源版本，不用泛泛“可能有影响”。影响表按来源模块展示 reported count、as_of、availability，未连接显示 Not connected，离线显示 Awaiting response，过期显示 Last updated…。

可选动作：

1. `Use for new evaluations`：新启动评估使用新标准；已启动的保留旧快照。
2. `Request re-evaluation`：选择明确范围并确认，显示目标受理/复核/完成状态。
3. `Keep existing evaluations`：保留历史结果，仍记录新版本提示；不能绕过撤回政策启动旧标准的新运行。

不将各阶段人数直接求和为独立候选人数。重评后链接新结果，旧结果仍在历史；JD 不出现直接编辑 Interview score 的按钮。

独立模式演示必须能从创建走到导出/已配置邮件交付；Overview 的 Candidate pipeline 显示 Not connected，不显示虚构数据。集成模式使用同 job_id，展示模拟来源、更新时间与深链。切换演示模式不模拟迁移账户或重新创建岗位。

## 11. 公共能力完整设计

| 复用组件 | JD 场景 / 必须包含 |
|---|---|
| SHARED-01 Identity/Permission | Workspace 切换、角色范围、无权限、撤权中状态；同账号 |
| SHARED-02/03 Appearance | Light/Dark/Deep/System、Blue/Teal/Violet、Small/Medium/Large；默认 Light+Blue+Medium |
| SHARED-04 Files | 表格/列表、上传预览下载、版本、audience、安全检查与业务消费分开 |
| SHARED-05/06 Connections | 邮箱/目录范围、Read now、监控、检查点、暂停恢复、断开与重新授权 |
| SHARED-07 Activity | operation/attempt、错误原因、单项重试、unknown 查询；成功项不重跑 |
| SHARED-08 Statistics | T1/T2/T3、范围、可折叠、更新时间、个人偏好 |
| SHARED-09 Tasks/Approval | assignee/queue、领取、转派、暂缓、到期、来源动作；不能随便勾选批准 |
| SHARED-10 Audit | 人/AI/系统来源、精确版本、理由、变更引用；敏感详情另验权 |
| SHARED-11 AI Models | 模型目录、任务策略、评测、预算/用量、回退、连接失败；未知价格为 Unknown |

模型页沿用价格、时延、准确性、合规四维框架。业务用户看到当前任务运行状态和限制；管理员管理策略，不要求 HR 每次选择供应商。原型 mock 数据不伪称某供应商真实成本或质量。

主题切换覆盖表格、差异、对话、弹层、toast、loading/error；字号变化保持内容和焦点。200% 缩放主操作仍可达；颜色不是唯一状态标志，键盘可完整操作，弹层有焦点管理与可读标签。个人设置跨模块同语义；原型可本地持久化并说明未连接账户同步。

## 12. 演示数据与完整故事线

全部使用虚构公司 Northstar Labs 和虚构用户；只用 example.com 邮箱，原型发送不连接真实服务。

| 对象 | 演示数据 / 状态 |
|---|---|
| Workspace | ws-demo / Northstar Labs |
| 人员 | Maya Chen：HM；Linh Tran：Recruiter；Alex Park：HR approver；Sam Reed：Finance；Jamie：Viewer |
| Job A | job-demo-101 / HR Lead / Ho Chi Minh City / HC 1；draft；无 active 标准 |
| Job B | job-demo-102 / Senior Backend Engineer / Hanoi / HC 2；open；active role v3；新稿 v4 pending |
| Job C | job-demo-103 / Finance Manager / Singapore / HC 1；paused；approved active v2；撤下 pending |
| Job D | job-demo-104 / Product Designer / Remote / HC 1；closed；历史外部版本可追溯 |
| Job E | job-demo-105 / Customer Success Lead / Ho Chi Minh City / HC 1；archived |
| Job B 表达版本 | InternalJD v5、ExternalJD v2 均源于 role v3；新稿表达不得假装已生效 |
| 预算演示 | B 内部 ceiling USD 7,000/month gross，restricted；公开 USD 4,500–6,000/month gross，独立批准字段 |
| 限制字段案例 | 从上传材料识别出的年龄偏好；pending policy review，不显示具体值给 Viewer，不进入公开或评分 |
| 集成影响 | B：Screening 12、Assessment 4、Interview unavailable；各自 as_of；不声称合计16名独立候选人 |

必须演示五条端到端故事：

1. **空白到可交付**：新建 A → 笔记提取 → AI 澄清 → 应用提案 → 内外 JD → HM/HR 审批 → 激活 → open → PDF 预览 → 邮件草稿与模拟发送。
2. **多人争议**：B v4 的 must-have 冲突 → 两人观点 → AI 折中 → stale 提案 → 人工合并 → 重提审批，v3 保持 active。
3. **受限与公开**：Maya 可见预算，Jamie 不可见 → 外部生成只含公开薪资 → 手工粘入限制信息被阻断 → 修复后成功。
4. **生效与影响恢复**：审批通过 → 激活响应未知 → 查询恢复唯一 v4 → 下游影响部分不可用 → 请求某范围重评 → 等待接收方复核，保留旧结果。
5. **公共与独立**：仅 JD 安装 → 邮箱导入未知意图待确认 → task 转派/暂缓 → 模型不可用改手工 → 主题/字号调整 → 返回岗位筛选不丢失。

每条故事可从预设场景重置，角色切换仅为 Demo control，不是生产权限设计。真实服务未接入处统一标 Demo，不使用“已真实发送”成功提示。

## 13. 状态与微文案清单

| 状态 | 建议英文文案 | 恢复路径 |
|---|---|---|
| 字段未知 | Not specified | Add details |
| 讨论未进入标准 | Suggestion — not applied | Review changes |
| 同字段冲突 | Someone updated this field | Compare changes |
| 旧提案 | Based on an older draft | Review latest draft |
| 无预算权限 | Restricted details | 查看可用授权说明，不暴露值 |
| 外部检查阻断 | This content needs review before sharing | Review flagged content（限权限） |
| 审批退回 | Changes requested | Open reviewer feedback |
| 生效未知 | Checking activation status | Check status |
| 未接下游 | Not connected | 看连接说明；不阻断 JD |
| 影响数据离线 | Impact data is unavailable | Retry / keep review pending |
| 邮件未知 | Delivery status is unknown | Check delivery status |
| 文件隔离 | File could not be used | View issue / replace file |
| 模型不可用 | AI is unavailable for this task | Retry / continue editing |
| 无筛选结果 | No jobs match these filters | Clear filters |
| 撤下进行中 | Withdrawal pending | View channel status |

Loading 不遮挡已保存内容；保存失败保留编辑并明确未保存。离线可保留普通输入，恢复后先检查 revision；撤权不保留可见的敏感缓存。Toast 只用于短反馈，关键失败应留在相关对象上直到处理。

## 14. 设计交付与验收

交付完整页面、共享组件 inventory、状态变体、交互连线、五条故事的演示数据、权限角色与验证记录。设计文件标注组件复用 SHARED 编号及对应 PRD AC，不在产品 UI 展示内部编号。可点击原型必须有真实页面内状态变化、返回路径、错误恢复；不能全部按钮仅弹同一个 toast。

| 验收重点 | 对应 PRD |
|---|---|
| 单模块可创建/审批/导出；集成沿用 Job | AC-01、11 |
| 评论/提案/正式标准可区分，冲突有解决路径 | AC-02 |
| Viewer、AI、搜索、导出和邮件一致隔离限制值 | AC-03、04 |
| pending 修订、审批撤权与版本冻结可见 | AC-05 |
| approved 与 activation 分开，unknown 查询恢复 | AC-06 |
| 旧 active、新稿、渠道版本同时呈现 | AC-07 |
| 旧快照、部分影响、明确重评范围与回执 | AC-08 |
| 重复导入/事件/邮件不出现双重成功记录 | AC-09、10 |
| 来源任务动作与过期提醒处理 | AC-12 |
| AI/文件/下游失败可恢复，无假0和假完成 | AC-13 |
| 三主题+System、Large、200%缩放和键盘 | AC-14 |
| 暂停/关闭与渠道撤下分别显示 | AC-15 |

设计完成不表示真实文件解析、实时协作、模型、SSO、邮件或渠道已集成。交付备注明确哪些为模拟、真实实现仍需哪些契约验证；不把模拟限制变成删减需求的理由。

## 15. 公共能力完整页面与独立原型门槛（v1.1）

**公共能力不是可省略设计。必须按PRD§14–15完整正文交付Settings、Appearance、首页、Files/Connections/Activity、My Tasks/提醒、AI Models等所有页面及状态。禁止只做入口链接、占位卡片或标注“未来平台提供”。** 未安装其他业务模块且没有Shell时，以下全部可操作；生产公共服务共享，不复制账户/主档/配置。

上一版§11仅是索引，本节和PRD完整内嵌正文补齐其范围。具体新增设置组织是JD设计落地；Resume Screening公共内容完整保留并按JD语义映射。原型连接可标Demo，不能以Demo为由省略错误、恢复、权限和持久化交互。

### 15.1 Settings页面树与行为

| 页面 | 关键控件与可点击流程 |
|---|---|
| Settings overview | 搜索设置、Personal/Workspace分组、作用域标识、当前用户与Workspace；可达所有获授权分组 |
| My profile & preferences | 公共身份、有效组织、语言/时区、继承默认、保存/失败；不做模块私有注册 |
| Appearance | 四主题卡片、强调色选择、字号选项、真实JD预览、Reset to defaults |
| Homepage & views | T1展开/摘要、T2/T3展开设置、个人保存视图；恢复默认不删自定义视图 |
| Notifications | 站内/邮件、时区/工作时段、摘要频率、强制通知说明、发送历史 |
| Organization & Workspace | 公司/品牌、默认语言时区、部门团队/BU/地点、成员入口，继承与编辑权限 |
| Members & permissions | 搜索成员、角色与Job范围、restricted用途/期限、授权/撤权预览与审计 |
| Workflow & approvals | 当前版本、步骤/角色/条件/代理、提审门槛、重大变更、验证/发布/历史 |
| Email & publication | 发件身份、模板预览、Audience、渠道连接/测试/失败；邮件发送独立确认 |
| Files & integrations | Files/Connections/Activity完整页面，不只是Settings外链 |
| AI Models | Model catalog、Task policies、Compare & evaluate、Usage & cost、Activity & versions五页 |
| Data policy & audit | 分类/用途/保留、策略版本、审计筛选与去敏详情、无权限状态 |

每页显示当前scope、Inherited from/Override（允许时）、保存/取消、成功/失败、Validation、Conflict、Read only、Authorization required。个人外观不需要管理员批准。配置保存与生产发布有不同按钮和状态，不能每次点击Save都触发JD审批。

### 15.2 Appearance完整交互规格

入口：Header或头像菜单的Appearance快捷面板，Settings→Appearance完整页；两处控制同一份偏好，切换即时互相更新。

- Theme：Light / Dark / Deep / System。Light默认；Dark中性暗灰；Deep深蓝灰，与Dark可辨；System随系统变化，显式主题不被覆盖。
- Accent：Blue默认、Teal、Violet；用文字、选择图标与颜色共同表达。success/warning/error保持自身语义。
- Text size：Small/Medium/Large，默认Medium，建议14/16/18px基准。真实预览使用岗位标题、要求、状态、按钮、输入框，不只一个Aa图标。
- 即时更新Job Library、Chat、Blueprint、内外JD、审批diff、Tasks、文件预览壳、Connections、Activity、模型设置、toast/弹层/错误/加载。导出文档仍用浅色打印样式。
- 主题、配色、字号、折叠独立保存；保留草稿和筛选。保存失败显示`Changes applied on this device. Sync failed.`及Retry，不假称已跨设备同步。
- Reset确认范围为显示与默认首页折叠，保留业务草稿/文档/自定义视图。账号切换不得短暂显示前一用户偏好或数据。
- 验证1366×768、Large与200%缩放；卡片重排，长按钮可换行，弹窗操作不被遮挡；键盘、焦点、读屏选中态完整。

### 15.3 首页与任务详细界面

Home显示My Work、授权Workspace Overview、More statistics、Trends、Job list入口。T1可压缩但数字保留；T2/T3默认折叠可展开并持久化，全部指标按PRD§14.4实现，不能因首屏不显示而省略。

演示本人已批准而另一人待批时：本人待批任务减少，他人待批仍存在；Job pending岗位仍计一个。My unfinished tasks与Approvals awaiting me有包含关系，不相加。所有卡带scope、单位、窗口和更新时间，点击去同口径列表。0、loading、unavailable、stale各有样例，权限不足不假0。

My Tasks标签：Assigned to me / Available to claim / Created or followed / Completed。列表支持Job、类型、负责人、状态、日期、优先级筛选；详情含required action、当前版本、due/waiting原因、协作者、timeline。领取、转派、暂缓/恢复、评论及业务提交均可完成；任务过期显示Review latest version。多人审批子任务分开，不能通用勾选代替批准。

Notification设置演示quiet hours、摘要、升级队列；任务完成/转派取消旧待发通知，邮件失败仍可站内处理。提醒点击直达原业务任务，阅读不标完成。

### 15.4 Files / Connections / Activity完整故事

Files沿用Google Drive的列表、位置导航、上传/拖放、多选、预览、详情、下载体验，增加读取与JD消费两条状态。未分配材料也能进入库；关闭预览恢复原列表位置与选择。关闭进度面板不取消任务，重新打开能看到进度。

Connections配置页必须展示邮箱/文件夹范围、规则预览、首次读取模式、正文/附件选择或子目录/类型、自动读取/监控、Read now、last/next run、Pause/Resume、重新授权、断开。文件夹后台读取明确Demo/实际连接，不伪称浏览器能长期监听任意目录。

Activity支持upload/download/email/folder/preview过滤、来源、状态、时间、actor、文件/operation搜索；批次展开成功/失败/跳过/取消/空扫描，详情按attempt展示。Retry failed items、Retry delivery、Reauthorize分别使用适用状态，成功项不重复导入。

必演示：无Job上传→批量部分失败→重试单项→预览→多选打包下载→过期链接重取→历史；邮件正文+两附件→重复跳过→JD消费待确认；目录旧文件更新→形成新版本→暂停→授权失效→恢复检查点。源删除不抹除导入历史。

### 15.5 AI Models完整故事与自动运行设置

管理员依次操作添加模型连接引用→测试/登记区域、能力、价格来源与有效期→选择jd_generate任务→查看质量样本/成本/P50/P95/失败率→配置主模型/回退/预算→验证和发布→运行历史及所有attempt成本→回滚已批准版本。

Task policies显示平台→Workspace→JD→task继承，不可选模型明确原因，不让普通HR越权改硬限制。Usage区分估算、预占、实际、Pending reconciliation；与岗位HC预算不同。

额外必有：Price sync设置（supported/unsupported、schedule、last run、Retry、manual update），Quality regression（数据集/任务/计划/阈值/结果），Controlled rollout（范围/比例/预算/终止/回滚），Alerts（规则/队列/频率/去重/历史）。不得按内嵌旧文P1删掉这些页面。自学习路由不默认启用。

异常样例：区域不允许、未评测、预算不足、未知价格、主模型超时安全回退、输出校验失败、取价不支持、回归退化、灰度触发停止、授权撤回。所有样例价格/质量/时延标Sample data；这些动作不自动批准或改写JRP。

### 15.6 新增演示与验收记录

在原五条JD故事外增加三条公共故事：

1. **个人设置**：Viewer进入Settings→Appearance切换Dark/Large→跨Job/Tasks/Files保持→System跟随→模拟保存失败/重试→重新登录恢复→Reset保留草稿。
2. **连接与任务恢复**：批量读取部分失败→Activity精确重试→未分配材料人工归属→产生补全任务→领取冲突→转派→暂缓恢复→业务提交完成→旧提醒取消。
3. **管理员设置**：只读继承/无权预算→切换有权角色→模型配置/评测/发布→价格同步与回归→告警/受控回滚→Activity追溯。

交付记录按PRD SH-JD-01～14逐项列页面、动作、权限状态、失败恢复、演示截图/路径和实际或Demo标识。**Settings所有分组、Appearance所有选项、Files三个标签、模型五页及自动运行设置全部可用，才算公共能力设计完整。** 原型未覆盖的项必须显式列为未完成，不能默认为公共模块会补。

## 16. 全模块公共视觉、字体、排版与交互基线（v1.2）

本节逐项对照本轮附件Resume Screening Brief§7/10/11/12/15及PRD§13，补齐上一版只说“同风格”的不足。附件与已有参考逐字节一致，来源指纹见本版PRD§16。**本节是JD当前设计的统一约束；公共组件在其他模块也应使用同一份设计规范与版本，但本次未修改其他模块文件或验证其真实界面。**

### 16.1 已有基线与未定设计值

| 项目 | 来源明确的基线 | JD执行方式 |
|---|---|---|
| 语言 / 风格 | 英文、Google Workspace风格、舒适间距、克制边界、蓝色主操作 | 直接采用；无额外JD主题分叉 |
| 工作列表 | Gmail式任务/候选人列表 | 用于Tasks/Job Library，保留JD业务列 |
| 长文阅读 / 评论 | Docs式报告阅读与评论 | 用于内部/外部JD、来源、版本差异 |
| 文件 | Drive式浏览/多选/预览/进度 | Files共享组件，非复制Google商标或全网盘功能 |
| 尺寸 | 1440×900设计，1366×768验证 | 两者强制；1280×800是附加检查 |
| 字号 | Small/Medium/Large默认Medium，正文14/16/18px为建议 | 同一比例适配全部组件；非只改正文 |
| 主题 | Light/Dark/Deep/System；Blue/Teal/Violet | 同枚举、默认、切换、持久化与状态颜色 |
| 窄屏 / 缩放 | 单列/详情切换，不削减功能；200%缩放可达 | JD工作区Document/Copilot可切换，主操作保持可达 |
| 字体家族 / 字重 / 行高 / 精确色值和间距 | 三份附件未给出具体token，也无组件源码 | 先复用实际公共token；没有时采用下面“候选默认”，明确非来源确认值 |

不得写成“Screening已经使用某字体/某圆角”而没有文件或实现依据。此处定义的是统一实现目标，不是对旧界面的像素测量。

### 16.2 字体与排版token候选默认

**以下数值均为补齐来源缺项的候选默认，不能宣称是附件已有标准。** 若实施环境存在正式共享组件/设计变量，先核对并直接使用正式值；否则将此候选作为公共token集统一建立，JD不单独硬编码。

| Token | 候选默认（Medium） | 应用 |
|---|---|---|
| font.family.ui | system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif | 跨页面正文/导航/按钮/输入共用；中文fallback由系统支持字体呈现 |
| font.family.code | ui-monospace, SFMono-Regular, Consolas, monospace | 仅受控技术详情/ID，普通HR页面不以代码字体排正文 |
| font.size.body | 16px | 内容、输入、列表；Small×0.875，Large×1.125 |
| font.size.secondary | 14px | 时间、辅助描述；随字号比例缩放，不把重要状态降成极小文本 |
| font.size.section | 20px | 页面内分组标题 |
| font.size.page | 24px | 页面/Job标题，长标题换行 |
| font.weight.regular/medium/strong | 400 / 500 / 600 | 正文/操作/标题；禁用态不靠极细字重 |
| line.height.body/document | 1.5 / 1.6 | 列表说明/长JD，避免拥挤与截断 |
| line.height.heading | 1.3 | 标题层次；不固定容器高度裁切多行 |
| document.reading_width | 约72ch上限 | JD长文居中或左对齐阅读列，宽屏不无限拉长段落 |
| space.scale | 4/8/12/16/24/32px | icon间距、组件内边距、组间距/页面边距共用 |
| radius.control/panel | 6/8px | 控件/面板统一；不按模块随机改变 |
| control.min_height | 40px | 输入/按钮最小高度；Large/多行自动增高 |
| table.header/row | 40/48px起始最小高度 | 同字号同密度一致；长内容自动增高 |
| page.padding / section.gap | 24px / 24px | 窄屏可收至16px，保留对齐关系 |

字号改变使用统一scale作用于文字层级和可容纳内容的布局。Dense/Comfortable如共用组件支持可作为独立个人视图偏好；默认Comfortable，不通过缩小字体塞更多列。固定阅读产物PDF/DOCX使用独立文档样式，不因用户Large导致导出内容变化。

色彩采用语义token：canvas、surface、surface-raised、text-primary/secondary/disabled、border、accent、focus、selected、success/warning/error/info。Light/Dark/Deep分别映射整套token；不能对页面简单反色。精确hex值由共享token确定，本稿不假造既有色板。差异add/remove也有文字标识；状态不只红绿。

### 16.3 页面框架与布局一致性

共享区域：导航、页头、面包屑、主要/次要操作、列表工具条、筛选chips、表格/卡片、详情抽屉、模态框、toast、错误/空/加载状态。模块只替换业务标题、列和动作，不重画一套基本控件。

任务列表采用主次信息层次：名称/动作在前，状态/优先级/截止/更新时间一致排列；选中态、hover、键盘focus不同且可辨。Job Library的Card/Board/Organization沿用同字体/间距和状态组件。

JD阅读沿用Docs式段落层次、边缘批注锚点和来源下钻。默认左对齐，不大段居中；列表与正文间距稳定。长字段先合理换行，次要列可折叠到详情，不能只靠省略号让人无法读全。数字有单位，薪资有币种/周期/gross-net；未知不补0。

1440×900允许JD文档+Copilot侧栏并排；1366×768保留Job header、tab与主操作，优先缩起可选导航/AI区域；更窄使用列表/详情或Document/Copilot切换，返回不丢输入。**普通页面不得整页水平溢出；版本比较或宽表仅在明确容器内横向滚动，并提供焦点字段/分栏替代。** 不因要对齐Screening而引入候选人Comparison业务。

### 16.4 公共命名与交互合同

| 组件 / 名称 | 必须相同的行为 |
|---|---|
| My Tasks | Assigned to me / Available to claim / Created or followed / Completed；当前标签/筛选可返回 |
| Files & Integrations | Files / Connections / Activity；文件消费状态独立于读取状态 |
| AI Models | Model catalog / Task policies / Compare & evaluate / Usage & cost / Activity & versions |
| Appearance | Theme / Accent color / Text size / Reset to defaults；即时应用和账户保存 |
| 列表→详情→返回 | 恢复授权范围内筛选、排序、滚动锚点及选择；失效记录解释移除 |
| 文档预览 | 支持关闭/Escape，返回触发点与原列表；Preview不强制Download |
| Dialog / Drawer | 打开时焦点进入，关闭后返回触发控件；Escape只关闭/取消，不提交；脏表单进入保留/放弃流程 |
| 筛选 | chips、Clear filters、scope可见；筛选无结果与空库不同 |
| Save / Cancel | Save显示saving并防重复提交；Cancel不隐式保存业务；已提交的异步操作不因关弹窗被伪撤销 |
| Submit / Confirm | 展示精确对象、版本、后果；按钮名为具体动作；授权人一次清晰确认，不多重重复弹窗 |
| Retry / Refresh | 读取失败可Retry；业务unknown先Check status；成功项不重跑 |
| Toast / Inline error | toast短确认；持续失败与阻断留在对象旁；可访问文本解释与下一步 |
| Read only / Disabled | 显示范围内原因；不能悬停才知道；无权数据不因tooltip泄露 |

未保存离页先保留或放弃，不无声删除。关闭进度面板不取消上传；Defer不是Completed；查看邮件不是批准。UI约定与Screening一致，实际写入仍经服务端权限/版本验证。

### 16.5 状态视觉与领域映射

公共StatusBadge读取entity_type+raw_status，映射稳定文字、图标与tone。Open/In progress/Waiting/Completed/Cancelled用于Task；Needs refresh/Overdue为附加标记。Approval的Approved、Job的Open、Publication的Published分别保留，不因颜色相似被合并。

必须制作共享状态样板：首次Loading、保留旧内容的Refreshing、真0/空库、筛选空、Failed+Retry、Stale+更新时间、Permission denied、Read only、Authorization required、Partial success、Outcome unknown、Unsynced setting。样板在Tasks、Files、Home、Models和JD工作区的相同语义使用相同视觉；无数据不能填0，模型失败不能显示不匹配。

交付链统一表达Package ready / Queued / Submitted / Delivered / Received or Imported，按通道实际可观测阶段显示。JD外部发布另用Publication状态。普通界面不展示schema/hash；来源详情可见精确版本和时间，授权技术详情再提供ID。

### 16.6 共享组件清单与实现交接

必须交付共享组件清单（名称为设计角色，不虚构现有代码路径）：AppFrame、PageHeader、AppearancePanel、MetricCard、FilterBar、TaskList/TaskDetail、DataTable、FileList/Preview、ConnectionEditor、OperationTimeline、ModelCatalog/PolicyEditor/Usage、StatusBadge、ConfirmDialog、EmptyState、ErrorState、Toast。

每个组件标注：共享token版本、props/状态、键盘/读屏行为、可配置业务插槽、权限处理、Small/Medium/Large与Light/Dark/Deep示例。相同组件不在JD文件夹复制分叉；独立构建可依赖公共包，不依赖其他L2的前端产物。

视觉评审使用同一公共fixture（相同文本长度、状态、记录数、theme、text size、viewport）对照Screening和JD共享页面；领域内容另测。演示人员不要求改成同一人，但集成演示共用Job/用户ID时必须同事实同版本，不能随机刷新数值。

### 16.7 验收脚本与真实状态

| 检查 | 操作 / 预期 |
|---|---|
| 字体/排版 | 相同fixture截图比对字体fallback、字号/字重、行高、内边距、表格密度、标题层次；差异有公共设计版本依据 |
| 显示偏好 | 两模块同账户改Dark/Large，公共组件一致响应；局部筛选/折叠仍独立；保存失败不声称同步 |
| 页面尺度 | 1440×900、1366×768、附加1280×800；200%缩放关键动作可达；宽表仅自身滚动 |
| 键盘与焦点 | Tab筛选→打开详情→打开模态→Escape→返回原触发点；脏表单可保留，取消不写入 |
| 状态与恢复 | empty/filtered-empty/failed/stale/unknown/partial-success；每种有明确下一步，无假0/假成功 |
| 独立运行 | 无Screening/Interview/Shell，JD公共页面全链可演示；切集成后不重建偏好/连接/账号 |
| 业务边界 | 同Task组件呈现不同task_type；JD审批和候选人筛选不互相套流程 |

验收对应PRD ALIGN-01～08与SH-JD-01～14。**本次已做附件内容、文档字段/术语和引用检查；未制作或运行原型，像素、缩放、键盘和真实跨模块同步均是后续设计/研发必须执行的门槛，不标为已通过。**

## 17. 文档主体 + Copilot侧栏的AI-native编辑体验（v1.3）

用户最新方向：像Google Docs编辑文档并与Gemini互动的体验，在文档本身看见批注、AI建议和修改标记。**主体必须是一份可直接编辑的JD，AI围绕文档工作。** 不要求集成这两款产品；继续使用HireOS共用视觉组件、字体、主题和设置。此节与已更新§4主布局优先，旧Blueprint描述仅用于辅助标准检查。

### 17.1 主工作区

页头：Job title、Internal/External、Draft/Active版本、Saving/Saved、协作者、Version history、Review for approval。第二行是Editing/Suggesting/Viewing与克制的富文本工具条；默认正文占视觉重心，避免聊天气泡抢占主体。

中央文档：有标题/段落/项目列表、可选大纲、光标、选区、评论锚点、建议修订。页边批注轨道与正文纵向对应。右侧只开一个主要面板：Copilot / Comments / Changes；定位某条建议时在同一侧栏展示内容，不叠加多个固定栏。

Requirements视图保留为Check requirements按钮/辅助tab。打开可查对应结构化要求与完整度，点击字段返回文档位置。普通用户不需要在左右两份内容中重复输入。Internal/External切换明确版本、受众及未同步提示，不使用隐蔽开关。

### 17.2 选中文本后的互动

选区浮动条：Ask Copilot、Rewrite、Shorten、Clarify、Add comment。浮动条不能遮住选中内容，键盘亦可打开。Ask Copilot打开侧栏并附带可移除的Selected text chip，显示本次讨论范围。

用户输入`Make this requirement more specific and easier to evaluate.`后，AI在目标段落显示修订预览，侧栏解释为什么这样改并提供Accept / Reject / Refine。点击Refine继续同一锚点讨论，不要求复制原文。侧栏回复中的View in document与边缘标记互相定位。

没有选区时显示This section或Whole document并让用户看到选择依据；用户手动扩大范围才能跨节修改。文档上的修改范围必须与侧栏scope一致，不能修改了整篇却只显示“优化了一句”。

### 17.3 标记样式与审阅

| 元素 | 设计与交互 |
|---|---|
| Selected text | 共享selection色，打开侧栏后保留非活动选区标记；光标可恢复 |
| Proposed insertion | 带下划线的新增内容，边缘AI/作者badge；未接受与已采纳内容可辨 |
| Proposed deletion | 原文删除线，可展开读完整；不直接消失 |
| Replacement | 同处呈现删/增，可在窄屏切Before/After；不能省掉旧句 |
| Comment anchor | 温和高亮/边缘气泡，点击打开线程；resolved折叠到历史 |
| Requirement change | 内联小标记+侧栏结构化old→new；不要求用户读JSON |
| Accepted / Rejected | 接受后正文更新且记录历史；拒绝后恢复正文，提案进入历史 |
| Stale / Orphaned | Location changed / Needs refresh，禁止Accept；提供Review latest text或重新选择范围 |

标记沿用公共语义token，Light/Dark/Deep均可读；AI、人、删除、新增不能只靠不同颜色区分。Changes提供未解决计数、上一条/下一条、作者过滤和Accept selected changes；批量预览列完整项目，重叠提案先解决。

阅读模式隐藏未采纳标记，显示已采纳草稿；Review显示待审修订；已批准版本始终只读。导出的公开版本无评论气泡、删除文字、内部修订说明和隐形敏感元数据。

### 17.4 必做演示：从模糊要求到可评估标准

文档原文：`Must have strong communication skills.`

1. HM选中此句，选择Ask Copilot，输入“改成能验证的具体要求”。
2. 原位显示删除原句，建议新增：`Can explain technical trade-offs clearly to non-technical stakeholders, supported by an example from a previous project.` 标AI suggestion。
3. 侧栏说明语义变化，并显示Requirement影响：证据预期由未明确变为具体项目实例；保持must-have，是否适用于岗位由HM审阅。
4. Recruiter在同句批注“这个岗位主要面对内部团队”，HM点击Refine，AI产生替代提案，旧提案保留为被替代。
5. HM接受当前提案，正文和JRP工作草稿同次更新；Saved后仍是Draft，active标准不变。
6. 第二个客户端先改了该句时，展示Needs refresh和新原文，不能直接接受旧提案。

另演示内部薪资选区不能进入External Copilot；调整must-have→preferred显示结构化变化；删除目标段落导致Location changed；Accept后Undo生成新草稿记录；保存失败保留文本；协作者只能Suggest，Viewer只View。

### 17.5 响应式、键盘与完整交付

1440×900为文档+侧栏；1366×768优先收起全局导航/大纲，正文仍可读；200%缩放可用可切换侧栏，文档上仍有建议数量和打开Changes入口。非强制同时显示所有面板，不用极小字体塞布局。

键盘可选择文字、Ask Copilot、浏览建议、Accept/Reject、进入评论并返回选区；模态Escape不提交。焦点和读屏标明“AI suggestion, insertion/deletion, pending”，接受后给简短状态反馈。多人cursor不替代作者信息；输入法输入中不插入AI结果移动光标。

设计交付新增DocumentEditor、SelectionToolbar、CopilotPanel、SuggestionMark、AnnotationThread、ChangesReviewPanel与标准映射卡；复用公共字体/间距/按钮/状态token。可点击原型必须实际改变文档共享状态，不只把AI回答展示在侧栏。验收逐项覆盖PRD COP-01～10；本稿仅定义设计，未宣称已有可运行编辑器。
