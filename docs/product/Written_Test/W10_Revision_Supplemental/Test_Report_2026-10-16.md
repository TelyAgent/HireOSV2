# W10 修订、重考与补测线上测试报告（2026-10-16）

## 结论

**线上验收未完成，不能判定通过。** 线上服务可达，但当前账号下没有已发布且仍可继续测评的 Case，也没有修订轮、隔离候选人、模拟发信和认证数据查询条件。本轮对 10 条 W10 用例做了入口与前置条件核查：**完整通过 0、线上确认失败 0、阻塞 10**；5 项 W10 AC 均未获端到端线上证据。阻塞不算产品缺陷或通过。

本地参考代码与已关闭的 [Issue #48](https://github.com/TelyAgent/HireOSV2/issues/48) 显示“补充测试作为新一轮”已有独立草稿、邀请及按轮评估的实现；这只覆盖 W10 的一部分，**不能替代**反馈包、修订提交与对照、Rescore、Retake 的验收。代码搜索未找到这些能力的实现，但无法证明本地 HEAD 等于线上构建。依所给 UX/UI 标准，缺少核心旅程证据时结论为 `insufficient_context`；若以当前本地实现作为发布候选，W10 核心需求存在 P0 交付缺口，不能发布为“W10 已完成”。

## 范围与环境

| 项 | 本轮实际情况 |
|---|---|
| 需求依据 | 同目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop IO](Loop_IO.md)、[Written Test 公共约定](../README.md)；[UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) |
| GitHub 决策 | [Issue #48](https://github.com/TelyAgent/HireOSV2/issues/48) 全文及两条评论；它只授权并规定多轮补测，不是完整 W10 主 Issue。未找到完整 W10 的关联 Issue/PR，无法作正式 PR QA |
| 时间、入口 | 2026-10-16 约 12:08–12:12（Asia/Shanghai）；[Written Test 线上任务页](https://hireos.aipollo.me/hireos/written/tasks) |
| 身份 | 已登录 Chrome；任务页写 `Signed in as John · HR Head · Aurora Studio`，页头显示另一中文姓名。未核实身份映射，不能声称 HR/Hiring Manager/Candidate 权限已通过 |
| 样本 | 4 个真实 Case：待发送 2、待发布 1、已结束 1；已发布且可继续 0。没有 W10 的 `S_result_released`、`S_revision_round1_sent`；没有 `[UJ-TEST]` 隔离数据 |
| 线上健康 | [E01 健康请求](evidence/2026-10-16/health.txt)：HTTP 200，`phase-0`；只证明服务可达 |
| 参考版本 | 本地 HEAD `c4b610500d33a279c03251091c5f0af13b831318`；线上构建 SHA 未取得，不把本地搜索当作线上二进制证明 |
| 操作边界 | 线上仅只读导航与健康请求；未创建轮次、改评分、发布结果、发邮件或注入故障。未运行本地 build/lint/type/unit/integration，不写成通过 |

标准原范围为 JD Management。本报告采用其旅程、U1–U10、证据、P0–P3 和结论门槛；职位字段、JD 审批与发布渠道条款不机械套用于笔试。截图/可访问树只能证明可见页面，不能单独证明权限、持久化、邮件交付或并发行为。

## 证据与线上步骤

| ID | 步骤 / 操作 | 预期 | 实际与证据 | 结论 |
|---|---|---|---|---|
| E01 | GET 线上健康接口 | 服务可达 | 200，`service=hireos-written`，[原始响应](evidence/2026-10-16/health.txt) | 仅环境可达 |
| E02 | HR 从 My Tasks 寻找 W10 前置 Case | 有已发布、可继续的结果 | 4 个 Case 中待发布 1、已结束 1、待发送 2；`Awaiting next step (0)`；页头账号与任务身份不一致，[脱敏观察记录](evidence/2026-10-16/live-observations.txt)及[身份截图](evidence/2026-10-16/01-task-identity.png) | 前置数据阻塞；身份文案问题另列草稿 |
| E03 | 打开待发布 Case 的 Assessment plan / Evaluation result | 已发布后有 Request revision、Add supplemental test | 数据加载完成后计划页显示已定稿未发布的 Round 1 和 `New supplemental test`；结果页显示最终分数、发布前勾选和 `Finalize & publish result`。未点击发布或补测，[观察记录](evidence/2026-10-16/live-observations.txt) | 不能据此断言发布后的入口缺失；初始空草稿是加载态 |
| E04 | 打开已结束 Case 的 Evaluation result | 终态只能回看 | 可见 Published 时间和 `Next action: Testing closed`，无后续动作；结果与关闭原因、反馈与岗位能力存在文案冲突，[观察记录](evidence/2026-10-16/live-observations.txt)、[状态截图](evidence/2026-10-16/02-closed-result-contradiction.png)、[反馈截图](evidence/2026-10-16/03-feedback-domain-mismatch.png) | 不能代替活跃已发布样本；文案问题另列草稿 |
| E05 | 查本地代码与 Issue #48 | 找到线上功能对应实现/决策 | 补充轮入口和草稿服务存在；修订、反馈包、Rescore、Retake 搜索无命中；#48 明确补测由 HR 自行选题，[命令与范围](evidence/2026-10-16/source-and-issue.txt) | 本地静态证据，线上版本待核 |

线上检查没有使用真实候选人信息做判断；本地持久证据已脱敏。浏览器中观察了画面，但未在仓库保存含候选人资料的截图。复测需用专用测试 Case 保存截图、DOM、API/DB 和模拟邮箱记录。

## 10 条用例执行结果

| 用例 / 优先级 | 本轮结果 | 已核实内容与解除条件 |
|---|---|---|
| UC-W10-01 发起修订生成独立新轮 / P0 | **阻塞** | 无可继续的已发布 Case；线上未见可进入的修订流程。须在隔离 `S_result_released` 中核弹窗、反馈披露级别、内部 notes、Round/Invitation/线程、模拟邮件和旧轮锁定。E02–E05 |
| UC-W10-02 反馈为空不能发送 / P2 | **阻塞** | 无修订弹窗或测试 Case；须验证 UI 必填、API 4xx、DB 无新增轮。E02–E05 |
| UC-W10-03 反馈发出后不可修改 / P1 | **阻塞** | 无已发反馈包及认证修改 API；须核只读 UI、直接修改 4xx、固定内容未变。E02/E05 |
| UC-W10-04 未收到答案显示 Not comparable / P1 | **阻塞** | 无 `S_revision_round1_sent`；须核未接受状态、Original 可看、delta=null 且不显示分差。E02/E05 |
| UC-W10-05 候选人接受并邮件提交 / P0 | **阻塞** | 无候选人身份、独立邀请或模拟邮箱；须核接受、修订线程匹配和新 Attempt 所属轮次。E02/E05 |
| UC-W10-06 旧线程不进入新轮 / P0 | **阻塞** | 无双线程样本和 mail ingress 控制；须验证旧线程进入 Needs confirmation 且修订轮无新作答。E02/E05 |
| UC-W10-07 修订对照与评分、原轮不变 / P0 | **阻塞** | 无已提交修订；须核三个 tab、逐问题修正状态、披露级别、修订定稿及原分/Release 不变。E02/E05 |
| UC-W10-08 双击发送只建一轮 / P1 | **阻塞** | 不在真实招聘 Case 执行双发；须用隔离 Case 与模拟邮件核 Round、Invitation 和邮件各一份。E02 |
| UC-W10-09 补测生成 PlanItem 与邀请 / P0 | **阻塞** | E05 表明普通多轮补测本地已有部分实现，**不等于线上整条用例通过**。缺活跃已发布 Case、FIN-002 测试题、模拟发信/API/DB；须核新 PlanItem 类型及未测能力、独立邀请/接受、原题和旧分不变。E02–E05 |
| UC-W10-10 Rescore 与 Retake 分开记录 / P2 | **阻塞** | 无线上入口和隔离数据；本地代码无对应实现命中。须分别核 Evaluation 新版本/Attempt 不增、Retake 新 Attempt/Invitation，以及旧 Release 不变。E02/E05 |

**统计口径**：只有全部预期断言有线上 UI、认证 API/DB、模拟邮箱等相应证据才算“通过”。静态代码与历史 Issue 评论不能替代本轮执行，也不将无法进入的操作记为产品“失败”。

## Acceptance Criteria 对照

| AC | 本轮结论 | 缺口 / 复测断言 |
|---|---|---|
| AC-1 提示→邀请→接受→提交→对照，旧线程隔离 | **未验证** | 缺修订轮和两条线程；需按 UC-01/05/06/07 走完整链路，核 Round/Attempt/邮件归属 |
| AC-2 修订评分不改原分与 Release | **未验证** | 缺两个轮次和定稿操作；前后读取原轮分数及 Release 精确版本/hash |
| AC-3 未收修订显示 Not comparable | **未验证** | 缺已发送未提交修订轮；核 UI 和 `delta=null` |
| AC-4 FIN-002/FIN-008 补测新 PlanItem/邀请、旧分不变 | **未验证** | #48 的普通补充轮实现有历史证据，但本轮未在线上操作；W10 要求的“未测能力”和类型“补证”与 #48 范围不一致，需产品决策后验证 |
| AC-5 反馈发送后不可修改 | **未验证** | 缺反馈包及修改 API；核只读 UI、服务端 4xx 和 DB 原文 |

## 应用性与 UX/UI 审查

**角色/目标**：HR 在发布结果后选择修订、补测、重考或重评；候选人理解新轮反馈、期限并接受；Hiring Manager 对照原稿与修订后评分。理想交接是 W05/W06 邀请接受、W07 线程收件、W08 评分及 W12 比较。当前只走到任务列表、待发布结果与已结束结果的只读检查，不能观察核心新轮旅程。

| 标准 | 结果 | 可观察证据 / 限制 |
|---|---|---|
| U1 容易理解 | **未验证** | 已看页面有 Case 状态和 Round 1；新轮类型、原轮锁定及反馈披露界面未出现。E03–E04 |
| U2 容易上手 | **未验证** | 没有活跃已发布结果，不能检验修订/补测起点。E02 |
| U3 快速完成 | **未验证** | 未走主任务，不能计算步骤、等待和重复输入。E02 |
| U4 下一步明确 | **部分观察，W10 未验证** | 已结束 Case 明示 Testing closed；待发布结果显示发布动作，但没有 W10 可继续状态。E03–E04 |
| U5 提示和按钮清楚 | **未验证** | 修订弹窗、补测抽屉、禁用/错误文案均未出现。E02 |
| U6 符合真实工作 | **未验证** | 未能观察反馈批准、候选人接受、旧线程处理和对照决策。E02 |
| U7 角色信息结构 | **未验证** | 仅一个登录态且身份标签不一致，未比较 HR/HM/Candidate。E02 |
| U8 减少跳转重复 | **未验证** | 无完整新轮路径；只读页面切换不能代替主流程。E02–E04 |
| U9 可恢复可预期 | **未验证** | 未进行双击、断网、500、超时、并发、权限撤销或旧线程注入。E02 |
| U10 可访问可操作 | **未验证** | W10 弹窗和修订页不可达；未测键盘、焦点、错误关联或 200% 缩放。E02 |

JD 标准要求“任何核心权限、持久化或交付结果无法确认时标记未验证”。本轮无认证业务 API/DB、服务端日志、模拟邮箱或角色分离证据，因此权限、数据隔离、独立邀请、反馈不可改和真实交付全部保留未验证。

## 发现、风险与建议

| ID / 定级 | 角色·步骤·证据 | 影响 | 最小修复 / 验收方式 |
|---|---|---|---|
| W10-GAP-01 / **P0，本地实现缺口，线上未复现** | HR/Candidate/HM，旅程 1–8、11；E05 本地应用搜索无修订、FeedbackPackage、Rescore、Retake 实现，E02 无前置线上样本 | 无法按 W10 核心目标完成反馈修订、对照和重考；本地候选版本不满足 AC-1/2/3/5 | 先将 W10 需求与未决批准/Retake 范围写入主 Issue 并决策；实现独立修订/重考模型与入口后，用隔离种子按 UC-01–08/10 和 AC-1/2/3/5 复测 |
| W10-SPEC-02 / **产品决策待定，不记线上缺陷** | HR，补测步骤 9；W10 PRD 要按未测能力选题并标 PlanItem“补证”，[Issue #48](https://github.com/TelyAgent/HireOSV2/issues/48) 明确 HR 自行选题、不做推荐；E05 | 现有多轮补测的交付范围与 W10 AC-4 不一致；直接按其一判失败会混淆需求基线 | 在主 Issue 记录 `[AI-QUESTION]`，明确是手选、能力筛选还是自动推荐，以及 PlanItem 类型；按最终 AC 执行 UC-09 |
| W10-DATA-03 / **P2，测试数据风险** | HR，发起修订步骤 1；[Loop IO](Loop_IO.md) 的 `new_deadline=2026-09-20 18:00 Asia/Shanghai` 已早于本轮测试日期 | 原样执行可能被截止日期校验挡住，或测到过期场景而非正常发起 | 复测 seed 使用未来日期，同时另设过期截止的边界用例；不擅自改产品规格 |
| W10-ENV-04 / **环境阻塞，非 Bug** | 所有角色，E02–E04 | 没有可安全写入的活跃已发布 Case，无法验证发信、评分、持久化与异常路径 | 提供隔离线上 Workspace、`[UJ-TEST]` Case、专用账号、simulation mail、API/DB 只读与可控注入，并给出清理方案 |

另有 E04 的“已结束原因 Passed”与候选人预览“未达到门槛”表述不一致；反馈还提到财务会计和 variance analysis，而可见评分项是 AI Agent 产品能力。[截图](evidence/2026-10-16/02-closed-result-contradiction.png)及[反馈截图](evidence/2026-10-16/03-feedback-domain-mismatch.png)证明页面文案冲突，但缺少该 Case 决策和反馈来源记录，不能据此推定后端数据被改写，也不归为 W10 功能验收结果。E03 初始显示的空草稿是加载态，复核后已排除。

## 结构化 UX Review

```yaml
review:
  product: "Written Test"
  surface: "W10 发布后修订、重考与补测路径"
  role: "HR / Hiring Manager / Candidate（线上仅一个身份，映射未核）"
  journey_goal: "保留原结果，按独立新轮完成反馈修订或补测并对照评分"
  evidence:
    source: "线上只读页面 E01–E04；本地代码与 GitHub Issue E05"
    steps_checked: ["任务入口", "待发布结果", "已结束结果"]
  verdict: "insufficient_context"
  findings:
    - id: "W10-GAP-01"
      severity: "P0"
      category: "state"
      step: 1
      title: "本地候选实现缺少完整修订与重考链路"
      evidence: "E05；线上部署版本未核实"
      user_impact: "无法完成 W10 核心旅程"
      recommendation: "按确认后的 W10 主 Issue 实现并部署独立反馈、轮次、作答与对照"
      acceptance_check: "隔离线上样本执行 UC-01–08/10，核 UI、API、DB 和模拟邮箱"
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
    - "无活跃已发布 Case 与修订轮种子"
    - "无独立 HR/HM/Candidate 身份、模拟邮箱、认证业务 API/DB 或故障注入"
    - "本地 HEAD 未核为线上构建 SHA；#48 不覆盖完整 W10"
```

## 复测所需条件和执行顺序

1. 在 GitHub 确定 W10 主 Issue、其全部评论、AC 和未决决策：反馈/补测是否二次批准、Retake 本期入口、补测选题规则；保留 #48 已有的人为决定，避免将历史补测 AC 改写成未授权行为。
2. 准备隔离线上 Workspace 和 `S_result_released`、`S_revision_round1_sent`，HR/HM/Candidate/受限身份，FIN-001/002/008 题目与原轮 70 分；候选人用 `[UJ-TEST]`、example.com，邮件只进入 simulation adapter。新截止改为执行日之后。
3. 取得线上构建 SHA、认证只读 API/DB、模拟邮箱/收件箱、可控双击与故障注入。先记录原轮分数/Release/题目与线程快照，再按 UC-01–10 执行；每次核 UI、持久化、外部记录和清理结果。对可比性、旧线程、双发、反馈不可改做服务端断言。
4. 按 UX 标准补键盘、焦点、200% 缩放、错误关联、输入保留和角色可见性检查；每个缺陷留步骤、截图/DOM、接口响应与最小复现数据。修复后再判 AC 和整体结果。

本报告只保存本地测试记录；未创建外部 Issue/PR、发布 GitHub 评论或修改线上招聘数据。
