# I10 面试阶段决定与双方确认｜线上测试报告

| 项 | 内容 |
|---|---|
| 测试时间 | 2026-10-15 约 18:20–18:25（北京时间） |
| 环境 | [HireOS Command Interview 线上环境](https://hireos.aipollo.me/hireos/interview/)，Chrome 桌面端，已有登录会话 |
| 测试依据 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop IO](Loop_IO.md)；[UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的通用证据规则与 U1–U10 |
| 测试目标 | HR 与 Hiring Manager 记录阶段决定、分别确认，再交给评估包；同时核对未完成轮次的入口门槛 |
| 总结 | **不通过全量验收**。10 条用例：0 完整通过、1 部分符合、9 未验证；另发现 1 条线上记录时间线冲突。权限、例外、补证和确认失效等核心规则缺少可执行的隔离场景，不能宣称通过。 |

## 1. 方法和数据边界

本轮用已有登录会话读取项目首页、一个**已有的已发布项目**的 Decision & Next Steps / Evaluation Package，以及一个**已有的未完成项目**的 Overview。只做页面导航和读取；未更改决定、确认、Offer 交接、候选人资料或其他线上数据。记录页面文案、可访问性树和路由作为线上证据。报告中的样本称为 A（已发布）和 B（进行中），不写候选人姓名、联系方式或评分原文。

会话右上角显示登录姓名，首页却显示 `MY WORK · Sarah Chen`。二者与 PRD 的 `hr_a`、`hm_a`、`interviewer_a` 映射没有得到核实，因此本轮不把 UI 中的 HR/HM 按钮当成真实角色授权证据。没有本模块要求的隔离 `[UJ-TEST]` seed、双角色账号、故障注入与可安全清理的测试项目；未调用写入 API、查询线上 DB/审计或执行双击/并发实验。仓库代码只用于解释观察到的界面与列出待复测风险，**不能证明线上部署代码版本或服务端实际行为**。

判定口径：**部分符合**仅限已经观察的子步骤；**未验证**表示没有完成用例规定的操作及必要 UI/API/DB 证据；**已知缺口**是产品文档或本地代码标出的实现现状，不等于本轮线上实测失败或通过。严重级别使用审查标准的 P0–P3，和用例优先级分开。

## 2. 按用户旅程的线上执行记录

| Step | 用户操作与预期 | 线上实际结果及证据 | 结论 |
|---|---|---|---|
| 1 进入决定 | Debrief 完成后可查看人工决定与 AI 草稿；未完成项目应提示前置步骤 | [样本 A 决定页](https://hireos.aipollo.me/hireos/interview/project/1cbc3fb1-48f8-4a2b-ae68-27ebcc1af804/decision)显示 `Package published`、`RECOMMENDED ACTION`、`DRAFT CONCLUSION` 和 AI draft 标识。AI 草稿给出 Must-have 数量、评分结论和引用 ID；引用显示为长 UUID 加评分原文，页面没有可点击来源。样本 B [Overview](https://hireos.aipollo.me/hireos/interview/project/5f57f693-470d-4d27-96dd-592aafdd8db6/overview)显示 1/2 轮完成；Decision 标签禁用，帮助文案为 `Finish Debrief with “Continue to decision” first.`，当前下一步为 Review。 | AI 建议边界与入口提示**部分符合**；引用可核查性不足。未测 AI 生成或服务端门槛。 |
| 2 选择决定 | Continue to next round、Recommend for offer 是不同动作，并可说明理由 | 样本 A 同时显示 `Continue to next round`、`Hold`、`Request more evidence`、`Do not proceed`、`Recommend for offer` 五个按钮；AI 建议附 `a proposal — a person decides`。页面显示已记录决定时间。未见理由输入、继续下一轮的证据目标/负责人/时间，也未见决定版本或记录人。没有点击按钮改变线上决定。 | **部分符合**：可确认选项分开；持久化与禁止 Offer 副作用未验证。见 I10-UX-01。 |
| 3 底线例外 | Must-have Unknown/未达标时推荐 Offer 必填例外理由、风险、计划 | 样本 A 的 Must-have 已显示全部达标；无 `S_debrief_security_unknown` 样本。当前决定页也未见例外输入区。 | **未验证**；文档标为已知缺口。 |
| 4 HR 确认后待 HM | HR 意见与确认后保持 pending，显示等待 HM；首页 M04/G05 正确计数 | 样本 A 已是双方确认状态，无法观察单方 pending；[线上首页](https://hireos.aipollo.me/hireos/interview/)显示 `Decisions awaiting my confirmation 0` 与 `Needs my confirmation (0)`，没有符合 `S_decision_hr_confirmed` 的隔离样本。决定页本身没有确认按钮/等待横幅；确认控件在 Evaluation Package。 | **未验证**；现有导航与旅程位置不一致，见 I10-UX-02。 |
| 5 HM 确认与交接 | 两方分别确认、记录身份/时间/意见，之后才可发布及交接 | [样本 A 评估包](https://hireos.aipollo.me/hireos/interview/project/1cbc3fb1-48f8-4a2b-ae68-27ebcc1af804/package)显示 HR、HM 均 `Confirmed` 和各自时间，`Published`、`Recommend for offer`、`Sent to Offer`。仅看到时间，未见确认人、意见或决定版本。页面同时提供两个 `Unconfirm` 按钮。**时间线冲突：HM 确认 2026-09-18 10:10:34，决定记录 10:10:45，Offer Sent 10:10:45，HR 确认 10:11:35**（浏览器页面本地时间）。 | 当前记录**不符合**“双方确认后才交接”的可见顺序；未查审计/DB，不能判定产生原因。见 I10-OBS-01。 |
| 6 决定变更 | 改动决定后旧确认失效并重新确认 | 样本 A 已发布但决定选项仍可见且看起来可点击；本轮没有更改线上决定。 | **未验证**；界面没有说明变更对既有确认/交接的影响，见 I10-UX-03。 |

## 3. 用例与验收标准覆盖

| 用例 | 对应 AC / 路径 | 本轮结果 | 依据与缺口 |
|---|---|---|---|
| UC-I10-01 只有 HR 确认为 pending | AC-1 / P2 | 未验证 | 无单方确认 seed；样本 A 已双方确认。 |
| UC-I10-02 待确认计数 | AC-2 / P3 | 未验证 | 首页 0 是可见值，但无单方确认样本、双角色会话，无法验证 M04/G05 分人计数。 |
| UC-I10-03 下一轮与 Offer 推荐分开 | AC-3 / P4 | 部分符合 | 两按钮线上分别存在；未记录 `continue_next_round`，未查 Offer 状态/DB；缺少下一轮目标、负责人、时间输入。 |
| UC-I10-04 Must-have Unknown 例外 | AC-4 / P5 | 未验证 | 无 Unknown seed，未提交例外；文档标未实现。 |
| UC-I10-05 补证未完成阻塞 | AC-5 / P6 | 未验证 | 样本 B 的 Decision UI 在 Debrief 前禁用，只证明导航门槛；无 `S_evidence_requested`，未以 HR/HM 测确认接口。 |
| UC-I10-06 确认接口校验角色 | AC-6 / P7 | 未验证 | 无 interviewer/hr/hm 独立身份，未调用确认 API；PRD 与本地服务代码标明按请求 `role` 选择确认槽位，为待修安全缺口。 |
| UC-I10-07 改决定后确认失效 | AC-7 / P8 | 未验证 | 未更改线上已确认决定；本地代码未见 `setDecision` 清空两方确认字段，需用隔离项目验证线上行为。 |
| UC-I10-08 Hold/Do not proceed 无 Offer | AC-8 / P9 | 未验证 | 两选项线上可见，但未保存；未检查状态/交接记录。 |
| UC-I10-09 双方确认完成 | FR-7 / P1 | 未验证 | 样本 A 的双方时间、Published 可见，但不是从单方到双方的实测；确认人、意见、审计及发布转移未查。 |
| UC-I10-10 双击只确认一次 | FR-6 / P10 | 未验证 | 未在现有真实项目上双击确认；无隔离 seed/审计证据。 |

**AC 结论：**AC-3 只有选项区分的 UI 证据；AC-1、AC-2、AC-4～AC-8 均没有完成规定的线上验证。没有 AC 达到完整通过。原 [User Cases](User_Cases.md) 的 `✅ 可测` 是可执行性标记，不能作为本次通过结果。

## 4. 发现、影响与复测条件

| ID / 级别 | 角色、步骤与证据 | 用户影响 | 最小修复方向及验收检查 |
|---|---|---|---|
| I10-OBS-01 / **P0，状态时间线** | HR/HM；步骤 5。样本 A 评估包可见 `Sent to Offer 10:10:45`，而 `HR Confirmed 10:11:35`，并且 HM 确认早于决定记录。 | 用户无法仅凭当前页面确认交接是在有效人工决定和双方确认之后发生；审计可信度受损。该项目可能是旧样本/迁移数据，本轮不推断当前新流程必然复现。 | 先核查该项目线上审计、DB 时间与历史迁移；用隔离项目重放“决定 → HR → HM → 交接”，断言每一步之前不得出现后一步状态，并在页面展示可追溯的事件顺序。 |
| I10-UX-01 / **P1，决定依据** | HR；步骤 1–2。样本 A 决定页只有选项和时间，未见理由、记录人、决定版本；AI 引用为 UUID/评分文本，没有可打开来源。 | HR/HM 难以核实建议与记录人工决定的依据，后续复核难以区分 AI 建议和人类理由。 | 为人工决定收集并展示理由、记录人/时间/版本；AI 引用提供可定位原评分证据的入口。复测每个主张可打开来源、每次决定有独立理由。 |
| I10-UX-02 / **P1，确认路径** | HR/HM；步骤 4–5。决定页没有 HR/HM 确认及等待横幅；评估包才出现两个确认控件，且已发布状态仍显示 `Unconfirm`。 | 用户在“Decision & Next Steps”完成决定后不知道该由谁确认，以及确认与评估包发布的边界。 | 明确“记录决定 → 各自确认 → 生成/发布评估包”的对象和顺序；在决定页或下一步处展示确认状态、等待对象和深链。用单方 seed 复测 pending 文案和角色入口。 |
| I10-UX-03 / **P1，变更后果** | HR/HM；步骤 6。已发布的样本 A 仍显示可操作的五个决定按钮与两个 `Unconfirm`，页面未解释对已发送 Offer 的影响。 | 用户可能误以为可安全改写已交接的决定；旧确认、交接与新决定是否一致不清楚。未点击，因此本轮没有证实实际状态被改写。 | 对发布后变更显示确认对象、版本、原确认失效和下游影响；隔离项目验证旧确认清除、旧交接处理与审计。 |
| I10-SEC-01 / **P0，待线上复测的已知缺口** | Interviewer/HR；步骤 4–5。PRD 和当前仓库 `tasks.service.ts` 注释均说明确认依据请求体 `role`，未按真实角色检查；线上没有身份/API 实测。 | 如果线上沿用该实现，HR 可代 HM 确认，破坏双人决策；本报告**不宣称线上已复现越权**。 | I15 接入真实身份后，用 interviewer 调用确认、HR 请求 HM 槽位，均应返回 403 且 DB/审计不变。 |

## 5. UX/UI 应用性十项检查

| 标准 | 本轮判定 | 线上证据或限制 |
|---|---|---|
| U1 容易理解 | 部分 | 项目状态、五个选项和“AI 仅建议”可见；人工理由、版本和交接时间线不清楚。 |
| U2 容易上手 | 部分 | 样本 B 禁用入口解释先完成 Debrief；决定页无双人确认指引。 |
| U3 快速完成任务 | 未验证 | 已发布样本不能安全重走记录、确认流程；无任务完成用时证据。 |
| U4 下一步明确 | 失败 | 决定页未显示等待谁确认；样本 B Overview 显示 `Next step: Review`。 |
| U5 提示和按钮清楚 | 部分 | 选项文字清楚；已发布状态仍出现变更/取消确认控件，无影响说明。 |
| U6 符合真实工作方式 | 未验证 | 理由、例外、复核和双方意见未能在隔离场景完成；已发布样本只供读取。 |
| U7 信息结构符合角色目标 | 未验证 | 只有一个登录会话，角色映射不明；不能断言 HR/HM/Interviewer 看到正确控件。 |
| U8 减少跳转与重复 | 部分 | Decision 与确认分处 Decision/Package 两页；是否有必要的决策价值待产品确认。 |
| U9 可恢复和可预期 | 未验证 | 未执行保存失败、双击、并发、权限变化或未知状态。 |
| U10 可访问、可读和可操作 | 部分 | 页面按钮和禁用原因进入可访问性树，状态有文本；未执行键盘全路径、200% 缩放、焦点及屏幕阅读器验证。 |

## 6. 审查限制与下一轮测试

1. **隔离数据与角色**：提供 `S_debrief_ready_all_must_met`、`S_debrief_security_unknown`、`S_evidence_requested`、`S_decision_hr_confirmed` 的 `[UJ-TEST]` 项目，以及独立 HR、HM、Interviewer 账号和清理方式。使用 `example.com` 邮箱，避免真实候选人资料进入报告。
2. **I10a 主闭环**：分别保存 Continue、Recommend、Hold、Do not proceed；逐步记录 UI、响应、DB、审计和首页 M04/G05；验证例外字段、未完成补证/计划轮次门槛、单方 pending 与双方完成。AI 质量相同输入至少跑两次，检查每条引用可追溯而非固定文案。
3. **I10b 安全与变更**：以真实身份测试 403、HR 代 HM、同人双槽位规则；更改已确认决定后核对确认失效和 Offer 交接状态；对确认按钮做双击及双会话并发，检查审计只有有效事件。对现存样本 A 的时间线先做只读审计核查，区分历史数据异常与当前可复现缺陷。
4. **无障碍与视觉**：在隔离场景补测键盘焦点顺序、200% 缩放、禁用说明、成功/失败/未知文案和表单错误关联。

按 UX/UI 审查标准，存在 P0 可见状态冲突且核心权限、持久化和交接未完整验证，I10 当前**不能判定通过**。本轮没有更改线上业务数据；报告记录的是可复核的页面观察、已知实现缺口和明确的未验证项。

```yaml
review:
  product: "HireOS Command Interview"
  surface: "I10 Decision & Next Steps → Evaluation Package"
  role: "HR / Hiring Manager；线上会话角色映射未核实"
  journey_goal: "记录人工阶段决定，由 HR 与 HM 分别确认后交接评估包"
  evidence:
    source: "线上 Chrome UI、可访问性树、路由；仓库代码仅用于辅助解释"
    steps_checked: [1, 2, 4, 5, 6]
  verdict: "fail"
  findings: ["I10-OBS-01", "I10-UX-01", "I10-UX-02", "I10-UX-03", "I10-SEC-01"]
  usability_check:
    understandable: "unknown"
    learnable: "unknown"
    efficient: "unknown"
    next_action_clear: "fail"
    controls_clear: "unknown"
    real_workflow_fit: "unknown"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "没有隔离 seed、独立角色账号与线上 DB/审计证据"
    - "没有执行写入、幂等、并发、失败注入和完整无障碍测试"
```
