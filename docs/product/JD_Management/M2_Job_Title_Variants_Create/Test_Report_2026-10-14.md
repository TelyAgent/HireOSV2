# M2「从职位名称生成三个版本并创建」线上测试报告

测试日期：2026-10-14（Asia/Shanghai）  
结论：**不通过**。9 条用例中，通过 4 条、失败 3 条、规格待确认 1 条、未验证 1 条。核心问题是同一次生成的三版事实字段不一致，并在用户只输入职位名时自行填入地点、工作方式等事实。创建后的归属及 internal 文档也未达到产品文档要求。

## 1. 依据、环境与范围

| 项 | 内容 |
|---|---|
| 产品依据 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[User Cases](User_Cases.md)；均为 v1.0 草稿 |
| UX 依据 | [JD Management UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)，按旅程步骤和 U1–U10 审查 |
| 环境 | 已发布页面 `https://hireos.aipollo.me/hireos/jd/jobs`；Codex in-app browser，桌面视口约 1280 × 720，英文界面 |
| 身份 | 页面右上角显示“蔡敏”；实际账号角色、身份映射与权限范围未取得服务端证据 |
| 构建 | 页面未展示线上构建号；本地仓库版本不能代表线上版本 |
| 基线 | 加载完成后 All Jobs 16、My Jobs 0、Published 7、Drafts 9；加载中的短暂 0 未作为基线 |
| 方法 | 实际 UI 点击、输入、双击、切换版本、刷新及列表观察；比对可见文案与字段。未取得已登录 API/DB 只读访问，也未注入 AI 服务故障 |
| 测试数据 | `Finance Manager` 两次、`make it remote`、`Chief Tidy Officer`、`[UJ-TEST] Finance Manager 20261014`；未输入候选人或真实薪资数据 |

本报告只把实际看到的行为判为通过。UI 计数不能代替 DB、AiRun、服务端 owner 或权限校验。PRD 的待确认项不推定为已批准产品规则。

## 2. 旅程步骤检查

| Step | 用户操作与预期 | 实际证据 | 结论 |
|---|---|---|---|
| 1 进入 M2 | 点击入口，标题作为用户消息，引导文案且输入框聚焦 | `i` 只展开说明；点击 Start with a Job Title 后出现一条标题消息、引导文案，焦点在底部输入框；无内嵌表单 | 通过 |
| 2 生成 | 发 `Finance Manager`，显示生成中，然后得到三版 | 用户消息出现一次；生成时出现省略号；结束后有 A/B/C 三卡及 Workspace 三页签 | 通过 |
| 3 对比 | 切换卡片/页签，三版仅风格不同且事实一致 | 卡片和页签同步；A 简短、B 候选人语气、C 详细。但第一次地点为“**中国大陆（具体城市可编辑）**”/“**中国大陆（具体城市可根据公司安排）**”/“**中国大陆**”；第二次为“**上海**”/“**中国大陆（支持远程/混合办公）**”/“**中国大陆，工作地点以公司实际办公城市为准**” | **失败，P0** |
| 4 Refine | 选 B，发 `make it remote`；三版更新、高亮且留在 B | B 保持选中；三版均显示 Updated，地点分别变为 A“远程”、B/C“远程（中国大陆）” | 更新交互通过；事实一致性仍失败 |
| 5 创建 | 用 B 创建 Draft；内容等于 B，归属当前用户并有 internal 文档 | 自动进入[职位编辑页](https://hireos.aipollo.me/hireos/jd/jobs/812d37af-bc2e-4e21-a3c7-2853cd01b6cc/document)。职责 6 条、要求 6 条与创建前 B 版可见文字逐条一致；刷新后仍是 Draft。页面显示 Public 21、**Internal 0**，列表 Owner 为 UUID `ee348e0e-d8db-4e82-bb6b-b9928954348f`、My Jobs 0；登录名为“蔡敏” | **部分满足，整体失败**；owner 需 API 复核 |
| 6 异常 | 空输入不得生成，并提示或禁用发送 | 空文本时 Send 的可访问状态仍为 enabled；点击后没有生成，也没有可见提示；未核查 AiRun | **失败**（反馈）；无 AiRun 未验证 |
| 7 罕见职位 | `Chief Tidy Officer` 应先确认含义（Journey）；PRD/用例说预期待确认 | 未追问，直接生成三版，把岗位解释为行政/办公室管理，并加入部门及“中国大陆”地点 | **规格待确认**；与 Journey 的异常描述冲突 |
| 8 双击 | 快速双击 Create A，只新增一个 Draft | Playwright 双击按钮后进入[测试职位编辑页](https://hireos.aipollo.me/hireos/jd/jobs/872db0e1-f2ee-4861-a022-b1e2a6565dc5/document)；All Jobs 17→18，列表仅一条同名职位 | UI 观察通过；DB 幂等记录未核查 |

两次相同 `Finance Manager` 输入均能产生三种风格；两次的版本内部均未满足事实一致性。第一次 A/B/C 的职位名、HC=1、全职与薪资未指定保持一致，但地点文字不同；第二次 A 为上海、B 支持远程/混合、C 地点由公司安排，地点与工作方式均存在实质差异。输入只有职位名，部门、地点、HC、工作方式及 5 年经验等均无用户来源标记。默认地点的产品规则为 `Ho Chi Minh City, VN`，本次各版没有采用该值。

## 3. 用例与验收标准

| 用例 | 结果 | 主要证据或限制 |
|---|---|---|
| UC-M2-01 入口引导 | **通过** | 信息按钮仅显示说明；入口标题、引导及焦点符合 FR-1 |
| UC-M2-02 三卡与页签 | **通过** | 生成两轮，每轮均有 A/B/C；卡片点击同步选中 Workspace 页签，Create 按钮随选择变化 |
| UC-M2-03 事实与风格 | **失败** | 两轮均有地点差异；第二轮工作方式也有差异。A/B/C 风格区别可见，但 AC-1 整体失败 |
| UC-M2-04 三版 Refine | **通过** | `make it remote` 后三版地点均显示 Remote/远程，三版有 Updated 高亮，仍选中 B；新值在 A 与 B/C 间仍不一致，另列 UC-M2-03 |
| UC-M2-05 创建所选版本 | **失败** | B 的职责/要求逐条匹配、Draft 持久化、自动跳转通过；Internal 0 与目标不符；Owner 与当前用户关系未确认，My Jobs 0 |
| UC-M2-06 空职位名 | **失败** | 点击可用 Send 无任何提示，未触发生成；AiRun 无读取权限，不能断言未新增 |
| UC-M2-07 AI 失败恢复 | **未验证** | 无可控 `llm_fail` 注入；不能由正常生成推断错误卡、Retry、Start over 或失败后无职位 |
| UC-M2-08 罕见职位名 | **规格待确认** | 直接生成办公管理解释；Journey 要求先确认，PRD/用例又将预期标为待确认 |
| UC-M2-09 双击创建 | **通过（UI 层）** | 双击后列表总数仅 +1，只有一条同名 Draft；未读取 DB 幂等键或请求记录 |

统计：**通过 4 / 失败 3 / 规格待确认 1 / 未验证 1 = 9**。

| AC | 结论 | 依据 |
|---|---|---|
| AC-1 三版风格不同、事实一致 | **失败** | 两次生成均出现地点/工作方式不一致；UC-M2-03 |
| AC-2 Refine 三版且留在当前版 | **通过（交互）** | 三版 Remote、高亮、仍选 B；事实一致性问题归 AC-1 |
| AC-3 创建内容等于所选版本 | **部分满足，整体失败** | 职责/要求一致且 Draft 持久化；Internal 0、归属未证实；UC-M2-05。双击仅新增一条 |
| AC-4 空职位名不触发生成 | **部分满足** | 未生成；但发送仍可点击且无提示，不满足 FR-7 与用例反馈要求；AiRun 未核查 |
| AC-5 AI 失败可恢复 | **未验证** | 缺可控故障注入 |

## 4. 缺陷与修复验收建议

所有已复现问题、规格冲突及待核查项的逐步操作见[问题清单与完整复现步骤](Issue_Reproduction_List_2026-10-14.md)。

| ID / 严重度 | 证据与用户影响 | 最小修复方向 / 修复后验收 |
|---|---|---|
| M2-LIVE-01 / **P0** · AI 事实边界 | 同一次三版的地点与工作方式不一致；两次 `Finance Manager` 的 A/B/C 各自给出不同地点。招聘人员无法确认哪个版本承载真实条件，可能把错误事实写入职位。 | 生成时固定共享的结构化事实，再只改写表达；字段级比对 title/location/HC/workplace/salary。相同输入至少跑两轮，逐字段一致，不填未经提供的事实。 |
| M2-LIVE-02 / **P1** · 创建归属 | 第一条创建后的列表 Owner 是 UUID、My Jobs 0；第二条 Owner 为 Linh Tran、My Jobs 1；两次都在显示“蔡敏”的同一 UI 会话内创建。职位可能落入错误归属或身份展示映射不稳定。 | 用已登录 API 核对 `createdBy`/owner 与认证主体；统一列表身份显示。创建两条测试职位并刷新后，均出现在当前用户 My Jobs。 |
| M2-LIVE-03 / **P1** · 文档类型 | 创建后的编辑页显示 Public 21、Internal 0，未见产品要求的 internal 文档内容；第二条也是 Internal 0。若 internal 内容应在单独对象中，当前 UI 不足以证明。 | 核对服务端文档模型与可见性，按规格生成 internal 文档；用 DB/API 和 UI 同时验证其存在、权限与内容。 |
| M2-LIVE-04 / **P2** · 空输入反馈 | 空文本 Send 状态 enabled，点击无提示。首次用户无法判断是输入必填还是系统无响应。 | 空值禁用并说明原因，或点击后在输入框旁显示明确错误；核查无请求、无 AiRun。 |
| M2-LIVE-05 / **待产品决策** · 罕见职位 | `Chief Tidy Officer` 被直接解释成办公室整理与设施管理；Journey 要求先确认含义，PRD 的待确认项尚未定案。 | 先统一规格；若要求追问，确认前不得生成，也不得填入未经提供的部门和地点。 |

另有跨模块已知问题：创建页的字段行显示 Location、Headcount、Level，**没有 Workplace type**；`Level` 是用户未提供的字段且新建瞬间显示 Mid，刷新后变空。该行为与 M1–M5 公共骨架的字段行规则不符，建议作为共性缺陷处理。现有 M1 线上报告已记录类似字段行问题，本报告不把它计为新的 M2 独有缺陷。

## 5. UX/UI 审查（U1–U10）

审查角色：已登录的职位创建者；业务角色未由服务端确认。目标：输入职位名，对比三种写法，选 B 并创建可继续编辑的 Draft；下一步交给 JD 编辑/完整性检查，审批与发布不在本次 M2 范围内。

| 标准 | 判定 | 证据与限制 |
|---|---|---|
| U1 容易理解 | **通过（本路径）** | 入口写明“3 JD options”；A/B/C 风格名称可见；创建页显示 Draft、Not published、JD ID |
| U2 容易上手 | **通过（本路径）** | 五种入口有说明按钮；M2 引导文案明确要求职位名，输入框自动聚焦 |
| U3 快速完成任务 | **通过（步骤）** | 入口→输入→选版→Create，无重复输入；生成中有状态。未测精确响应时间，阈值仍待确认 |
| U4 下一步明确 | **部分满足** | 创建后自动到编辑页，Publish 禁用并提示需修订；页面有 Analyze，但未显示负责人/截止时间，角色下一步未完全明确 |
| U5 提示和按钮清楚 | **失败** | Create 按钮写明版本；空输入 Send 可点击却无解释 |
| U6 符合真实工作方式 | **失败** | 版本对比有用，但不同版本改变地点/工作方式，破坏招聘人员的真实决策依据 |
| U7 角色信息结构 | **未验证** | 只使用一个已登录会话，未取得 Recruiter/Manager/Approver/Viewer 角色及字段权限证据 |
| U8 减少来回跳转 | **通过（本路径）** | 卡片与 Workspace 同屏联动；创建后直接进入编辑页 |
| U9 可恢复和可预期 | **未验证且有缺口** | 正常路径显示生成与保存；空输入无反馈。AI 故障、断网、结果未知、权限变化均未注入 |
| U10 可访问、可读、可操作 | **部分观察，整体未验证** | 主输入框获得焦点；选中页签和 Draft 有文字状态，不只靠颜色。未执行完整键盘路径、200% 缩放、屏幕阅读器与错误字段关联测试 |

按审查标准：存在 P0，流程 verdict 为 **fail**。职位是否属于当前用户、internal 文档对象、AiRun、权限边界和无对外副作用未从服务端确认，不能声明这些项目通过。

```yaml
review:
  product: "JD Management"
  surface: "M2 Start with a Job Title → A/B/C → Refine → Create"
  role: "已登录职位创建者（实际业务角色未确认）"
  journey_goal: "由职位名对比三版并创建所选 Draft"
  evidence:
    source: "线上 UI 可访问树、可见页面、刷新后列表及本地截图"
    steps_checked: [1, 2, 3, 4, 5, 6, 7, 8]
  verdict: "fail"
  findings:
    - id: "M2-LIVE-01"
      severity: "P0"
      category: "ai_boundary"
      step: 3
      title: "三个版本的地点和工作方式不一致"
      evidence: "第二轮同次生成：上海 / 中国大陆（支持远程或混合办公） / 中国大陆且城市待定"
      user_impact: "无法可靠选择事实正确的 JD"
      recommendation: "共享结构化事实，三版只改表达"
      acceptance_check: "同一输入至少两轮，逐字段核对事实一致且有来源"
    - id: "M2-LIVE-02"
      severity: "P1"
      category: "permissions"
      step: 5
      title: "创建者归属显示不一致"
      evidence: "同一可见登录会话的两条职位分别显示 UUID/My Jobs 0 与 Linh Tran/My Jobs 1"
      user_impact: "创建者难以找到并管理刚创建的职位"
      recommendation: "核对认证主体与 owner 写入及展示映射"
      acceptance_check: "API 核验 owner，刷新后两条均出现在 My Jobs"
    - id: "M2-LIVE-03"
      severity: "P1"
      category: "state"
      step: 5
      title: "创建后未见 internal 文档"
      evidence: "编辑页显示 Public 21 / Internal 0"
      user_impact: "内部招聘上下文可能未交接"
      recommendation: "核实并生成要求的 internal 文档"
      acceptance_check: "API/DB 与 UI 确认对象、内容及可见性"
    - id: "M2-LIVE-04"
      severity: "P2"
      category: "controls_clear"
      step: 6
      title: "空职位名点击发送无反馈"
      evidence: "Send enabled；点击后无提示、无新消息"
      user_impact: "用户不知道如何继续"
      recommendation: "禁用并说明原因，或显示必填错误"
      acceptance_check: "空值下清晰反馈且无 AI 请求"
  usability_check:
    understandable: "pass"
    learnable: "pass"
    efficient: "pass"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "unknown"
    no_unnecessary_hops: "pass"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "未取得线上构建号、已登录 API/DB、AiRun 与身份映射"
    - "未注入 llm_fail/network_down，未测 200% 缩放和完整键盘路径"
    - "PRD 的事实默认值与罕见职位预期仍待产品确认"
```

## 6. 测试数据与证据

本次创建两条 Draft，均**保留供复核**，未删除、发布或外发：

| 职位 | ID | 结果 |
|---|---|---|
| [Finance Manager](https://hireos.aipollo.me/hireos/jd/jobs/812d37af-bc2e-4e21-a3c7-2853cd01b6cc/document) | `812d37af-bc2e-4e21-a3c7-2853cd01b6cc` | B 版 Refine 后创建；JD-2026-0013；Owner 在列表显示 UUID |
| [[UJ-TEST] Finance Manager 20261014](https://hireos.aipollo.me/hireos/jd/jobs/872db0e1-f2ee-4861-a022-b1e2a6565dc5/document) | `872db0e1-f2ee-4861-a022-b1e2a6565dc5` | A 版双击创建；JD-2026-0014；仅一条同名 Draft |

最终列表 All Jobs 18、Published 7、Drafts 11；从初始 16/7/9 只增加上述 2 条。My Jobs 最终为 1，与两条都由本次可见会话创建的事实不一致，需服务端核验。`Chief Tidy Officer` 和第二轮未选定的 `Finance Manager` 只生成 Copilot 草稿，未点击 Create。

本地截图存于仓库忽略目录：[职位列表](../../../../.local/m2-test-evidence/job-list.png)、[B 版创建详情](../../../../.local/m2-test-evidence/created-b.png)。截图可能包含现有职位名称，仅用于本地复核，不纳入公开仓库。正式缺陷 Issue 尚未创建；仓库规则要求先起草并由用户确认。

要补齐未验证项，需要可控的 LLM 故障注入、已登录 API/DB 只读核查（owner、AiRun、internal 文档、创建幂等记录）、明确的测试角色，以及产品对罕见职位和事实默认值的决定。
