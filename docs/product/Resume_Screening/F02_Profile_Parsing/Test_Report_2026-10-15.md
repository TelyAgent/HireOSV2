# F02 简历解析与候选人档案线上测试报告（2026-10-15）

## 结论

**不通过，不能按 F02 当前验收标准放行。** 15 条用例中，通过 0 条、失败 4 条、部分通过 3 条、未验证 8 条。线上已证实的主要问题是：档案字段没有原文定位；完整虚构简历中的语言、证书、项目、到岗时间和总工作年限未在详情页呈现；未写工作授权却被列为“缺失信息”；未有关联岗位的候选人纠正所在地仍被强制要求填写原因。权限、档案版本、审计和已有评估的刷新状态缺少所需角色及 API/DB 证据，不能推定通过。

本报告记录 **2026-10-15 09:54–09:57 CST** 对已发布页面的实际操作。产品预期依据 [PRD](PRD.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[User Cases](User_Cases.md)，应用性审查依据 [HireOS Command UX/UI Review Standard](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的通用 U1–U10、证据及通过门槛。该标准原为 JD Management 编写；JD 专属字段、审批和发布条款不作为 F02 验收项。F02 文件标为“草稿，待评审”，本报告只按当前文本判定。

## 环境、数据与方法

| 项 | 实测信息 |
|---|---|
| 线上地址 | `https://hireos.aipollo.me/hireos/screening/`；入口和候选人详情均可访问 |
| 执行身份 | 已登录会话；页面显示“蔡敏”，候选人 Owner 显示 Emma Wilson。未核实会话身份与业务角色映射 |
| 浏览器与语言 | Codex 内置浏览器；页面为 English，未获得浏览器版本和线上构建号 |
| 仓库版本 | 本地 HEAD `c0e47a6`；**不能视为线上构建号**。工作区已有其他未提交改动，测试未修改代码 |
| 检查方式 | 页面可访问树、可见文本、实际导入与纠正、刷新；线上 API 响应、数据库、AiRun、审计日志未读取 |
| 测试数据 | 通过**粘贴档案**提交一份完全虚构的简历文本，系统将材料命名为 `[UJ-TEST] F02 Avery Stone.txt`；解析后的候选人姓名和简历库列表显示为 **`Avery Stone`**，邮箱 `f02.avery.20261015@example.com`。复用已有 `[UJ-TEST] Pia Nguyen` 观察缺失字段和纠正校验。没有使用真实候选人数据进行断言 |
| 线上记录 | 导入批次 `bbef7640-4547-428b-bb34-83396ae8fac0`，显示 `1/1 processed · Succeeded`；新候选人 ID `6a8ad361-32b3-41bf-832d-e42707fbcf11` |

新样本原文包含重叠的两段经历（2020-06～2022-06、2022-01～present）、教育、SQL/Python/Tableau、英语和西语水平、AWS 证书、Atlas 项目、`USD 60,000–70,000 per year gross`、`one month` 到岗，以及明确写出的性别、出生日期、国籍、婚姻状况。`Work authorization: Not stated.` 表示没有提供授权事实。所有姓名、机构、邮箱和履历均为虚构。

## 逐步实测证据

| Step | 用户操作 | 预期结果 | 实际结果与证据 | 结论 |
|---|---|---|---|---|
| 1 | 打开简历库，选择 Paste profile，粘贴虚构简历并 Add to library | 可读材料进入解析；逐条给出结果 | 批次显示 `1/1 processed · Succeeded`、`New candidate, no conflicts — added to the Resume Library` 和 Open profile；没有选择岗位 | 通过，本步骤属于 F01→F02 前置交接 |
| 2 | 打开新候选人详情 | 4.1 全字段及状态、原文位置可见 | 显示姓名、邮箱、地点、薪资、经历、技能和一句教育；未见语言、证书、项目、到岗时间、总工作年限，也没有字段状态/原文位置或原文跳转控件 | 失败；仅能断言 UI，不能断言未存入 DB |
| 3 | 对照虚构原文核查关键数据 | 日期规范、重叠时间不重复计算、薪资原币种/周期/税别 | 两段日期以 `YYYY-MM` 显示；薪资显示 `$60,000–$70,000/yr (gross)`；总工作年限未显示，无法核对重叠处理 | 部分通过 |
| 4 | 核查没有授权事实和受保护属性的样本 | 工作授权不计入缺失；受保护属性不展示也不存储 | 工作授权显示 `Unknown`，但 Missing information 列出 `work authorization`；性别、出生日期、国籍、婚姻状况未在可见详情出现。未取得 API/DB 响应 | 工作授权失败；受保护属性仅 UI 部分通过 |
| 5 | 对刚导入、尚未匹配的 Avery 尝试把所在地改为 `Tacoma, WA, United States` 且不填原因；对已有 Pia 也做相同空原因检查 | 未被有效推荐/评估使用的字段原因选填 | Avery 详情显示 `Searching for matching roles…`，Pia 显示 `No matching roles right now`；两者纠正弹窗均显示 `REASON FOR CORRECTION *`，点击 Save 均提示 `Say why the profile is being corrected — it is kept in the log.`，未保存。Avery 的这次输入随后取消 | 失败；刚导入且未匹配的样本也被强制要求原因 |
| 6 | 把新虚构候选人所在地从 Seattle 改为 Tacoma，填写 `QA synthetic profile correction 2026-10-15` 并保存 | 保存新档案版本、保留旧版和原文、审计可查 | 详情立即显示 Tacoma；提示 `Profile corrected — affected screenings marked stale for refresh`。页面没有档案版本号、旧档案入口或审计入口；该人没有预置有效评估 | 保存通过，版本/审计/评估状态未验证 |
| 7 | 在保存纠正后刷新新候选人详情 | 导入和纠正的数据持久化 | 刷新后候选人、薪资、经历和纠正后的 `Tacoma, United States` 仍在；取消的 `Tacoma, WA, United States` 未保存 | 页面层持久化通过；旧版本/DB 未查 |

### 线上页面链接

- [新建虚构候选人详情](https://hireos.aipollo.me/hireos/screening/candidates/6a8ad361-32b3-41bf-832d-e42707fbcf11)
- [既有虚构测试候选人详情](https://hireos.aipollo.me/hireos/screening/candidates/0a1255a5-9ead-4d81-b3ae-9b7ca5822bf4)

这些链接仅定位对象；页面状态可能随其他测试变化。上述证据来自本次操作时的页面可访问树和可见文案，没有保存包含候选人信息的截图到公开仓库。

**列表查找说明（2026-10-15 16:27 CST 复核）：**在用户当前 Chrome 会话的线上简历库中，搜索 `Avery Stone` 显示“共 66 位候选人中的 1 位”，该行的邮箱与候选人 ID 均与本报告一致。列表按解析后的候选人姓名显示，不按材料文件名 `[UJ-TEST] F02 Avery Stone.txt` 显示；因此搜索文件名或 `[UJ-TEST]` 可能找不到此条。当前复核只确认列表可见，不改变原测试结论。

## 15 条用例结果

| 用例 | 结果 | 实际观察和限制 |
|---|---|---|
| UC-F02-01 完整解析且字段可定位 | **失败** | 新样本有多项字段未在 UI 呈现；无逐字段状态、页码/段落及原文跳转。未查 API。 |
| UC-F02-02 总工作年限为推导值 | **失败** | 两段重叠经历显示，但详情没有总工作年限及“推导值”标记，无法核对去重。 |
| UC-F02-03 中文简历与薪资 | **未验证** | 本次没有上传规定的 CJK 字体 PDF 和 `35-45K·14 薪` 样本；英文薪资通过不代表此项通过。 |
| UC-F02-04 资料稀少不编造 | **部分通过** | 既有 Pia 档案把薪资显示为 `Not provided`，经历/教育列为缺失，未见明显编造；未核对原始文本/API，且同一输入未运行两次。 |
| UC-F02-05 不提取受保护属性 | **部分通过** | 新样本原文明确写出性别、出生日期、国籍、婚姻状况，详情可见区域没有这些字段；API/DB 未查，不能确认未提取。 |
| UC-F02-06 工作授权不计入缺失字段 | **失败** | 新样本无授权事实，详情仍在 Missing information 中列出 `work authorization`。有授权事实时的受限显示未测。 |
| UC-F02-07 无姓名时用文件名兜底 | **未验证** | 未导入无姓名文件；已有记录不能证明本次兜底链路。 |
| UC-F02-08 解析失败可重试 | **未验证** | 没有可控 `llm_fail` 与规则解析同时失败的条件；未制造线上解析故障。 |
| UC-F02-09 纠正已用字段时原因必填 | **未验证** | 缺少 S_linked 的指定 Nina 有效评估前置状态；普通弹窗原因必填不等于按使用情况判断正确。 |
| UC-F02-10 纠正未用字段时原因选填 | **失败** | 刚导入且尚未匹配的 Avery 修改所在地仍被强制填原因；Pia 也复现。弹窗没有项目描述纠正字段。正式复测仍需 S_linked/未使用字段及 API 证据。 |
| UC-F02-11 纠正生成新版本并使评估待更新 | **部分通过** | 虚构新候选人填写原因后所在地更新，出现“affected screenings marked stale”提示；版本号、旧版、审计、有效评估及其引用未核对。 |
| UC-F02-12 新简历版本 | **未验证** | 未经 F03 为同一人确认第二份简历；未测试已有评估保留。 |
| UC-F02-13 Hiring Manager 受限字段 | **未验证** | 当前只有一个已登录会话，未获得 hm_a 会话和已登录 API 检查。 |
| UC-F02-14 Viewer 受限字段不下发 | **未验证** | 缺 viewer_a 账号及已登录 API 响应；UI 隐藏不能替代服务端验证。 |
| UC-F02-15 HR Approver 查看纠正审计 | **未验证** | 缺 approver_a 会话和审计读取入口/权限证据。 |

统计：**通过 0 / 失败 4 / 部分通过 3 / 未验证 8 = 15**。UC-F02-01、02、06、10 的失败针对线上可见行为；未验证子步骤不被算作通过。UC-F02-10 的指定“项目描述”操作和服务端使用关系仍待正式复测。

## 验收标准覆盖

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 字段原文定位 | **失败** | UC-F02-01：详情没有逐字段证据位置或跳转。 |
| AC-2 缺失字段不编造 | **部分通过** | UC-F02-04：UI 有 `Not provided`；未做原文/API 对照及双次 AI 质量测试。 |
| AC-3 纠正生成版本、旧版和原文可查 | **未验证** | UC-F02-11 保存成功，但页面未显示档案版本/旧版/原文入口。 |
| AC-4 新简历使评估待更新且不改写 | **未验证** | 无第二简历和有效评估；成功 toast 不足以证明。 |
| AC-5 全部简历版本和岗位关系 | **未验证** | 单版本显示来源和日期；多版本、多岗位种类未构造。 |
| AC-6 无权限角色看不到敏感值 | **未验证** | 缺角色会话和 API 响应。 |
| AC-7 全字段、日期、总年限 | **失败** | UC-F02-01、02：UI 缺多项字段和总年限；两段日期格式可见正确。 |
| AC-8 不提取受保护属性 | **部分通过** | UC-F02-05：UI 未显示；存储层未查。 |
| AC-9 工作授权缺失/权限/不参与评分 | **失败** | UC-F02-06：未写仍在 Missing information；权限和评分未查。 |
| AC-10 纠正原因规则及记录 | **未验证** | 已观察普通纠正弹窗一律必填；但没有完整的已使用/未使用前置状态和审计证据。 |

## 应用性 / 可用性审查（U1–U10）

| 标准 | 结论 | 线上证据与限制 |
|---|---|---|
| U1 容易理解 | **部分通过** | 页标题、候选人、Owner、Identity: Provisional、缺失信息可见；档案版本与解析状态不见。 |
| U2 容易上手 | **通过** | Resume Library 的 Paste profile、Upload resumes 入口明确，导入后有 Open profile。 |
| U3 快速完成任务 | **部分通过** | 粘贴后单批次可进入详情；查看证据和旧版需要的路径缺失，导致核对任务无法完成。 |
| U4 下一步明确 | **部分通过** | 无匹配岗位时提供 Run matching/Search roles；解析纠错后的下一步、负责人与刷新结果不明确。 |
| U5 提示和按钮清楚 | **部分通过** | Add to library、Correct profile、Save correction 文案明确；纠正说明只说会生成 snapshot，未显示如何查看；原因规则没有按使用情况解释。 |
| U6 符合真实工作方式 | **失败** | HR 无法在当前详情核对材料位置和多项简历信息，难以判断解析是否准确。 |
| U7 信息结构符合角色目标 | **未验证** | 仅一个已登录会话；HR/HM/Viewer 字段和操作差异未实测。 |
| U8 减少跳转和重复输入 | **部分通过** | 粘贴后可直达档案；缺失证据入口可能迫使用户另找原文，但未实测跨页路径。 |
| U9 可恢复和可预期 | **未验证** | 正常导入有处理中与成功状态；解析失败、并发冲突、权限变化未测。 |
| U10 可访问、可读、可操作 | **未验证** | 可访问树能读到主要按钮和错误文本；未完成键盘焦点、200% 缩放及错误字段关联的系统检查。 |

流程判定 `fail`：有影响核心“核对解析准确性”的 P0 问题；权限、版本和评估等核心结果仍未验证。页面可见性不能替代服务端权限和持久化证据。

## 缺陷、影响与复测方式

| ID | 严重级别 | 角色/步骤 | 证据与用户影响 | 最小修复方向及验收检查 |
|---|---|---|---|---|
| F02-LIVE-01 | **P0** | Recruiter，Step 2 | 完整虚构原文含语言、证书、项目、到岗时间，详情无这些区块；各字段无状态/来源位置。HR 不能核对解析结果。 | 展示 4.1 全字段与状态、来源版本/位置；点字段可定位原文，原文不可用时显示 unavailable。用同一样本复测 UI/API。 |
| F02-LIVE-02 | **P1** | Recruiter，Step 3 | 两段重叠经历已显示，但没有总工作年限或推导标记；无法判断是否重复计算。 | 显示由不重叠月份计算的年限及“推导值”，用固定重叠样本核对结果。 |
| F02-LIVE-03 | **P1** | Recruiter，Step 4 | 无工作授权事实时 Missing information 仍含 `work authorization`，会误导 HR 追索非必需资料。 | 从缺失列表排除工作授权；有明确原文时只在授权角色展示受限字段。用无/有授权两份样本及角色 API 复测。 |
| F02-LIVE-04 | **P1** | Recruiter，Step 5 | 新导入且尚未匹配的 Avery 修改所在地时原因仍必填；表单无法编辑项目描述。未被使用字段的简单纠正增加阻力。 | 按有效推荐/评估引用决定原因必填，提供可纠正字段和“其他”说明规则；用可证明未使用的字段做 UI/API 复测。 |
| F02-LIVE-05 | **P1** | Recruiter，Step 6 | 保存后只见新所在地和成功提示，当前详情没有档案版本号、旧版、原文及纠正审计入口；不能完成可追溯核查。 | 展示当前/历史档案版本及纠正记录；核对原值、新值、操作者、时间、原因，确认旧原文未变。此项目前只证实 UI 不可见，不能据此断定后端未保存。 |

P0/P1 是按审查标准对**当前可见功能影响**的建议级别，不代表已完成代码归因。用户确认验收标准后，五项问题已分别创建 [Issue #155](https://github.com/TelyAgent/HireOSV2/issues/155)、[#156](https://github.com/TelyAgent/HireOSV2/issues/156)、[#157](https://github.com/TelyAgent/HireOSV2/issues/157)、[#158](https://github.com/TelyAgent/HireOSV2/issues/158)、[#159](https://github.com/TelyAgent/HireOSV2/issues/159)。

## 审查限制与后续复测条件

1. 缺 hm_a、viewer_a、approver_a 的可用会话及已登录 API/DB 只读证据，AC-6 与审计、服务端权限不能判定。
2. 缺指定 S_linked（含有效评估）、双版本简历及 F03 确认链路，AC-3～5、AC-10 的完整业务闭环不能判定。
3. 缺可控 `llm_fail`、规则解析失败注入，不能验证失败重试和无半成品档案。没有为测试故意扰动线上解析服务。
4. 未上传 CJK 字体 PDF、无姓名文件和重复 AI 质量样本；这些用例维持未验证。
5. 没有线上构建号、服务端日志、AiRun 或审计日志；不能将本地代码或成功 toast 当作线上持久化证据。
6. 本次使用线上已发布环境但未部署或更改服务配置；只新增一份虚构简历并对其做一次纠正。测试记录**保留供复核**，没有执行删除，因为删除的恢复语义和其他测试依赖未核实。

## 审查结构化摘要

```yaml
review:
  product: "Resume Screening / F02"
  surface: "Resume Library → Candidate Profile → Correct profile"
  role: "Recruiter / TA（会话角色映射未核实）"
  journey_goal: "核对解析结果、纠正错误并追溯材料与版本"
  evidence:
    source: "线上页面可访问树、可见文案、导入/纠正操作、刷新"
    steps_checked: [1, 2, 3, 4, 5, 6, 7]
  verdict: "fail"
  findings:
    - {id: "F02-LIVE-01", severity: "P0", category: "state", step: 2, title: "档案字段和来源定位不完整", evidence: "新样本详情缺语言/证书/项目/到岗及字段来源", user_impact: "无法核对解析准确性", recommendation: "呈现全字段及证据位置", acceptance_check: "同样本逐字段对照原文与 API"}
    - {id: "F02-LIVE-02", severity: "P1", category: "clarity", step: 3, title: "总工作年限不可见", evidence: "重叠经历已显示但无总年限", user_impact: "无法核对时间去重", recommendation: "显示推导值", acceptance_check: "固定重叠样本核对月份"}
    - {id: "F02-LIVE-03", severity: "P1", category: "state", step: 4, title: "工作授权误列缺失", evidence: "Missing information 含 work authorization", user_impact: "误导补资料", recommendation: "排除该字段", acceptance_check: "无授权事实样本缺失列表不含它"}
    - {id: "F02-LIVE-04", severity: "P1", category: "controls", step: 5, title: "未使用字段仍强制纠正原因", evidence: "刚导入且尚未匹配的候选人仍要求原因", user_impact: "纠正增加阻力", recommendation: "按有效引用判断必填", acceptance_check: "明确未使用字段可不填原因保存"}
    - {id: "F02-LIVE-05", severity: "P1", category: "state", step: 6, title: "纠正历史不可见", evidence: "仅见新值及成功提示", user_impact: "无法查旧值和原因", recommendation: "提供版本和审计入口", acceptance_check: "UI/API/DB 可查新旧版本和原文"}
  usability_check:
    understandable: "fail"
    learnable: "pass"
    efficient: "fail"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "无线上 API/DB/审计证据"
    - "无 HM/Viewer/Approver 角色会话"
    - "无 S_linked、双版本简历及可控解析故障"
```
