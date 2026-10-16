# W07 提交收件与 Submission Inbox 线上测试报告（2026-10-16）

## 1. 结论与范围

**结论：不通过（fail，W07 核心流程未具备可执行条件）。** 线上 `Submission Inbox` 仅显示标题和说明，没有邮件、状态分组、空状态或处理入口；一条真实文本提交可在 Case 的 `Submission` 页查看，但该页只显示题目、答案和 Received 时间，不具备 W07 规定的邮件收件与文件证据详情。13 条 User Cases 中 **0 通过、2 条可见部分失败、11 条阻塞/未验证**。其中「阻塞」表示没有所需邮件注入、隔离 seed、角色或服务端核验能力，不表示这些场景已在线上复现故障。

| 项 | 本轮记录 |
|---|---|
| 环境与时间 | [HireOS Written 线上环境](https://hireos.aipollo.me/hireos/written/submissions)，2026-10-16 约 12:00–12:02，Asia/Shanghai；Chrome 桌面 1176×719，英文界面 |
| 身份 | 顶栏显示「蔡敏」；My Tasks 页面同时显示 `Signed in as John · HR Head · Aurora Studio`。身份/角色来源不一致，不能据此推定实际授权范围 |
| 规格 | [PRD](PRD.md)、[User Cases](User_Cases.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[公共约定](../README.md)、[UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)；本标准原适用 JD Management，本报告复用其旅程、U1–U10、证据与 P0–P3 分级，不套用 JD 专属业务字段 |
| 数据 | Inbox 无可见邮件；My Tasks 有 4 条任务、Pending submission 为 0、Pending release 为 1；从后者进入一条已有真实文本答案提交。未获得 W07 指定的 `case_b`、`case_c`、`case_d`、模拟邮件和跨 workspace 身份 |
| GitHub 与提交 | 未提供 W07 主 Issue/PR；按 `W07`、`Submission Inbox` 检索未找到可确认主 Issue。源码参照本地 `c4b610500d33a279c03251091c5f0af13b831318`，**不是线上构建 SHA**。本报告是线上探索测试，不冒充合并后的正式 QA，也不虚构 `qa.json` 身份 |
| 数据操作 | 只读浏览页面和健康接口。未向真实邮箱发信、上传附件、改变候选人提交、评分或任务状态，也未做故障注入 |

## 2. 证据索引与执行记录

| ID | 证据 | 操作与观察 |
|---|---|---|
| E01 | [线上 Inbox 截图](evidence/2026-10-16/01-submission-inbox-empty.png) | 打开 `/hireos/written/submissions`；仅标题和「Task and status match first...」说明，页面其余区域空白；没有邮件卡片、分组或空状态 |
| E02 | 真实 Submission 截图（本地证据，含个人信息，未入库） | 从 My Tasks 的 Pending release Case 进入 Submission；显示 Submitted、Received 时间、题目和候选人文本答案、Go to evaluation；没有 Processed、原始 ZIP、逐项文件、Candidate/Round/Task binding。截图包含线上候选人资料，仅留在本地证据目录 |
| E03 | [My Tasks 截图](evidence/2026-10-16/03-my-tasks.png) | 任务总数 4，Pending submission 0，Pending release 1；页面身份文案与顶栏不一致；未见 Submission issues 卡片 |
| E04 | [健康检查原始记录](evidence/2026-10-16/04-health.txt) | `GET /hireos/written/api/health` HTTP 200，`phase-0`；仅证明健康端点可达 |
| E05 | [Inbox 前端源码](../../../../hireos-written/hireos-written-front/src/pages/SubmissionInboxPage.tsx) | 本地源码使用内存 `MAIL`；Confirm assignment 只改组件 state，Not a match 和 Request missing files 只显示 toast；是代码参照，未在线上执行这些按钮 |
| E06 | [fixture 定义](../../../../hireos-written/hireos-written-front/src/data/fixtures.ts) | 本地 `MAIL`、`ATTEMPTS`、`CORE_FILES` 初始化为空（约第 124、142、82 行）；可解释本地构建的空列表，但不能单独证明线上构建 SHA |
| E07 | [实际提交渲染](../../../../hireos-written/hireos-written-front/src/pages/SubmissionDetailPage.tsx) | 本地 `RealSubmissionContent` 仅接收 questions、answers、submittedAt；与 E02 观察一致。另一个原型详情分支含模拟下载/预览 toast，不是 E02 的真实数据路径 |
| E08 | [后端邮件服务](../../../../hireos-written/hireos-written-backend/src/mail-accounts/mail.service.ts) | 本地源码第 4–8 行明确为 SMTP 发信半部；本轮未找到收件消费控制器。源码覆盖不等于线上部署确认 |

线上截图和健康响应是运行环境证据；E05–E08 是本地源码佐证，不能把后者当作线上执行通过。健康接口不能证明邮箱连接、收件消费、权限或数据库事务正常。

## 3. User Cases 逐项结果

| 用例 | 结果 | 实际观察/阻塞原因 | 解除条件与复验 |
|---|---|---|---|
| UC-W07-01 Inbox 分组与技术细节 | **部分失败** | E01：无邮件时整页空白，没有可读空状态或下一步；有数据时的六类分组、详情和 Technical details 无法测试 | 注入六类隔离邮件，核组别、数量、详情层级和 Operations 技术字段 |
| UC-W07-02 完整邮件自动提交与两封回执 | **阻塞** | 无 `mail_complete` 注入、连接 hr@ 的模拟收件服务、回执 adapter 或 Response/Task 只读证据；E01 为空 | 提供 `S_inv_accepted_deadline`、mock ingress、simulation_only 回执及 DB/API 计数 |
| UC-W07-03 扫描延迟按可信时间 | **阻塞** | 无 `mail_late_scan` 与 `mail_scan_delay` 注入及 Received/Processed 日志 | 截止前收件、截止后扫描，核按时判定与两时间 |
| UC-W07-04 身份/线程不清 | **阻塞** | 无错误邮箱、旧轮、双岗位、无线程四封模拟邮件；空 Inbox 不能证明分类正确 | 分别注入四种邮件，核原因、未提交和不落最近轮次 |
| UC-W07-05 人工确认归属 | **阻塞** | E01 无 Needs confirmation 项；无法操作 Confirm assignment；E05 仅说明本地组件 state 行为 | 提供可处理邮件和 Case/Round，确认后核邮件绑定、审计和持久提交 |
| UC-W07-06 咨询/自动回复不算提交 | **阻塞** | 无咨询、自动回复邮件和 Not a match 入口 | 注入两封邮件，核非提交、待处理移除、Response 数量不变 |
| UC-W07-07 缺件、通知与恢复 | **阻塞** | 无缺 xlsx 邮件、IssueGroup、补件通知 adapter 和补发事件 | 使用 `S_inv_started_missing`，核 Missing、请求通知、问题组关闭和最后必需件时间 |
| UC-W07-08 可疑附件隔离 | **阻塞** | 无 SPF 失败 + xlsm 的安全模拟附件；未在真实环境投递恶意文件 | 隔离环境注入无害模拟文件，核 Quarantined、Operations 记录、未执行/未提交 |
| UC-W07-09 邮件与上传去重 | **阻塞** | 无相同 hash 的 Portal/邮件双通道文件与提交/评分任务计数 | 隔离 workspace 内双通道投递，核 Duplicate、1 个 Response/评分任务 |
| UC-W07-10 提交后不同版本不覆盖 | **阻塞** | 无已提交文件版本与 `mail_conflict`，E02 是文本答案 | 注入不同附件，核左右差异、原提交和 AI draft 不变、修订/更正动作 |
| UC-W07-11 Submission 详情 | **部分失败** | E02 确认真实文本提交可读、Received 和 Go to evaluation 可见；缺 Processed、原始 ZIP、文件逐项、身份/轮次/任务绑定。指定的 Taylor/xlsx seed 未提供，故文件路径仍未验证 | 提供含 ZIP/xlsx 的真实提交，核下载、Preview/Missing、绑定及双时间；区分文本提交与文件提交的设计范围 |
| UC-W07-12 Excel 证据 | **阻塞** | 无 xlsx、Evidence API 或计算状态，不能判断公式/缓存值行为 | 注入公式文件，核工作表/单元格/公式/缓存值及 `Calculation not verified` |
| UC-W07-13 跨 workspace 隔离 | **阻塞** | 仅一个当前会话，无 `hr_other_ws`、`hr_restricted` 或 API 权限核验 | 两个受控账号 + `mail_cross_ws`，同时核 UI 不可见与 API 拒绝 |

“部分失败”只针对本轮确实可观察到的空状态与真实提交详情。其余预期结果未获得执行条件，不根据本地源码给出线上通过/失败结论。

## 4. Acceptance Criteria 与关键规则

| AC | 结论 | 证据与缺口 |
|---|---|---|
| AC-1 完整邮件自动提交、双时间 | **未验证/未满足发布门槛** | E01 无收件记录；E02 只有文本提交的 Received，无 Processed。缺邮件注入、回执、DB 和任务队列证据 |
| AC-2 邮件与上传只产生一次提交 | **未验证** | 无双通道同文件与提交数量核验 |
| AC-3 后到不同附件不覆盖 | **未验证** | 无文件版本冲突 seed 与前后快照 |
| AC-4 异常分类与补件恢复 | **未验证** | 无四类模拟邮件、IssueGroup、隔离审计与补件通知 |
| AC-5 双岗位/旧轮/无线程不误归属 | **未验证** | 无双岗位、旧轮、其他 workspace 账号及 API 权限证据 |
| AC-6 扫描延迟仍按可信收件时间 | **未验证** | 无可控收件/扫描时间与期限判定日志 |
| AC-7 Excel 公式与未验证计算状态 | **未验证** | 无 xlsx 与 Evidence 定位数据 |

FR-1 的空态可用性及 FR-9 的真实详情信息有线上可见差距（E01–E02）。BR-1 自动提交、BR-4 旧轮隔离、BR-5 期限、BR-7 去重、BR-8 宏与外链安全、§6 权限、断连恢复均没有线上行为证据。PRD 尚待确认收件过渡方案、补件通知触发方式与 Duplicate 判定依据；这些决定应进入关联 Issue，不由测试报告替代。

## 5. 按用户旅程的 UX/UI 审查

**角色/目标**：HR 识别候选人提交归属、优先处理缺件/不明身份/风险邮件，确认可进入评分；Operations 处理隔离邮件。线上仅完成「打开 Inbox → 看到空白」和「从 My Tasks 打开一条真实文本提交」。未到达旅程步骤 2–8、10。按指定标准，当前有核心任务入口 P0，**verdict=fail**。

| 标准 | 结论 | 证据与影响 |
|---|---|---|
| U1 容易理解 | **失败** | E01 有标题但无状态、数量或原因；用户无法知道真无邮件、加载失败还是未连接收件箱 |
| U2 容易上手 | **失败** | E01 无空态引导、连接状态、样例或可执行下一步 |
| U3 快速完成任务 | **失败** | E01 无邮件可处理；E02 的提交详情另在 Case 内，Inbox 无对应入口或交接 |
| U4 下一步明确 | **失败** | E01 无待处理对象、负责人、期限或下一步；E02 有 Go to evaluation，但缺证据齐全/可评分判定 |
| U5 提示和按钮清楚 | **部分/未验证** | E02 的 Go to evaluation 可读；Inbox 无主要控件；确认归属、补件和隔离动作无线上实例 |
| U6 符合真实工作方式 | **失败** | E01 不能处理 HR 统一邮箱的待确认、缺件或隔离邮件；E02 仅覆盖文本答案 |
| U7 信息结构符合角色目标 | **失败** | Inbox 无优先级/状态分组；E03 顶栏身份与工作台身份不同，当前角色与权限范围不清 |
| U8 减少跳转/重复输入 | **未验证** | 无 Inbox 列表→详情→返回的完整路径 |
| U9 可恢复和可预期 | **失败/未验证** | E01 无空态/故障区分或重试；断连、超时、并发和重复投递未受控测试 |
| U10 可访问、可读和可操作 | **部分/未验证** | E01 标题/说明在可访问树中有文本；无邮件主操作可测。未做 200% 缩放、键盘焦点顺序与弹窗管理验证 |

### 可复现发现与复验标准

| ID / 严重度 | 旅程步骤与实际 | 用户影响及最小修复 | 复验 |
|---|---|---|---|
| W07-LIVE-01 / **P0** | 步骤 1：Inbox 只显示标题和一句说明，既无业务记录也无空态（E01）；本地收件组件只读取空 `MAIL`，后端只有 SMTP 发信参照（E05、E06、E08） | HR 不能处理邮件提交；接入受控收件消费与持久列表，并清楚区分「无邮件」与「连接/加载失败」 | 使用六类模拟邮件核列表、分类、数量、详情和刷新后持久性；断连时显示状态/恢复动作 |
| W07-LIVE-02 / **P1** | 步骤 9：真实 Submission 只显示 Received 和文本答案，无 Processed、文件/绑定信息（E02、E07） | HR 不能按 W07 判断收件处理时间、必交物及所属轮次；按提交来源显示适用的证据与绑定，文件提交补齐双时间和文件清单 | 用文本提交和文件提交各一条复验；后者核 ZIP 下载、Preview/Missing、Case/Round/Task 绑定及时间 |
| W07-LIVE-03 / **P1，跨模块身份风险** | My Tasks 显示 Signed in as John，顶栏显示蔡敏（E03） | HR 无法确认当前工作区身份与授权范围；统一身份来源并展示明确角色/workspace | 同一会话跨 My Tasks/Inbox/Case 查看一致身份，换角色后权限和展示同步变化 |

E05–E08 只说明当前本地提交的实现形态，W07-LIVE-01 的线上复现范围限于空白 Inbox；尚未用模拟邮件证明线上消费逻辑的具体失败点。

```yaml
review:
  product: "Written Test / W07 Submission Intake"
  surface: "Submission Inbox、My Tasks、Case Submission"
  role: "HR / Recruiter；Operations 未登录验证"
  journey_goal: "正确识别并处理邮件提交、缺件和风险项，再交接评分"
  evidence:
    source: "线上 Chrome 截图 E01–E03；健康接口 E04；本地源码 E05–E08"
    steps_checked: [1, 9]
  verdict: "fail"
  findings:
    - id: "W07-LIVE-01"
      severity: "P0"
      category: "state"
      step: 1
      title: "Inbox 无可处理记录或空态"
      evidence: "E01；E05、E06、E08 为本地源码参照"
      user_impact: "HR 无法开展邮件提交收件处理"
      recommendation: "接入收件消费和持久列表，补齐空态/失败态"
      acceptance_check: "六类模拟邮件显示正确，刷新后仍在；断连有恢复入口"
    - id: "W07-LIVE-02"
      severity: "P1"
      category: "state"
      step: 9
      title: "真实 Submission 缺处理时间与证据绑定信息"
      evidence: "E02、E07"
      user_impact: "HR 难以核实交付物与所属轮次"
      recommendation: "按提交来源补齐适用的时间、文件和绑定视图"
      acceptance_check: "文本和文件提交均显示正确来源；文件提交可核双时间、文件和绑定"
    - id: "W07-LIVE-03"
      severity: "P1"
      category: "permissions"
      step: 1
      title: "页面身份文案不一致"
      evidence: "E03"
      user_impact: "无法确定当前操作对应的角色和 workspace"
      recommendation: "统一身份和工作区展示来源"
      acceptance_check: "同一会话各页面身份一致，切换角色后权限同步"
  usability_check:
    understandable: "fail"
    learnable: "fail"
    efficient: "fail"
    next_action_clear: "fail"
    controls_clear: "unknown"
    real_workflow_fit: "fail"
    role_information_fit: "fail"
    no_unnecessary_hops: "unknown"
    recoverable: "fail"
    accessible: "unknown"
  limits:
    - "无 W07 主 Issue/PR、线上构建 SHA、邮件模拟入口及指定 seed"
    - "无多角色、业务 API/DB、邮件 adapter 与受控故障注入"
    - "未测 200% 缩放、完整键盘和弹窗焦点"
```

## 6. 测试执行、风险与交接

| 项 | 状态 |
|---|---|
| 线上 UI | 已执行：Inbox、My Tasks、Case Submission 的只读浏览与截图 E01–E03 |
| 线上健康接口 | 已执行：`curl -sS --max-time 15 .../api/health`，退出码 0、HTTP 200（E04） |
| 邮件/附件/权限/异常注入 | **未执行**：无隔离 mock ingress、`simulation_only` adapter、指定 seed/账号、服务端只读核验能力 |
| build/lint/type/unit/integration | **未执行**：本轮为线上探索测试且未修改应用代码；不能写成通过，也不以本地 CI 替代线上业务验收 |
| 正式 QA Schema | 未生成 `evidence/qa.json`：没有主 Issue/PR、实际合并提交与 `evidence/context.json`，不能伪造身份或 AC 映射 |

优先提供受控测试 workspace、`case_b/c/d`、mock hr@ 邮件注入、文件扫描延迟、安全模拟附件、只读 Response/IssueGroup/MailConsumption/评分任务计数、两类回执的 simulation adapter，以及 HR/Operations/受限和其他 workspace 账号。先复测 AC-1、AC-4、UC-W07-01/11 的主流程与可用性，再覆盖去重、冲突、期限和隔离。请明确 W07 主 Issue/PR、线上构建 SHA，并将收件方案、补件通知触发及 Duplicate 判定的产品决定记录到 GitHub；后续才能产出仓库 Schema 的正式 QA 报告。
