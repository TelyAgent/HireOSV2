# I07 实时面试与记录：预发布环境测试报告

测试日期：2026-10-15（Asia/Shanghai）  
结论：**未完成线上验收，不能判定通过**。本轮在指定预发布地址完成了登录态、项目入口和阶段门槛检查，但现有项目没有可安全执行 I07 主流程的隔离测试数据。10 条用例均未取得完整线上证据；其中未排期与已完成场次只取得部分 UI 入口证据。文档所列 5 条 known gap 与本地代码检查相符，但不能据此断言预发布部署的实际行为。

## 1. 范围、依据和证据等级

| 项 | 内容 |
|---|---|
| 产品依据 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[User Cases](User_Cases.md)；AC-1～8、UC-I07-01～10、P1～P10 |
| UX 依据 | [JD Management UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的逐步取证、U1～U10、严重度与报告结构；JD 专属字段、审批和发布要求不直接套用到面试 |
| 环境 | 用户指定的[预发布 Interview](https://hireos.aipollo.me/hireos/interview/)；Chrome 已有登录态，页头显示“蔡敏”；未取得部署版本号、服务端角色证明或 DB/审计访问 |
| 执行方式 | 浏览器 UI 只读检查项目、阶段入口、Brief 内容和禁用原因；没有创建或结束会议，没有写候选人笔记、修改轮次、发邀请或调用线上写入 API |
| 测试数据 | 线上未提供 `S_round2_scheduled`、`S_plan_approved`、`S_round1_completed` 等隔离 seed，也未提供 `interviewer_a` 与非本人账号。现有演示项目只用于入口观察；没有将其候选人内容写入报告 |
| 证据分层 | E-01～E-04 是预发布 UI 可访问树/DOM 观察；C-01～C-04 是当前工作区代码观察；L-01 是本地命令结果。代码和本地命令均不能证明线上部署版本 |

报告中的“未验证”表示缺少完成断言所需的线上证据，**不表示功能一定不存在**。页面文字也不能单独证明 API 权限、DB 持久化、录制授权或 Zoom RTMS 的真实交付结果。

## 2. 线上执行记录

| 证据 | 旅程步骤 | 实际操作与观察 | 证明范围与限制 |
|---|---|---|---|
| E-01 | 入口 | 打开预发布 Interview 首页，已有登录态；项目列表显示 13 个项目，账号页头为“蔡敏”。“My work · Sarah Chen”面试待办为 0 | 证明当前浏览器可访问工作区；页头身份与工作台角色文案不一致，服务端身份/角色未核实。没有可直接使用的 `interviewer_a` 待办 |
| E-02 | 前置条件 | 打开[草稿项目](https://hireos.aipollo.me/hireos/interview/project/af66de98-b3b9-4ff6-bf3a-72352129cf96/overview)：Live Interview 不可进入，导航帮助提示先生成 Brief 问题；Schedule 也提示先确认计划 | 只证明该草稿项目的前置门槛提示；它不是 `S_plan_approved`，不能完成 AC-7 |
| E-03 | 已完成场次 | 打开已有两轮完成的演示项目：Overview 显示两轮 Completed，Live Interview 入口不可进入 | 只证明导航入口被阻止；没有在 Live 页面看到“会议已结束”提示，也未验证 Zoom join URL/API，因此 UC-I07-10 未通过 |
| E-04 | 已排期场次 | 打开一条已有排期、未完成的项目，Overview 显示“Next step: Interview Brief”，Live Interview 入口标为不可用；Brief 有 STAR 问题，“Start this round”按钮可见。Live 导航 DOM 的 `aria-disabled=true`，title 为 `Open Live Interview from “Start this round” at the bottom of Interview Brief.` | 证明从 Brief 启动是预发布 UI 当前入口。没有点击 Start：该动作可能创建或加入 Zoom 会议，且当前项目不是隔离测试数据；不能据此判断 I07 主流程结果 |

未进入 Live 页面。`LivePage` 当前代码会在打开页面时自动调用 `POST /tasks/:id/interview-sessions`，而启动轮次可能触发 Zoom 会议，因此不能把直接导航或点击启动当成无副作用的只读检查（C-01）。

## 3. 用例与验收结果

| 用例 | 优先级 | 本轮线上判定 | 现有证据与完成条件 |
|---|---|---|---|
| UC-I07-01 拒绝录制仍可完成 / AC-1 | P0 | 未验证 | 无隔离会议、候选人授权记录及 manual notes 来源的 UI/DB 证据；文档标 known gap |
| UC-I07-02 转写失败与恢复 / AC-2 | P0 | 未验证 | 无可控 RTMS 故障注入、录制状态与重试后的证据；文档标 known gap |
| UC-I07-03 跳过题显示未问 / AC-3 | P0 | 未验证 | 未进入 Live、未跳题；需要问答记录与 Review 双侧证据。当前代码仅保存页面内存状态，见 C-02 |
| UC-I07-04 忽略 AI 建议无变化 / AC-4 | P0 | 未验证 | 无可操作 AI 建议和前后 DB 快照；文档标 known gap，见 C-03 |
| UC-I07-05 采纳建议标为人选择的追问 / AC-5 | P1 | 未验证 | 无可操作建议、追问记录与来源字段；文档标 known gap，见 C-03 |
| UC-I07-06 刷新后笔记仍在 / AC-6 | P0 | 未验证 | 未用隔离场次写入笔记；需等“已保存”后刷新，核 UI、GET API 与作者归属。当前代码具备保存路径，见 C-04 |
| UC-I07-07 未排期不能开始 / AC-7 | P1 | 部分 UI 观察，未完成 | E-02 是更早的草稿门槛；仍需 `S_plan_approved` 单独验证未排期提示及直接 API 拒绝 |
| UC-I07-08 非本人场次被拒 / AC-8 | P0 | 未验证 | 缺 `interviewer_a`、另一面试官场次和独立登录态；必须核 API 403，不能以 UI 隐藏替代。文档标 known gap |
| UC-I07-09 录制中转写带时间码 / FR-7 | P1 | 未验证 | 无已授权的测试 Zoom 会议、RTMS 文本和 TranscriptLine API 证据 |
| UC-I07-10 已完成轮次不能再加入 / FR-12 | P2 | 部分 UI 观察，未完成 | E-03 仅看到导航禁用；需用已完成隔离场次核会议已结束提示和加入接口/链接结果 |

**统计**：10 条用例完整通过 0、完整失败 0、部分 UI 观察 2、未验证 8。8 条 AC 中，AC-7 部分观察，其余 7 条未验证；UC-I07-10 是 FR-12 补充边界，不属于 AC-1～8。不能把未执行项目算作通过或失败。

## 4. 当前工作区代码风险，与线上结果分开

| 证据 | 代码位置 | 观察与风险 | 复测验收 |
|---|---|---|---|
| C-01 | `LivePage.tsx:22-29, 76-81`、`MeetingRecordPanel.tsx:83-99` | Live 完成调用 `POST /rounds/:id/complete`；记录面板打开时自动 `POST /tasks/:id/interview-sessions`。在共享项目上打开 Live 可能产生记录会话 | 使用 `[UJ-TEST]` 项目进入，核仅目标轮次产生一条会话；失败/刷新后不重复 |
| C-02 | `LiveQuestionPanel.tsx:10-30, 39, 52-62` | 当前题号与 skipped 集合只存在 React state，`Skip` 只改内存，未见持久化问答调用；且最后一题 Skip 禁用。AC-3 的记录和 Review 可见性存在明确实现缺口 | 跳过任意题（含最后一题），刷新后仍标“未问”；API/DB 有实际问答状态，Review 显示一致 |
| C-03 | `MeetingRecordPanel.tsx:10-23, 124-137` | AI 建议和证据缺口是固定示例，整个 `fieldset disabled`；现阶段无法进行 Use/Add/Dismiss。对应 AC-4/5 不可按产品预期执行 | 建议有 AI 来源标签；三种操作可用且分别核对前后问题、笔记、分数和证据记录 |
| C-04 | `useMeetingNotes.ts:18-55, 61-74`、`MeetingRecordsService:41-88` | 笔记按 session/作者加载、800ms 后自动保存，有版本冲突与重试处理；代码可支持 AC-6 的部分路径。断网时草稿只保留在当前页面，未见跨刷新本地持久草稿 | 隔离场次等待“已保存”再刷新核一致；另测保存失败、断网恢复、并发冲突和作者隔离 |

另有前置和权限风险：`MeetingRecordsService.create` 仅按任务创建者过滤，未检查该轮排期或指定面试官；`RoundsService.complete` 查询按 workspace，未检查 `interviewerId`，也未在该方法内检查 `scheduledAt`（相关代码见 `meeting-records.service.ts:24-38`、`rounds.service.ts:213-229`）。这是代码检查，不等于线上 API 已复现越权；应优先用独立账号验证 AC-7/8，并修正服务端守卫。

## 5. 旅程步骤与应用性 U1～U10

| 项 | 判定 | 本轮证据 / 限制 |
|---|---|---|
| U1 容易理解 | 部分观察 | E-02/E-04 的阶段提示能说明为何未进入；Live 页本身未打开 |
| U2 容易上手 | 未验证 | Brief 的“Start this round”可见，但未执行首次进入和实际提问 |
| U3 快速完成任务 | 未验证 | 未跑从启动到 Review 的完整路径，无法测步骤、等待或重复操作 |
| U4 下一步明确 | 部分观察 | E-04 Overview 指向 Brief，Brief 有启动按钮；完成后交接未测 |
| U5 提示和按钮清楚 | 部分观察 | 禁用导航有 title 说明；录制、重试、AI 建议与完成确认未测 |
| U6 符合真实工作方式 | 未验证 | 多问法、手工记录、拒绝录制和故障替代路径未测 |
| U7 信息结构符合角色 | 未验证 | E-01 页头与 My Work 人名不一致；没有独立 Interviewer 账号和字段权限证据 |
| U8 减少跳转重复 | 未验证 | 未跑 Brief → Live → Review 的实际返回、上下文保存 |
| U9 可恢复和可预期 | 未验证 | 未做断网、刷新、RTMS 故障、并发、权限撤销注入 |
| U10 可访问可操作 | 未验证 | 未进入 Live 页面；未完成键盘、焦点、200% 缩放与状态朗读检查 |

```yaml
review:
  product: "Interview / I07"
  surface: "Brief → Live Interview → Review"
  role: "Interviewer（目标角色；本轮浏览器账号服务端角色未证实）"
  journey_goal: "按计划提问并留下可追溯证据，录制或转写不可用时保留手工记录"
  evidence:
    source: "预发布浏览器 UI/DOM E-01～E-04；工作区代码 C-01～C-04；本地命令 L-01"
    steps_checked: [1]
  verdict: "insufficient_context"
  findings:
    - id: "I07-UX-01"
      severity: "P0"
      category: "state"
      step: 3
      title: "跳题状态仅在当前页面内存"
      evidence: "C-02；尚无预发布跳题与 Review 复现"
      user_impact: "面试官可能无法在记录和 Review 中区分未问与无回答"
      recommendation: "持久化逐题实际状态及来源"
      acceptance_check: "跳题后刷新并在 Review、API/DB 中看到未问"
    - id: "I07-UX-02"
      severity: "P0"
      category: "ai_boundary"
      step: 5
      title: "AI 建议目前为禁用示例"
      evidence: "C-03；尚无预发布可操作建议复现"
      user_impact: "无法执行采纳、加入笔记或忽略的人工选择闭环"
      recommendation: "接入建议及操作记录，明确建议和人工采纳边界"
      acceptance_check: "分别执行三种操作，核 UI、API/DB 与零隐式评分"
  usability_check:
    understandable: "unknown"
    learnable: "unknown"
    efficient: "unknown"
    next_action_clear: "unknown"
    controls_clear: "unknown"
    real_workflow_fit: "unknown"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "缺隔离的预发布 I07 seed、测试面试官账号和可控 Zoom/RTMS 注入"
    - "缺线上构建号、API 原始响应、DB、授权记录与审计证据"
```

上方 P0 是**本地代码风险级别**，不是预发布环境已复现 P0 的断言。按审查标准，关键持久化、权限和证据来源未知时，不能给出 pass 或 conditional pass。

## 6. 本地自动检查 L-01

这些命令在当前工作区执行，不代表预发布部署版本：

| 子项目 | 实际命令与结果 |
|---|---|
| Interview 后端 | 初次 `npm test` 在旧 Prisma Client 上 build 失败；执行 `npx prisma generate` 后 build 通过。`npm test` 最终 7/10 通过、3/10 失败：`intake`、`interviewers`、`meeting-records` 测试在 `new URL(process.env.DATABASE_URL)` 报 `ERR_INVALID_URL`，本地未提供测试 `DATABASE_URL`，属于环境前置缺失，不能当产品缺陷。`npm run lint`、`npm run typecheck` 通过 |
| Interview 前端 | 初次 build 因缺本地 `@types/node` 失败；执行 `npm ci` 后 `npm run build`、`npm run typecheck` 通过。build 提示 JS chunk 超过 500 kB；未运行不存在的 lint/test script |

## 7. 完整复测所需条件与顺序

1. 在**预发布**创建隔离的 `[UJ-TEST]` 项目、虚构候选人（邮箱 `example.com`），按 [Interview README](../README.md#seed前置状态目录) 提供 `S_plan_approved`、`S_round2_scheduled`、`S_round1_completed`；测试后按环境约定清理。提供 `interviewer_a`、另一面试官及只读/HR 身份，能核服务端角色。
2. 提供不会触达真实候选人的测试 Zoom 会议、录制同意/拒绝状态、可控 RTMS 失败与恢复注入，以及可查看的授权/TranscriptLine/会话/问答/笔记/审计记录。若会议供应商、授权获取时机、会中 AI 建议范围尚未定案，先在产品规格或 Issue 确认。
3. 先跑 P0：UC-I07-01、02、03、04、06、08；每一步同时记录 UI、API 和 DB/外部证据。然后跑 P1：05、07、09；最后跑 P2：10。用同一轮次的状态与证据来源核对 Review 交接。
4. 对每个用例记录执行时间、测试身份、预发布构建号、操作、期望、实际、截图或 API 响应（脱敏）、数据记录 ID、缺陷严重度；结束后重新按 U1～U10 检查 Live 页面，包括键盘和 200% 缩放。

本次只新增此本地报告；未修改业务代码、未部署、未创建/关闭 Issue 或 PR，也未提交或推送。仓库现有其他未提交改动均未触碰。
