# I09 跨轮 Debrief 与补证：线上测试报告

测试时间：2026-10-15 18:20–18:25（Asia/Shanghai）  
结论：**不通过完整验收**。线上读测证实 Debrief 丢失同一能力的较早轮次意见（AC-3 失败），并发现逐项要求等级与项目概览不一致、完整评分后只显示 `Pass` 而没有最终加权数值。补证闭环、Unknown、AI 跨轮草稿和权限等关键路径缺少隔离测试条件，本轮不判通过。

覆盖：10 条用例中失败 2 条、未验证 8 条；7 条 AC 中失败 1 条、未验证 6 条。另有 2 条 FR / 信息一致性问题。这里的“失败”限于已看到的 UI 断言，不代替服务端数据结论。

## 1. 依据、环境与方法

| 项 | 内容 |
|---|---|
| 产品依据 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[User Cases](User_Cases.md)；AC-1～7、UC-I09-01～10、P1～P9。文档是 v1.0 草稿、待评审 |
| UX 依据 | [UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的逐步取证、U1～U10、P0～P3 和报告格式。JD 专属字段与发布规则不套用于 I09 |
| 线上入口 | `https://hireos.aipollo.me/hireos/interview/`；Chrome 已登录，页头显示“蔡敏”，业务界面为英文；未取得线上构建号及服务端角色证明 |
| 样本 | 工作区现有“03 / 高级后端工程师”演示项目，状态 `Package published`，2/2 轮已完成，Rubric v1 已确认，8 项能力均有人工分。报告不记录候选人姓名、原文评语或转写 |
| 操作 | 只读打开 Overview、Rubric、Review 第 1/2 轮和 Debrief；展开能力卡；刷新/切换页面核对。没有创建项目、改分、发起 AI 生成、补证、决定、发送消息或操作服务器 |
| 证据层级 | 线上浏览器可访问树和可见控件；本地源码与自动检查单列。没有 API 原始响应、数据库、审计、AI 调用记录或独立身份 |

## 2. 线上逐步证据

| 证据 / 旅程步骤 | 实际操作与观察 | 可支持的结论及限制 |
|---|---|---|
| E-01 / 入口 | 首页现有样本显示 `Package published`、`2 / 2 rounds completed`；进入项目，Overview 显示一个 Must-have 要求 **L4**，该项目的 Debrief 标签可用 | 证明样本可进入完整 Debrief；不能证明 I09 的目标 seed（Security Unknown）已提供 |
| E-02 / 标准 | Rubric 页写 `Rubric v1 confirmed`、8 张能力卡，`Weights total 105%`；其中第一项权重 18% | 证明当前样本权重未归一到 100%；这是上游标准数据问题，不能把它单独归因于 I09 |
| E-03 / 步骤 1～2 | Debrief 页显示 `SCORED 8 / 8`、`MUST-HAVE COVERAGE 6 / 6`、`EVALUATED WEIGHT 100%`、`OVERALL SCORE Pass`。逐项卡列 Must-have、权重、分数和状态；上述 Overview 的 L4 项在 Debrief 写 `Required L3` | 证明完整评分有汇总和状态；没有**最终加权数值**，且本项目的要求等级跨页不一致。`100%` 是覆盖率，不是最终分数 |
| E-04 / 步骤 1、4 | Review 第 1 轮中“缓存、异步任务、消息队列、限流和降级”Must-have 显示 **Below bar**，有人工说明；第 2 轮同一项显示 **Meets bar**，有不同人工说明。Debrief 展开该项只显示 `RECORDED (HUMAN) · Round 2`、分数 3 和第 2 轮说明；没有第 1 轮分数、意见、反证或打开其追溯的控件 | **AC-3 的 UI 断言失败**：两轮意见没有同时保留为可见证据。不能据此判断数据库中第 1 轮记录是否已删除；Review 第 1 轮仍能读到它 |
| E-05 / 步骤 1 | 展开另一张能力卡，Debrief 仅有一块 `RECORDED (HUMAN) · Round 1` 和一块 `AI DRAFT (ALL ROUNDS)`；后者写 `No AI draft yet`，页上有 `Generate AI draft` | 证明目前无跨轮 AI 草稿、存在手动生成入口；没有调用生成，所以不判断 AI 评分、引用、分歧列表与重试结果 |
| E-06 / 步骤 5～7 | 当前已发布样本的 Debrief 无 `Request more evidence`、证据图或 `Continue to decision` 操作；项目导航可直接进入已完成的 Decision | 对当前**已完成项目**，不能把缺按钮直接等同于未完成项目的入口失败；结合本地实现可列为实现缺口，需在目标 seed 上复核 |

## 3. 用例执行结果

| 用例 | 结果 | 依据 / 未满足的测试条件 |
|---|---|---|
| UC-I09-01 部分评估不显示最终分 | 未验证 | 线上无 `one_unscored` 隔离样本；现有样本 8/8 |
| UC-I09-02 Must-have Unknown 单独突出 | 未验证 | 无 `security_unknown` 样本；不能用全达标样本外推 |
| UC-I09-03 两轮分歧都保留 | **失败（UI）** | E-04：Review 两轮同项结论不同，Debrief 只显示第 2 轮 |
| UC-I09-04 AI 与人工差 ≥2 级 | 未验证 | E-05 无 AI 跨轮草稿；没有执行生成或构造 `ai_gap` |
| UC-I09-05 发起补证 | 未验证（已知实现缺口） | 无 `followup` seed；E-06 为已发布样本，无合适入口和 DB 核验 |
| UC-I09-06 补证完成后刷新 | 未验证（已知实现缺口） | 无已提交的补证轮 |
| UC-I09-07 双击只生成一个补证轮 | 未验证（已知实现缺口） | 无创建入口，且缺 API/DB 唯一性证据 |
| UC-I09-08 全部评分后显示最终分 | **失败（UI）** | E-03：全部评分后显示 `Pass`，没有数值加权分；`EVALUATED WEIGHT 100%` 只表示覆盖率 |
| UC-I09-09 AI 跨轮草稿失败 | 未验证 | 未向线上注入 `llm_fail`；E-05 只证明没有草稿及可见生成按钮 |
| UC-I09-10 Interviewer 不能进入 Debrief | 未验证（已知实现缺口） | 无独立 `interviewer_a` 账号及服务端 403 证据 |

## 4. AC 与功能需求判定

| 条目 | 判定 | 解除条件 |
|---|---|---|
| AC-1 部分评估与覆盖率 | 未验证 | 准备 `one_unscored`，核无最终分且覆盖率按有效权重计算 |
| AC-2 Must-have Unknown | 未验证 | 准备 Security Unknown 且其他项高分的 seed，核单独突出和不被抵消 |
| AC-3 两轮意见与反证 | **失败** | E-04；同项在两轮有不同评分时，Debrief 同时展示两轮分数、说明、支持与反证，刷新后仍在 |
| AC-4 AI/人工差距与双追溯 | 未验证 | 准备 `ai_gap`，检查阈值、两条链及来源 |
| AC-5 补证、状态、决定阻断 | 未验证 | 准备目标 seed，创建一次补证，核计划、状态、决定页和 DB |
| AC-6 补证后刷新 | 未验证 | 提交补证轮并核新证据、Unknown 更新和新决定要求 |
| AC-7 双击幂等 | 未验证 | 在隔离数据上重复提交并检查仅一个请求、一个轮次 |
| FR-1 逐项要求等级 | **失败（跨页一致性）** | E-01/E-03：同一 Must-have 在 Overview 要求 L4、Debrief 显示 L3；须使用确认的逐项等级 |
| FR-3 全部评分后最终加权分 | **失败（UI）** | E-03：只有 Pass，无数值分。先确定 105% 权重的归一规则，再显示计算过程 |

## 5. 问题、严重度与修复验收

| ID / 级别 | 角色、步骤、证据 | 用户影响 | 最小修复与复测 |
|---|---|---|---|
| I09-UX-01 / **P1，AC-3 阻断** | Hiring Manager，步骤 1/4；E-04 | Debrief 以较新轮分覆盖较早轮分，讨论者看不到同项的不同意见及其依据，容易误判已经达成一致 | 每张能力卡按轮次列出所有人工评分、说明、支持证据与反证，并标识跨轮结论；用 2/3 或 2/4 分歧 seed 复测两条都可见，且与 Review 一致 |
| I09-UX-02 / **P1，FR-1** | Hiring Manager，步骤 3；E-01/E-03 | L4 底线在 Debrief 变成 L3，可能将不达标误判为达标 | 使用 Rubric 确认的逐项要求等级判断状态；跨 Overview、Rubric、Review、Debrief 比对同一版本 |
| I09-UX-03 / **P1，FR-3 / UC-I09-08** | Hiring Manager，步骤 2；E-02/E-03 | `OVERALL SCORE Pass` 隐去加权数值，且当前确认的权重合计 105%，使用者无法复核汇总结果 | 先修正或明确归一权重规则；全部评分时显示数值、分母、状态和版本；部分评分时不显示最终分 |
| I09-UX-04 / **P1，待目标 seed 线上复核** | Hiring Manager，步骤 5；E-06 + 本地 `DebriefPage.tsx` | 补证动作在当前 UI 实现中没有对应流程，证据不足时难以从 Debrief 闭环 | 实现缺口、负责人、形式、截止日期、补证轮和状态；在未完成的 Unknown seed 上验证。E-06 单独不构成线上失败证据 |

## 6. U1～U10 应用性检查

| 项 | 判定 | 证据与限制 |
|---|---|---|
| U1 容易理解 | 失败 | E-03：`OVERALL SCORE Pass` 与“最终加权分”概念不一致；同项 L4/L3 冲突 |
| U2 容易上手 | 部分验证 | 项目导航及可展开卡片清楚；缺口 seed 的补证入口未测 |
| U3 快速完成任务 | 部分验证 | 可从项目打开 Debrief、展开卡；未执行补证主任务 |
| U4 下一步明确 | 未验证 | 当前样本已发布；无未完成项目的下一步证据 |
| U5 提示和按钮清楚 | 部分验证 | `Generate AI draft` 与人工分区分；最终分标签误导 |
| U6 符合真实工作方式 | 失败 | E-04：跨轮讨论时需回 Review 切轮才能找回旧意见 |
| U7 信息结构符合角色 | 失败 | E-04：Hiring Manager 需要比较分歧，汇总只提供一轮意见 |
| U8 减少跳转 | 失败 | 为核同项两轮理由必须离开 Debrief 返回 Review 并切轮 |
| U9 可恢复和可预期 | 未验证 | 未注入 AI 失败、断网、并发或重复提交 |
| U10 可访问、可读、可操作 | 部分验证 | 卡片有按钮及展开状态文字；未做键盘、读屏、200% 缩放、焦点与对比度检查 |

```yaml
review:
  product: "Interview / I09"
  surface: "Review 两轮 → Debrief 汇总"
  role: "已登录账号（页头蔡敏；HM/HR 服务端角色未核实）"
  journey_goal: "比较跨轮证据、分歧与底线；必要时发起补证"
  evidence:
    source: "线上 Chrome 可访问树、页面切换与展开观察；本地源码另列"
    steps_checked: [1, 2, 3, 4]
  verdict: "fail"
  findings:
    - {id: "I09-UX-01", severity: "P1", category: "state", step: 4, title: "同项旧轮意见未在 Debrief 展示", evidence: "E-04", user_impact: "跨轮分歧不可在汇总中复核", recommendation: "按轮列全部意见与反证", acceptance_check: "分歧 seed 的两轮记录同时可见"}
    - {id: "I09-UX-02", severity: "P1", category: "state", step: 3, title: "要求等级跨页不一致", evidence: "E-01/E-03", user_impact: "可能误判 Must-have", recommendation: "以确认的逐项标准判断", acceptance_check: "同版本各页等级一致"}
    - {id: "I09-UX-03", severity: "P1", category: "clarity", step: 2, title: "完整评分无最终加权数值", evidence: "E-02/E-03", user_impact: "无法复核汇总计算", recommendation: "明确归一规则并展示数值与分母", acceptance_check: "完整与部分评分分别显示正确状态"}
  usability_check:
    understandable: "fail"
    learnable: "unknown"
    efficient: "unknown"
    next_action_clear: "unknown"
    controls_clear: "unknown"
    real_workflow_fit: "fail"
    role_information_fit: "fail"
    no_unnecessary_hops: "fail"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "缺目标 seed、独立身份、故障注入、线上构建号、API/DB/审计证据"
    - "已有演示项目为已发布状态，不代表未完成项目的补证入口"
```

## 7. 本地核查与复测条件

本地工作区代码说明：`tasks.service.ts` 的 Debrief 读取所有轮次分数后，按 `updatedAt` 只为每张能力卡保留一条；前端每张卡仅渲染一个 `RECORDED (HUMAN)`。后端使用全局 `DEBRIEF_BAR = 3`，并只返回 `pass/fail` 总体结果。前端 `DebriefPage.tsx` 没有补证弹窗或证据图。这些是**当前工作区实现观察**，线上构建号未核，不能替代线上 API/DB 验证。

| 子项目 | 实际命令与结果 |
|---|---|
| interview 后端 | `npx prisma generate`、`npm run build`、`npm run lint`、`npm run typecheck` 均通过；`npm test`：10 条中 7 通过、3 失败。3 条测试启动即因本机缺可解析的 `DATABASE_URL` 报 `ERR_INVALID_URL`，属于测试环境前置条件，不能归为 I09 功能失败 |
| interview 前端 | `npm run build`、`npm run typecheck` 通过；构建提示单个 bundle 大于 500 kB。`package.json` 无 lint/test script，本轮未编造执行 |

复测前准备：`S_all_rounds_scored_security_unknown`、`S_all_rounds_fully_scored`、`S_followup_round_submitted` 和 `one_unscored`/`split_scores`/`ai_gap`；独立 HM、HR、Interviewer 身份；可控的 `llm_fail` 与双击注入；只读 API/DB/审计访问及线上构建号。对每条用例分别记录 UI、API、DB 和外部副作用断言。确认补证入口归属、人工分歧阈值及权重归一规则后再做完整验收。

本轮只新增本地测试报告；未修改线上数据、未创建 Issue/PR、未部署、未提交或推送。工作区其他现有未提交改动均保留。
