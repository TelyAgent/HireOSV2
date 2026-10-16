# M6「Analyze 完整性检查与 AI 修复」线上测试报告

测试日期：2026-10-14（Asia/Shanghai）  
结论：**不通过**。已观察到发布按钮在 AI 草稿尚未确认、文档尚未保存时启用；AI Review 仍给出“待修改”时，规则摘要仍显示 11/11 合格且发布按钮可用。测试只验证到按钮状态，**没有点击发布，也没有证明服务端实际允许发布**。

> **后续产品决定（2026-10-15）**：较早按 11 项必填；同日后续允许 Level 为 Not set，A4 改为选填，当前口径为 10 项必填。概述不显示句数提示；Keep 后自动重查；X1–X8/V1–V5/R1–R3 纳入本期门禁；Ready 后提交审批，审批前不得发布。以更新后的 [M6 PRD](PRD.md) 和[完整性标准](../HireOS_Command_JD_Completeness_Standard_v0.1.md)为后续验收口径。本报告保留 2026-10-14 真实观察和当时的“待确认”记录，不将产品决定写成已上线或已复测。

按新口径，M6-LIVE-02 的 D1/X7“待修改”应阻断提交审批，缺陷结论已明确；M6-LIVE-05 转为按钮范围与文案的落实项：AI 只处理有来源的可修复项，职级和薪资等事实由人补齐。旧测试中“批量修复后单独达到 Ready”的预期不再适用，需按新版 AC-3/AC-5 复测。

## 1. 依据、环境和边界

| 项 | 内容 |
|---|---|
| 产品依据 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[User Cases](User_Cases.md)，均为 v1.0 草稿 |
| UX 依据 | [JD Management UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)，逐步检查并按 U1–U10 评估 |
| 线上入口 | `https://hireos.aipollo.me/hireos/jd/jobs`，Chrome 已登录会话，中文界面，桌面视口约 1416 × 640 |
| 身份 | 页面显示“蔡敏”；没有服务端角色、授权字段或其他账号的证据 |
| 构建 | 页面未展示构建号；本地代码只用于理解交互，不作为线上通过证据 |
| 方法 | 实际 UI 创建隔离草稿、编辑、Analyze、单项/批量 AI 修复、双击、Undo、Keep、保存、刷新；记录可访问树、可见文案和截图 |
| 未执行 | 发布、提交审批、真实外发、直接调用生产 API、DB/AiRun 查询、故障注入、多角色登录和完整无障碍测试 |

产品文档尚未确认 9 项还是 11 项必填、Weak 判定口径、Keep 后重查方式，以及跨项一致性检查是否纳入门禁。因此本报告将这些差异单列，不推定其产品决策。测试页面运行时显示 **11 项必填**。

### 测试数据与副作用

本次只新建一条 `[UJ-TEST] M6 Analyze 20261014` 草稿，JD 编号 `JD-2026-0018`，ID `65685cc8-95a8-4052-9440-ce192eaf4c8f`：[线上编辑页](https://hireos.aipollo.me/hireos/jd/jobs/65685cc8-95a8-4052-9440-ce192eaf4c8f/document)。最初只有标题、地点 `Ho Chi Minh City, VN`、编制 1、职责 1 条、要求 1 条；后来为 Ready 路径加入合成测试薪资 `1K–2K / month · gross · USD`、职级 Mid，并逐项确认 AI 草稿。最终状态为**已保存、未发布**，保留供复核。测试过程中对另一条既有 `[UJ-TEST] Growth Operations Manager 20261014` 只运行 Analyze，未修改内容。

本地证据位于仓库忽略目录 `.local/m6-test-evidence/`：`after-undo.png`、`publish-enabled-before-keep.png`、`ready-after-reload.png`、`ready-with-ai-revise.png`、`ai-revise-panel.png`。这些文件未纳入公开仓库。

## 2. 主流程逐步结果

| Step | 操作与预期 | 线上实际 | 结论 |
|---|---|---|---|
| 1 打开不完整草稿 | 徽标等于待处理项数；阻断发布有原因 | 初次显示 2 缺失 + 2 待修改、徽标 4；刷新后未保存的默认 Mid 消失，变为 3 缺失 + 2 待修改、徽标 5。发布禁用，提示还差 4/5 项 | UI 计数与分组一致；职级默认值持久性异常 |
| 2 查看缺失项 | 默认章节位置出现红色虚线占位块与 AI 起草/去填写 | 职位概述占位位于首节，薪资占位位于 Compensation；有 AI 起草或去填写 | 通过（可见层） |
| 3 Analyze | 处理中、切换 Analysis、显示时间、四组及总体结论 | 显示“分析中…”，自动切换；有待补充、待修改、建议补充、已完成以及“分析于”时间；Completed 默认展开。AI 检查随后给出 B1/C1/D1/X4 等意见 | 基本通过；顶部以数量和进度表达，未见明确 Ready/Needs work/Blocked 文案 |
| 4 AI 一键处理 | 修复缺失与 Weak，内容待确认，最终达到 Ready | 按钮写 `AI 一键处理 (3)`，只处理概述、职责、要求；最初 4 项待处理变为 1 项薪资缺失，刷新后的 5 项变为职级与薪资 2 项缺失。AI 内容带可点击的“AI 起草”确认标记，出现撤销 | **未满足 AC-3 的全量修复/Ready 结果**；薪资与职级需要人工提供事实，产品预期需澄清 |
| 5 AI 内容质量 | 2–4 句概述、职责/要求各 ≥3，且不编造事实 | 两轮批量结果均为 2 句概述、3 条职责、3 条要求；但在只提供 SQL 和每周产品数据复核时，AI 新增“spreadsheet software”技能，另一次称该职位为“Product Data Analyst”或“Mid-level Analyst” | **失败**：条数合格不足以证明事实可信 |
| 6 Undo | 精确恢复原文 | 批量和单项修改后点撤销，概述回到 `No role summary on file.`，职责回到 `Review product data weekly and share findings.`，要求回到 `Can write SQL queries.`；徽标恢复 4/5。保存后重新打开仍为原文 | UI/持久化可见层通过；建议状态 `reverted` 未查 |
| 7 单项 AI fix | 显示前后差异，修复后移到 Completed | 点击“核心职责”AI 修改后，1 条变成 3 条，该项进入已完成；正文直接变更并出现撤销，未显示修复前后并排或行内 diff | **部分满足**：状态迁移通过，差异展示失败 |
| 8 双击 | 只写入一次 | 快速双击 `AI 一键处理 (3)`，按钮立即变“处理中”；完成后概述一段、职责 3 条、要求 3 条，未见重复段落 | UI 层通过；请求次数和 DB 幂等未查 |
| 9 人工补齐与 Keep | 全部合格，刷新后一致 | 人工填入 Mid 和合成薪资，批量补齐剩余 3 项；确认 7 个 AI 草稿、保存、刷新后，页面仍显示 11/11、发布按钮可用，文本与薪资保留 | Ready 路径的 UI 持久化通过；没有审批入口可测 |
| 10 再次 Analyze | 检查结果与门禁一致 | 规则摘要仍为“必填项已全部完成”及 11/11，发布按钮可用；AI 检查同时给出 D1“待修改”（SQL、表格能力缺熟练程度）与 X7“待修改”（职位称谓不一致） | **失败/口径冲突**：同屏出现可发布与待修改 |

## 3. 14 条用例与验收覆盖

| 用例 | 结果 | 证据或未验证原因 |
|---|---|---|
| UC-M6-01 初始徽标与门禁 | **部分通过** | 徽标 4/5 等于缺失加待修改，发布禁用且有原因；提交审批控件/路径未见 |
| UC-M6-02 缺失占位位置 | **通过（UI）** | 概述与薪资占位在对应章节；提供 AI 起草或去填写 |
| UC-M6-03 Analyze 结果分组 | **部分通过** | 处理态、时间、四组和 6/11、7/11 进度可见；没有明确三态结论文案；AI Review 与规则摘要可能冲突 |
| UC-M6-04 六组 Weak 规则 | **部分验证** | 实测职责少于 3 条、要求少于 3 条；一句概述引发 AI Review C1 待修改，但规则分组仍把它列为“待补充”。营销词、Junior 5 年、Remote 无地区、`strong communication` 未逐组造数复测 |
| UC-M6-05 AI fix all | **失败（按 AC-3）** | 两轮都只处理 3 个 AI 可处理项，不能靠该动作达到 Ready；薪资/职级留待人工 |
| UC-M6-06 AI 内容质量 | **失败** | 两轮满足句数/条数，但出现未经输入确认的技能或职位称谓；无编造具体薪资数字 |
| UC-M6-07 Undo 精确恢复 | **部分通过** | UI 文本逐字恢复并保存；未读 DB 与 suggestion 状态 |
| UC-M6-08 单项 AI fix | **失败（按完整预期）** | 进入 Completed；未见前后 diff，直接改正文 |
| UC-M6-09 Ready 门禁与持久化 | **部分通过** | Keep + 保存后 11/11，刷新保持；Keep 前和未保存时发布按钮已可用，且 AI Review 待修改不阻断 |
| UC-M6-10 服务端拒绝不合格提交 | **未验证，known gap** | 文档已标注审批未实现；未直接调用生产发布接口，无法断言 422/无审批请求 |
| UC-M6-11 Viewer 只读 | **未验证，known gap** | 没有 Viewer 身份和已登录 API/DB 权限证据 |
| UC-M6-12 分析失败恢复 | **未验证** | 没有可控 `llm_fail` 注入；正常 AI 响应不能替代此用例 |
| UC-M6-13 双击幂等 | **部分通过** | UI 未见重复段落；未核查请求、AiRun 或 DB 写入次数 |
| UC-M6-14 编辑后分析过期 | **通过（UI）** | 单项 AI 修改后，AI 检查显示“检查之后文档有改动”及“重新分析” |

| AC | 结论 | 说明 |
|---|---|---|
| AC-1 徽标、占位 | **部分通过** | UI 表现符合；刷新前后职级默认值造成 4→5，属于创建/持久化交叉问题 |
| AC-2 四组和 Weak | **部分验证** | 四组可见；六组 Weak 未逐条跑完，且 AI Review/规则分组口径不同 |
| AC-3 fix all、质量、Undo | **失败** | AI fix all 无法完成全部必填；生成未经证实的技能/称谓；Undo UI 可用 |
| AC-4 单项 fix | **失败** | 移入 Completed，但缺少修复前后差异 |
| AC-5 Ready/服务端门禁 | **失败且服务端未验证** | Ready 与 AI 待修改并存；未确认草稿已可点发布；服务端 422 未测 |
| AC-6 Viewer 权限 | **未验证** | 无 Viewer 账号与 API 证据 |

## 4. 缺陷与规格冲突

### M6-LIVE-01 / P0：AI 草稿未确认、文档未保存时发布按钮已启用

- **复现**：在本次测试草稿上人工填入职级和合成薪资，点击 `AI 一键处理 (3)`；等待 11/11。此时 7 个 AI 内容块仍带“AI 起草 · 点击确认保留”标记，顶部显示“有未保存的更改”，但“发布”已启用。
- **影响**：用户可能把未审核、未持久化的 AI 提案视作可发布正式版本。此处只证实了 UI 按钮状态，未点击发布，也未验证服务端最终门禁。
- **修复验收**：未 Keep 或未保存的 AI 内容不使发布/提交可用；API 用草稿版本和待确认建议直调时拒绝并列原因；Keep、保存、重新检查后才打开相应下一步。
- **证据**：`.local/m6-test-evidence/publish-enabled-before-keep.png`。

### M6-LIVE-02 / P0：AI Review 待修改与 11/11 可发布同屏并存

- **复现**：逐项 Keep 并保存、刷新，点击 Analyze。规则摘要显示“必填项已全部完成”与 11/11，发布按钮可用；AI 检查同时给出 D1“待修改：要求缺熟练程度”和 X7“待修改：职位称谓不一致”。
- **影响**：招聘人员无法判断 AI 待修改是否阻断发布，门禁与分析结论不一致。X7 是否纳入本期仍待产品决定；D1 属于本期 Weak 范围。
- **修复验收**：产品先确认 AI Review 的待修改是否计入 Ready；同一版本的摘要、徽标、按钮、服务端响应保持一致，并解释每个阻断项。
- **证据**：`.local/m6-test-evidence/ready-with-ai-revise.png`、`.local/m6-test-evidence/ai-revise-panel.png`。

### M6-LIVE-03 / P1：单项 AI fix 没有修复前后差异

- **复现**：在只有 1 条职责的草稿上，点击 Analysis 中“核心职责”的 AI 修改。正文立即替换为 3 条，出现撤销，但未显示原文与新文的 diff 或确认面板。
- **影响**：用户无法在接受前核对修改范围；与 PRD FR-6、UX U5 的 Preview/Apply 边界不符。
- **修复验收**：先展示原文、新文和逐项差异，再由用户 Keep/Apply；拒绝或撤销后原文精确恢复。

### M6-LIVE-04 / P1：AI 补齐引入无来源的岗位事实

- **证据**：原始输入只含“每周复核产品数据并分享发现”和“能写 SQL 查询”。一轮批量输出新增“Can use spreadsheet software to organize and summarize data.”；另一次把角色称作“Product Data Analyst”，并非输入的职位名。后续 AI Review 还指出标题与正文称谓不一致。
- **影响**：未经确认的技能或职位定位可能进入对外 JD；即使句数、条数合格也不能代表可发布。
- **修复验收**：AI 输出逐句标记已有来源或明确作为待确认提案；没有来源的技能、职级、称谓不得自动写入可发布正文。同 seed 至少复测两轮。

### M6-LIVE-05 / P1 · 规格待确认：AI fix all 的“all”边界

- **证据**：在 5 项待处理时，按钮显示 `(3)`，只处理可生成的概述、职责、要求；职级和薪资留待人工，故不会自动达到 PRD 的 Ready 终态。
- **冲突**：FR-5/AC-3 要求全部缺失和待修改项；BR-6 又禁止 AI 编造薪资等事实。两者不能同时按字面执行。
- **建议**：将按钮改为“AI 处理可起草的 3 项”，在剩余项中给明确人工下一步；将 AC-3 改为 AI 处理后仍需人工补齐事实和确认，不以 AI fix all 单独达到 Ready 为判定条件。

### M6-CROSS-01 / P2：创建表单未设置职级却暂显 Mid

保存新建测试草稿后，编辑页显示职级 `Mid`、徽标 4；刷新后职级为空、徽标 5。此问题来源可能在创建/加载链路，建议在相应模块追踪；本报告保留其对 M6 seed 和计数的影响，不断言根因。

## 5. UX/UI 审查（U1–U10）

角色：已登录职位创建者；业务角色未取得服务端证据。目标：把不完整草稿补到可进入下一业务步骤，并能判断 AI 修改是否可信。交接对象按产品文档应为 M7 审批，线上页面只显示“发布”按钮；审批流程已被文档标记为未实现。

| 标准 | 判定 | 证据与限制 |
|---|---|---|
| U1 容易理解 | **部分满足** | 标题、草稿/未发布、JD ID 可见；“11/11 已完成”与 AI 待修改并存，不能明确解释实际 Ready |
| U2 容易上手 | **通过（本路径）** | 缺失项在正文标位，提供 AI 起草/去填写；Analysis 按组列出下一动作 |
| U3 快速完成 | **部分满足** | 批量处理 3 项无需跳页；薪资、职级需人工补充符合事实边界，但按钮名称未说明仅处理 3 项；未测响应时间阈值 |
| U4 下一步明确 | **失败** | 11/11 后直接出现发布可用，未见提交审批；AI 待修改也未指明是否阻断及由谁确认 |
| U5 提示和按钮清楚 | **失败** | 禁用发布有剩余项原因；但 AI 草稿与发布可用并存，单项 fix 未展示差异，`AI 一键处理` 的范围含糊 |
| U6 符合真实工作方式 | **失败** | AI 加入未证实技能和职位称谓，可能影响真实招聘要求；没有显式来源/确认路径 |
| U7 角色信息结构 | **未验证** | 只使用一个登录会话；Viewer/Manager 字段权限没有证据 |
| U8 减少来回跳转 | **通过（本路径）** | 正文与 Analysis 同屏；去填写直接定位或打开表单 |
| U9 可恢复和可预期 | **部分满足** | Undo 恢复正文、编辑后 AI 检查标过期；AI 故障、断网、并发和真实发布恢复未测 |
| U10 可访问、可读、可操作 | **部分观察，整体未验证** | 待补充/待修改有文字及图标，不仅靠颜色；未完成键盘、200% 缩放、读屏和焦点顺序测试 |

按 UX 标准，存在未解决 P0，流程 verdict 为 **fail**。

```yaml
review:
  product: "JD Management"
  surface: "M6 Analyze → AI fix → Keep/Undo → Ready"
  role: "已登录职位创建者（服务端业务角色未确认）"
  journey_goal: "补齐不完整 JD 并判断是否可进入审批或发布"
  evidence:
    source: "线上 UI 可访问树、可见文案、刷新后状态、本地截图"
    steps_checked: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  verdict: "fail"
  findings:
    - id: "M6-LIVE-01"
      severity: "P0"
      category: "ai_boundary"
      step: 9
      title: "AI 草稿未确认且未保存时发布按钮已启用"
      evidence: "7 个 AI 草稿待 Keep，页面显示有未保存的更改，发布按钮可用"
      user_impact: "未确认提案可能被误认为正式可发布版本"
      recommendation: "Keep、保存和重新检查前关闭门禁，并加入服务端校验"
      acceptance_check: "未确认/未保存时 UI 和 API 均拒绝发布或提交"
    - id: "M6-LIVE-02"
      severity: "P0"
      category: "state"
      step: 10
      title: "AI Review 待修改与 11/11 可发布并存"
      evidence: "D1/X7 待修改；摘要 11/11 且发布按钮可用"
      user_impact: "用户无法判断检查结论及剩余阻断项"
      recommendation: "统一规则、AI Review、按钮及服务端门禁的口径"
      acceptance_check: "同一版本在四处给出一致结论和原因"
    - id: "M6-LIVE-03"
      severity: "P1"
      category: "controls_clear"
      step: 7
      title: "单项 AI fix 不展示前后差异"
      evidence: "点击后正文立即由 1 条变 3 条，仅有撤销入口"
      user_impact: "难以在接受前检查 AI 修改"
      recommendation: "先展示差异，再让用户应用"
      acceptance_check: "应用前能逐项查看原文和新文"
    - id: "M6-LIVE-04"
      severity: "P1"
      category: "ai_boundary"
      step: 5
      title: "AI 引入未提供的技能或职位称谓"
      evidence: "仅提供 SQL，AI 增加 spreadsheet software；另一次称角色为 Product Data Analyst"
      user_impact: "对外 JD 可能包含未经确认的招聘条件"
      recommendation: "来源标记与事实确认"
      acceptance_check: "两轮同 seed 均不把无来源事实写入正式内容"
  usability_check:
    understandable: "fail"
    learnable: "pass"
    efficient: "unknown"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "unknown"
    no_unnecessary_hops: "pass"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "没有生产 API/DB 和 Viewer 身份，不能确认服务端门禁或权限"
    - "未点击发布，未执行故障注入、200% 缩放或完整键盘路径"
    - "PRD 的门禁项数、Weak 与跨项一致性口径仍待确认"
```

## 6. 后续验收所需条件

1. 按 2026-10-15 最新口径实施并复测：10 项必填、Level 可为 Not set，D1/X7 等待修改纳入 Ready 门禁；AI 批量处理只覆盖有来源的可修复项并明确提示剩余人工项；Keep 自动重查；审批前不开放发布。
2. 提供隔离的 Viewer、Recruiter/TA 等测试身份与 API/DB 只读核查条件，以验证 403、422、建议状态、revision 和无审批/发布副作用。
3. 提供可控 `llm_fail`、断网与幂等观测手段，再执行 UC-M6-12、请求层 UC-M6-13 和剩余 Weak 参数组。
4. 修复后复测 P0：未 Keep/未保存、规则合格但 AI 待修改、服务端直调、刷新/并发四种状态；只在所有证据一致后关闭缺陷。

本报告未创建 GitHub Issue 或 PR；仓库规则要求创建 Issue 前先给用户看草稿并获得确认。
