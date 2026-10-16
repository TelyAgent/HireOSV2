# M5「手动表单创建职位」线上测试报告

测试日期：2026-10-14，约 19:20–19:27（Asia/Shanghai）  
**最新结论（按 2026-10-14 用户澄清复核）：手动创建的核心保存路径成立，长 JD 的三级结构不符合要求；完善建议被算入发布阻断，与确认口径不符。** 本次没有实际发布。下面“最新口径复核”是当前结论；其后的第 1–6 节保留首次执行时的原始证据和旧口径判定，旧判定中的“Internal 0 即创建失败”“未填 Hour 即创建失败”已经撤回。

## 最新口径复核（2026-10-14）

用户确认：创建草稿必须填齐必要内容；当前沿用 PRD 的五项（职位名称、地点、招聘人数、岗位职责、岗位要求），逐字段清单若调整须另行确认。其余内容选填，填写了要带进下一步。M5 创建验收只核对**已填**必要项和选填项是否准确进入草稿。长 JD 支持一级“基础信息／职位描述／职位要求”、二级“1.基础条件／2.专业能力”等分组、三级描述文字。发布必填项缺失时阻止发布；完善建议继续显示，但不得阻断发布。

| 检查 | 最新判定 | 证据与边界 |
|---|---|---|
| 必要内容创建草稿 | **UI 通过，服务端未完全验证** | 五项填齐后自动进入 Draft 编辑页；刷新后内容与职位仍在。缺项及非法值的 UI 拦截见下方原始步骤 2–5；未取得已登录 API/DB 证据 |
| 已填选填项回显 | **部分通过** | 实测 25–40 K / CNY / Monthly 回显，长 JD 的 Role summary 回显；未填 Level 在刚创建时短暂显示 Mid，刷新后为空；Employment type 默认 Full-time，用户未确认，不能把该默认值视为用户填写 |
| 未填选填项 | **创建不应因此失败** | 实测未填薪资的草稿能够创建。Internal 0 是页面可见性计数，不是用户已填内容丢失的证据；旧报告以此判 M5 创建失败，现撤回 |
| 三级文档结构 | **失败，P1** | 用户提供的长 JD 创建后，`基础条件`、`专业能力`、`能力特质`被拼成 Requirements 列表项的文字前缀，没有成为独立的二级标题；一级章节也没有按“基础信息／职位描述／职位要求”完整呈现。截图所示结构与草稿可见结构不一致；用户原文未写入公开仓库 |
| 发布必填与建议分流 | **失败，P1（UI + 本地代码证据）** | 草稿的 Analyze 显示 `2 missing · 1 to revise`：Level、Public salary range 在 To complete；“积极主动”在 To revise。Publish 禁用提示 `3 item(s) to complete or revise`，把一条完善建议计入阻断数。本地 `issueCount` 把 `weakCount` 与缺失项相加；未通过实际发布验证建议项单独剩余时的按钮状态 |
| 201 字符标题 | **失败，P2** | 没有清晰的长度错误，提示成 Copilot 暂不可用；与本次口径调整无关 |
| 绕过前端、断网、AiRun、Owner | **未验证** | 缺已登录 API/DB 和故障注入证据，不能宣称通过或失败 |

| 最新发现 / 严重度 | 对创建者的影响 | 修复后验收 |
|---|---|---|
| M5-STRUCT-01 / **P1** · 三级结构被压平 | 原本独立的“基础条件／专业能力／能力特质”变成十条普通要求的文字前缀，无法按分组阅读与编辑 | 用含三级结构的 JD 创建草稿、刷新，核对一级章节、二级标题及标题下的三级描述分别是独立结构节点 |
| M5-PUBLISH-01 / **P1** · 建议进入发布阻断 | “积极主动”的措辞建议与缺失必填项一起计入 Publish 禁用数量，用户即使补齐必填仍可能被建议挡住 | 构造仅剩完善建议的草稿，确认建议可见且 Publish 可用；缺发布必填项时 Publish 仍禁用并列出具体缺项 |
| M5-OPTIONAL-01 / **P2** · 未填选填事实短暂出现 | Level 未填却瞬时显示 Mid；Employment type 默认 Full-time 且无“未设置”，用户可能误以为这些值来自自己 | 未选级别、雇佣类型时创建并刷新，草稿不显示其为已确认事实；若必须预选，需在保存前明确提示并确认 |

按最新口径复看 UX/UI 标准：U1 理解性与 U2 上手性在五项必要字段上部分满足；U3 路径效率和 U8 无多余跳转通过；U4 下一步因发布禁用原因可见而部分满足；U5 控件提示因 201 字符错误失准而失败；U6 真实工作流程因三级结构丢失而失败；U7 角色信息、U10 完整无障碍未验证；U9 失败时输入保留但断网未验证。以上与下方旧口径的 U1–U10 表格相比，应以本段为准。

**复核后的总体判定：不通过**，原因是长 JD 层级未保留，以及发布建议被计入禁用门槛。第 1–6 节中的 12 条原用例和统计是首次执行时的历史记录；按新口径新增 UC-M5-13（三级结构）和 UC-M5-14（发布门槛），这两项的证据与限制以上表为准。未取得线上构建号，本地源码仅用于解释观察到的发布禁用逻辑，不能代替线上部署版本证明。

## 1. 原始执行记录：依据、环境与判定边界

| 项 | 本次记录 |
|---|---|
| 产品依据 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop IO](Loop_IO.md)，均标为 v1.0 草稿 |
| UX/UI 依据 | [JD Management UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)，逐步记录证据并检查 U1–U10 |
| 页面 | `https://hireos.aipollo.me/hireos/jd/jobs`，Codex in-app browser，英文界面 |
| 身份 | 页首显示“蔡敏”；没有服务端会话主体、角色和字段权限证据 |
| 构建 | 页面未提供线上构建号；本地 HEAD `c0e47a6` 仅供追查，不能代表线上部署版本 |
| 初始/最终列表 | 加载完成后 All Jobs 19 / My Jobs 0 / Published 7 / Drafts 12；结束时 21 / 0 / 7 / 14。加载阶段的临时 0 未计入 |
| 方法 | 实际 UI 选择入口、填写与修改字段、Save、双击 Save、观察错误提示、打开编辑页、刷新并核对列表。证据为浏览器可访问树与可见文案 |
| 数据 | 两个 `[UJ-TEST]` 虚构职位；未使用候选人信息，也没有发布或外发 |

**判定口径：**“部分通过”表示已观察到 UI 层结果，但用例要求的网络请求、服务端记录或 DB 断言未完成；“未验证”不等于通过。缺少已登录 API/DB 只读入口与可控断网注入，不能从 UI 计数推断“未发创建请求”“没有 AiRun”或服务端幂等。PRD 的必填项口径、Viewer 行为和保存耗时阈值仍待产品确认，不以推测补齐。

## 2. 按 User Journey 的逐步证据

| Step | 实际操作 | 预期 | 观察到的证据 | 判定 |
|---|---|---|---|---|
| 1 进入表单 | Job Library → New job → Create Manually | 对话内表单，五项必填与选填清楚 | 对话先出现一次 `Create Manually`，随后显示说明与表单；Job title、Location、Headcount、Responsibilities、Requirements 有 `*`。可见 Level、Employment type、Department、Role summary、Preferred、Min/Max K、Currency、Pay period、Gross/net；**没有 Workplace type 与 Reports to** | 部分满足；缺字段 P1 |
| 2 空表单 | 直接 Save | 标出职位名，不创建 | 提示 `Please enter a job title.`；列表保持 19。未抓取请求流 | UI 通过，完整断言未验证 |
| 3 HC 非法 | 完整填写其余必填项，依次设 HC=`0`、`1.5`、`-1` 并 Save | 三者拒绝 | 每种均出现 `Headcount must be a whole number of 1 or more.`；留在表单，列表 19 | UI 通过，完整断言未验证 |
| 4 职责/要求 | 职责依次为空、`1.`、仅空行；恢复合法职责后清空要求 | 对应字段标红、提示，不创建 | 职责三种输入均出现 `Please add at least one responsibility.`；空要求出现 `Please add at least one requirement.`；列表 19。未核对字段色彩与 aria 错误关联 | UI 拦截通过；可访问性未验证 |
| 5 薪资倒置 | Min K=40、Max K=25，Save | 最大值提示不能低于最小值 | 出现 `Enter a min and max (max ≥ min).`；列表 19 | UI 拦截通过；提示未精确指出 Max K |
| 6 合法保存 | 标题 `[UJ-TEST] M5 Manual Form 20261014`、地点 `Ho Chi Minh City, VN`、HC=1、职责 `Coordinate the hiring workflow`、要求 `3+ years in sales`、薪资 25–40 K/CNY/Monthly，Save | 直接进入编辑页，Draft，文档同输入，internal 内容存在 | 自动进入[编辑页](https://hireos.aipollo.me/hireos/jd/jobs/b3a45b96-d067-4018-a1af-93500231c366/document)，显示 Draft / Not published、职责与要求原文、`25K–40K / month · gross · CNY`；**Public 8 / Internal 0**。由于表单没有 Hour 选项，无法输入预期的 `USD 25–40 per hour` | **失败，P1**；直接跳转和部分内容保存通过 |
| 7 持久化与特殊字符 | 刷新编辑页，再返回列表 | 仍是 Draft、原文保留、Owner 为当前用户 | 刷新后仍显示 Draft、职责、`3+ years in sales`、薪资；列表 19→20，仅一条同名职位。列表 Owner 为 `ee348e0e-d8db-4e82-bb6b-b9928954348f`，My Jobs 仍为 0；刚创建时 Level 显示 Mid，刷新后 Level 为空 | 持久化和 `3+` 通过；Owner 待 API 核查；Level 显示不一致 |
| 8 绕过前端 | 计划直接提交七组非法数据 | 每组服务端返回 4xx，且无新职位 | 未取得可安全复用的已登录 API/DB 测试入口；未执行直接调用 | 未验证 |
| 9 双击 Save | 第二个合法表单上快速双击 Save | 恰好新增一个 Draft | 自动进入[第二条编辑页](https://hireos.aipollo.me/hireos/jd/jobs/f9cdaa4b-133d-4dd6-ac1f-5e90179a9308/document)；刷新列表 20→21，只有一条 `[UJ-TEST] M5 Double Save 20261014` | UI 层通过；请求数与幂等键未验证 |
| 10 保存失败 | 201 字符标题配合法字段 Save | 长度超限有明确错误 | 没有前端 200 字符提示；短暂进入 Creating 状态，随后显示 `The job was not created — Copilot is temporarily unavailable. Your input is kept — retry in a moment.`，表单值保留；列表仍 19。当时无法判断服务端是因长度拒绝，还是其他故障 | **失败，P2**：用户得不到可修复的长度错误 |
| 11 断网恢复 | 计划在 Save 时注入 `network_down` | 失败提示、输入保留、无假职位 | 浏览器控制未提供可控网络中断；未执行。Step 10 的服务端失败虽保留输入，但不能替代断网验证 | 未验证 |

第二条无薪资测试职位的角色概述在编辑页显示 `Drafted live with Ask Copilot from a spoken/typed description.`，而表单的 Role summary 留空。该文案把手动创建误述为 Copilot 起草，见缺陷 M5-LIVE-03。没有 AiRun 记录读取权限，不能据此判断实际是否调用 AI。

## 3. 原始用例与 AC 结果（旧口径，以上方复核为准）

| 用例 | 结果 | 关键证据或限制 |
|---|---|---|
| UC-M5-01 表单字段与必填标记 | **部分通过** | 五项必填标记可见；缺 Workplace type、Reports to；薪资无 Hour |
| UC-M5-02 空表单不能保存 | **部分通过** | 职位名提示且列表数不变；未观察请求流 |
| UC-M5-03 招聘人数非法 | **部分通过** | 0、1.5、-1 均有整数且 ≥1 提示；未观察请求流 |
| UC-M5-04 职责为空或无实际内容 | **部分通过** | 空、`1.`、空行均拦截；未验证错误字段关联和请求流 |
| UC-M5-05 要求为空 | **部分通过** | 提示至少一条要求；未观察请求流 |
| UC-M5-06 薪资最大值低于最小值 | **部分通过** | 40/25 被拦截；提示为范围级，未明确定位 Max K |
| UC-M5-07 合法表单直接创建 | **失败** | 自动跳转、Draft、刷新持久化成立；Internal 0，无法输入 Hour，Owner/AiRun 未核查 |
| UC-M5-08 特殊字符与选填显示 | **失败** | `3+` 保留；未填 Level 刚创建时出现 Mid、刷新后变空；缺 Workplace type 字段行 |
| UC-M5-09 绕过前端非法提交 | **未验证** | 缺已登录 API/DB 测试入口；没有把本地代码或匿名请求当作线上服务端证据 |
| UC-M5-10 双击 Save | **部分通过** | 列表只增加一条；未核查请求数与服务端幂等记录 |
| UC-M5-11 断网不生成假职位 | **未验证** | 未注入 `network_down`；普通保存失败保留输入不等于断网通过 |
| UC-M5-12 201 字符职位名 | **失败** | 没有前端长度提示，错误被泛化为 Copilot 暂不可用；未取得实际 HTTP 状态与错误码 |

统计：**失败 3 / 部分通过 7 / 未验证 2 = 12**。

| PRD AC | 判定 | 依据 |
|---|---|---|
| AC-1 合法数据直接创建、内容一致、无 AiRun | **失败** | 创建与刷新后内容大体成立，但 internal 文档缺失、Hour 目标无法输入，空概述被替换为误导性 Copilot 文案；AiRun 未验证 |
| AC-2 所有非法数据由前端拦截、不发创建请求 | **部分满足** | 空值、HC、职责、要求和倒置薪资有可见拦截；未抓请求流。201 字符标题无本地长度提示 |
| AC-3 绕过前端时服务端拒绝 | **未验证** | 未执行已登录 API 直调及 DB 计数 |
| AC-4 双击 Save 只创建一个职位 | **部分满足** | UI 列表 20→21 且同名仅一条；服务端幂等未核查 |
| AC-5 断网失败且无假职位 | **未验证** | 未注入断网；201 字符保存失败时保留输入且未见新增列表项，只能作有限旁证 |

## 4. 原始缺陷记录（部分已重判，以上方复核为准）

| ID / 严重度 | 实际证据与用户影响 | 最小修复方向及复验 |
|---|---|---|
| M5-LIVE-01 / **P1** · 表单与薪资模型 | 表单无 Workplace type、Reports to，Pay period 只有 Monthly / Yearly；用户无法按规格填完整数据，也无法形成 `USD 25–40 per hour`。 | 对齐已批准的字段清单与薪资单位；复验包含 Hour 的合法保存及文档/字段行回显。必填项的 5/9/11 口径先由产品确认。 |
| M5-LIVE-02 / **P1** · internal 文档 | 合法创建后编辑页显示 Public 8 / Internal 0；不能确认产品要求的 internal 文档交接。 | 核对服务端文档对象、audience、章节和权限；用 UI 与已登录 API/DB 同时验证。若 internal 文档设计已调整，先更新规格。 |
| M5-LIVE-03 / **P1** · 手动内容误标为 AI | 未填 Role summary 的第二条手动职位显示 `Drafted live with Ask Copilot from a spoken/typed description.`；可能误导下游使用者对来源的判断。 | 不填则保持空并提示补充，或用明确的“手动创建、概述未填”状态；复验无 AI 来源暗示、AiRun 记录为零。 |
| M5-LIVE-04 / **P2** · 职位名上限反馈 | 201 字符标题未在前端拦截，最终显示 Copilot 暂不可用；用户不知道应缩短标题。 | 前端明确限制 1–200 字符；服务端返回可识别的字段错误，并在原字段显示。复验 200/201 字符边界与无脏数据。 |
| M5-LIVE-05 / **P2** · 未填 Level 显示 | 第一条职位创建后 Level 瞬时显示 Mid，刷新后为空；一个未填字段被暂时显示成已确认事实。 | 未填值保持一致的空状态；创建、刷新、列表逐处复验。 |
| M5-LIVE-06 / **待核查** · Owner | 两条新建职位的列表 Owner 均为 UUID，My Jobs 仍为 0；可见登录名“蔡敏”，但没有服务端身份映射。 | 已登录 API 核对 `createdBy`/owner 与认证主体，并验证 My Jobs 查询；只凭显示不能定性为服务端归属错误。 |

另有与 M1/M2 报告相同的共性字段行问题：编辑页显示 Location、Headcount、Level，没有 Workplace type。建议按公共骨架统一修复，避免为相同行为重复开缺陷。

## 5. 原始 UX/UI 审查（旧口径，以上方复核为准）

角色：已登录职位创建者，页面显示“蔡敏”；具体 Recruiter/Manager 权限未证实。目标：不使用 AI，逐字段填写并创建可编辑 Draft；后续交给 M6 完整性检查。

| 标准 | 判定 | 证据与限制 |
|---|---|---|
| U1 容易理解 | **部分满足** | `Create Manually` 与五项必填明确，创建后 Draft / Not published 可见；空概述的 Copilot 起草文案混淆来源 |
| U2 容易上手 | **部分满足** | 入口说明与表单标签清楚；缺工作方式、汇报线，薪资以 K 为单位且无 Hour，用户难以按文档完成输入 |
| U3 快速完成任务 | **通过（本路径）** | New job → Create Manually → Save 后自动到编辑页；未测响应耗时阈值 |
| U4 下一步明确 | **部分满足** | 编辑页有 Analyze 3、Publish 禁用及原因；未显示 Owner、截止时间和 M6 交接对象 |
| U5 提示和按钮清楚 | **失败** | 201 字符保存失败显示 Copilot 暂不可用，未指出标题长度；倒置薪资提示没有定位 Max K |
| U6 符合真实工作方式 | **失败** | 手动路径无法填写 Hour、工作方式和汇报线，且空概述被 AI 起草文案替代 |
| U7 角色信息结构 | **未验证** | 只有一个会话，未取得 Recruiter/Manager/Viewer 各角色权限与字段可见性证据 |
| U8 减少跳转重复 | **通过（本路径）** | 表单与对话同屏，保存后自动进入编辑页；没有 Workspace 预览或重复确认 |
| U9 可恢复和可预期 | **部分满足** | 201 字符失败时表单值保留并有 Retry；错误原因不准确，断网、结果未知与权限变化未注入 |
| U10 可访问可操作 | **未验证** | 必填标记与错误文本可见；未完成键盘全路径、焦点管理、200% 缩放和错误字段的辅助技术关联检查 |

按审查标准，存在未豁免 P1，且核心的服务端校验、AiRun 和 internal 文档对象缺乏证据，**不能判为通过**。

```yaml
review:
  product: "JD Management"
  surface: "M5 Create Manually → Save → Job document"
  role: "已登录职位创建者（业务角色未由服务端证实）"
  journey_goal: "不用 AI，按字段创建并交接可编辑 Draft"
  evidence:
    source: "已发布页面可访问树、可见提示、编辑页刷新及职位列表计数"
    steps_checked: [1, 2, 3, 4, 5, 6, 7, 9, 10]
  verdict: "fail"
  findings:
    - id: "M5-LIVE-01"
      severity: "P1"
      category: "real_workflow_fit"
      step: 1
      title: "表单缺少工作方式、汇报线和 Hour 周期"
      evidence: "字段列表无 Workplace type / Reports to；Pay period 仅 Monthly / Yearly"
      user_impact: "无法输入并保存规格要求的完整职位与按小时薪资"
      recommendation: "按确认后的字段与周期规格补齐输入和回显"
      acceptance_check: "保存 Hour 范围后在文档及字段行核对"
    - id: "M5-LIVE-02"
      severity: "P1"
      category: "state"
      step: 6
      title: "创建后未见 internal 文档"
      evidence: "新职位编辑页 Public 8 / Internal 0"
      user_impact: "内部招聘上下文没有可验证的交接对象"
      recommendation: "核对并写入 internal 文档对象"
      acceptance_check: "UI 和已登录 API/DB 双重核验文档内容与权限"
    - id: "M5-LIVE-03"
      severity: "P1"
      category: "ai_boundary"
      step: 9
      title: "手动创建的空概述显示 Copilot 起草来源"
      evidence: "第二条新建职位显示 Drafted live with Ask Copilot from a spoken/typed description."
      user_impact: "下游可能误认手动内容为 AI 生成内容"
      recommendation: "保持空概述并提示补全，正确记录来源"
      acceptance_check: "手动路径无 AI 起草文案并核对 AiRun 为零"
    - id: "M5-LIVE-04"
      severity: "P2"
      category: "controls_clear"
      step: 10
      title: "201 字符标题没有明确长度错误"
      evidence: "最终提示 Copilot is temporarily unavailable，表单值保留"
      user_impact: "用户无法定位修复办法"
      recommendation: "前后端给出字段级 200 字符上限提示"
      acceptance_check: "200 字符可存、201 字符明确拒绝且无创建"
  usability_check:
    understandable: "fail"
    learnable: "fail"
    efficient: "pass"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "unknown"
    no_unnecessary_hops: "pass"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "未取得线上构建号、已登录 API/DB、AiRun、身份映射及请求记录"
    - "未注入断网，也未完成 200% 缩放和完整键盘/辅助技术测试"
    - "产品必填项口径、Viewer 行为与响应时间阈值待确认"
```

## 6. 测试数据与后续验证

两条测试 Draft 均保留供复核，没有删除、发布或外发：

| 职位 | ID | 结果 |
|---|---|---|
| [[UJ-TEST] M5 Manual Form 20261014](https://hireos.aipollo.me/hireos/jd/jobs/b3a45b96-d067-4018-a1af-93500231c366/document) | `b3a45b96-d067-4018-a1af-93500231c366` | 有 25K–40K/CNY/Monthly；Draft；Internal 0；刷新后仍在 |
| [[UJ-TEST] M5 Double Save 20261014](https://hireos.aipollo.me/hireos/jd/jobs/f9cdaa4b-133d-4dd6-ac1f-5e90179a9308/document) | `f9cdaa4b-133d-4dd6-ac1f-5e90179a9308` | 双击 Save 后列表仅一条；空概述出现 Copilot 起草文案 |

要关闭未验证项，需要可控 `network_down`、已登录 API/DB 只读核查（服务端 4xx/错误码、职位数、owner、AiRun、internal 文档及幂等记录），以及 Recruiter/Manager/Viewer 测试身份。报告仅记录已观察结果，未创建 Issue；若要跟踪缺陷，按仓库规则先起草并请用户确认 AC。
