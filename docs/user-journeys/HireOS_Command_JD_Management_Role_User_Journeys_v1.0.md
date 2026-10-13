# HireOS Command — JD Management 角色 User Journey

文档编号：CMD-JD-UJ-ROLE-001  
版本：v1.1  
状态：用于产品、设计、研发与 AI 审查的工作稿  
范围：JD Management 登录后的角色目标、操作路径、关注点与审查输入

## 1. 文档目的

本文件把 JD Management 的产品规格转换为“角色登录后要完成什么”的用户旅程。它不是 UI 测试脚本，也不替代 PRD、Interface Spec 或 Design Brief；它用于：

- 让设计和研发按角色检查入口、权限、状态和下一步是否连贯；
- 让 AI 审查识别“目标—操作—结果—风险”之间的断点；
- 为后续高保真原型、可用性测试和验收测试提供统一的角色基线。

权威依据：

- [JD Management PRD v1.3](HireOS_Command_JD_Management_PRD_v1.3.md)
- [JD Management Interface Spec v1.3](HireOS_Command_JD_Management_Interface_Spec_v1.3.md)
- [JD Management Design Brief v1.3](HireOS_Command_JD_Management_Design_Brief_v1.3.md)

当本文件与上述文档冲突时，以 PRD 定义的产品行为、Interface Spec 定义的状态/权限契约为准。

## 2. 角色定义与共同前提

### 2.1 角色映射

| 本文角色 | JD 文档中的对应角色 | 主要责任 | 默认写入/决策范围 |
|---|---|---|---|
| HR | HR / Recruiter | 建岗、补全、协调、生成内外部 JD、提交审批和交付 | 可编辑授权范围内的 Job、JRP 草稿和 JD；不能代替其他角色作未经授权的审批 |
| 面试官 | Viewer / Interviewer / Collaborator | 阅读当前获授权标准，为评估提供证据或建议 | 默认只读；可按授权评论、补充证据或提出建议；不能看到 restricted 字段，不能批准/激活/发布 |
| 管理者 | Hiring Manager；必要时包含 Department Head/Finance approver | 描述业务目标、职责和成功标准，解决冲突，审批或复核需求 | 可编辑职责范围内的业务需求；作为 Hiring Manager 参与默认 HM → HR 审批；预算/编制审批取决于策略 |

> “管理者”不是一个自动拥有全部权限的超级角色。是否可看预算、HC、restricted requirement 或执行审批，必须由 Workspace/RBAC/字段用途授权决定。

### 2.2 所有人登录后的共同规则

1. 登录后进入本人有权限的 Workspace；无权限的 Job 不出现在列表、搜索、统计或通知摘要中。
2. 首页优先呈现角色相关的下一步：我的待办、待我审批、我负责的岗位或需要我补充的内容。
3. Job Workspace 同时展示三类独立事实：当前招聘状态、有效要求版本、草稿/审批状态；不能把“已保存”“已批准”“已激活”“已发布”混为一个完成状态。
4. AI 的权限是“当前用户有效权限 ∩ Workspace AI Policy ∩ 工具白名单 ∩ 当前字段用途授权”。AI 不因聊天、附件或 @mention 获得额外权限。
5. 任何改变正式要求、审批、激活、发布、发送或关闭状态的高影响动作，都必须显示精确版本、差异、受影响范围，并由获授权人明确确认。

### 2.3 信息可见性分层

每条旅程都必须标明字段的受众和用途，不能只写“用户可见”。

| 信息层 | 示例 | 可见/可用规则 |
|---|---|---|
| 对内对外可用 | 职位名称、地点、部分职责、公开薪资、工作模式 | 可进入 External JD，但仍需经过公开审阅 |
| 仅内部可见 | 实际预算、内部薪资上下限、招聘原因、编制、内部目标 | 仅授权 HR、管理者或指定审批人可见；不得进入公开搜索、邮件或外部文档 |
| Restricted | 限制性要求、政策依据、特殊背景、敏感讨论 | 按字段和用途授权；默认不进入普通协作、模型上下文、评分或外发 |

每个字段还应明确：谁可读、谁可编辑、谁可确认、谁可发布，以及 AI 是否可以使用该字段。

## 3. 共享岗位生命周期

```text
登录 → 角色首页/任务 → Job Library → Job Workspace
  → 需求草稿与协作 → 质量检查 → 提交审批
  → 批准 → 激活为有效标准 → 打开招聘
  → 生成/审阅 Internal JD 与 External JD
  → 按渠道发布或发送 → 版本/影响追踪
```

状态必须分别记录：

- `hiring_status`：draft / open / paused / closed / archived；
- `approval_status`：not_submitted / pending / changes_requested / rejected / approved / cancelled / superseded；
- `activation_status`：not_requested / pending / succeeded / failed / outcome_unknown；
- `publication_status`：not_published / queued / publishing / published / failed / outcome_unknown / withdrawal_pending / withdrawn。

所有角色还需要在首页、任务列表或 Job header 看到 `owner`、`assignee`、`due_at`、`planned_publish_at` 和 `next_action`。最近更新时间不能替代截止时间；逾期、待我处理和等待他人处理必须可区分。

### 3.1 创建时的统一业务问题

五种创建入口的交互形式可以不同，但最终都要能收集并确认职位名称、地点、职责、岗位要求、薪资范围、招聘人数、负责人、工作模式、截止/发布时间以及信息可见性。

用户可以在不选中文字的情况下提出招聘相关问题，例如市场薪资、城市差异、经验要求或预算建议。系统应提供清晰的“编辑 JD / 招聘问答 / 市场调研”模式切换；市场调研结果必须包含来源和日期，并在写入内部预算或公开薪资前要求人工确认。

## 4. 角色旅程一：HR

### 4.1 登录目的

HR 登录后的首要目的，是把一项招聘意图变成可协作、可审批、可追溯的岗位标准，并推动它进入招聘和对外交付，而不是单纯生成一份漂亮的职位文案。

登录后应立即回答：

- 哪些岗位需要我补全或处理冲突？
- 哪些版本待我提交、审批、激活或发布？
- 哪些外部交付失败或处于未知状态？
- 哪些岗位的要求发生重大变化，需要影响复核？

### 4.2 主路径

| 阶段 | HR 操作路径 | 可观察结果 | HR 关注点 |
|---|---|---|---|
| 1. 进入 | 登录 → Workspace → Home / My Tasks | 显示本人待办、待审批、失败恢复和最近岗位，带范围与更新时间 | 数据是否属于当前 Workspace；未知/过期不能显示为 0 |
| 2. 选岗 | Home 卡片或 Job Library → 搜索/筛选 → 打开 Job | 列表显示 Job title、招聘状态、active version、draft/approval、负责人和下一步 | 搜索和计数不泄露 restricted；保留筛选和返回位置 |
| 3. 建立草稿 | New Job → Chat / Upload / Paste notes / Template / Clone | 文件读取、提取、人工确认、草稿保存分阶段显示；来源可追溯 | AI 不猜 HC、币种、薪资周期、负责人或法律依据；原文不直接生效 |
| 4. 结构化补全 | Job Workspace → Requirements / 文档编辑 → Copilot | 缺口、歧义、冲突和建议分组显示；提案先以 Suggested/Proposed changes 呈现 | Comment 不等于 Requirement；AI 修改需可见 old → new、原因、来源和影响 |
| 5. 协作 | @mention 管理者/面试官 → 评论线程 → 处理建议/冲突 | 每条意见有作者、时间、可见范围和状态；接受后记录 revision | 不把私有或 restricted 对话带入共享会话；撤权后不继续展示缓存 |
| 6. 质量检查 | Analyze / Quality review → 补齐 title、owner、HC、地点/工作安排、职责、must/preferred、可见性和阻断项 | 可看到 To complete、To revise、Suggestions、Completed；阻断项清零 | 完整度不是录用质量预测；unknown 不能当成 0 |
| 7. 生成文档 | Internal JD / External JD → 预览 → 审阅 → 生成新版本 | 内外部 JD 各自版本化并引用精确 JRP；外部文档只使用 public_eligible 投影 | restricted、预算、替补原因、评估策略不能进入公开文本、搜索、附件或邮件 |
| 8. 提交审批 | Workflow & Approval → Review candidate → Submit for approval | 冻结 candidate、内容 hash、内外 JD 版本、审批政策和授权范围 | 修改后应创建新 revision；旧审批不能被静默更新 |
| 9. 推进生效 | 追踪 Approval task → 处理退回/拒绝 → 获批准后 Activate | 显示 Approved、Activation pending/succeeded/failed/outcome_unknown；Core 结果可对账 | 批准不等于已激活、已 open 或已发布；超时不能声称成功 |
| 10. 交付与维护 | Publication → 选择精确外部版本/渠道 → 预览 → Confirm publish；Activity / Versions 追踪 | 每个渠道有独立状态、回执和重试；历史版本可比较，恢复只能生成新草稿 | 不重复发送未知结果；撤下是独立流程；重大变更触发 Impact Review |

### 4.3 HR 的关键成功标准

- 能从任一待办深链回到正确 Job 和正确版本；
- 能区分草稿、提案、审批、激活、发布和发送状态；
- AI 生成内容始终可追溯、可撤销、可解释，且不越权读取或外发；
- 发布按钮只在审批/激活/渠道门槛满足时可用；
- 失败或未知结果提供查询、重试和人工处理路径，不制造“成功”假象。
- 能看到需要补全、待审批、待发布、逾期和待他人处理的任务，并知道截止时间和下一步。
- 能在同一工作区完成市场调研、人工确认预算以及生成内外部薪资表达，不被迫跳到外部工具。

## 5. 角色旅程二：面试官

### 5.1 登录目的

面试官登录后的首要目的，是理解当前岗位采用的有效标准，并在授权范围内准备面试、补充证据或提出改进建议。面试官不是 JD 的默认维护者，也不是审批人。

登录后应立即回答：

- 我被分配了哪些面试任务和岗位？
- 这些面试使用哪个不可变的 Requirement Snapshot / active version？
- 我能看到哪些要求、证据标准和 rubric？哪些字段被限制？
- 我提出的建议是否进入正式标准，谁需要确认？

### 5.2 主路径

| 阶段 | 面试官操作路径 | 可观察结果 | 面试官关注点 |
|---|---|---|---|
| 1. 进入 | 登录 → Home / My Tasks | 显示分配的面试任务、即将开始的岗位和需要补充的证据 | 不显示无权限岗位或 restricted 摘要；任务状态有 due、waiting、needs_refresh |
| 2. 查阅岗位 | 任务深链 → Job Workspace → Overview / Requirements | 显示 active requirements、来源版本、更新时间和用途；只读字段明确 | 不能把最新草稿误当成面试依据；必须看到 snapshot/version ref |
| 3. 准备面试 | Requirements → 查看 evidence expectations / rubric 引用 → Interview 入口 | 能将问题和评分依据绑定到稳定 requirement_id | 评分维度来自获批准标准；不能自行把建议变成硬过滤 |
| 4. 提供反馈 | 对具体要求评论或提出 suggestion → 选择公开范围 | 建议进入协作线程，显示 Proposed changes，不直接改正式 JRP | 评论与正式 Requirement 分离；不得把候选人私人信息带入不必要的共享上下文 |
| 5. 处理变化 | 收到 `needs_refresh` 或 Impact Review 通知 → 查看旧/新差异 | 明确当前已开始评估是否保留旧 snapshot，是否需要重新评估 | JD 不直接改写已完成的面试结果；新标准只影响新评估或明确重评范围 |
| 6. 完成任务 | My Tasks → 记录面试证据/提交 → 查看完成回执 | 任务以业务 completion_ref 完成，不是简单勾选；审计保留来源版本 | 不能以“已读”代替完成；权限撤销后不能继续提交敏感内容 |

### 5.3 面试官的关键成功标准

- 清楚知道面试依据的 active version / snapshot，而不是“最新版”模糊指代；
- 只能访问与当前任务相关且获授权的字段；
- 建议不会静默改变正式要求、评分契约或发布内容；
- 岗位要求变化时，能看到影响范围和处理决定；
- 完成面试任务后，有可追溯的业务完成证据。
- 能看到自己的任务截止时间、逾期状态和下一步，而不是只有最近更新时间。

## 6. 角色旅程三：管理者

### 6.1 登录目的

管理者登录后的首要目的，是确认“为什么招、招什么人、如何判断成功”，并对职责范围内的精确岗位版本作出业务确认或审批。管理者关注业务正确性和取舍，不应被迫维护所有格式细节。

登录后应立即回答：

- 哪些岗位需要我补充业务目标、职责、成功标准或解决冲突？
- 哪些候选版本待我审批，审批范围和差异是什么？
- HC、地点、级别、关键职责或 must-have 是否发生重大变化？
- 新版本会影响哪些正在进行的评估？

### 6.2 主路径

| 阶段 | 管理者操作路径 | 可观察结果 | 管理者关注点 |
|---|---|---|---|
| 1. 进入 | 登录 → Home / Needs My Attention / Pending Approvals | 显示本人负责或待审批岗位，按业务范围聚合 | 统计有 scope、as_of、availability；不把无权限岗位混入团队总数 |
| 2. 定义需求 | 打开 Job → Requirements / Chat → 输入业务目标、职责、成功标准 | AI 以澄清问题和结构化草稿呈现；空缺标 Unknown，不擅自补全 | 看到自己的输入如何变成 requirements；避免把偏好写成未经审查的硬条件 |
| 3. 解决冲突 | Review conflicts → 对比 Base / Current / Proposal → Keep / Edit merged / Request changes | 显示不同作者、原话、理由和影响；解决决定写入 Activity | 不用无依据的候选池百分比；评论解决不代表要求自动变更 |
| 4. 审阅表达 | Internal/External JD → Preview → Compare to JRP | 外部文案与 public_eligible 需求一致；重大差异被标记 | 外部表达不能成为第二套正式标准；不应出现预算、受限背景或内部评分策略 |
| 5. 审批 | Pending approval → 查看 candidate、hash、差异、审批步骤和范围 → Approve / Request changes / Reject | 决策记录 human actor、精确版本、理由（如适用）和时间 | AI 只能辅助解释，不能作为 approver；审批不自动 open、激活或发布 |
| 6. 复核影响 | Versions & Impact → 查看旧/新 JRP 和下游报告 → 选择 new_only / request_reevaluation / keep_existing | 每项影响带来源、as_of 和可用性；下游未知显示 unknown | 已开始评估保留旧 snapshot；重评是新运行，不能覆盖历史结果 |
| 7. 追踪结果 | Overview / Activity → 查看 Activation、Hiring status、Publication 的独立状态 | 能看到 Approved · Activation pending 等中间态及失败原因 | 不把批准误认为已经生效或已对外发布；重大变更继续留在历史中 |

### 6.3 管理者的关键成功标准

- 能快速判断岗位目标、职责、成功标准和关键取舍是否正确；
- 审批时看到的是精确冻结版本、差异和影响，不是泛化摘要；
- 任何重大要求变化都触发正确的审批和影响复核；
- 管理者的确认不会越过 HR、Finance 或其他策略要求的步骤；
- 历史决策可追溯，旧版本可阅读但不能被原地改写。
- 能在登录后的第一屏找到待我确认、待我审批、急需发布和已超时的岗位。

## 7. 角色交接与边界

| 交接点 | 发起角色 | 接收角色 | 必须交接的对象 | AI 审查重点 |
|---|---|---|---|---|
| 业务意图 → 结构化草稿 | 管理者 | HR | 目标、职责、成功标准、must/preferred、未知项 | AI 是否保留来源和未知，不编造事实 |
| 草稿 → 可审批候选版 | HR | 管理者/审批人 | JRP、Internal/External JD、差异、阻断项、manifest hash | 是否冻结精确版本；是否混入未确认提案 |
| 已批准标准 → 面试依据 | 管理者/HR | 面试官 | active version、Requirement Snapshot、evidence expectations | 面试官是否拿到正确 snapshot，是否越权 |
| 面试反馈 → 要求修订 | 面试官 | HR/管理者 | 针对 requirement 的评论、证据、建议范围 | 评论是否被误当正式要求；是否保护候选人敏感信息 |
| 需求重大变化 → 影响处理 | HR | 管理者/面试官及下游负责人 | 旧/新差异、受影响评估、new_only/reevaluate/keep 选项 | 是否显示 unknown 而非虚构影响数量 |
| External JD → 渠道发布 | HR | 外部渠道/候选人 | 精确 external jd_version、审批状态、公开预览 | 是否存在 restricted 泄露、版本错配或未经批准发布 |

## 8. AI 审查输入格式

AI 审查应以每个角色、每个关键任务为单位读取以下字段，而不是只读取页面截图或聊天记录：

```yaml
journey_id: HR-01
role: HR | interviewer | manager
login_context:
  workspace: "Northstar Labs"
  landing_surface: "Home / My Tasks / Pending Approvals"
  authorized_scope: "workspace or explicit job/field scope"
goal: "角色登录后要完成的业务结果"
trigger: "触发本次旅程的事件"
preconditions:
  - "账号、岗位状态、任务或审批状态"
steps:
  - id: 1
    surface: "页面/标签/任务"
    action: "用户动作"
    expected_state: "可观察的状态、版本或回执"
    decision: "用户需要判断什么"
    permission_check: "必须允许/必须拒绝的访问"
    ai_touchpoint: "无 / 解释 / 提案 / 高影响动作辅助"
risks:
  - "越权、版本错配、状态伪成功、敏感信息泄露等"
handoff:
  to_role: "下一个角色"
  artifact: "Job/JRP/JDVersion/Snapshot/Task/ApprovalCandidate"
success_criteria:
  - "可验证的完成条件"
open_questions:
  - "仍需产品或策略确认的问题；没有则写 []"
```

### 8.1 AI 审查问题清单

对每条旅程至少检查：

1. 登录后的首屏是否直接支持该角色的目的，还是把角色带入与其无关的通用功能？
2. 每一步是否有明确的输入、可观察结果、下一步和退出/恢复路径？
3. 角色是否只能看到和修改其授权范围内的 Job、字段、版本与会话？
4. 评论、AI 提案、已确认要求、审批、激活、发布和发送是否被清楚区分？
5. 是否明确显示精确版本、snapshot、来源、更新时间、状态和未知结果？
6. 高影响动作是否由正确的人确认，且内容/收件人/版本变化会使旧确认失效？
7. 失败、网络中断、权限撤销、并发冲突、Core 超时和下游未连接时，用户是否能恢复而不重复执行？
8. AI 是否可能把未知信息当事实、把候选人敏感信息带入共享上下文，或把内部字段带到外部 JD？
9. 交接给下一角色时，是否传递了正确的版本化业务对象，而不是一段无法追溯的摘要？
10. 旅程完成是否有业务证据（completion_ref、decision、activation result、delivery receipt），而不是仅显示“Done”？

### 8.2 会议要求的应用性硬性检查

以下项目不是可选的视觉建议，而是每次页面审查都必须检查的应用性门槛：

1. 角色是否一进入页面就知道自己是谁、为什么来、下一步是什么？
2. 能一步完成的操作是否被拆成多步；是否存在不必要的重复输入、跳转或确认？
3. 页面是否明确当前处于编辑、招聘问答、市场调研、审批还是发布模式？
4. 用户提出不属于当前模式的问题时，是否能得到清楚解释并切换到正确模式？
5. 按钮、提示、状态和截止时间是否足以支持用户自主完成任务，而不是依赖口头培训？
6. 信息结构是否围绕角色目标组织，而不是让所有角色看到相同的通用内容？
7. 失败、超时、权限不足、网络中断或未知结果时，是否有可恢复路径？
8. 页面是否避免把“流程已跑通”误认为“用户已经完成业务目标”？

## 9. 不属于本文件的内容

- 具体视觉尺寸、组件间距和原型文案：见 Design Brief；
- API 字段、事件、幂等键和状态契约：见 Interface Spec；
- 逐步点击、测试数据、浏览器兼容和缺陷记录：见现有 [User Journeys v0.2](HireOS_Command_JD_Management_User_Journeys_v0.1.md)；
- 候选人筛选、面试评分或 Offer 审批的内部流程：除非作为 JD 版本影响的下游边界，不在本文件展开。

## 10. 版本记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.0 | 2026-10-13 | 新增 HR、面试官、管理者三类角色的登录目的、路径、关注点、交接边界和 AI 审查输入格式 |
| v1.1 | 2026-10-13 | 根据会议评审补充市场调研、三类信息可见性、截止时间/任务、模式切换和应用性硬性审查标准 |
