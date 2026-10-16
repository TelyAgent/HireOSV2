# W04 候选人测评计划线上测试报告（2026-10-16）

## 1. 结论与边界

**结论：不通过（fail）。** 线上可以浏览计划、从任务进入 Case、预览题库题、生成 AI 题干草稿，并在历史轮次看到只读内容；但 W04 的核心任务「确定题目、条件和版本，确认后冻结为待发送版本」没有完整操作路径。Owner、提交截止时间、计划确认/冻结、前置条件与计划版本均无可见入口。依据 [UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 第 7 节，核心任务存在 P0 时不能通过。

该标准原用于 JD Management；本报告复用其用户旅程、U1–U10、证据、严重级别和判定规则。JD 专属的薪资、JD 审批/激活/发布字段不套用于 W04。

| 项 | 本轮记录 |
|---|---|
| 线上入口 | [My Tasks](https://hireos.aipollo.me/hireos/written/tasks) → Case 计划页 |
| 时间/时区 | 2026-10-16 约 11:56–12:00，Asia/Shanghai |
| 浏览器 | Chrome，桌面视口约 1176×719，英文 UI |
| 角色 | 顶栏显示「蔡敏」，My Tasks 显示「Signed in as John · HR Head · Aurora Studio」；实际账号权限映射未取得 |
| 规格 | [PRD](PRD.md)、[User Cases](User_Cases.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[公共 seed 约定](../README.md#公共约定) 及上述 UX/UI 标准 |
| 线上样本 | 待测空计划、待测含 `Q-0001` 草稿计划、待发布且含已发送 Round 1 的计划。题库只有 `Q-0001`、`Q-0002`；无 FIN-001/002/009 或 Riley 未确认关系 seed |
| 版本身份 | 本地参考 HEAD `c4b6105`，不是线上构建号；页面未显示线上构建 SHA |
| GitHub 身份 | 未收到关联主 Issue/PR；用 `gh issue list --state all --limit 100` 按 W04/测评计划检索未命中专属 Issue。本报告是线上探索测试，不冒充合并后绑定 SHA 的正式 QA |
| 数据变更 | 未保存、删除任何计划项，未新建轮次或发送邀请。AI 只生成抽屉内草稿，随后取消；题库选择后取消 |

本轮没有测试专用 Case、独立身份、认证 API/数据库/服务端日志、故障注入能力。**可见 UI 状态不能证明服务端权限、题库原题不变、持久化、幂等、历史 Attempt 归属或真实发信结果。** 由于现有 Case 对应真实候选人，本轮没有把提交/删除/外发类操作作用于这些记录。测试结果中的「阻塞」仅表示无法执行，不自动算作产品失败。

## 2. 证据索引

截图在 [`evidence/2026-10-16/`](evidence/2026-10-16/)；截图包含线上候选人个人信息，内部评审时按招聘数据权限处理。E06 原页面曾短暂显示加载前的空草稿，已等真实数据加载完成后才采信最终状态。

| ID | 截图 | 可复核观察 |
|---|---|---|
| E01 | 空计划（本地证据，含个人信息，未入库） | 四 tab、面包屑、目标、空状态；发送按钮因没有题目而禁用 |
| E02 | 题库无同岗位题（本地证据，含个人信息，未入库） | 全栈工程师计划的题库下拉无可选题；Approved v1 提示存在 |
| E03 | AI 输入（本地证据，含个人信息，未入库） | Test focus、三个通用建议；提示无关联 JD/简历文本，仅据岗位名称生成 |
| E04 | 空输入校验（本地证据，含个人信息，未入库） | 点击 Confirm generate 后提示 `Enter a test focus first.` |
| E05 | AI 生成草稿（本地证据，含个人信息，未入库） | 输入全栈 API/UI 设计焦点后生成相关题干；DOM 显示四项 Rubric 权重 45/25/15/15，总和 100% |
| E06 | 历史轮次（本地证据，含个人信息，未入库） | 待发布 Case 的 Round 1 状态、发送日期、截止日期和分数摘要 |
| E07 | 已发送只读（本地证据，含个人信息，未入库） | 展开历史轮次显示题干及 `Sent rounds are read-only.`，无编辑/删除控件 |
| E08 | 未发送草稿（本地证据，含个人信息，未入库） | Round 1 draft 含 Q-0001，显示 Edit/Delete/Send；没有 Owner、计划确认或前置条件 |
| E09 | 编辑抽屉（本地证据，含个人信息，未入库） | 可编辑题干、Save changes；未保存 |
| E10 | 从题库选择（本地证据，含个人信息，未入库） | 已在草稿中的 Q-0001 仍可选，题干预填；未再次提交 |
| E11 | [任务页身份](evidence/2026-10-16/11-task-identity.png) | 同一页面顶栏显示「蔡敏」，工作台显示「Signed in as John · HR Head」 |

## 3. 执行步骤与 12 条用例

结果按整条 UC 判定；「部分」只代表已观察的子步骤，不折算为通过。

| 用例 | 结果 | 实际操作和观察 | 缺口/证据 |
|---|---|---|---|
| UC-W04-01 计划页结构与空状态 | **部分/失败** | 从 My Tasks 进入空计划，四 tab、面包屑、验证目标和 Add 入口可见。 | Owner、提交截止时间不显示，FR-3 未满足。E01 |
| UC-W04-02 从题库添加且原题不变 | **部分/阻塞** | 在同岗位草稿 Case 选 Q-0001，原题干预填，显示 Approved v1 与候选人级修改说明。 | 无 FIN-001 seed；未提交候选人级修改，无法比较保存后计划快照和题库原题。E08–E10 |
| UC-W04-03 概念题不可加入 | **阻塞** | 线上题库仅 Q-0001/0002；可见选择器按岗位过滤。 | 无 FIN-009，未执行 UI 概念题门禁和 POST 4xx。E02、E10 |
| UC-W04-04 AI 生成题目 | **部分** | 输入非敏感测试焦点，点 Generate with AI 后出现相关题干和四项 Rubric，随后取消。 | 未点 Confirm generate，因此未证明保存快照、刷新持久化或二次运行稳定质量；没有原定 FIN 岗位 seed。E03、E05 |
| UC-W04-05 AI 输入校验与失败 | **部分/阻塞** | 空 Test focus 点确认，出现准确提示且无计划项新增。 | 未注入 `llm_fail`，失败保留输入及重试未验证。E01、E04 |
| UC-W04-06 双击添加只加一项 | **阻塞** | 未向真实候选人计划提交新增项。 | 需独立测试 Case、双击注入及后端条数证据。 |
| UC-W04-07 编辑、删除未发送项 | **部分/阻塞** | 草稿 Q-0001 提供 Edit/Delete；Edit 抽屉可编辑，取消后原页面保持。 | 未保存或删除真实记录，toast、持久化和删除后的数量未验证。E08、E09 |
| UC-W04-08 已发送项不能修改 | **部分** | 已发送 Round 1 可展开；题干只读，无 Edit/Delete，明确提示只读。 | 未调用认证 PATCH/DELETE，无法确认服务端 4xx 与快照不变。E06、E07 |
| UC-W04-09 确认计划后冻结待发送 | **失败** | 待测草稿只有 Add 和 Send；文字只说明 Send 之前不会发出，没有单独的 Confirm/Freeze 操作。 | 无法产生独立待发送版本及证明没有 Invitation；FR-8 所要求的确认步骤缺失。E08 |
| UC-W04-10 补测新版本与旧作答 | **部分/阻塞** | 已完成 Round 1 页面有 `New supplemental test`，历史轮次只读。 | 没有 FIN-002/原分 70 seed；未对真实 Case 新开轮次；没有补证类型、计划版本与旧 Attempt 关联证据。E06、E07 |
| UC-W04-11 前置满足只生成待确认任务 | **失败/阻塞后半** | 当前草稿和编辑抽屉没有前置条件设置入口。 | 无法建立 FIN-001→FIN-002 前置关系，因而不能执行满足条件后的任务/邀请检查。E08、E09 |
| UC-W04-12 未确认关系不能发送 | **阻塞** | 空计划的 Send 因「至少一题」禁用；这不是关系门禁证据。 | 无 `S_core_candidate_unlinked`，未见指定提示，未调用邀请 API。E01 |

汇总：**0 整条通过；7 部分（其中 4 条的后半被环境阻塞）、2 失败、3 阻塞**。UC-W04-11 因前置条件配置入口缺失判为失败；其后续任务/邀请验证仍阻塞。统计不把部分/阻塞项目算作通过。

## 4. Acceptance Criteria 与业务规则

| 项 | 结论 | 证据与复测条件 |
|---|---|---|
| AC-1 未确认招聘关系不能发送 | **未验证** | 现有空计划因无题目禁用发送，无法隔离关系条件；需 Riley 未确认关系测试 Case，并在有题时查 UI 和邀请 API 4xx。E01 |
| AC-2 候选人级修改不改变题库原题 | **未验证** | Q-0001 选择与编辑入口可见，但没有提交；需专用 Case 保存修改后，对比计划项快照与题库原题的 UI/API。E09、E10 |
| AC-3 已发送项不能编辑/删除 | **UI 部分通过，服务端未验证** | 历史轮次无编辑/删除且有只读说明；需认证 PATCH/DELETE 4xx 与邀请快照不变证据。E07 |
| AC-4 修改生成新计划版本且旧 Attempt 可见 | **未验证/核心路径缺失** | 历史 Round 1 可见，但没有可见的计划版本或 History 版本对比；需专用已完成 Attempt seed 和版本/关联查询。E06、E07 |
| AC-5 前置满足生成待确认任务、不自动邀请 | **失败/后续未验证** | 当前计划 UI 没有前置条件配置；需可配置依赖的测试 Case、任务和邀请的 API/DB/邮件 adapter 证据。E08、E09 |
| AC-6 FIN-002/008 补测不改变旧分数 | **未验证** | 有新补测入口和只读历史轮次，但无 FIN 题库/旧分数 70 seed；不得把显示 Round 1 当作旧分数不变的证明。E06、E07 |
| BR-7 概念题不得入可发送计划 | **未验证** | 无 FIN-009；需 UI 选择器、计划 POST 与最终邀请三处验证。E02 |

## 5. 按用户旅程的 UX/UI 审查

主角色为 HR / Recruiter，目标是为一个候选人确定题目、Owner、截止时间、类型和前置条件，确认计划后交给 W05 发送。实际可走通的可见路径是「My Tasks → 计划 → 题库/AI 草稿 → 直接 Send」。

| 步骤 | 用户动作 | 预期 | 实际与证据 | 结论 |
|---|---|---|---|---|
| 1–3 | 进入计划并判断任务 | 四 tab、候选人/岗位/状态、目标、Owner、截止时间、空状态 | 四 tab、状态、目标和空状态可见；Owner/截止时间缺失。E01 | 部分 |
| 4–5 | 选择题库或 AI 出题 | 已批准题目快照；岗位建议、题干和 Rubric | Q-0001 可预览；全栈岗位无题可选；AI 提示仅根据岗位名称，生成相关草稿及 Rubric。E02–E05、E10 | 部分 |
| 6–8 | 编辑/删除草稿、查看已发送 | 草稿可操作，已发送只读 | 草稿控件与编辑抽屉可见；历史轮次只读。E07–E09 | UI 部分 |
| 9 | 确认计划 | 冻结为待发送版本，和真正发送分开 | 没有确认/冻结控件，只有直接 Send。E08 | 失败 P0 |
| 10–12 | 提交、补测、关系门禁 | 状态、旧成绩保留、未确认关系禁发 | 可见历史轮次和补测入口；没有必要 seed/API 证据。E06、E07 | 未验证 |

### U1–U10 应用性检查

| 项 | 结论 | 证据与用户影响 |
|---|---|---|
| U1 容易理解 | **失败** | 顶栏身份「蔡敏」与 My Tasks「John · HR Head」不一致；计划页面未显示明确的计划版本，HR 无法确认当前身份与版本。E01、My Tasks 可访问 DOM |
| U2 容易上手 | **部分** | 空状态和 Add 清楚；全栈岗位题库没有题目时，只出现空下拉与通用 Approved v1 文案，缺少「本岗位无可用题」和可行下一步。E01、E02 |
| U3 快速完成任务 | **失败** | 不能在页面设置 Owner、截止时间、前置条件或独立确认计划；HR 无法完成完整计划准备。E08、E09 |
| U4 下一步明确 | **失败** | 直接 Send 取代「确认后待发送」，计划的负责人、截止时间、等待原因不可见。E08 |
| U5 提示和按钮清楚 | **部分** | 空计划 Send 的禁用原因有文字提示，已发送只读有说明；`Confirm generate` 同时用于题库选择和 AI 生成，动作含义不准确。E01、E07、E10 |
| U6 符合真实工作方式 | **失败** | 无法制定串行/并行与补证/修订类型，也无法在发信前锁定可审阅版本。E08、E09 |
| U7 信息结构符合角色目标 | **失败** | 页面重心是题干，HR 决策所需的 Owner、截止时间、计划状态与下一步缺失；角色差异未取得测试身份验证。E08 |
| U8 减少重复和跳转 | **部分/未知** | 四 tab 同页可切换，面包屑可返回 My Tasks；返回后的列表筛选保留与多轮操作成本未测。E01 |
| U9 可恢复和可预期 | **未知** | 空输入有提示，AI 成功可见；故障/并发/未知结果和保存失败未注入。E04、E05 |
| U10 可访问、可读、可操作 | **未知** | 可见状态有文字且抽屉有标题/关闭按钮；未做 200% 缩放、完整键盘焦点、屏幕阅读器及错误字段关联测试，不能宣称无障碍通过。E03、E07 |

### 可行动发现

| ID/级别 | 旅程步骤与证据 | 对角色目标的影响 | 最小修复与验收方式 |
|---|---|---|---|
| W04-UX-01 **P0** | 步骤 9：草稿仅有 Add/Send，无确认/冻结。E08 | 无法先确认可追溯计划再决定发送，核心 W04 目标不成立 | 增加明确的确认/冻结动作和独立待发送状态；确认后核对版本快照存在、Invitation/发信记录为零，再单独发送 |
| W04-UX-02 **P1** | 步骤 2、9：Owner/截止时间不可见。E01、E08 | HR 不知道责任人与完成时间，无法交接或追期 | 展示并可设置 Owner、截止时间及未设置状态；刷新后核对持久化和角色可见性 |
| W04-UX-03 **P1** | 步骤 6、11：计划项无类型/前置条件配置。E08、E09 | 无法规划补证、修订、串行或并行测试 | 为草稿项提供类型和依赖设置；核对前置完成只创建待确认任务，不创建 Invitation |
| W04-UX-04 **P1** | 步骤 1：顶栏「蔡敏」，My Tasks「John · HR Head」。E11 | 使用者无法确认当前操作身份及授权范围 | 统一身份来源；以两个真实角色会话核对顶栏、工作台、权限与审计身份一致 |
| W04-UX-05 **P2** | 步骤 4：无同岗位题时空下拉仍显示 Approved v1。E02 | HR 需要试错才知道没有题可用 | 显示明确空状态、题库/AI 下一步；用无题岗位验证 |
| W04-UX-06 **P2** | 步骤 4：题库模式主按钮 `Confirm generate`。E10 | 把选题误认为 AI 生成，操作结果不清楚 | 题库模式改为「Add to plan」，AI 模式保留生成/确认语义；验证按钮与实际副作用一致 |

```yaml
review:
  product: "Written Test / W04 Assessment Plan"
  surface: "My Tasks → Case plan → question drawer → sent round"
  role: "HR / Recruiter（页面角色显示冲突，实际权限未核实）"
  journey_goal: "确定候选人的测试内容、条件和版本，确认后待发送"
  evidence:
    source: "线上 Chrome UI、可访问 DOM、E01–E11 截图；本地源码仅作交叉核对"
    steps_checked: [1, 2, 3, 4, 5, 6, 8, 9, 11]
  verdict: "fail"
  findings:
    - {id: "W04-UX-01", severity: "P0", category: "state", step: 9, title: "缺少独立的计划确认/冻结动作", evidence: "E08", user_impact: "HR 无法形成可审阅的待发送版本", recommendation: "增加确认及独立待发送状态", acceptance_check: "确认后有版本快照且没有 Invitation"}
    - {id: "W04-UX-02", severity: "P1", category: "next_action", step: 2, title: "Owner 与截止时间缺失", evidence: "E01、E08", user_impact: "无法分工和追期", recommendation: "展示和设置 Owner、截止时间", acceptance_check: "保存刷新后可见且权限正确"}
    - {id: "W04-UX-03", severity: "P1", category: "state", step: 11, title: "缺少类型和前置条件配置", evidence: "E08、E09", user_impact: "无法规划补测和依赖", recommendation: "提供补证/修订及串行/并行配置", acceptance_check: "依赖满足只产生待确认任务"}
    - {id: "W04-UX-04", severity: "P1", category: "permissions", step: 1, title: "页面身份显示冲突", evidence: "E11", user_impact: "操作者无法确认自己的角色和授权", recommendation: "统一身份来源", acceptance_check: "多角色会话的顶栏、任务、审计一致"}
    - {id: "W04-UX-05", severity: "P2", category: "learnability", step: 4, title: "空题库缺少解释和下一步", evidence: "E02", user_impact: "选题需试错", recommendation: "显示无同岗位题的空状态", acceptance_check: "无题岗位有明确替代入口"}
    - {id: "W04-UX-06", severity: "P2", category: "clarity", step: 4, title: "题库选择按钮误称生成", evidence: "E10", user_impact: "操作结果含糊", recommendation: "题库模式使用 Add to plan", acceptance_check: "两种模式按钮与副作用一致"}
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
    - "缺少专用 seed、角色和认证 API/数据库证据"
    - "未执行高影响写入、故障注入和 200% 缩放/完整键盘审查"
    - "线上构建 SHA 未知；本地源码不视为生产行为证据"
```

## 6. 源码交叉核对与证据限制

以下是本地参考提交的源码观察，**不等同于线上构建已部署**：

- [`PlanPage.tsx`](../../../../hireos-written/hireos-written-front/src/pages/PlanPage.tsx) 的草稿区域直接提供 Add 和 Send；`startSupplementalRound` 打开新草稿轮次，没有独立的确认计划步骤。页面的目标文本由岗位和第一道题能力拼装，未见 Owner/截止时间输入。
- [`AssessmentQuestionDrawer.tsx`](../../../../hireos-written/hireos-written-front/src/components/AssessmentQuestionDrawer.tsx) 用岗位过滤已发布题库；AI 无 JD/简历时退化为岗位名称；题库与 AI 模式共享 `Confirm generate`。本地 `handleConfirm` 在异步 `onConfirm` 返回前即提示成功，因此需要用失败注入复核线上是否会出现错误成功提示。
- [`plan-item.dto.ts`](../../../../hireos-written/hireos-written-backend/src/plan-items/plan-item.dto.ts) 的 `kind` 只允许 `required | optional`，无补证/修订值；[`plan-items.service.ts`](../../../../hireos-written/hireos-written-backend/src/plan-items/plan-items.service.ts) 可见创建计划项的快照字段，但本轮无生产数据库证据。

没有执行本地 build、lint、type check、unit 或 integration；这些不能记为线上通过。没有制造网络故障、修改真实招聘记录或发送任何候选人通知。

## 7. 复测条件与交接

1. 提供隔离的线上测试 Workspace/身份及每条 UC 独立 seed：`S_case_plan_empty`、`S_case_plan_ready`、`S_inv_sent_deadline`、`S_result_final_unreleased`、`S_core_candidate_unlinked` 和 FIN-001/002/008/009 题库；测试候选人使用 `[UJ-TEST]` 与 example.com，发信接 simulation adapter，并说明清理机制。
2. 提供可记录的线上构建 SHA、主 Issue/PR、认证 API/数据库只读核对方式及 `llm_fail`、双击、并发注入能力。逐项保留请求、状态码、计划/邀请/Attempt 版本和邮件 adapter 证据。
3. 明确 PRD 待确认的计划批准、候选人级修改版本归属、补证/修订类型规则，并写回主 Issue。确认行为规则后修复 P0/P1，再按 AC-1–AC-6 与 U1–U10 复测。

本报告只保存本地审查结果和证据；未创建外部 Issue/PR 或发布 GitHub 评论。
