# W03 测评项目与候选人关联线上测试报告（2026-10-16）

## 勘误：现行入口是 My Tasks（2026-10-16 复核）

用户确认 **Assessments 模块已移除，创建任务入口改为 My Tasks 右上角**。下文第 1–6 节保留了针对旧 `Assessments` 路由的原始探索记录和截图，**其「不通过、3 失败/9 阻塞」统计及 W03-LIVE-01/02/03 不能作为现行创建流程的缺陷结论**。先前按旧路由起草的「无法创建测评项目」「从 JD 起草」「Import 演示」「缺少 Create assessment 入口」四条 Bug 草稿全部撤回；旧路由的 Demo 行为仍是事实，但不应要求恢复已移除模块。

现行线上入口为 [My Tasks](https://hireos.aipollo.me/hireos/written/tasks)。右上角 `+ New written test` 可打开 `Start with a job description` 弹窗，提供 `Paste a new JD` 和 `Choose an existing job` 两种方式，且候选人简历标为必填。空表单点击 `Create task` 显示 `Provide a job description.`；切到现有岗位后，岗位检索两次均显示 `The shared records service is unavailable. Please retry later.`。未准备隔离 JD/简历测试数据，未提交创建请求，因此**实际创建、持久化、幂等和候选人关联仍未验证**。现有 [W03 PRD](PRD.md) 的「目标-only 项目、无候选人项目」与现行任务先行弹窗不一致，需更新需求和用例后再给 W03 当前流程验收结论。

| 新证据 | 内容 |
|---|---|
| E09 | [My Tasks 创建弹窗](evidence/2026-10-16/06-my-tasks-create-modal.jpg)：线上可见入口、新 JD 与必填简历 |
| E10 | [现有岗位检索错误](evidence/2026-10-16/07-my-tasks-existing-job-unavailable.jpg)：共享主档服务不可用；当前仅可确认环境/依赖阻塞，未查到根因 |
| E11 | [缺 JD 校验](evidence/2026-10-16/08-my-tasks-jd-required.jpg)：空表单提示 `Provide a job description.` |
| E12 | [My Tasks 实现](../../../../hireos-written/hireos-written-front/src/pages/TasksPage.tsx)：第 155–158 行提供 `+ New written test` 与创建弹窗；[弹窗实现](../../../../hireos-written/hireos-written-front/src/components/CreateWrittenTaskModal.tsx) 提供两种 JD 模式和简历必填。代码不是线上构建身份凭证 |

本勘误优先于下文旧路由结论。下文用例/AC/UX 状态是**旧规格与旧页面的历史对照**，不应提交为当前 Bug 或用于计算当前通过率。

## 1. 旧 Assessments 路由的原始结论与范围（已被勘误取代）

**结论：不通过（fail）。** 线上 `Assessments` 显示「No assessment projects yet.」。点击 `Create project`、`Draft a project from this JD` 均只显示 Demo 提示，没有创建表单、项目草稿或可继续的详情页。主任务在项目入口即被阻断。12 条用例中 **3 条失败、9 条阻塞、0 条通过**；阻塞项不能被解释为功能通过或已复现服务端缺陷。

| 项 | 本轮记录 |
|---|---|
| 线上入口 | [Assessments](https://hireos.aipollo.me/hireos/written/assessments)；[项目详情路由](https://hireos.aipollo.me/hireos/written/assessments/prj_fin) |
| 时间/时区 | 2026-10-16 约 11:54–11:58，Asia/Shanghai；健康响应见 E05 的 UTC 时间戳 |
| 身份与设备 | 已登录页面显示「蔡敏」；Chrome 桌面视口 1176×719；页面为英文 UI；W03 细粒度角色权限未取得 |
| 规格 | [PRD](PRD.md)、[User Cases](User_Cases.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[Written Test 公共约定](../README.md)；[UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) |
| 线上数据 | 0 个可见测评项目；「Other open roles」有 3 个岗位，均显示 `No job link on file`；未取得 `S0_employer`、`S_screened_candidates`、Core Profile v2 等指定 seed |
| 代码参照 | 本地 `c4b610500d33a279c03251091c5f0af13b831318`；**不是线上构建 SHA**。代码只用于解释可见行为，线上结论以截图/页面为准 |
| GitHub 对象 | 未提供 W03 主 Issue/PR；按 W03/测评项目关键词未识别到可确认的主 Issue。本报告是线上探索测试，不冒充合并后正式 QA，也不虚构 `qa.json` 的 Issue/PR/commit 身份 |
| 数据变更 | 未创建候选人、Application、Case、项目或邀请；未修改已有记录、发送邮件或注入服务故障。点击演示入口后刷新列表仍为空 |

本标准原适用 JD Management；本报告复用其用户旅程、U1–U10、证据要求与 P0–P3 分级，不把 JD 专属审批、激活、发布字段套用到 W03。页面证据不能证明数据库、Core 权限、幂等或真实发信。未取得线上业务 API 的认证调试会话、只读数据库、服务端日志、受控故障注入或隔离测试 seed。未运行本地 build/lint/type/unit/integration；它们不能被记为线上测试通过。

## 2. 证据索引与执行记录

| 编号 | 证据 | 操作与观察 |
|---|---|---|
| E01 | [项目列表与 Create project 提示](evidence/2026-10-16/01-create-project-demo.jpg) | 打开列表后点击 `Create project`；页面仍为 0 项目，只出现 `Demo: a target/JD-only project can be drafted with no Job or Application yet.`，无表单 |
| E02 | [从 JD 起草提示](evidence/2026-10-16/02-draft-jd-demo.jpg) | 对「AI 工具产品经理」点击 `Draft a project from this JD`；只出现 `Demo: would draft a JD-only Assessment project...`，无草稿/跳转 |
| E03 | [Import 提示](evidence/2026-10-16/03-import-demo-toast.jpg) | 点击 `Import`；只出现 `Demo: import historical assessment summary (approximate, unverified scores only).`，无上传/预览 |
| E04 | [项目详情不可达](evidence/2026-10-16/04-project-not-found.jpg) | 访问规格中的 `prj_fin` 详情路由；显示 `Project not found.`；该 ID 未作为线上项目展示，不能据此判断任意真实项目损坏 |
| E05 | [线上 Written 后端健康响应](evidence/2026-10-16/05-health.txt) | `curl -sS --max-time 15 -w ... https://hireos.aipollo.me/hireos/written/api/health`；HTTP 200、`phase-0`；仅证明健康端点可达 |
| E06 | [列表实现](../../../../hireos-written/hireos-written-front/src/pages/AssessmentsListPage.tsx) | 本地代码第 20–21、63 行将三个主按钮接到 Demo 文案；第 25 行为空态分支 |
| E07 | [详情实现](../../../../hireos-written/hireos-written-front/src/pages/ProjectDetailPage.tsx) | 本地代码第 20–21 行在目标项目/岗位缺失时显示 `Project not found.`；第 34–42 行的候选人动作只显示成功提示，无真实 Core 调用；此为代码风险，因线上详情不可达，未记为线上复现 |
| E08 | [Screening 交接实现](../../../../hireos-written/hireos-written-backend/src/intake/screening-handoff.service.ts) | 本地代码第 19–46 行用 upsert 写本地 Candidate/Job/Case/Task；不能替代线上重复投递的实际数量校验，也未证明 `application_id` / `file_version_id` 保真 |

E01–E04 是线上 Chrome 页面截图；E05 是线上只读 HTTP 请求；E06–E08 是本地提交的代码定位。二者证据等级不同。

## 3. 旧 W03 规格的 12 条 User Cases 原始结果（当前须重测）

| 用例 | 结果 | 实际执行与证据 | 尚需验证或解除条件 |
|---|---|---|---|
| UC-W03-01 项目列表统计列 | **阻塞** | 项目列表为空，只见空状态与 3 个 Other open roles（E01） | 注入 `prj_fin`、case_a–d 后核必评/选评、人数、Awaiting、Issues、Results；空列表不能证明统计错误 |
| UC-W03-02 只有目标也能创建项目 | **失败** | 点击 `Create project` 只有 Demo 提示，无名称/目标输入、创建、题库入口（E01） | 实现项目创建后，用 `project_goal_only` 和 `project_with_job` 核 UI、Core Job 引用与无 Application 的 DB/API 证据 |
| UC-W03-03 从 JD 起草项目 | **失败** | 点击岗位卡片按钮只有 Demo 提示，未生成草稿（E02） | 提供有 Core Job/JD 的测试岗位，核预填目标、草稿与引用；当前 3 个卡片均提示无 Job link |
| UC-W03-04 未确认关系不能邀请 | **阻塞** | 无可达项目详情，无法打开 Add candidate；`prj_fin` 显示 not found（E04） | 隔离项目、新候选人身份、Core 只读核验、邀请 API 4xx 检查；不能从本地 fixture 文案推断线上门禁 |
| UC-W03-05 Confirm link 唯一 Application | **阻塞** | 无可达项目与 Confirm link 入口（E04） | 提供未关联 Core Candidate、可核 Application/Case 数量和双击注入能力 |
| UC-W03-06 已关联候选人复用 | **阻塞** | 无可达项目与 Alex 关联 seed（E01、E04） | 已关联候选人 seed、操作前后 Core 数量与 Case 引用 |
| UC-W03-07 Core 不可用 | **阻塞** | 无候选人创建路径，也无受控 `core_unavailable` 注入（E04） | 在隔离线上环境注入故障，核错误文案、Retry、草稿保留及 Core/本地无半成品 |
| UC-W03-08 Core 响应丢失对账 | **阻塞** | 无候选人创建路径、request_id 记录或 `core_response_lost` 注入（E04） | 受控丢响应、Core 只读计数及同 request_id 恢复日志 |
| UC-W03-09 从 Screening 选择复用公共 ID | **阻塞** | 无可达项目；未取得 `S_screened_candidates`（E01、E04） | 提供 2 人 seed，核 `candidate_id`、`application_id`、`file_version_id` 与来源一致；无候选人时核指定空态 |
| UC-W03-10 重复交接不重复建 Case | **阻塞** | 健康接口 HTTP 200（E05）；未对生产 `POST /intake/screening-handoff` 做写入，也无 DB 计数权限 | 使用隔离 workspace、有效 Core ID、两次同请求及 Case/Task 数量前后证据；E08 的 upsert 不能视作线上通过 |
| UC-W03-11 快速创建向导 | **失败/后续阻塞** | 列表无 `Create assessment` 向导入口，只有 Create project/Import（E01）；无项目可继续。当前代码也未发现该向导入口（E06） | 实现向导并注入两名已关联候选人、FIN-001；分别核缺项提示、两封独立邀请及首轮；发送需 simulation adapter 证据 |
| UC-W03-12 Profile v2 待复核 | **阻塞** | 无已评分 Case 可达，也未注入 Profile v2（E01、E04） | 提供 `S_result_final_unreleased`、Core v1→v2 变更及旧分只读证据 |

本轮覆盖 W03a 的 P1–P3 入口（失败）；W03b 的 P4–P8 与 W03c 的 P9–P14 因前置项目/seed/注入能力缺失未走到终态。没有把点击演示按钮折算为项目创建成功。

## 4. 旧 Acceptance Criteria 与业务规则（当前须更新规格）

| AC | 结论 | 证据与缺口 |
|---|---|
| AC-1 只有目标即可创建项目和题库草稿 | **失败** | Create project 只给 Demo 提示（E01）；项目和题库草稿均无法创建 |
| AC-2 未确认关系禁邀并解释原因 | **阻塞** | 项目详情不可达（E04）；需 UI 禁用状态与直接邀请 API 4xx 双证据 |
| AC-3 Confirm link 唯一 Application | **阻塞** | 无入口/seed；需双击后 Core 数量、Case 引用和 request_id 证据 |
| AC-4 响应丢失进入 Reconciling 且数量不变 | **阻塞** | 无受控故障注入与 Core 计数；不能由代码意图判通过 |
| AC-5 Screening 复用三个公共 ID | **阻塞** | 无可达项目/筛选 seed；本地交接代码只展示部分 upsert（E08），未实际核三个 ID |
| AC-6 Profile v2 后旧评分标 v1、待复核、不改分 | **阻塞** | 无 Case/Profile seed 与评分数据 |
| AC-7 Core 不可用时保留草稿且不显示已创建 | **阻塞** | 创建入口不可达，无故障注入；需 UI + Core/本地计数 |

FR-1 的统计、FR-3/4/5 的项目详情、FR-6 的向导和 BR-3/4/5 的权限/幂等都未获得线上行为证据。E08 表明本地实现使用本地 Candidate/Job 写入，与 W03 PRD 的「Core 唯一写入方」存在需产品/架构确认的差异；这不是通过本轮线上 UI 测出的数据污染。

## 5. 旧 Assessments 用户旅程的 UX/UI 审查（不作当前 Bug 结论）

角色目标：HR / Recruiter 为岗位或能力目标建立测评项目，确认候选人与岗位关系，再准备邀请；Hiring Manager 可查看项目状态与结果。线上旅程仅到「Assessments 空态 → 点击 Create project / Draft from JD → Demo 提示」，没有下一步或交接对象。按指定标准，**存在 P0，verdict=fail**。

| 标准 | 结论 | 证据、影响与限制 |
|---|---|---|
| U1 容易理解 | **失败** | 3 个岗位卡片同时写 `No job link on file` 与 `Draft a project from this JD`，用户无法确认起草引用哪个 JD（E01、E02） |
| U2 容易上手 | **失败** | 空态只说没有项目；突出 Create project，但点击无表单或示例可继续（E01） |
| U3 快速完成任务 | **失败** | 项目创建与 JD 起草都停在 Demo toast，核心任务无法完成（E01、E02） |
| U4 下一步明确 | **失败** | 演示提示未给草稿、负责人、后续题库/候选人入口（E01、E02） |
| U5 提示和按钮清楚 | **失败** | `Create project` / `Draft...` / `Import` 看似执行动作，实际只显示演示说明；Import 未选择文件（E01–E03） |
| U6 符合真实工作方式 | **失败** | 无法先建目标或 JD 项目，再关联候选人；主工作流中断（E01、E04） |
| U7 信息结构符合角色目标 | **失败** | 空态未提供可执行下一步；无项目统计、待处理人数/状态可供 HR 判断（E01；统计准确性本身未验证） |
| U8 减少来回跳转 | **未验证** | 无可达项目详情，不能测试返回列表后的筛选/位置/上下文 |
| U9 可恢复和可预期 | **未验证** | `core_unavailable`、`core_response_lost`、重复点击和权限变化均未受控测试；Demo toast 不能代表业务成功或失败恢复 |
| U10 可访问、可读和可操作 | **部分/未验证** | 当前主按钮在可访问树中有名称，状态文字不只靠颜色；未测 200% 缩放、完整键盘顺序、焦点回置、对比度或项目抽屉 |

### 可复现问题与修复验收

| ID / 严重度 | 旅程步骤、复现与实际 | 用户影响与最小修复 | 复验条件 |
|---|---|---|---|
| W03-LIVE-01 / **P0** | 步骤 2、3：点击 Create project 或 Draft from JD，只见 Demo toast，仍为 0 项目（E01、E02） | HR 无法开始 W03 主流程；接入真实 AssessmentProject 创建/起草，明确目标或 Core Job 引用 | 目标-only 与 JD 两条路径各生成可再打开的项目；前者无需 Candidate/Application；刷新后仍在，API/DB 与 UI 一致 |
| W03-LIVE-02 / **P1** | 步骤 1：3 个 Other open roles 均提示 `No job link on file`，却提供 `Draft...from this JD`（E01、E02） | 用户不知道是否存在可引用 JD，按钮承诺与对象状态冲突；展示可核的 Core Job/JD 引用或禁用并解释原因 | 有引用时可查看来源、生成草稿；无引用时不会暗示已关联 JD |
| W03-LIVE-03 / **P2** | 列表辅助操作：Import 只弹 Demo 提示，无文件/摘要选择（E03） | 历史摘要导入不可完成且按钮未表明仅演示；实现预览/确认或明确禁用该入口 | 指定历史摘要可预览来源和近似/未验证分数，确认前不产生业务记录；若未提供此能力，入口清楚标为不可用 |
| W03-LIVE-04 / **P1，代码待线上复现** | 步骤 5、8：本地详情代码 `createCandidate` 与 `createFromScreening` 直接显示成功提示（E07） | 一旦详情可达，可能把未写入 Core/Case 的操作说成完成；需服务端确认后展示结果和引用 | 用隔离项目执行并核 Core/Case 数量及失败路径；上线构建与本地代码一致性需先确认 |

W03-LIVE-04 是**源码风险**，不是本轮线上复现 Bug；E04 阻断其线上执行。W03-LIVE-01 与 02 为实际页面行为，P0/P1 按标准中核心任务阻断与决策风险分级。

### 标准结构化审查记录

```yaml
review:
  product: "Written Test / W03 Project Candidate Linking"
  surface: "Assessments 列表、项目创建/JD 起草入口、项目详情路由"
  role: "HR / Recruiter；Hiring Manager（详情未验证）"
  journey_goal: "建立测评项目，确认候选人与岗位关系并准备独立邀请"
  evidence:
    source: "线上 Chrome 页面、可访问树、E01–E04 截图；E05 健康请求；E06–E08 本地代码"
    steps_checked: [1, 2, 3, 4]
  verdict: "fail"
  findings:
    - id: "W03-LIVE-01"
      severity: "P0"
      category: "state"
      step: 2
      title: "项目创建与 JD 起草只返回 Demo 提示"
      evidence: "E01、E02：点击后无表单/草稿，列表仍为空"
      user_impact: "HR 无法启动测评项目主流程"
      recommendation: "接入项目创建和持久化，并提供可继续的详情"
      acceptance_check: "目标-only、JD 两条路径分别创建可刷新、可打开的项目"
    - id: "W03-LIVE-02"
      severity: "P1"
      category: "clarity"
      step: 3
      title: "无 Job link 的岗位仍提示从 JD 起草"
      evidence: "E01、E02：3 个卡片均无 Job link，按钮仍可点击"
      user_impact: "HR 无法判断项目会引用哪个 JD"
      recommendation: "显示有效 Core Job/JD 来源；缺失时解释并限制起草"
      acceptance_check: "草稿引用可核来源；缺失引用不产生误导"
    - id: "W03-LIVE-03"
      severity: "P2"
      category: "clarity"
      step: 1
      title: "Import 按钮只有演示提示"
      evidence: "E03：点击后无导入选择或预览"
      user_impact: "无法导入历史摘要，用户可能误解按钮能力"
      recommendation: "实现导入或明确标示暂不可用"
      acceptance_check: "导入前可核来源与近似分数，或入口明确禁用"
  usability_check:
    understandable: "fail"
    learnable: "fail"
    efficient: "fail"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "fail"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "无 W03 主 Issue/PR 和线上构建 SHA，不能按 QA Schema 生成正式报告"
    - "无 S0_employer、Screening、Core Profile seed；无认证业务 API/DB/日志及受控故障注入"
    - "项目详情不可达；权限、持久化、幂等、真实发信及 200%/键盘未验证"
```

## 6. 原复测准备与交接（以勘误中的现行入口为准）

1. 先修通项目目标-only 与 JD 创建路径，并展示可持续访问的项目详情；提供线上构建 SHA。优先复测 AC-1、UC-W03-02/03，再运行依赖项目的其他用例。
2. 准备隔离 workspace 与 [公共约定](../README.md#公共约定) 中的 `S0_employer`、`S_core_candidate_unlinked`、`S_screened_candidates`、`S_result_final_unreleased`；测试人名加 `[UJ-TEST]`、邮箱用 `example.com`，发信走 `simulation_only`，提供清理方案。
3. 提供 Core/Screening 的只读 API 或数据库计数、request_id/交接日志及受控 `core_unavailable`、`core_response_lost` 注入，逐项核 AC-2–AC-7 和 BR-3–BR-5；未经这些证据不能宣称权限、唯一性或资料引用正确。
4. 产品需确认 PRD「待确认」中的本地 Candidate/Job 与 Core 主档冲突、AssessmentProject 实体、快速向导与 W05 Composer 的关系。决定应记录到关联 Issue/PR；本轮不代替产品作决定。
5. 明确 W03 主 Issue/PR 与验收提交后，再按仓库 `.github/schemas/qa.json` 输出正式 QA 报告。此次没有伪造关联编号或线上构建身份，也未向 GitHub 发布评论或创建 Issue。
