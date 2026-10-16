# I11 评估包与 Offer 交接：线上测试与 UX/UI 审查报告

| 项 | 结果 |
|---|---|
| 日期 | 2026-10-15（Asia/Shanghai） |
| 环境 | [HireOS Interview 线上环境](https://hireos.aipollo.me/hireos/interview/)；Chrome 桌面浏览器，已登录现有账号 |
| 范围 | I11 评估包页面、草稿入口门槛、导出按钮反馈；按 [I11 文档](PRD.md) 的 AC-1～AC-8 与 [UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的 U1～U10 审查 |
| 总结 | **不通过 I11 全量验收**。已发布包可读，但 PDF 导出为模拟反馈；版本、真实 Offer ACK 与失效链路缺少可验证结果。8 个 AC 均未取得完整通过证据。 |

## 1. 角色、目标与测试边界

主角色为 HR / Recruiter，目标是在双方确认后查看、导出版本化评估包，并可靠交给 Offer；Hiring Manager 需要查看和导出。依据 [User Journey](User_Journey.md) 和 [User Cases](User_Cases.md) 执行。UX/UI 标准原本写给 JD Management，本报告使用其通用的应用性、证据、严重级别与报告结构检查 I11；JD 特有的字段、审批与 AI 问答条目不作为 I11 的验收项。

本次使用线上已有项目做**只读检查**：导航、读取可见状态、点击经仓库代码确认只显示模拟提示的 Export PDF。没有创建/修改项目，没有取消确认、发送 Offer、更新 JD、注入失败，也没有查询线上 DB。仓库 [AGENTS.md](../../../../AGENTS.md) 规定 Agent 不操作生产环境，因此会改变生产状态的用例不在本次执行。现有项目不是 `[UJ-TEST]` seed；不把其历史状态当作新流程可复现性证据。未核实当前账号与 HR / HM 业务角色的映射，也没有第二角色账号。

**证据索引**（以下链接为线上只读页面；不在公开报告复制候选人个人信息）：

- E1：[已有已发布项目评估包](https://hireos.aipollo.me/hireos/interview/project/1cbc3fb1-48f8-4a2b-ae68-27ebcc1af804/package)：页面显示 Published、Evidence manifest、HR/HM Confirmed 时间、Recommend for offer、Offer handoff `Sent`、`Sent to Offer` 禁用按钮。
- E2：E1 页面点击 `⬇ Export PDF` 后，界面提示 `Export is simulated here. It would carry the rubric, scores, evidence links and both confirmations as one PDF.`；没有 PDF 下载或生成/下载状态。
- E3：[已有草稿项目 Overview](https://hireos.aipollo.me/hireos/interview/project/4636accf-54e6-4c6b-85c7-81aac02ba916/overview)：`Evaluation Package` 导航禁用，帮助文案 `Record a decision on Decision & Next Steps first.`。这只能证明未记录决定时的 UI 门槛，不能证明单方确认时的 UI/API 门槛。
- E4：仓库 [PackagePage.tsx](../../../../hireos-interview/job-Interview-front/src/pages/project/PackagePage.tsx) 的 Export PDF 回调仅调用模拟提示；[tasks.service.ts](../../../../hireos-interview/job-Interview-backend/src/intake/tasks.service.ts) 的 `package()` 返回当前汇总，`sendOffer()` 只把本地 `offerState` 改为 `sent`。代码用于解释功能缺口，不证明线上部署的精确提交。

## 2. 旅程步骤检查

| Step | 用户操作与预期 | 线上实际 / 证据 | 结论与限制 |
|---|---|---|---|
| 1 打开包 | 未确认时显示 still in review，可预览、不能发布或交接 | 草稿项目的包入口禁用，并提示先记录决定（E3）；已发布项目可打开（E1） | **部分符合**：前置提示清楚；没有单方确认 seed，未测未确认预览及 API 拒绝。 |
| 2 审核包 | 显示 Version n、Rubric 版本、逐项分数/理由、受控证据引用、限制、确认人/时间 | 已发布页有岗位/候选人、证据摘要与标签、双方确认时间、默认不含原始材料的说明；未见包版本、Rubric 版本、生成时间、逐项数字分数、可打开的受控证据引用或确认意见（E1） | **不符合完整包规格**；仅凭页面不能断言后端交接数据不含原始材料。 |
| 3 导出 | PDF 成功，含 Rubric、分数、证据链接、双方确认；生成/下载状态分开 | 点击后只显示模拟导出提示，没有可下载 PDF 或两个独立状态（E2） | **失败，P0**：独立闭环终点不可完成。 |
| 4 交接 | 发送中 → Offer ACK；可见精确版本与交付证据 | 现有页面显示 `Sent` 和禁用的 `Sent to Offer`；没有 ACK、包版本、接收方或交付记录（E1） | **未验证真实交付**；`Sent` 不能当作 Offer 已接收。 |
| 5 失败重试 | 超时说明无部分发送，允许重试 | 无隔离数据与失败注入；现有已发送项目不能重试 | **未验证**；E4 代码也无 ACK/重试记录。 |
| 6 上游变化 | JD 更新后包需复核，已交接版本通知 Offer 失效 | 未改动线上 JD；当前页未见版本或失效状态 | **未验证**；文档标记 known gap。 |

## 3. 用例与 AC 覆盖

| 用例 / AC | 优先级 | 本次判定 | 实测证据与缺口 |
|---|---|---|---|
| UC-I11-01 / AC-1 独立闭环到导出 | P0 | **失败** | E2 证明导出为模拟；I01→I10 全流程未跑。 |
| UC-I11-02 / AC-2 超时后重试 | P0 | **未验证 / known gap** | 无 Offer mock、超时注入和 ACK；未触发线上交接。 |
| UC-I11-03 / AC-3 同版本只接收一次 | P0 | **未验证 / 部分实现** | E1 的按钮禁用只能证明 UI 避免再次点击；没有 Offer 端接收次数或包版本证据。 |
| UC-I11-04 / AC-4 v1 重放不覆盖 v2 | P1 | **未验证 / known gap** | 没有版本化包与 Offer mock；未重放。 |
| UC-I11-05 / AC-5 JD 更新失效 | P1 | **未验证 / known gap** | 没有线上更新 JD；未观察失效事件或通知。 |
| UC-I11-06 / AC-6 不含原始材料 | P0 | **部分符合 UI，安全未验证** | E1 显示默认不含原始材料的文案；没有交接 payload、受控引用或权限 API 证据。 |
| UC-I11-07 / AC-7 单方确认禁止发布/交接 | P0 | **未验证** | E3 只覆盖“没有决定”，没有 `S_decision_hr_confirmed`，也未调用交接 API。 |
| UC-I11-08 / AC-8 生成与下载失败分开 | P1 | **失败于前置能力 / known gap** | E2 没有实际生成/下载流程，无法注入两类失败。 |

**统计：**8 个用例，完整通过 0；线上明确失败 1（UC-01）；部分符合 UI 1（UC-06）；未验证 5（UC-02～05、07）；前置能力缺失而无法执行 1（UC-08）。这些分类不把文档中的“可测”当作通过。8 个 AC 均未完成端到端验证。

## 4. 发现、影响与修复验收

| ID | 严重度 / 类别 | 角色与步骤 | 可观察证据、用户影响 | 最小修复方向与验收方式 |
|---|---|---|---|---|
| I11-001 | **P0 / efficiency, state** | HR，步骤 3 | Export PDF 仅显示模拟文案（E2），HR 无法完成独立闭环的导出存档。 | 实现 PDF 生成及下载；以隔离 seed 核对 Rubric、分数、证据链接、双方确认与浅色打印样式，分别注入生成失败/下载失败。 |
| I11-002 | **P1 / clarity, state** | HR/HM，步骤 2 | 包头未见 Version n、Rubric 版本、生成时间；证据行仅有 Strong/Medium 标签，未见数字分数和受控引用（E1）。用户无法确认交接的精确内容版本或复核证据。 | 展示不可变包 ID/版本、来源 Rubric 版本、生成时间、逐项分数及可授权访问的引用；修订后验证旧版只读。 |
| I11-003 | **P0 / state, next_action** | HR，步骤 4–5 | 页面把本地 `Sent` 作为最终状态，缺少 ACK 与失败/重试证据（E1、E4）。HR 可能将未被 Offer 接收的结论误认为交接完成。 | 将发送与 ACK 分状态，持久化尝试和幂等键；用 mock 注入超时、重复、乱序，核对失败可重试、同版本只接收一次、旧版不覆盖新版。 |
| I11-004 | **P1 / permissions** | HR/HM，步骤 2–4 | E1 同页同时显示 HR 与 HM 的 `Unconfirm` 按钮；E4 的确认实现只按请求体 `role` 写对应槽位。当前账号与业务角色未核实，不能断言已线上越权，但权限边界缺乏可靠证据。 | 服务端从已验证身份判定可确认角色，分别用 HR/HM/Interviewer 身份验证可见性与越权 API 403；确认操作记录人和意见。 |
| I11-005 | **P1 / state, recoverability** | HR，步骤 6 | 当前包页未提供版本/失效状态，I11 文档将 JD 更新失效列为未实现；无法判断旧结论是否仍适用（E1、E4）。 | 建立上游版本依赖、失效标记和 Offer 通知；测试 JD 更新、数据撤回、录制授权撤回后的新旧版本状态。 |
| I11-006 | **P2 / clarity** | HR，步骤 4 | E1 显示 `Sent · 9/18/2026, 10:10:45 AM`，HR 确认显示 `9/18/2026, 10:11:35 AM`，表面顺序为发送早于当前 HR 确认。历史记录可能经历取消再确认，不能据此断言发送接口当时绕过门槛；页面无法解释该顺序。 | 显示确认与交接的审计时间线及包版本；用新建隔离数据验证交接严格晚于双方针对同一版本的确认。 |

## 5. 应用性十项 U1～U10

| 项 | 判定 | 依据 / 限制 |
|---|---|---|
| U1 容易理解 | **失败** | 可识别包和 Published，但无版本；`Sent` 与真正 ACK 含义不清（E1）。 |
| U2 容易上手 | **部分符合** | 草稿入口禁用理由清楚（E3）；未验证单方确认状态的引导。 |
| U3 快速完成任务 | **失败** | 导出主任务在模拟提示处终止（E2）。 |
| U4 下一步明确 | **失败** | 已发送状态没有接收方 ACK、负责人或失败恢复动作（E1）。 |
| U5 提示和按钮清楚 | **失败** | `Export PDF` 暗示真实文件，但只给模拟提示；`Sent to Offer` 未说明是发送还是已接收（E1/E2）。 |
| U6 符合真实工作方式 | **失败** | 无可导出产物和可靠交接，HR 无法按实际 Offer 交接工作流闭环。 |
| U7 角色信息匹配 | **未知** | 当前账号业务角色未核实；无 HM/Interviewer 账号对照及权限 API 测试。 |
| U8 无不必要跳转/重复 | **未知** | 仅检查包页和草稿入口；未跑完整 I01→I11 路径。 |
| U9 可恢复可预期 | **失败** | 导出无生成/下载独立状态，交接无失败/ACK/重试可观察链路（E1/E2/E4）。 |
| U10 可访问可操作 | **未知** | 可见状态有文字，不仅靠颜色；未执行键盘、焦点、屏幕阅读器和 200% 缩放检查。 |

## 6. 审查限制与复测条件

本次没有 `S_decision_hr_confirmed`、`S_package_v2_handed_off` 等隔离 seed，也没有真实 Offer 模块、Offer mock、失败注入开关、可清理的测试身份与角色。因此不能把文档中的 known gap、UI 文案、仓库代码或旧项目历史记录写成线上 API/DB/外部交付通过。没有读取或在报告中保存完整候选人材料。文档尚待确认的“Offer 模块未实现前是否隐藏交接按钮”和“Interviewer 是否可看包”也不由测试者代定。

完整复测需要非生产隔离环境或由人准备可清理的 `[UJ-TEST]` seed、HR/HM/Interviewer 身份、Offer mock 与失败注入，并保存脱敏 UI、API、DB、Offer 接收次数、PDF 产物证据。先复测 P0 的导出、ACK/重试、单方确认 API 拒绝和原始材料隔离，再测版本乱序与失效。此次仅编写报告，没有执行本地 build、lint、typecheck 或自动测试；这些不能计为通过。

```yaml
review:
  product: "Interview / I11"
  surface: "Evaluation Package 与 Offer handoff"
  role: "HR / Recruiter；Hiring Manager（权限未核实）"
  journey_goal: "双方确认后审核、导出版本化评估包，并可靠交接给 Offer"
  evidence:
    source: "线上 Chrome UI/可访问性树/按钮反馈；仓库代码用于辅助解释"
    steps_checked: [1, 2, 3, 4]
  verdict: "fail"
  findings:
    - { id: "I11-001", severity: "P0", category: "efficiency", step: 3, title: "PDF 导出仅为模拟", evidence: "E2", user_impact: "无法导出存档", recommendation: "实现生成与下载", acceptance_check: "检查实际 PDF 及两类失败" }
    - { id: "I11-002", severity: "P1", category: "clarity", step: 2, title: "缺包版本和可复核证据", evidence: "E1", user_impact: "无法核对交接版本与评分", recommendation: "显示版本、分数和受控引用", acceptance_check: "核对新旧版本与逐项内容" }
    - { id: "I11-003", severity: "P0", category: "state", step: 4, title: "Sent 缺少 Offer ACK", evidence: "E1、E4", user_impact: "可能误判交接成功", recommendation: "区分发送、ACK、失败和重试", acceptance_check: "mock 注入超时、重复和乱序" }
    - { id: "I11-004", severity: "P1", category: "permissions", step: 2, title: "双方确认权限缺少验证", evidence: "E1、E4", user_impact: "无法证明只有授权角色能确认", recommendation: "服务端按身份校验", acceptance_check: "三角色 UI 与 API 验证" }
    - { id: "I11-005", severity: "P1", category: "recoverability", step: 6, title: "无版本失效链路", evidence: "E1、E4", user_impact: "旧结论可能继续被使用", recommendation: "建立失效和通知", acceptance_check: "上游更新后核对包与 Offer 状态" }
    - { id: "I11-006", severity: "P2", category: "clarity", step: 4, title: "历史确认与发送时间顺序难解释", evidence: "E1", user_impact: "审计判断困难", recommendation: "显示版本化审计时间线", acceptance_check: "新数据验证先确认后交接" }
  usability_check:
    understandable: "fail"
    learnable: "unknown"
    efficient: "fail"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "fail"
    accessible: "unknown"
  limits:
    - "线上只读；未执行写入 API、DB、Offer mock 和故障注入"
    - "当前账号业务角色未核实；无单方确认 seed"
    - "仓库代码不证明线上部署的精确提交"
```
