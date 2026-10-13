# HireOS Command — JD Management User Journey

文档编号：CMD-JD-UJ-001  
版本：v1.0  
状态：JD Management 统一 User Journey 基线  
范围：JD 创建与 JD 管理两大场景

## 1. 文档目的与依据

本文合并两份既有 User Journey：

- JD Copilot Agent 创建模块 User Journey v1.0；
- JD Management 角色 User Journey v1.1。

合并后的文档以 JD Copilot Agent 创建模块中的四类角色为统一角色基线，并将完整流程分为两个场景：

1. **场景 A：创建 JD**——从招聘意图、文件或表单开始，生成并确认职位草稿；
2. **场景 B：管理 JD**——对已有职位进行补全、协作、分析、审批、激活、发布和影响追踪。

权威依据：

- [JD Copilot Agent PRD v0.2](../HireOS_JD_v2/HireOS_Command_JD_Copilot_Agent_PRD_v0.2.md)
- [JD Management PRD v1.3](../HireOS_Command_JD_Management_PRD_v1.3.md)
- [JD Management Interface Spec v1.3](../HireOS_Command_JD_Management_Interface_Spec_v1.3.md)
- [JD Management Design Brief v1.3](../HireOS_Command_JD_Management_Design_Brief_v1.3.md)

当本文与 PRD、接口契约或权限策略冲突时，以对应版本的权威文档为准。

## 2. 统一角色与权限

| 角色 | 登录后的主要目的 | 核心操作 | 默认限制 |
|---|---|---|---|
| **Recruiter / TA** | 将招聘需求整理成合格 JD，协调协作者并推动审批/交付 | 创建职位、补全字段、应用 AI 建议、保存草稿、提交审批、追踪发布 | 不能替审批人作出审批结论，不能绕过阻断项提交或发布 |
| **Hiring Manager** | 说明为什么招、招什么人、成功标准和团队上下文，并确认业务取舍 | 回答追问、编辑授权字段、解决冲突、确认岗位内容、参与审批 | 不能修改未授权预算/敏感字段，不能自动替代 HR 或审批政策发布 |
| **HR Approver** | 确认内容、预算、风险和流程前置条件已经处理 | 查看候选版本、差异、风险和影响，批准、退回或拒绝 | 不能把 AI 建议当成人工决策；无权限时不能查看 restricted 字段 |
| **Viewer** | 阅读获授权的 JD、分析结论和当前有效版本 | 查看职位、来源、版本和授权的 Agent 结论 | 不能应用修改、保存、提交审批、发布或查看敏感字段 |

权限在每次动作执行时重新校验。聊天、附件、引用和 @mention 不得扩大 Job、字段、版本或用途权限。

## 3. 共同原则与状态

### 3.1 共同原则

1. Agent 的任务是把非结构化招聘意图转成可编辑、可追溯、可检查、可审批的职位标准，不是自动写完并发布 JD。
2. Agent 默认提出建议；应用修改、保存草稿、提交审批、批准、激活和发布均需用户显式操作。
3. 明确输入、来源材料、Agent 推断、建议和 Unknown 必须区分展示；不确定信息不能伪装成事实。
4. 内部内容、外部内容和 restricted 内容按字段及用途隔离；restricted 默认不进入普通协作、模型上下文或外发。
5. Comment、Proposed change、Confirmed requirement、Approval、Activation、Publication 是不同事实，不能用一个“完成”状态代替。

### 3.2 信息可见性

| 信息层 | 示例 | 处理规则 |
|---|---|---|
| 对内对外可用 | 职位名称、地点、部分职责、公开薪资、工作模式 | 可进入 External JD，但仍需公开审阅和确认 |
| 仅内部可见 | 实际预算、内部薪资范围、招聘原因、编制、内部目标 | 仅授权角色可见；不能进入公开搜索、邮件或外部文档 |
| Restricted | 限制性要求、政策依据、敏感讨论、特殊背景 | 按字段和用途授权；默认不进入普通协作、AI 评分或外发 |

每个敏感字段都应明确谁可读、谁可编辑、谁可确认、谁可发布，以及 AI 是否可以使用。

### 3.3 状态与任务

Job Management 至少区分：

- `hiring_status`：draft / open / paused / closed / archived；
- `approval_status`：not_submitted / pending / changes_requested / rejected / approved / cancelled / superseded；
- `activation_status`：not_requested / pending / succeeded / failed / outcome_unknown；
- `publication_status`：not_published / queued / publishing / published / failed / outcome_unknown / withdrawal_pending / withdrawn。

首页、任务列表或 Job header 还需显示 `owner`、`assignee`、`due_at`、`planned_publish_at` 和 `next_action`。最近更新时间不能替代截止时间；待我处理、等待他人、逾期和未知结果必须分开。

## 4. 共同登录旅程

用户登录后应快速知道：

- 我是谁、属于哪个 Workspace；
- 我是在创建新职位，还是继续已有草稿/任务；
- 我有哪些待补全、待确认、待审批或失败恢复事项；
- 当前用户可以执行哪些动作；
- 当前职位采用哪个 active version 或 draft version。

共同入口路径：

```text
登录 → 角色首页 / My Tasks → Job Library → Job Workspace
  → 创建或管理 JD → 协作/分析 → 审批/激活 → 发布/影响追踪
```

# 场景 A：创建 JD

## A1. 场景目标

用户从零散会议笔记、聊天记录、口头描述、外部 JD、职位名称或空白表单开始，得到一份带来源、缺失项和风险提示的结构化职位草稿，并在人工确认后保存或提交审批。

创建流程：

```text
进入 Create a Job
  → 选择五种创建方式
  → 输入招聘意图或材料
  → Agent 提取字段、来源和置信度
  → 追问关键缺失/冲突
  → 生成结构化草稿
  → 用户查看 diff 并逐项应用
  → 保存草稿或进入 Analyze
  → 用户明确提交审批
```

## A2. 创建场景共同旅程

| 阶段 | 用户操作 | 预期结果 | AI/应用性审查 |
|---|---|---|---|
| 进入 | 登录 → Job Library → `Ask Copilot` | 打开右侧 `Ask Copilot`，进入 `Create a Job` 首页 | 首页明确这是创建职位的任务，不是泛化聊天 |
| 选择 | 查看五个并列入口，点击 `i` | 提示说明入口用途、适用情况和用户要提供的内容 | 用户无需培训即可选择；没有隐含先后依赖 |
| 开始 | 点击入口 | 入口标题先显示为用户消息，随后 Agent 直接引导 | 当前创建模式和输入提示清晰 |
| 提取 | 输入文字/语音/文件/链接/表单 | 输出字段、来源、置信度、缺失项和处理状态 | 推断不冒充事实；失败可重试或转手动 |
| 审阅 | Ask Copilot 与 Workspace 并列 | 生成的草稿、字段和 diff 可查看 | 建议与正式 JD 视觉区分，不自动覆盖 |
| 确认 | `Apply`、`Save draft` 或 `Submit for approval` | 每个动作有明确按钮、操作者、时间和 revision | 不自动写入、审批、发布或发送外部通知 |

## A3. 五种创建方式

### A3.1 Quick Start：回答三个问题

**主要角色**：Recruiter、Hiring Manager。  
**目的**：用户只有招聘困难和目标，不知道如何组织完整 JD。

| 步骤 | 用户动作 | 预期结果 |
|---|---|---|
| 1 | 点击 `Quick Start` | Agent 一次性提出：为什么招/遇到的困难、希望候选人解决什么、必须具备哪些硬技能 |
| 2 | 一次回答全部或部分问题 | Agent 识别已回答内容，只追问缺失问题，不重复询问 |
| 3 | 无法推断职位名称 | Agent 追问 Job title，不留空或写 `New Role` |
| 4 | 完成关键回答 | 生成 1 份结构化草稿，字段显示来源、置信度和待确认项 |
| 5 | 查看 Workspace | 可查看概述、职责、要求、加分项、地点和工作方式 |
| 6 | 点击 `Create job from this draft` | 创建职位，创建者成为 Owner；刷新后数据仍在 |

成功条件：只追问未回答问题；生成一份可编辑草稿；未确认内容不进入正式事实；创建前没有审批或发布副作用。

### A3.2 Start with a Job Title：从职位名称开始

**主要角色**：Recruiter、Hiring Manager。  
**目的**：用户知道职位名称，希望快速比较表达风格。

1. 点击入口后只显示引导文案，底部输入框聚焦；
2. 输入职位名称后生成三份风格不同、事实一致的 JD：Concise & direct、Warm & people-first、Detailed & structured；
3. 用户在对话卡片或 Workspace 页签中对比；
4. 用户选择 A/B/C 其中一份；
5. 可选地使用 `Refine`，统一修改所有版本并高亮差异；
6. 点击 `Create job with version A/B/C` 后，使用选中版本创建职位。

成功条件：只有该入口生成三份版本；选择版本和最终创建版本一致；没有无来源事实扩散。

### A3.3 Upload a JD：上传已有 JD

**主要角色**：Recruiter、Hiring Manager。  
**目的**：将 PDF/DOCX/TXT 中已有的 JD 快速结构化。

1. 点击入口立即打开文件选择器，同时显示引导和 `Choose file`；
2. 取消后可再次选择，不报错；
3. 成功读取后提取标题、职责、要求、加分项、地点和工作方式，生成 1 份草稿；
4. 每个字段显示来源；文件原文不直接成为正式 JD；
5. 文件无法读取时，显示原因并提供手动输入或重试；
6. 用户查看原文与改写 diff，逐项应用或放弃。

成功条件：支持格式和失败路径清楚；解析失败不生成空草稿或虚假内容；上传完成不等于保存或提交审批。

### A3.4 Paste a Link or Text：粘贴链接或文案

**主要角色**：Recruiter、Hiring Manager。  
**目的**：将公开职位链接、完整 JD 或会议笔记转成公司内部草稿。

1. 点击入口后提示粘贴链接或完整文案，输入提示更新；
2. 内容过短或不可识别时，说明如何重新粘贴；
3. 链接显示来源、公司/职位、可用性和读取状态；
4. 正文或会议笔记被提取和改写为 1 份草稿；
5. 页面无法访问或来源不可靠时，不编造内容，提供手动输入路径；
6. 用户比较原始来源与新草稿后应用。

成功条件：链接和正文识别规则可理解；来源和失败状态可追踪；遵守版权边界，不大段复制外部 JD。

### A3.5 Create Manually：手动创建

**主要角色**：Recruiter、Hiring Manager。  
**目的**：逐字段控制，不使用 AI 起草。

必填：Job title、Location、Headcount、Responsibilities、Requirements。可选：Level、Work model、Department、Reports to、薪资范围和周期。

1. 点击入口后在对话中展示表单，不调用 AI 起草；
2. 缺失或非法字段标红并提示，不创建职位；
3. 用户点击 `Save` 后直接创建并进入编辑页，不经过 Workspace 预览；
4. 手动创建仍需接受完整性检查和审批前置条件；
5. 表单内容原样进入对应章节，保存记录操作者和时间。

## A4. 创建场景的角色分工

| 角色 | 创建阶段的重点 |
|---|---|
| Recruiter | 选择入口、收集材料、补齐字段、查看来源和风险、保存草稿、发起审批 |
| Hiring Manager | 提供业务目标、职责、成功标准、must/preferred 和团队上下文；确认推断是否准确 |
| HR Approver | 创建阶段通常只在提交前后介入，确认关键字段、预算、合规和流程前置条件 |
| Viewer | 只能阅读授权草稿、来源和分析结果，不能应用修改或推进流程 |

# 场景 B：管理 JD

## B1. 场景目标

用户对已经创建的职位进行持续管理：补全和修改要求、协作解决冲突、运行质量分析、保存版本、提交和执行审批、激活有效标准、生成内外部 JD、发布并追踪下游影响。

管理流程：

```text
登录角色首页/任务
  → Job Library → Job Workspace
  → 读取当前状态和 active/draft version
  → 编辑、协作、分析和处理风险
  → 保存 revision → 提交审批
  → 批准/退回/拒绝 → 激活
  → 打开招聘 → 生成/审阅 Internal/External JD
  → 发布、撤回或影响复核 → 版本追踪
```

## B2. 管理场景共同入口

登录后的首页必须按角色呈现：

- Recruiter：待补全、待审批、待发布、失败恢复和重大变更；
- Hiring Manager：待我确认、待我审批、急需发布、预算/HC/职责变化；
- HR Approver：待审批候选版本、差异、阻断项和逾期审批；
- Viewer：分配的阅读/评估任务、有效 snapshot、needs_refresh 和截止时间。

用户从首页或任务深链进入 Job Workspace 后，必须同时看到：当前招聘状态、有效要求版本、新草稿/审批状态、负责人、截止时间、下一步和更新时间。

## B3. 管理已有草稿：编辑与 Copilot

**主角色**：Recruiter、Hiring Manager；Viewer 可读。  
**目标**：在不丢失旧内容和审计记录的情况下修改 JD。

1. 用户打开编辑页右侧 `Copilot`；
2. 可直接提问或引用选中文字，例如“把职责改得更偏 B2B 增长”；
3. Agent 返回新增/替换/润色建议和 old → new diff；
4. 用户逐项 `Apply`、编辑提案或撤销；
5. 应用后记录操作者、时间、来源和 revision；
6. 未点击应用前正式 JD 不改变；
7. 用户提出市场调研或一般招聘问题时，可从编辑模式切换到问答/调研模式，不强迫先选中文字；
8. 无权限用户只能查看结论或请求有权限的人处理，不显示伪按钮。

## B4. 协作、冲突和信息边界

1. 用户通过评论、@mention 或建议修改邀请其他角色参与；
2. 每条意见显示作者、时间、可见范围、引用字段和状态；
3. `Comment ≠ Requirement`，接受评论不会自动改变正式标准；
4. 冲突面板显示 Base / Current / Proposal，用户可 Keep current、Use proposal 或 Edit merged proposal；
5. restricted 会话不能被复制到普通协作上下文；撤权后不能继续展示缓存敏感内容；
6. 解决冲突后记录最终决定、决定人和进入标准的内容。

## B5. Analyze 与质量门禁

**主角色**：Recruiter；协作者可查看。  
**目标**：判断草稿能否进入审批。

1. 用户点击 `Analyze`；系统显示处理中状态并切换到 `Analysis`；
2. 结果至少区分：`阻断`、`需要确认`、`优化建议`；
3. 检查完整性、逻辑一致性、文案质量、风险和流程前置；
4. 用户可以逐项补填或使用 `AI fix`，每项显示修复前后差异；
5. Unknown 可以保留为待确认，但按规则在提交审批时拦截或提醒；
6. 阻断项未解决时 `Submit for approval` 不可用；优化建议不阻断保存。

至少检查：职位名称、地点、HC、职位概述、核心职责、任职要求、可见范围、JD 唯一 ID、语言版本，以及职级/经验、地点/工作方式、HC/审批状态的一致性。

## B6. 保存、审批和激活

### Recruiter 路径

1. 点击 `Save draft`，记录操作者、时间、来源和 revision；
2. 草稿保存不发送审批或发布通知；
3. 点击 `Submit for approval` 后重新校验权限、阻断项、候选版本和审批人；
4. 展示精确版本、未处理项、审批范围和影响；
5. 用户显式确认后创建审批任务。

### HR Approver 路径

1. 从 `Pending Approvals` 进入候选版本；
2. 查看内容、差异、来源、风险、可见范围和冻结版本 hash；
3. 选择 `Approve`、`Request changes` 或 `Reject`；
4. 决策记录 human actor、精确版本、时间和理由；
5. AI 可以解释或总结，但不能代替审批人。

### 激活路径

获批准后，授权用户显式触发 Activate。系统必须区分 `Approved`、`Activation pending`、`Activation succeeded`、`Activation failed` 和 `Outcome unknown`。批准不等于已激活、已 open 或已发布；超时不能声称成功。

## B7. Internal JD、External JD 与发布

1. Internal JD 与 External JD 分开版本化，并引用精确 JRP 版本；
2. External JD 只能从 `public_eligible` 字段投影生成；
3. 预算、替补原因、内部评估策略和 restricted 内容不得进入公开预览、搜索、PDF、邮件或分享链接；
4. 生成或编辑外部文案时，改变职责、薪资或资格要求必须形成结构化提案；
5. 发布前显示候选版本、审批状态、渠道、公开预览和确认人；
6. 每个渠道独立记录 queued/publishing/published/failed/outcome_unknown/withdrawal_pending/withdrawn；
7. 未知结果的主动作是查询状态，不默认重复发送；
8. 撤下和关闭是独立流程，不能把 Job 状态直接伪装成渠道已撤下。

## B8. 版本、影响和下游交接

1. 新标准重大变化（薪资、HC、地点、级别、must-have、关键职责或评分规则）触发 Impact Review；
2. 显示旧/新版本差异、受影响对象、来源、`as_of` 和可用性；
3. 由授权用户选择 `new_only`、`request_reevaluation` 或 `keep_existing`；
4. 已开始的评估保留旧 Requirement Snapshot，新评估使用新的 active version；
5. 重评创建新运行，不覆盖旧结果；
6. 交给面试/筛选等下游的必须是精确 active version、Requirement Snapshot 和 evidence expectations，而不是“最新版”模糊指代；
7. 下游无回复时显示 unknown，不显示虚构的 0。

## B9. 管理场景的角色成功标准

| 角色 | 成功标准 |
|---|---|
| Recruiter | 能从待办深链回到正确 Job/版本；能补全、分析、保存、提交并追踪发布；失败或未知结果可恢复 |
| Hiring Manager | 能确认岗位目标、职责、成功标准和关键取舍；能看到待确认、待审批、急需发布和超时岗位 |
| HR Approver | 审批时看到精确冻结版本、差异、风险和影响；能批准/退回/拒绝并留下可追溯决策 |
| Viewer | 只看到获授权的有效标准和任务；使用正确 snapshot；不能修改、审批或看到敏感字段 |

## 5. 角色交接矩阵

| 交接 | 发起角色 | 接收角色 | 版本化交接对象 | 审查重点 |
|---|---|---|---|---|
| 招聘意图 → 创建草稿 | Hiring Manager / Recruiter | Recruiter | 结构化字段、来源、置信度、Unknown | 是否保留原始输入，不把推断当事实 |
| 草稿 → 业务确认 | Recruiter | Hiring Manager | JRP 草稿、职责、要求、成功标准、冲突、diff | 是否清楚哪些内容等待确认 |
| 草稿 → 审批 | Recruiter | HR Approver | 冻结候选版本、Analysis、阻断项、可见范围、hash | 是否绕过阻断或审批权限 |
| 审批结果 → 激活/编辑 | HR Approver | Recruiter | approved / changes requested / rejected 版本 | 决策人、理由和下一步是否明确 |
| 有效标准 → 下游评估 | Recruiter / Hiring Manager | Viewer/评估者 | active version、Requirement Snapshot、evidence expectations | 是否使用正确 snapshot，是否越权 |
| 重大变化 → 影响复核 | Recruiter | Hiring Manager / HR Approver / 下游负责人 | 旧/新差异、受影响对象、处理选择 | 是否显示 unknown 而非虚构影响数量 |
| External JD → 渠道 | Recruiter | 外部渠道/候选人 | 精确 external JD version、审批状态、公开预览 | 是否泄露 restricted、错用版本或未经批准发布 |

## 6. AI Review 输入格式

AI 审查必须同时获得角色、场景、页面状态和本 User Journey，不应只看截图或代码：

```yaml
journey_id: A-CJ-01 | B-MJ-01
scenario: create | manage
module: JD Management
role: Recruiter | Hiring Manager | HR Approver | Viewer
goal: "角色登录后要完成的业务结果"
entry: "登录后的首页、Job Library、Create a Job 或 Job Workspace"
mode: create | edit | analyze | approval | activation | publication | viewer
preconditions:
  - "权限、Job 状态、已有材料、版本或任务"
steps:
  - id: 1
    user_action: "用户动作"
    expected_ui: "可观察页面、字段、状态或按钮"
    decision: "用户需要判断什么"
    permission_check: "允许/拒绝的字段和动作"
    recovery: "失败、取消、超时或无权限时的路径"
agent_check:
  - "来源、置信度、Unknown、diff、确认边界"
handoff:
  to_role: "下一个角色"
  artifact: "Job/JRP/JDVersion/Snapshot/Task/ApprovalCandidate"
success_criteria:
  - "可验证的完成结果"
open_questions: []
```

### AI Review 必查项

1. 当前角色是否知道自己是谁、为什么进入页面、当前处于创建还是管理模式？
2. 创建入口是否容易理解，能一步完成的动作是否被拆成多步？
3. Agent 是否只追问缺失信息，支持一次回答多个问题，并保留 Unknown？
4. 生成内容是否区分用户输入、来源材料、Agent 推断、建议和正式数据？
5. 编辑、招聘问答、市场调研、Analyze、审批和发布模式是否清楚可切换？
6. 应用、保存、提交、批准、激活和发布是否都由正确角色显式触发？
7. 是否显示 diff、来源、置信度、版本、操作者、时间、截止时间和下一步？
8. 阻断、需要确认、优化建议、失败和未知结果是否被正确区分？
9. 不同角色是否只能执行授权动作，Viewer 是否看不到敏感字段或伪按钮？
10. 版本变化是否触发正确审批和 Impact Review；下游是否拿到精确 snapshot？
11. 上传、链接、语音、网络、权限和 Core 超时是否可恢复且不编造成功？
12. 是否存在未经人工确认的审批、激活、发布、撤回或外部通知？

## 7. 统一完成标准

- Recruiter、Hiring Manager、HR Approver、Viewer 的登录目的和权限清楚；
- 五种创建方式都能从 `Create a Job` 首页进入，并完成草稿或保存职位；
- 创建时关键字段、来源、置信度、缺失项和待确认项可见；
- 草稿和修改以建议/diff 呈现，未确认前不写入正式数据；
- Analyze 区分阻断、需要确认和优化建议；阻断存在时不能提交审批；
- 保存、提交审批、批准、激活和发布均需正确角色显式操作；
- Internal JD、External JD、restricted 信息和版本边界清楚；
- 首页和任务列表显示负责人、截止时间、待我处理、逾期和下一步；
- 失败、权限不足、网络中断、未知结果和并发冲突都有恢复路径；
- 每次建议、应用、审批、激活和交付都保留来源、时间、操作者、版本和业务回执；
- 下游评估使用精确 Requirement Snapshot，历史结果不被新版本静默覆盖。

## 8. 待确认事项

- AI 默认值是否需要在界面显式标注为“默认”；
- PDF/DOCX 解析能力、失败标准和上传限制；
- 粘贴正文识别阈值以及外部链接抓取授权/版权边界；
- 无法推断职位名称时是否一律追问；
- Viewer 是否可以评论，还是完全只读；
- 薪资市场调研和对标 JD 能力何时纳入 Agent 入口；
- 审批超时规则、审批人配置和提交阻断策略；
- JD 完成截止时间和计划发布时间是否分开；
- 面试/筛选下游由 JD 还是下游模块维护“已招到人/关闭”状态。

## 9. 版本记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.0 | 2026-10-13 | 合并 Agent 创建模块 User Journey v1.0 与 JD Management 角色 User Journey v1.1，统一四类角色并按创建/管理两大场景重组 |
