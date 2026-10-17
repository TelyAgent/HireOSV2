# W02 组卷 Builder 与 AI 出题线上测试报告（2026-10-16）

## 1. 结论、对象与方法

**结论：不通过（fail）。** 已发布题目详情有 `Edit question`，可打开题库编辑抽屉修改标题、岗位标签和题干；它与代码中单独实现的 Builder 页面不是同一界面。Builder 没有可见入口，本轮按代码注册的路由直达后，Q-0001 的 Prompt、能力分配初始化为空。该直达路径属于探索测试，不能单凭它断言正常用户的 `Edit question` 流程也有空数据问题。Builder 的 AI 失败与成功均为定时模拟，Save draft 只显示成功提示且刷新后内容消失。将一项新建能力设为 100% 后，即使 Prompt 为空且没有 criterion / anchors，发布按钮也会启用。测评计划的另一条 AI 出题路径可真实生成题干和概括性评分维度，但尚不能完成本规格要求的“目标 → 能力 → 证据 → Blueprint → 题目 → Rubric → 人工质量审阅 → 版本发布”闭环。

| 项 | 本轮记录 |
|---|---|
| 线上入口 | [Written Test 题库](https://hireos.aipollo.me/hireos/written/question-bank)；直达 [Q-0001 Builder](https://hireos.aipollo.me/hireos/written/questions/9f160328-648b-4a8f-8abd-7bb6d5a42996/builder) |
| 时间 / 时区 | 2026-10-16 约 11:51–11:59，Asia/Shanghai |
| 浏览器 / 视口 | Chrome，桌面视口约 1478 × 679；英文 UI |
| 身份 | 顶栏显示登录用户「蔡敏」；未取得 W02 细粒度权限和第二身份 |
| 规格 | 本目录 [PRD](PRD.md)、[User Cases](User_Cases.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)；[UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) |
| 线上数据 | 题库仅 Q-0001、Q-0002，均为 Published v1；没有 FIN-001、v2 引用、预置 70 分样例或技术题 seed |
| 本地参考提交 | `c4b610500d33a279c03251091c5f0af13b831318`；不是线上构建号，线上版本未能识别 |
| GitHub 对象 | 用户未指定主 Issue / PR / 合并提交。本报告是按指定文档开展的线上探索测试，不冒充合并后正式 QA，也不编造 `evidence/qa.json` 的身份字段 |
| 数据变更 | 未发布、删除、邀请或确认 AI 生成题目。仅在 Builder 点击 Save draft、用合成文案核对刷新后的持久化，并在计划抽屉对同一合成目标生成两次后取消；计划中的原 Q-0001 保持原样 |

本轮执行真实页面操作并保存截图；引用源码只用于解释可观察现象或标注未执行风险。没有数据库、服务端日志、认证 API 调试、故障注入与独立测试账号，因此 UI 证据不能证明服务端权限、版本持久化、旧邀请不变、隔离执行或 AI run ref。没有运行本地 build、lint、type、unit、integration；这些检查不记为通过。

**入口澄清：** 详情的 `Edit question` 调用 `QuestionCreateDrawer`，提供标题、岗位标签、题干及 `Save changes`；独立 Builder 的路由为 `/questions/:id/builder`，提供 Sections、能力占比、模拟 AI、Save draft 和 Save & publish。两者在当前代码中不同。PRD 对“题目详情 Edit / Builder”存在待确认项，因此“缺少独立 Builder 入口”先作为规格与导航待确认问题，不应单独作为已确认 Bug 提交；Builder 页面上的其余观察均注明是直达路由测试。

## 2. 证据索引

截图在 [evidence/2026-10-16](evidence/2026-10-16/)；编号与下文对应。包含候选人信息的计划页截图未保留，AI 两次结果以本轮可访问 DOM 观察记录在本报告，未保存个人信息。

| 编号 | 证据 | 观察 |
|---|---|---|
| E01 | [Builder 初始](evidence/2026-10-16/01-builder-initial.png) | Q-0001 标题加载后 Prompt 为空、无能力行、预览为 0 材料/交付物/能力；无右侧 Coverage / Difficulty / Estimated effort |
| E02 | [模拟超时](evidence/2026-10-16/02-ai-timeout.png) | 第一次点击后显示 `Generation failed (simulated timeout).` 和 Retry |
| E03 | [模拟重试](evidence/2026-10-16/03-ai-retry-ready.png) | 第二次显示 Draft ready；Prompt、Rubric 未产生可见内容 |
| E04 | [空内容 Save draft](evidence/2026-10-16/04-save-draft-toast.png) | 没有输入内容仍显示 `Draft saved` |
| E05 | [修改后 Save draft](evidence/2026-10-16/05-save-modified-draft.png) | 输入 `[UJ-TEST] W02 draft persistence check` 后仍显示成功提示 |
| E06 | [刷新后](evidence/2026-10-16/06-after-refresh.png) | 测试文案消失，Prompt 再次为空；草稿未持久化 |
| E07 | [90%](evidence/2026-10-16/07-allocation-90.png) | 总和 90% 时提示错误且发布按钮禁用 |
| E08 | [110%](evidence/2026-10-16/08-allocation-110.png) | 总和 110% 时提示错误且发布按钮禁用 |
| E09 | [100% 但空题](evidence/2026-10-16/09-allocation-100-empty.png) | 新建一项能力设为 100% 后显示 Ready，发布按钮启用，Prompt 仍空 |
| E10 | [未保存离开](evidence/2026-10-16/10-exit-with-unsaved-change.png) | 改过分配后点题目 breadcrumb，直接回详情，没有未保存提示 |
| E11 | [题目详情](evidence/2026-10-16/11-question-detail-no-builder.png) | 详情只有 Preview、Delete、Edit；无 Builder 入口 |
| E12 | [现有 Rubric](evidence/2026-10-16/12-question-rubric.png) | 详情有 4 项整体能力百分比且总和 100%；不是按 criterion 的 fraction / anchors 编辑 |

## 3. 执行记录：12 条 User Case

“部分”只表示列出的子步骤实测成立；“阻塞”表示缺少 seed、权限或入口，不能代替产品缺陷结论。

| 用例 | 结果 | 实际操作、结果与证据 | 未完成或复验条件 |
|---|---|---|---|
| UC-W02-01 Builder 布局与派生版本说明 | **失败** | Q-0001 详情无 Builder 链接（E11）；直达路由可见派生版本说明，但仅两列，左侧为静态 Sections 标签，主区只有 Prompt、分配和预览，无右侧 Coverage / Difficulty / Estimated effort（E01）。 | 未把视口精确设为 1366，抽屉断点未验证；先提供真实右侧信息与详情入口。 |
| UC-W02-02 AI 六步产出并标草稿 | **部分 / 失败** | Builder 点击生成显示 loading，第一次模拟失败、第二次只标 Draft，未填充题干或 Rubric（E02–E03）。计划页 AI 抽屉对同一合成目标运行两次，均返回题干和概括性评分维度；第一次权重 40/30/20/10，第二次 50/25/25，均合计 100%。 | 两次都未在 UI 呈现独立“所需证据”、Blueprint、每个 criterion 的满分与 anchors、AI run ref；计划抽屉没有草稿版本状态。无服务端调用记录权限。 |
| UC-W02-03 AI 失败后重试 | **部分 / 失败** | Builder 固定第一次 `simulated timeout`、Retry 后固定 Draft ready（E02–E03）；输入与生成内容没有真实链路。计划抽屉真实 AI 调用两次都成功。 | 没有注入真实 llm_fail 或超时，未验证服务端无新版本、人工编辑恢复和真实 Retry。 |
| UC-W02-04 停止生成防半截发布 | **失败（入口缺失）** | Builder 生成时仅按钮禁用、显示 `Generating… (demo latency)`；没有 Stop 操作（E02）。 | 需要停止控件、可控制的慢响应和持久化检查。 |
| UC-W02-05 受保护属性质量拦截 | **失败（入口缺失）** | Builder 的 Quality review 只是左栏文本，无运行/逐条处置控件（E01）；未将含年龄目标提交到真实 AI。 | 在合成隔离数据中注入 `goal_bias`，复验 UI/API 发布门禁。 |
| UC-W02-06 90% / 110% 阻止发布 | **失败，含局部通过** | 新建能力单行设为 90%、110% 均禁用发布（E07–E08）；提示只说 `Adjust the row(s) above`，不指出 Analysis 的具体 criterion。分配是全题能力列表总和，不是每个 criterion 的分配和。 | 需真实多 criterion seed；服务端发布 4xx 与无新版本未验证。 |
| UC-W02-07 正确分配后发布与 70 分 | **失败，发布未执行** | 单项设 100% 即显示 Ready 且可点发布，虽然 Prompt 空、没有 anchors（E09）；预览只显示数量，不含题包、权重、可见材料、未处置问题（E01）。为保护线上题目未点击发布。 | 需要可隔离的 FIN-001 v1 / 旧邀请 seed，服务端版本和 70 分计算接口。 |
| UC-W02-08 质量审阅逐条处置 | **失败** | 只有静态 Quality review 标签及可选的整体提示，未见问题类型、位置、建议、忽略理由或处置动作（E01）。 | 实现逐条问题、处置人/时间记录后复验。 |
| UC-W02-09 草稿不能进入邀请 | **阻塞 / 源码风险** | Builder 的 Save draft 提示成功，但刷新后测试文案丢失（E05–E06），无法得到持久草稿检查选择器。计划 AI 抽屉生成后已取消，未触发 Confirm generate。 | 需要真实草稿与邀请 API；当前源码将 AI 确认后的题标为 `published`，见 `AssessmentQuestionDrawer.tsx:121–147`，这是待验证的门禁风险，不能把未执行邀请写为线上已外发。 |
| UC-W02-10 双击发布幂等 | **阻塞** | 没有隔离测试题和版本记录；未对现有 Q-0001 点击发布。 | 用专用 seed 连续双击，并查 API / DB 只有一个新版本。 |
| UC-W02-11 新版本提示与旧引用 | **阻塞** | 线上仅两条 v1；无 v2 引用数据，Builder 无版本选择控件（E01、E11）。 | 注入 FIN-001 v1 引用和已发布 v2，查未选择时仍引用 v1。 |
| UC-W02-12 技术题与适应性路径 | **失败（UI），服务端未验证** | Builder 和题目详情未见代码/SQL/模型上传、隔离执行、分支策略、选题理由、曝光或不可排名标记（E01、E11）。 | 需 `tech_ok` / `tech_timeout` 与适应性 seed、隔离环境和服务端证据。 |

汇总：**0 完整通过、2 部分、7 失败、3 阻塞**。UI 缺失能证明用户无法沿本规格入口完成任务；不能据此断言所有后端 API 均不存在。

## 4. Acceptance Criteria 逐项结论

| AC | 结果 | 证据与边界 |
|---|---|---|
| AC-1 每个 criterion 分配和、修正后发布、70 分 | **失败** | 只校验整题能力总和，90/110% UI 禁用而不定位 criterion（E07–E08）；100% 空题也可发布（E09）。未执行真实发布与 70 分 API。 |
| AC-2 真超时、Retry 成功、内容为草稿 | **失败，模拟反馈部分可见** | E02–E03 是固定模拟，重试未生成内容；计划真实 AI 两次成功，未注入超时。 |
| AC-3 草稿不改已发布题、发布生成新版本 | **失败，后半未验证** | Save draft 只 toast，刷新内容丢失（E05–E06）；发布未执行，旧邀请版本不变未验证。 |
| AC-4 新版引用提示且不静默替换 | **阻塞** | 缺 v2 seed；现有 Builder 无版本提示/选择控件（E01）。 |
| AC-5 质量问题逐条显示与处置 | **失败** | 没有可运行的 Quality review 和处置记录（E01）。 |
| AC-6 技术题成功/超时证据、未校准不可排名 | **失败（入口缺失）/服务端未验证** | E01、E11 未见技术执行和适应性控件，无法在线上完成路径。 |

## 5. 用户旅程与 UX/UI 标准审查

标准原针对 JD Management；本报告复用其十项通用可用性原则、证据要求和 P0–P3 门槛，不套用 JD 专属审批/激活字段。目标角色是 Hiring Manager / Reviewer：从已发布题或测评计划进入 Builder，生成并修订题目，核对评分、质量与版本后发布。当前流程在“进入 Builder → 编辑 → 审阅 → 发布”多处中断。

| 标准 | 结论 | 线上证据与影响 |
|---|---|---|
| U1 容易理解 | **失败** | 说明承诺派生版本和旧邀请不变，实际草稿保存后消失（E01、E05–E06），造成状态误判。 |
| U2 容易上手 | **失败** | 详情没有 Builder 入口，只有直达路由可打开（E11）；左侧四项像导航但无切换交互（E01）。 |
| U3 快速完成任务 | **失败** | 无真实 Builder AI 六步结果、质量处置和持久版本；计划页 AI 与 Builder 分离，无法接入同一审阅闭环（E01–E03；计划抽屉观察）。 |
| U4 下一步明确 | **失败** | AI Draft ready 后没有生成可编辑内容；Save draft 给出完成提示却丢内容（E03、E05–E06）。 |
| U5 提示与按钮清楚 | **失败** | `simulated timeout`、`Draft ready` 和 `Draft saved` 看起来属于同一工作流，实际前两者是模拟状态，后者不是持久保存（E02–E06）。 |
| U6 符合真实工作方式 | **失败** | 无逐 criterion、anchors、逐条质量审阅和发布版本证据；100% 空题可进入发布动作（E01、E09）。 |
| U7 信息结构符合角色目标 | **失败** | 无右侧 Coverage / Difficulty / Estimated effort，预览只有数量，审阅者无法据此决定是否发布（E01）。 |
| U8 减少来回跳转 | **失败** | 详情没有 Builder 入口；计划 AI 生成与题库 Builder 各自独立（E11；计划抽屉观察）。 |
| U9 可恢复和可预期 | **失败** | 修改分配后离开无提醒（E10）；刷新丢草稿（E05–E06）；真实 AI 超时恢复未验证。 |
| U10 可访问、可读和可操作 | **部分 / 未验证** | 主要按钮与文本框可通过可访问树识别；Retry 为链接但无明显按钮语义。未执行完整键盘顺序、焦点回置、200% 缩放与对比度测量。 |

### 优先处理的可复现发现

| ID / 级别 | 复现、实际结果 | 影响与修复方向 | 复验 |
|---|---|---|---|
| W02-LIVE-01 / **P0** | Q-0001 详情的 Edit question 可编辑标题/岗位/题干，但独立 Builder 无可见入口；直达后 Prompt/能力为空；Save draft 成功提示后刷新丢失（E01、E05–E06、E11）。 | 简单题干编辑可经 Edit question 完成；完整组卷与草稿版本流程不可达且不能持久保存。先确认产品是否保留独立 Builder，再修复该路由的数据初始化、保存及入口。 | 进入 FIN-001 v1 Builder，保留原内容；保存草稿刷新仍在；已发布 v1 不变。 |
| W02-LIVE-02 / **P0** | 新建能力 100% 即启用发布，空 Prompt、无 criterion / anchors（E09）。 | UI 发布门禁不足，可能允许无效题；服务端是否拒绝尚未验证。按每个 criterion 校验分配、锚点和必填内容，后端独立校验。 | 90/110% 指定行报错；100% 但缺 anchors / Prompt 的 UI 与 API 均拒绝；完整题可发布。 |
| W02-LIVE-03 / **P1** | Builder AI 第一次固定模拟超时，Retry 固定成功但不填内容（E02–E03）。 | 误导用户认为真实生成和草稿已经完成。接入真实生成任务、可停止/重试及明确状态。 | 同输入两次均产出完整六步数据；真实超时可重试且无半成品入库。 |
| W02-LIVE-04 / **P1** | Quality review 仅静态标签，无逐条问题、位置、建议、处置（E01）。 | 人工不能完成质量把关；偏差题缺可见门禁。 | `goal_bias` 标出受保护属性并拒绝发布；普通问题可记录处置人、时间和理由。 |
| W02-LIVE-05 / **P1** | 修改分配后通过 breadcrumb 直接离开（E10）。 | 未保存修改静默丢失。加入离开确认和保存状态。 | 改动后站内跳转/刷新均给明确提醒；保存后正常离开。 |
| W02-LIVE-06 / **P2** | 预览仅有材料、交付物、能力数量，无题包/权重/候选人内容/未处置问题（E01）。 | 发布前难以核查实际内容。 | 预览逐项展示且与候选人可见版本一致。 |

P0 依指定标准意味着流程不通过。W02-LIVE-02 对服务端绕过发布仅为风险，**没有**在生产执行直接 API 或实际发布，不能宣称已出现无效版本。

### 标准结构化审查记录

```yaml
review:
  product: "Written Test / W02 Builder 与 AI 出题"
  surface: "题库详情、Builder、计划 AI 出题抽屉"
  role: "Hiring Manager / Reviewer"
  journey_goal: "按要求生成可审阅题包，校验评分分配，保存草稿并发布可追溯版本"
  evidence:
    source: "线上 Chrome 页面、可访问 DOM、E01–E12 截图；本地参考源码"
    steps_checked: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  verdict: "fail"
  findings:
    - {id: "W02-LIVE-01", severity: "P0", category: "state", step: 10, title: "草稿保存成功提示但刷新丢失", evidence: "E05–E06", user_impact: "无法保存组卷进度", recommendation: "接通持久草稿并核实成功状态", acceptance_check: "保存后刷新仍保留"}
    - {id: "W02-LIVE-02", severity: "P0", category: "state", step: 6, title: "空题满足总和100%即可启用发布", evidence: "E09", user_impact: "无效评分题可能进入发布路径", recommendation: "逐criterion和必填字段双端校验", acceptance_check: "空题及缺anchors被UI/API拒绝"}
    - {id: "W02-LIVE-03", severity: "P1", category: "ai_boundary", step: 2, title: "Builder生成与超时为模拟状态", evidence: "E02–E03", user_impact: "用户误判AI产出", recommendation: "接入真实任务与错误恢复", acceptance_check: "两次真实生成均有完整可编辑数据"}
    - {id: "W02-LIVE-04", severity: "P1", category: "next_action", step: 8, title: "质量审阅无逐条处置", evidence: "E01", user_impact: "无法人工把关", recommendation: "逐条列出并留存处置", acceptance_check: "偏差拦截及处置记录可复验"}
  usability_check:
    understandable: "fail"
    learnable: "fail"
    efficient: "fail"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "fail"
    no_unnecessary_hops: "fail"
    recoverable: "fail"
    accessible: "unknown"
  limits:
    - "没有主 Issue/PR、线上构建号及数据库/服务端日志"
    - "未执行真实发布、邀请、故障注入和其他角色权限测试"
    - "1366 断点及完整可访问性未测"
```

## 6. 风险、解除条件与执行状态

1. **版本与邀请隔离：未验证。** 需专用 FIN-001 v1/v2、已发送 v1 邀请及认证 API/DB 证据，按 AC-3/4 与 UC-09–11 重测。当前 Builder `publish()` 只报 toast 并跳转，源码没有持久化调用（`BuilderPage.tsx:7–9,44–47`）；这解释 UI 风险，不代替线上数据库检查。
2. **AI 完整性：未通过。** 计划 AI 两次均产出题干和整体维度权重，但没有每个 criterion 的 anchors、所需证据、Blueprint 或 run ref 的可见证据；应补齐结构化结果与调用追溯。真实 llm_fail、Stop 和受保护属性门禁需可控注入环境。
3. **技术题/适应性：路径缺失。** 需隔离执行适配器、成功/超时日志、版本化测试证据和未校准路径样例，再验证 AC-6。
4. **检查状态：** 本轮只执行线上手工 UI 测试与两次线上 AI 请求；本地 build/lint/type/unit/integration **未执行**，接口直调和数据库检查 **未执行**，不记为通过。没有新增产品代码或自动测试。

复验优先顺序：先修复 Builder 入口、数据初始化、真实草稿/发布服务与服务端门禁（P0）；再接通真实 AI、逐条质量审阅和离开提醒（P1）；最后补完整预览与响应式/可访问性验证。完成后以隔离 seed 重跑 12 条用例和 6 项 AC，并保留 API、DB、AI run、截图及命令退出码证据。
