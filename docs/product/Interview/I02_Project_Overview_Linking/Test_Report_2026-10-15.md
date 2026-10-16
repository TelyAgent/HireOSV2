# I02 项目概览与候选人关联｜线上测试报告

| 项目 | 结果 |
|---|---|
| 测试时间 | 2026-10-15 17:26–17:42（北京时间） |
| 环境 | [HireOS Command Interview 线上工作区](https://hireos.aipollo.me/hireos/interview/)；Chrome，已登录账号 |
| 依据 | [I02 PRD](PRD.md)、[User Cases](User_Cases.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) |
| 结论 | **不通过**。发现 1 项 P0、2 项 P1、2 项 P2；11 条用例中 1 条失败、10 条未完成端到端验证（其中 7 条与文档标记的 known gap 相符）。不能把未执行的用例计为通过。 |

## 1. 范围与方法

以 HR / Recruiter 的「进入项目、看清材料与下一步、关联候选人、打开简历、按门槛进入面试」旅程为主线，检查线上 DOM/可访问性树、可见页面、点击后的路由与反馈。检查了两个已存在的草稿项目：

- [项目 A：AI 项目经理](https://hireos.aipollo.me/hireos/interview/project/af66de98-b3b9-4ff6-bf3a-72352129cf96/overview)：候选人已关联，简历未提供，Rubric 未确认。
- [项目 B：高级产品设计师](https://hireos.aipollo.me/hireos/interview/project/2b638734-2bc3-4f61-bd8a-54684964ed42/overview)：候选人已关联，简历未提供，计划显示已确认，但两轮均未排期、未指定面试官。

使用现有数据只做读取和可逆的页面操作；没有创建、上传、删除或修改线上业务记录。规格要求的 `S_jd_only_project`、`S_project_with_materials`、`interviewer_a` 未在本次线上环境获得。当前账号与原型中的 Sarah Chen 角色映射未核实，权限结论不能由 UI 推断。当前仓库源代码只用于解释观察结果，不代替线上 API/DB 证据。

## 2. 实测路径与证据

| 步骤 | 操作与预期 | 线上实际结果 | 结论 |
|---|---|---|---|
| 1 | 首页进入项目 A；看岗位、候选人、材料、覆盖率、轮次、下一步 | 头部显示岗位、Draft、候选人；Source materials 显示 JD Provided，简历/筛选/测评 Not provided；Rubric 未确认；下一步指向 Requirements & Rubric。四个区块可读。 | 已观察，**不等同 AC-1**：项目 A 已有关联候选人 |
| 2 | 项目 A 无简历时，从任务列表点击 View résumé；预期入口弱态且不打开抽屉 | 列表仍显示可点击的 `View résumé`；点击后出现 `Résumé preview is coming soon.` 提示，未打开抽屉。 | **失败，AC-7 / UC-I02-09** |
| 3 | 项目 B 进入 Overview，核对材料与轮次 | 简历/筛选/测评均为 Not provided；两轮均 `Not scheduled · No interviewer yet`，但横幅显示 `Next step: Live Interview`。 | **失败，FR-9/10 与 U4** |
| 4 | 点击项目 B **Overview 横幅**中的 `Open →`（不是顶部已禁用的 `Live Interview` 标签）；预期在门槛未满足时留在项目并说明前置动作 | 进入 `/project/2b638734-2bc3-4f61-bd8a-54684964ed42/live`。页面显示 `Development Test meeting; no project or round linked`、`Open an interview round from the schedule to join its meeting automatically.`、`RECORD_NOT_FOUND`；顶部 `Complete session & review` 可见。2026-10-15 再次从同一项目复现。 | **P0 阻断**：入口与状态门槛矛盾，落入无项目/轮次关联的开发测试页 |
| 5 | 在项目 B 打开 `+ New Interview Project`，检查先建项目后关联的入口；按 Escape 关闭 | 弹窗指引 `Pick a job from JD Management … then upload résumés to start interviewing.`，未见 JD-only 建立或 `Link candidate` 入口；Escape 可关闭弹窗。 | 关联主流程线上不可执行；弹窗关闭键盘行为通过 |
| 6 | 1366×768 查看项目 B | 四个内容区块按列排布，页面本体未见横向滚动；项目导航标签超出可视宽度，出现横向滚动，末尾 `Evaluation Package` 被截断。 | 区块布局满足 PRD 的最低描述；导航可发现性存在 P2 问题 |

项目 A、B 的 Source materials 只显示材料类别及 Provided/Not provided，没有 FR-1 要求的文件名、来源、具体状态。项目参与者可在 Overview 查看责任角色；先前根据两个项目的 People 区块推断“责任角色不可见”并不成立，已撤回。两个检查项目均未见项目级 Recent activity；由于没有专用活动记录 seed，其完整展示行为仍需复验。

## 3. 11 条用例执行结果

状态定义：**失败** = 线上观察与预期相反；**未验证** = 缺少指定前置数据/身份或没有可操作入口；**known gap** = 产品用例已标未实现，线上现象与之相符，但未执行完整验证。

| 用例 | 优先级 | 结果 | 本次证据与限制 |
|---|---|---|---|
| UC-I02-01 JD-only Overview | P0 | 未验证 | 两个项目均已关联候选人；无 `S_jd_only_project`。只能确认已关联项目的缺失资料未显示 Pass。 |
| UC-I02-02 选择候选人关联 | P0 | known gap / 未验证 | 已访问的 Overview 无 `Link candidate`；没有 JD-only seed 或关联接口实测。 |
| UC-I02-03 只上传简历关联 | P1 | known gap / 未验证 | 创建项目弹窗要求选择岗位并上传简历；未见项目内只上传简历的关联入口。未上传文件。 |
| UC-I02-04 缺少关联输入 | P1 | known gap / 未验证 | 无关联弹窗，不能触发空输入校验。 |
| UC-I02-05 重复报告 Resolve | P1 | known gap / 未验证 | 无重复报告 seed，也未见 Resolve 控件；未查询 DB 历史版本。 |
| UC-I02-06 未 Triage 附件 | P1 | known gap / 未验证 | 无未归类附件 seed，也未见 Triage 控件；不能证明其是否进入其他证据列表。 |
| UC-I02-07 未关联时进入 Brief | P0 | 未验证 | 无 JD-only 项目，不能执行指定门槛；已关联项目中未满足前置条件的导航按钮有禁用说明。 |
| UC-I02-08 Interviewer 只读与 403 | P0 | known gap / 未验证 | 无 `interviewer_a` 身份或关联接口；不能用当前账号替代权限测试。 |
| UC-I02-09 无简历入口弱态 | P1 | **失败** | 项目 A Overview 显示 Résumé Not provided；首页对应 `View résumé` 仍可点，出现 coming soon 提示。 |
| UC-I02-10 简历抽屉预览与返回 | P2 | 未验证 | 两个检查项目均无简历；没有 `S_project_linked` 的默认简历。现有列表入口仅显示 coming soon，不能据此宣布有简历时的抽屉也失败。 |
| UC-I02-11 双击关联幂等 | P1 | known gap / 未验证 | 无关联入口；未执行双击或 DB 核查。 |

**统计：** 通过 0，失败 1，未验证 3，known gap / 未验证 7。另有 1 项 P0 流程缺陷在步骤检查中发现，不与 UC-I02-07 的指定 JD-only 场景混算。

## 4. 问题清单

| ID | 级别 | 角色 / 步骤 | 证据与用户影响 | 最小修复方向与复验 |
|---|---|---|---|---|
| I02-UX-001 | **P0** | HR，项目 B Overview → Next step → Live | 轮次未排期且无面试官，仍显示 Live Interview；点击进入无项目/轮次关联的 Development Test meeting，Notes 为 `RECORD_NOT_FOUND`。用户可能误以为已进入真实面试并尝试完成会话。 | 下一步须从真实、已解锁且具备轮次上下文的动作计算；Live 入口在未排期时禁用并解释原因；禁止从项目 Overview 跳到开发测试会话。复验未排期、已排期、已开始三个状态的横幅、导航、直达 URL。 |
| I02-UX-002 | **P1** | HR，首页无简历项目 → View résumé | Overview 明示 Résumé Not provided，但列表仍提供可点击入口；点击只返回 `Résumé preview is coming soon.`，用户无法预测动作结果。 | 无简历时置为真正禁用并显示原因；有简历时打开右侧预览抽屉。复验 AC-7 和 FR-11，关闭后保持列表位置。 |
| I02-UX-003 | **P1** | HR，Overview 材料核对 | Source materials 仅有类别与状态，没有文件名、来源、当前版本；HR 无法判断材料来自哪里或是否为待处理重复件。 | 每项展示文件名、来源、读取/版本状态；重复与未归类项给出明确处理入口。用重复报告与 Triage seed 复验。 |
| I02-UX-004 | P2 | HR，项目活动追溯 | 两个检查项目的 Overview 均未见项目级 Recent activity；无法在该页面回看创建、确认等关键业务事件。缺少有活动记录的专用 seed，不能确定所有项目均如此。 | 在 Overview 展示项目近期业务事件；无事件时给出明确空态。用有事件的 seed 复验。责任角色可见性不属于本问题。 |
| I02-UX-005 | P2 | HR，1366×768 项目导航 | 后段导航标签被截断，导航存在水平滚动，未见明显的更多入口/滚动提示；用户可能漏掉后续步骤。 | 提供可见的滚动提示或收纳菜单；复验首尾标签可通过鼠标与键盘发现。 |

`I02-UX-001` 可由线上路由和页面内容直接证实；其根因尚未通过部署版本代码、服务端日志或 DB 确认。其他 known gap 不能仅凭前端缺少控件推断服务端返回码或数据行为。

## 5. 应用性十项检查（UX/UI 标准 U1–U10）

| 项 | 判定 | 证据 / 限制 |
|---|---|---|
| U1 容易理解 | 部分通过 | 岗位、Draft、候选人可见；`Next step: Live Interview` 与未排期状态冲突。 |
| U2 容易上手 | 失败 | JD-only → Link candidate 无入口；无简历入口看似可用却只提示 coming soon。 |
| U3 快速完成任务 | 失败 | 核心关联与材料处理不能在 Overview 完成；错误下一步跳往开发测试页。 |
| U4 下一步明确 | 失败 | 项目 B 的下一步与轮次未排期、未指定面试官的状态相反。 |
| U5 提示和按钮清楚 | 失败 | View résumé 无简历时仍可点；禁用的部分导航有 Help 文案，这是局部优点。 |
| U6 符合真实工作方式 | 失败 | 缺少先建项目后关联、材料重复处理、Triage 的线上闭环。 |
| U7 信息结构符合角色目标 | 部分通过 | 四区块能概览材料/能力/轮次，责任角色可见；项目级活动和 Interviewer 视图仍需复验。 |
| U8 减少来回与重复 | 未验证 | 未能执行关联、材料处理；没有足够证据判断完整路径步数或返回位置。 |
| U9 可恢复可预期 | 失败 | 未排期项目可进入无关联 Live 页面并得到 `RECORD_NOT_FOUND`，没有返回对应修复位置的明确指引。 |
| U10 可访问可操作 | 部分验证 | New Project 弹窗可用 Escape 关闭；状态有文字；1366×768 导航被截断。200% 缩放、完整焦点顺序、屏幕阅读器、角色权限未测。 |

## 6. 审查限制与后续复验

1. I02 文档为待评审草稿，且 JD 管理 UX/UI 标准跨模块借用；本报告仅将其通用的 U1–U10、证据和判定规则用于 Interview，不把 JD 专有的发布/审批字段强加给 I02。
2. 缺少专用的 `[UJ-TEST]` seed、测试账号和可确认清理方式，因此未在生产数据上制造重复报告、上传简历、提交关联或切换面试官角色。API 403、DB 引用、历史版本、幂等、未归类材料是否被证据使用均未验证。
3. 要完成端到端验收，先准备 `S_jd_only_project`、`S_project_linked`、`S_project_with_materials` 与 `interviewer_a`，再按 11 条用例执行 UI + API + DB 检查；保留脱敏截图、响应码和查询结果，测试后清理 `[UJ-TEST]` 数据。
4. **发布门槛：** 先修复并复测 P0；P1 修复或获得明确产品豁免后再重评。当前不得标记 I02 已通过。

## 7. 结构化结论

```yaml
review:
  product: "HireOS Command Interview"
  surface: "I02 Project Overview & Candidate Linking"
  role: "HR / Recruiter（线上账号角色映射未核实）"
  journey_goal: "看清项目状态并完成候选人关联、材料整理与下一步交接"
  evidence:
    source: "线上 Chrome UI、可访问性树、路由、当前仓库代码辅助核对"
    steps_checked: ["项目概览", "无简历入口", "下一步入口", "创建项目弹窗", "1366×768 布局"]
  verdict: "fail"
  findings:
    - {id: "I02-UX-001", severity: "P0", category: "state", step: "下一步", title: "未排期项目进入无关联 Live 测试会话", evidence: "Development Test meeting; no project or round linked / RECORD_NOT_FOUND", user_impact: "面试主流程被错误引导", recommendation: "按解锁状态计算下一步并拦截缺少轮次上下文的 Live", acceptance_check: "未排期不能进入 Live，已排期进入正确轮次"}
    - {id: "I02-UX-002", severity: "P1", category: "clarity", step: "简历入口", title: "无简历时 View résumé 仍可点击", evidence: "Résumé Not provided；点击后显示 preview is coming soon", user_impact: "动作预期错误且无法预览", recommendation: "无简历禁用，有简历打开抽屉", acceptance_check: "复测 UC-I02-09/10"}
    - {id: "I02-UX-003", severity: "P1", category: "clarity", step: "材料核对", title: "材料缺少文件名和来源", evidence: "Source materials 仅显示类别及 Provided/Not provided", user_impact: "不能确认材料身份与当前版本", recommendation: "显示文件名、来源、状态和版本", acceptance_check: "用多份材料核对显示与版本切换"}
    - {id: "I02-UX-004", severity: "P2", category: "clarity", step: "项目活动追溯", title: "Overview 未见项目级 Recent activity", evidence: "两个检查项目均未见项目级活动列表；缺少有活动记录的 seed", user_impact: "不能从 Overview 回看关键业务事件", recommendation: "展示近期事件或明确空态", acceptance_check: "用有事件和无事件的 seed 分别核对"}
    - {id: "I02-UX-005", severity: "P2", category: "accessibility", step: "项目导航", title: "1366×768 下末尾步骤被截断", evidence: "导航出现水平滚动且 Evaluation Package 被截断", user_impact: "后续步骤不易发现", recommendation: "提供可见的溢出提示或收纳菜单", acceptance_check: "鼠标和键盘可发现全部步骤"}
  usability_check:
    understandable: "fail"
    learnable: "fail"
    efficient: "fail"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "fail"
    no_unnecessary_hops: "unknown"
    recoverable: "fail"
    accessible: "unknown"
  limits:
    - "无 JD-only、重复材料和未归类附件 seed"
    - "无 interviewer_a 测试身份；未测 API 403 与 DB 持久化"
    - "未测 200% 缩放和完整键盘/读屏流程"
```
