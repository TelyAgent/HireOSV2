# I06 面试 Brief｜线上测试报告

| 项目 | 结果 |
|---|---|
| 测试时间 | 2026-10-15 18:10–18:14（北京时间） |
| 补充复核 | 2026-10-15 21:08（北京时间），对照第 2 轮计划与 Brief 问题范围 |
| 环境 | [HireOS Command Interview 线上工作区](https://hireos.aipollo.me/hireos/interview/)；Chrome，当前登录账号 |
| 依据 | [I06 PRD](PRD.md)、[User Cases](User_Cases.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) |
| 总结 | **不通过**。9 条用例：失败 3、部分符合 1、未验证 5、完整通过 0。发现 1 项 P0、4 项 P1、1 项 P2；缺少指定 seed 和测试身份的项目不计为通过。 |

## 1. 范围与方法

按 Interviewer 开面前「看岗位与候选人背景 → 区分事实、未知和待核实说法 → 看本轮重点及问题 → 打开来源 → 进入下一步」的旅程，读取线上页面、可访问性树、导航结果和按钮反馈。借用 JD Management 审查标准中通用的 U1–U10、证据要求和严重级别；不将 JD 发布/审批规则套用于 I06。

本次使用两个现有项目，报告中分别称为 A、B，避免记录候选人个人信息：

- [项目 A：下一轮已排期](https://hireos.aipollo.me/hireos/interview/project/5f57f693-470d-4d27-96dd-592aafdd8db6/brief)：第 1 轮已完成，第 2 轮已排期；Overview 显示简历、筛选包、测评结果均为 `Not provided`。
- [项目 B：计划已确认、首轮未排期](https://hireos.aipollo.me/hireos/interview/project/2b638734-2bc3-4f61-bd8a-54684964ed42/brief)：Brief 显示 `No résumé attached`，Overview 的两轮均未排期。

只执行了页面读取、点击来源入口和 `View plan →` 等导航。没有创建/上传材料、生成或重试 AI 内容、修改排期、开始面试、提交反馈、调用写入 API，也没有操作线上数据库。当前账号与文档所列 HR / Interviewer 身份的映射未核实。仓库代码仅用于解释已观察现象及标明实现边界，不代替线上 API/DB 证据。

## 2. 线上实测路径

| 步骤 | 操作与预期 | 实际结果 | 判断 |
|---|---|---|---|
| 1 | 打开项目 A，按三栏查看 Known / Unknown / Claims 及筛选、测评缺失状态 | 页面有 `BACKGROUND SUMMARY`、Business capability lane、HR verification lane；显示 `No résumé attached` 和 `Candidate résumé matching isn't wired up yet`，但没有三栏，也没有在 Brief 内把筛选/测评标为 `Not provided`。 | AC-1 所需缺失状态未满足；FR-2 未满足。 |
| 2 | 核对待核实说法是否确实来自项目材料 | 项目 A、B 均显示 `No résumé attached`，同时 HR `AI risk flags` 都声称简历写有 `led migration to microservices`。项目 B 是设计岗位，却出现同一条微服务迁移说法。 | **P0：没有简历仍呈现具体“简历说法”，容易污染面试判断。** |
| 3 | 点击项目 A 上述 Claim 的 `Résumé` 来源入口，预期在抽屉中打开原证据 | 页面未离开 Brief，但只出现一条重复该说法的提示消息；没有原始简历或来源抽屉。 | 来源不可核验；不能将该提示当成来源证据。 |
| 4 | 查看推荐重点和问题 | 项目 A、B 都按 Rubric 卡片显示推荐问题，并按 Situation / Task / Action / Result 排序；有 `View in rubric` 和 `View plan →`。项目 B 的 `View plan →` 能进入计划页。 | 问题展示和计划跳转部分符合 FR-4；未核验线上 API 的问题生成输入版本。 |
| 5 | 核对已排期轮次的快照范围 | 项目 A 的 Brief 显示 `Start the next round`，但未显示快照创建时间、轮次编号、证据截止时间或被引用的证据版本。 | 页面无法证明 AC-3；按轮快照能力未完成。 |
| 6 | 打开未排期的项目 B | 显示 `Round 1 isn't scheduled yet` 与 `Go to schedule`；没有规格原文 `Schedule a round before opening the live brief.`。问题卡片仍可阅读。 | 门槛及修复入口部分符合 FR-1；文案与规格不一致。 |
| 7 | 从项目 A 计划页的第 2 轮点击 `view in Brief`，核对本轮问题 | 计划页标明第 2 轮 `3 questions (2 mandatory)`；进入 Brief 后显示全岗位 6 张问题卡，没有第 2 轮标题、问题范围或与计划的对应关系。 | **FR-4 未满足**：不能清楚辨认本轮应问的 3 个问题。 |

## 3. 九条用例结果

状态含义：**失败**是当前线上证据与预期冲突；**部分符合**是已观察到部分能力，但未满足完整步骤或缺 API 证据；**未验证**是缺少指定 seed、身份或失败注入。文档中写的 known gap 不等于本次测试通过。

| 用例 | 优先级 | 结果 | 证据与限制 |
|---|---|---|---|
| UC-I06-01 缺筛选和测评时正常生成 | P0 | **失败** | 项目 A 的 Overview 明确两类材料 `Not provided`，Brief 可显示问题，但 Brief 内没有对应的“未提供”标记；没有把缺失写成通过。 |
| UC-I06-02 Known 结论可打开来源 | P0 | 未验证 / known gap | 页面没有 Known 结论可逐条点击。额外核对 Claim 的 `Résumé` 按钮，只得到提示而非来源抽屉，见 I06-UX-002；这不能冒充 AC-2 的完整测试。 |
| UC-I06-03 快照不含之后的证据 | P1 | 未验证 / known gap | 缺少 `later_evidence` seed，不能验证排除行为；页面也没有快照时间和范围。 |
| UC-I06-04 未提交的分数不可见 | P0 | 未验证 / known gap | 缺 `round1_unsubmitted`、第 2 轮面试官身份及对应 API 访问；未检查响应是否泄露分数。 |
| UC-I06-05 未关联候选人时只显示岗位要求 | P1 | 未验证 | 两个检查项目均已关联候选人，无 `S_jd_only_project`。 |
| UC-I06-06 简历经历显示为待核实 Claim | P0 | **失败** | `Claim to verify` 标签存在，但两个无简历项目都出现相同的具体微服务迁移说法，无法视为真实简历经历。 |
| UC-I06-07 未排期时打开 Brief | P1 | 部分符合 | 项目 B 有未排期说明和 `Go to schedule`；缺规格要求的完整提示，且 Brief 仍展示全部推荐问题。未执行 `S_plan_approved` 的精确 seed。 |
| UC-I06-08 推荐重点与问题 | P1 | **失败** | STAR 四步和 `View plan →` 可用；但项目 A 的第 2 轮计划标明 3 个问题，从该轮 `view in Brief` 进入后却显示全岗位 6 张卡，没有本轮映射。未检查线上问题接口输入版本。 |
| UC-I06-09 Brief 生成失败 | P2 | 未验证 | 未在生产环境注入 `llm_fail` 或触发生成；不能证明失败/重试和岗位要求可见性。 |

**统计：** 完整通过 0；失败 3；部分符合 1；未验证 5。AC-1、AC-6 及 FR-4 有失败证据；AC-2～AC-5 均未完成指定端到端验证。

## 4. 问题清单

| ID | 级别 / 类别 | 角色与步骤 | 证据、影响 | 最小修复方向与复验 |
|---|---|---|---|---|
| I06-UX-001 | **P0 / ai_boundary** | Interviewer、HR；辨认待核实说法 | 两个 Brief 明示 `No résumé attached`，仍同样声称简历中有 `led migration to microservices`，包括一个设计岗位项目。面试官可能围绕不存在的经历提问，并把虚构材料带入评估。 | Claim 只从实际可访问材料生成；无简历时显示未提供，不输出具体经历。以无简历、真实含该说法的简历、异岗位三组 seed 复验。 |
| I06-UX-002 | **P1 / clarity** | Interviewer；打开来源 | Claim 的 `Résumé` 按钮只弹出重复文案，没有原证据或抽屉。用户无法判断说法是否来自真实材料。 | 仅对存在来源的结论给出可点击来源，打开带定位的来源抽屉；无来源时不得显示可点击 `Résumé`。逐条复验 Known/Claim。 |
| I06-UX-003 | **P1 / state** | Interviewer；看背景摘要 | Brief 没有 Known / Unknown / Claims 三栏，也未显示筛选/测评 `Not provided`；Overview 虽有缺失状态，面试准备页无法就地判断哪些材料缺失。 | 按三类列出结论和来源，把可选资料缺失显式标为“未提供”；复验 AC-1/2 和 FR-2/9。 |
| I06-UX-004 | **P1 / state** | 第 2 轮 Interviewer；看快照范围 | 已排期下一轮的页面不显示快照时间、证据截止点或引用版本。缺少 `later_evidence` seed，尚不能宣称线上已混入未来证据，但当前页面不足以供用户确认范围。 | 建立按轮快照并显示生成时间、范围、证据版本；用轮次开始后新增证据复验 AC-3。 |
| I06-UX-005 | P2 / clarity | Interviewer；未排期入口 | 项目 B 给出 `Round 1 isn't scheduled yet` 和修复按钮，但与 FR-1 指定提示文案不同。 | 统一未排期文案与行动入口；确认未排期时 `Start live interview` 的可见与禁用规则后复验。 |
| I06-UX-006 | **P1 / state** | 第 2 轮 Interviewer；从计划进入 Brief | 项目 A 计划页第 2 轮标为 `3 questions (2 mandatory)`，点击该轮 `view in Brief` 后展示 6 张全岗位问题卡，也未标出第 2 轮问题。面试官无法判断本轮重点，可能重复或漏问。 | Brief 保留所选轮次上下文，明确列出本轮目标能力和对应 3 个计划问题；以不同轮次分配不同问题的 seed 复验跳转与显示。 |

仓库当前 [BriefPage.tsx](../../../../hireos-interview/job-Interview-front/src/pages/project/BriefPage.tsx) 的 `hrItems` 含固定的微服务迁移文案，`Résumé` 回调调用 `say(...)`；后端 [brief.service.ts](../../../../hireos-interview/job-Interview-backend/src/brief/brief.service.ts) 的问题查询按 Job 和已确认 Rubric 返回，不含候选人或轮次快照。代码与 UI 观察一致，但报告不据此推断线上部署的精确提交或服务端权限表现。

## 5. 脱敏页面截图

截图仅裁取对应控件或状态，避开候选人姓名与账号信息；截图能证明可见界面，不能单独证明服务端权限、快照冻结或接口返回内容。

| 发现 | 截图 | 可证明的内容 |
|---|---|---|
| I06-UX-001 | [无简历提示](evidence/I06-UX-001_no_resume.jpg)、[具体 Claim](evidence/I06-UX-001_claim_without_resume.jpg) | 同一项目页面分别出现 `No résumé attached` 和具体简历说法。 |
| I06-UX-002 | [Claim 来源按钮](evidence/I06-UX-001_claim_without_resume.jpg)、[点击后的提示](evidence/I06-UX-002_source_toast.jpg) | 点击来源后只出现重复文案的提示；未见来源抽屉。 |
| I06-UX-003 | [Overview 缺失资料](evidence/I06-UX-003_overview_missing_materials.jpg)、[Brief 信息结构](evidence/I06-UX-003_brief_structure.jpg) | Overview 标明筛选和测评缺失；Brief 当前显示业务/HR 分区，而非三类背景结论。 |
| I06-UX-004 | [本轮重点区域](evidence/I06-UX-004_focus_no_snapshot_scope.jpg) | 该区域没有快照时间或证据截止说明；是否排除后续证据仍需专用 seed 验证。 |
| I06-UX-005 | [未排期提示](evidence/I06-UX-005_unscheduled.jpg) | 实际文案及 `Go to schedule` 按钮。 |
| I06-UX-006 | [第 2 轮计划](evidence/I06-UX-006_round2_plan.jpg)、[Brief 首张卡](evidence/I06-UX-006_brief_first_card.jpg)、[Brief 末张卡](evidence/I06-UX-006_brief_last_card.jpg) | 计划标 3 个问题；同一 Brief 展示从首张到末张的全岗位卡片。完整卡片数另由线上可访问性树核对为 6。 |

I06-CODE-001 是代码审计风险，尚无线上权限复现截图。

## 6. 应用性十项（U1–U10）

| 项 | 判定 | 证据 / 限制 |
|---|---|---|
| U1 容易理解 | 失败 | 页头与 Rubric 版本可见，但“无简历”和“简历声称”相互矛盾。 |
| U2 容易上手 | 部分符合 | Business/HR 两个区域和 STAR 顺序直观；事实/未知/待核实的完整分类缺失。 |
| U3 快速完成任务 | 部分符合 | 推荐问题可在本页读，计划可一键打开；核验来源失败。 |
| U4 下一步明确 | 部分符合 | 未排期时 `Go to schedule` 清楚；已排期时有开始下一轮入口，但缺少快照范围。 |
| U5 提示和按钮清楚 | 失败 | `Résumé` 看似打开来源，实际只显示重复提示。 |
| U6 符合真实工作方式 | 失败 | 无法在 Brief 核实材料或分辨虚构说法，增加面试误判风险。 |
| U7 信息结构符合角色目标 | 部分符合 | HR 与业务面试官分区；当前账号角色映射未核实，不能确认按角色可见性。 |
| U8 减少来回与重复 | 部分符合 | 推荐问题和 `View plan →` 就近可用；来源核验无可用路径。 |
| U9 可恢复可预期 | 未验证 | 未排期有修复入口；AI 失败、网络异常及重试未注入。 |
| U10 可访问可操作 | 部分验证 | 页面状态有文字；主区域在当前桌面视口可读。未执行 200% 缩放、完整键盘焦点顺序或读屏测试。 |

## 7. 限制与复验条件

### 代码审计补充风险（不计入线上实测发现数）

| ID | 关联要求 | 代码证据 | 仍需验证 |
|---|---|---|---|
| I06-CODE-001 | AC-4 / BR-3：独立反馈提交前隐藏其他面试官评分 | 前端 `BriefPage` 调用 `useDebriefSummary(taskId)`；该 Hook 请求 `GET /tasks/:id/debrief`。后端控制器只向 service 传 `workspaceId`，`TasksService.debrief` 汇总所有轮次的非空 `CardScore`，响应含 `score`、`note` 和所属轮次；未按面试官、轮次提交状态过滤。`WorkspaceGuard` 虽获取 `roles`，该路径没有使用。 | 用第 1 轮分数已保存但未提交的 seed，以第 2 轮面试官身份请求 Brief 和 Debrief 接口，核对状态码及响应体。当前不能声称线上已向未授权用户泄露。 |

这属于与 I06 有关的高优先级代码风险，应单独起草并在隔离环境复现；不能将代码推断替代线上权限测试。

1. I06 产品文档为待评审草稿；按轮快照、HR/业务 Brief 划分、评分披露时机仍列为待确认。这里依据现有 AC 记录差距，不替产品负责人决定最终规则。
2. 缺少 `[UJ-TEST]` 的 `S_jd_only_project`、`S_round1_scheduled`、`S_round2_scheduled_round1_submitted`、`later_evidence`、`round1_unsubmitted` 及 `interviewer_a` 测试身份。权限、证据隔离、快照冻结、无候选人空态不能仅靠当前 UI 判断。
3. 未执行写入 API、DB 查询、AI 失败注入和完整无障碍测试；线上只读证据不能证明持久化、服务端 403 或重试幂等。需要隔离测试数据和可清理机制后，逐条复测 9 个用例并保留脱敏 UI、API 与 DB 证据。
4. **发布门槛：** I06-UX-001 为 P0，当前不通过。修复后先复测无简历/异岗位 Claim，再补齐来源、缺失资料和快照；P1 修复或经明确产品豁免后重评。

## 8. 结构化结论

```yaml
review:
  product: "HireOS Command Interview"
  surface: "I06 Interview Brief"
  role: "Interviewer；HR / Recruiter（线上账号角色映射未核实）"
  journey_goal: "开面前识别可验证事实、缺口和本轮重点，并从原始证据核查说法"
  evidence:
    source: "线上 Chrome UI、可访问性树、页面路由和按钮反馈；仓库代码仅辅助解释"
    steps_checked: ["已排期 Brief", "无简历 Claim", "来源入口", "STAR 问题", "计划跳转", "未排期 Brief"]
  verdict: "fail"
  findings:
    - {id: "I06-UX-001", severity: "P0", category: "ai_boundary", step: 2, title: "无简历时展示具体简历说法", evidence: "No résumé attached 与 led migration to microservices 同页出现", user_impact: "面试判断可能受虚构材料影响", recommendation: "按真实来源生成 Claim", acceptance_check: "无简历与异岗位 seed 均不出现该说法"}
    - {id: "I06-UX-002", severity: "P1", category: "clarity", step: 3, title: "来源按钮没有打开原证据", evidence: "点击 Résumé 只出现重复文案提示", user_impact: "无法核验结论", recommendation: "打开来源抽屉并定位证据", acceptance_check: "逐条点击 Known/Claim 可见授权来源"}
    - {id: "I06-UX-003", severity: "P1", category: "state", step: 1, title: "背景分类和缺失资料标记不完整", evidence: "Brief 无三栏和筛选/测评未提供状态", user_impact: "面试官难以识别资料缺口", recommendation: "补三栏和未提供状态", acceptance_check: "复测 AC-1/2"}
    - {id: "I06-UX-004", severity: "P1", category: "state", step: 5, title: "未显示快照范围", evidence: "下一轮 Brief 无时间、截止点和版本", user_impact: "不能确认所见证据属于当前轮次", recommendation: "建立并展示按轮快照", acceptance_check: "later_evidence seed 复测 AC-3"}
    - {id: "I06-UX-005", severity: "P2", category: "clarity", step: 6, title: "未排期提示与规格不一致", evidence: "显示 Round 1 isn't scheduled yet / Go to schedule", user_impact: "状态可理解但与预期提示不统一", recommendation: "统一文案与门槛动作", acceptance_check: "S_plan_approved 复测 FR-1"}
    - {id: "I06-UX-006", severity: "P1", category: "state", step: 7, title: "从第二轮进入 Brief 后仍展示全岗位问题", evidence: "计划第 2 轮标 3 questions；Brief 展示 6 张卡且无轮次标识", user_impact: "无法辨认本轮应问问题", recommendation: "按所选轮次展示对应问题", acceptance_check: "用两轮不同问题的计划复验跳转和显示"}
  usability_check:
    understandable: "fail"
    learnable: "unknown"
    efficient: "fail"
    next_action_clear: "pass"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "缺少指定 seed 和 Interviewer 测试身份"
    - "未验证 API 403、DB、快照冻结与 AI 失败注入"
    - "未做 200% 缩放、完整键盘与读屏测试"
```
