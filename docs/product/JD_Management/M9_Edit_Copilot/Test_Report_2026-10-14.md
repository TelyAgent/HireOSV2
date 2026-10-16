# M9 职位编辑与 Copilot 改写：线上测试及 UX/UI 审查报告

> **2026-10-15 产品决定（后于本次测试）**：Level 允许 Not set，完整性标准 A4 改为选填、必填总数改为 10；冲突需点击查看双方改动并人工确认合并；角色编辑权限尚未实现，本轮不测试；语言切换只翻译系统界面与新模板，已有 JD 内容保持原文。以下保留 2026-10-14 的实际观察与当时判定，不代表这些决定已上线。当前问题状态见[整理清单](Issue_Triage_2026-10-15.md)。UC-M9-15 当时的“冲突提示通过”不满足新的人工确认合并 AC；UC-M9-16 中已有英文文档内容保持英文，按新规则不再单独算作缺陷。

测试日期：2026-10-14（Asia/Shanghai）  
环境：[HireOS JD Management 线上页面](https://hireos.aipollo.me/hireos/jd/jobs)；Codex in-app browser，约 660 × 694 视口；登录界面显示“蔡敏”。线上构建号、服务器日志和数据库访问未取得。  
依据：[M9 PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop_IO](Loop_IO.md)、[JD Management UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)。  
角色与目标：以 Recruiter / TA 身份，在职位编辑页修改字段和正文，确认 AI 建议后保存，并交给完整性检查及后续审批/发布。实际登录身份和服务端角色未核实。

## 结论

**不通过。** 17 条用例中：UI 可确认通过 3 条，部分满足 6 条，失败 4 条，未验证 3 条，已知未实现 1 条。这里的“通过”仅指报告写明的可见 UI 条件，不代表 API、DB、权限或 AI 请求体也已验证。PRD AC-3 明确失败；AC-1 仅单向可用；AC-4、AC-5、AC-6 缺关键证据，不能判为通过。按审查标准 §7，P0 安全边界未取得请求级证据，结论仍需保留“未验证”；可确认的 P1 问题使流程不能称为完成。

专用测试草稿：[JD-2026-0019 / `[UJ-TEST] Staff Backend Engineer`](https://hireos.aipollo.me/hireos/jd/jobs/d3039b95-1e58-44b0-9d20-a4b499e1856e/document)，ID `d3039b95-1e58-44b0-9d20-a4b499e1856e`。从手工创建的 `[UJ-TEST] M9 Edit Copilot 20261014` 开始；最终为 Draft、Not published，Location `Shanghai, China`、Headcount 1、Level `Staff`，原始 Role summary 已恢复，第一条职责为接受后的改写，且被标为 Confidential。没有删除、发布、提交审批或外发。第二标签页的冲突草稿未保存。

## 执行记录与验收覆盖

| 用例 / AC | 实际操作与可观察证据 | 结果 |
|---|---|---|
| UC-M9-01 / AC-1 | 页头 `h1.jw-title` 为纯文本；页面未提供标题输入控件，无法按用例“修改页头标题并回车”。 | **失败**：页头→文档方向无入口。 |
| UC-M9-02 / AC-1 | 将文档首个可编辑 `h2` 改为 `[UJ-TEST] Staff Backend Engineer`；刷新后页头、面包屑及文档标题均显示该值。列表标题未另行核对。 | **部分满足**：文档→页头及刷新持久可见。 |
| UC-M9-03 / AC-2 | 清空 Location 并移焦后，值恢复 `Shanghai, China`；提示 `Location is required — it can’t be empty.`。未直接 PATCH 空值。 | **部分满足**：UI 通过，API 400 未验证。 |
| UC-M9-04 / AC-2 | Location 设为 `Remote`，分析面板出现 To revise → Location → `Remote roles should name the accepted regions or time zones.`；随后恢复原 Location。 | **通过（UI）**。 |
| UC-M9-05 / AC-3 | 初始字段行只有 Location、Headcount、Level，**没有 Workplace type**；Add field 菜单却包含 Workplace type。添加 Recruiter 后字段显示，但保存刷新后为 `Not set`，未保留添加时显示的 `Linh Tran`。 | **失败**：固定字段、菜单排除和人员值持久化不符合预期。 |
| UC-M9-06 / AC-3 | Recruiter 字段获得焦点后出现 `从此处移除`；点击后字段消失，再打开 Add field，`招聘负责人`重新出现并可加回。 | **通过（UI）**。 |
| UC-M9-07 / AC-3 | Level 设为 `Staff` 后清空并移焦，原值恢复，提示 `职级 为必填项，不能为空。`，且字段始终显示。 | **失败**：不能设为 Not set，也不会隐藏。 |
| UC-M9-08 | 页面右侧宽度为约 360px；没有可见或可访问的拖动手柄。未能执行 200px / 80% 拖动，也未验证 `hireos-jw-side-width` 持久化。当前代码 `.jw-side` 固定 `width:360px`，可作为实现侧佐证。 | **失败**：调整入口缺失；边界与记忆未验证。 |
| UC-M9-09 / AC-4 | 选中公开职责 `Build reliable application workflows` 并发送改写指令；正文原位出现旧/新文字预览，Accept 后仅该职责变为 `Design, implement, and maintain reliable application workflows.`，另一条职责未变；提示 `Suggestion accepted`、`Document saved`，刷新后新文字仍在。发送前没有独立的引用标签，只有 `Current block` 提示。 | **部分满足**：UI 改写、确认、刷新通过；请求选区、接受前 API 正文、revision +1 和 DB 建议状态未验证。 |
| UC-M9-10 / AC-4 | 对同一公开职责生成第一条建议并 Reject；原文恢复，原位标记消失，面板显示 `Rejected`。 | **部分满足**：UI 通过；DB 建议状态未验证。 |
| UC-M9-11 / AC-5 | 将上述测试职责块改为 Confidential，再选中该块；出现 `This block is Confidential — Copilot can’t read or rewrite it.`，输入框、语音和发送均 disabled。 | **部分满足**：UI 禁用通过；未抓取网络请求，无法确认保密正文没有进入请求体。 |
| UC-M9-12 / AC-4 | 线上没有可控的 `stop_generation` 注入；生成过程仅观察到 `Thinking…`，未执行中断。 | **未验证**。 |
| UC-M9-13 / AC-4 | 未注入 `llm_fail`，也未观察到自然失败。 | **未验证**。 |
| UC-M9-14 / AC-6 | 普通编辑时顶部出现 `Unsaved changes` + 手动 `Save`；点击后依次为 `Saving…`、`Saved`。没有 `network_down` / HTTP 500 注入能力，未验证 Offline、Save failed、恢复重试。 | **未验证**。另：正文编辑需要手动保存，与 PRD 的“自动保存”表述不一致。 |
| UC-M9-15 / AC-7 | 两标签同时打开同一 Draft。A 将 Role summary 改为 `M9 concurrency test: saved from tab A.` 并保存；B 基于旧页面改为 tab B 文案再保存，提示 `文档已被他人更新，请刷新后再保存。`，状态保持“有未保存的更改”。A 随后恢复原 summary 并保存。 | **通过（UI）**：没有静默覆盖；DB 原始 revision 未直接读取。 |
| UC-M9-16 | 切换中文后，导航、Location/Headcount/Level、Add field、Remote 的检查原因与恢复按钮显示中文。文档章节 `Responsibilities`、`Requirements`、`Compensation` 与用户创建的英文内容仍显示英文；未逐项重跑 UC-01～07。最后切回英文。 | **部分满足**：主要控件和检查提示汉化；“无残留英文”及全量双语路径未满足/未核实。 |
| UC-M9-17 | 没有 Hiring Manager、Viewer 测试账号或角色切换；规格自身标注 known gap。未用现有账号推断其他角色权限。 | **已知未实现 / 未执行**。 |

> 统计口径：UC-04、06、15 为 UI 通过；UC-02、03、09、10、11、16 为部分满足；UC-01、05、07、08 为失败；UC-12、13、14 未验证；UC-17 为已知未实现。

## 主要发现与最小修复方向

| ID | 级别 / 类别 | 旅程步骤、证据与用户影响 | 建议 / 复验 |
|---|---|---|---|
| UX-M9-01 | P1 / efficiency、state | 步骤 1：页头标题无法直接编辑，用户需返回文档标题位置才能改名；与双向联动要求不符。 | 给页头提供明确编辑入口；从页头修改后核对文档标题、列表和刷新结果。 |
| UX-M9-02 | P1 / clarity、state | 步骤 5：Workplace type 初始缺席，却出现在 Add field；用户看不到必需的工作方式。Recruiter 加入后刷新变为 Not set。 | 固定显示 Workplace type 并从菜单移除；保存 Recruiter 人员后刷新验证值一致。 |
| UX-M9-03 | P1 / clarity、state | 步骤 7：Level 清空被拒绝并提示必填，和允许 Not set 的规则相反；用户无法表达“尚未设定”。 | 统一必填标准与 M9 规则；按批准规则验证清空、隐藏和分析状态。 |
| UX-M9-04 | P2 / efficiency、accessibility | 步骤 8：右侧面板约 360px，未见拖动手柄；窄视口下编辑区明显受挤压。 | 提供键盘可操作的宽度调整，限制 300px～60% 并在刷新后验证。 |
| UX-M9-05 | P1 / recoverable、state | 公共保存：修改正文后停在 `Unsaved changes`，需要主动点 Save；与文档“自动保存”不一致，离开页面可能遗失未提交修改。 | 若产品确认自动保存，提供防抖保存及失败/重试状态；若保留手动保存，同步修改 PRD 和离页提示。 |
| UX-M9-06 | P2 / ai_boundary | 步骤 9：选区改写前面板只显示 `Current block`，没有清晰的引用标签或选中文字范围；用户难确认 AI 作用范围。 | 显示所选文字的可检查引用和范围，接受前突出旧/新差异。 |
| UX-M9-07 | P2 / clarity | 步骤 10：切中文后，模板章节标题仍为英文；中英文切换对界面标签有效，但内容语言边界未说明。 | 区分“界面语言”和“文档内容语言”；新模板章节跟随界面语言，已有文档保留原文时给明确说明。 |

## 应用性十项与功能边界

| 标准 | 结论 | 证据 / 限制 |
|---|---|---|
| U1 容易理解 | 部分 | Draft、JD ID、Not published、Saved 可见；固定字段缺 Workplace type。 |
| U2 容易上手 | 部分 | Add field、Copilot 入口可见；页头改名入口缺失。 |
| U3 快速完成 | 部分 | 编辑与 Copilot 同页完成；正文需手动 Save。 |
| U4 下一步明确 | 未验证 | Analyze 显示缺失/待修改；审批交接、负责人、截止时间不在本次 M9 测试证据中。 |
| U5 提示和按钮清楚 | 部分 | Location 错误与 Remote Weak 说明清楚；选区引用范围不清楚。 |
| U6 符合真实工作方式 | 部分 | 可编辑、AI 建议可 Accept/Reject；自动保存与字段规则不一致。 |
| U7 信息结构符合角色 | 未验证 | 只有一个登录账号，无法比较角色。 |
| U8 无不必要跳转 | 通过（当前路径） | 标题、字段、正文、分析、Copilot 位于同一编辑页。 |
| U9 失败可恢复 | 部分 | 并发保存提示冲突且保留 B 的未保存编辑；断网、500、AI 失败未测。 |
| U10 可访问 | 未验证 | 只完成语义控件/禁用态观察；键盘全流程、焦点、200% 缩放未测。 |

功能与权限边界：公开文本 Accept/Reject 的 UI 结果可见；Confidential 选区的输入禁用可见；请求体、AiRun、DB revision、建议状态、Core Job 字段与角色 API 权限均未直接核对。未执行审批、激活或发布。

## 审查结构化结果

```yaml
review:
  product: "JD Management"
  surface: "M9 职位编辑与 Copilot 改写"
  role: "Recruiter / TA（按旅程执行；服务器角色未核实）"
  journey_goal: "编辑并保存 JD 字段、正文，只在确认后应用选区改写"
  evidence:
    source: "线上页面 DOM / UI 状态、刷新、双标签交互；本地代码仅辅助定位"
    steps_checked: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  verdict: "fail"
  findings:
    - {id: "UX-M9-01", severity: "P1", category: "efficiency", step: 1, title: "页头标题不可编辑", evidence: "h1 为纯文本，无输入控件", user_impact: "无法从页头直接改名", recommendation: "增加页头编辑入口", acceptance_check: "双向同步并刷新核对"}
    - {id: "UX-M9-02", severity: "P1", category: "state", step: 5, title: "Workplace type 字段规则错误", evidence: "字段行缺失，Add field 菜单却包含", user_impact: "关键字段不稳定可见", recommendation: "固定显示并从菜单排除", acceptance_check: "初始、保存、刷新均检查"}
    - {id: "UX-M9-03", severity: "P1", category: "clarity", step: 7, title: "Level 不允许 Not set", evidence: "清空被拒绝并提示必填", user_impact: "无法表示未设定", recommendation: "统一产品规则与校验", acceptance_check: "清空、隐藏、分析状态一致"}
    - {id: "UX-M9-04", severity: "P2", category: "accessibility", step: 8, title: "侧栏不可调宽", evidence: "约 360px 固定宽度，未见拖动手柄", user_impact: "编辑区域狭窄", recommendation: "增加可键盘操作的调整控件", acceptance_check: "验证 300px～60% 与刷新记忆"}
    - {id: "UX-M9-05", severity: "P1", category: "recoverable", step: 9, title: "正文没有自动保存", evidence: "修改后显示 Unsaved changes 和 Save", user_impact: "离页有丢失风险", recommendation: "实现自动保存或修订规格并提示离页", acceptance_check: "修改后等待、刷新、断网恢复"}
  usability_check:
    understandable: "fail"
    learnable: "fail"
    efficient: "fail"
    next_action_clear: "unknown"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "unknown"
    no_unnecessary_hops: "pass"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "无网络请求体、数据库、审计日志、服务端身份和构建号证据"
    - "未注入断网、HTTP 500、LLM 失败和停止生成"
    - "未执行 200% 缩放或多角色权限测试"
```

## 后续复测所需条件

1. 提供可隔离的线上测试账号：Recruiter、Hiring Manager、Viewer；为权限用例核对 API 403。
2. 提供浏览器网络抓包或服务端请求日志、只读 DB/AiRun 访问，以核对 AC-4/5 的选区、保密内容、revision 和 suggestion 状态。
3. 提供可控的 `network_down`、HTTP 500、`llm_fail`、`stop_generation` 注入环境，再执行 UC-M9-12～14。
4. 在桌面及 200% 缩放下重测侧栏宽度、键盘与焦点，并在修复字段规则后重测 UC-M9-01/05/07/08。

本次只操作线上 UI 中的专用测试 Draft；没有运行本地 build、lint、typecheck 或自动测试，也没有访问生产服务器或数据库。报告记录的是已实际观察到的结果，不将未执行项写成通过。
