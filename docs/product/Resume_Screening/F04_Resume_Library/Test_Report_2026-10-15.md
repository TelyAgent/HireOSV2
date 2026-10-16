# F04 简历库：线上功能测试与 UX/UI 审查报告

**测试日期：**2026-10-15（Asia/Shanghai）  
**结论：** **不通过（fail）**。线上姓名搜索、已关联候选人仍在库、刷新后列表记录仍在等部分行为可见；但标签搜索返回错误结果，列表缺少多维筛选、关联岗位数和标签/负责人编辑入口。权限、空库、删除审计及四种异常匹配状态没有足够线上条件，均未判为通过。定时复查需求存在产品规则待确认项，见第 7 节，不列为已确认线上缺陷。

## 1. 依据、环境与判定口径

| 项 | 内容 |
|---|---|
| 产品依据 | [F04 PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop IO](Loop_IO.md) |
| UX/UI 依据 | [HireOS Command — JD Management UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)；其审查方法与 U1–U10 用于 F04，JD 专属审批/发布项目不适用 |
| 线上入口 | [Resume Library](https://hireos.aipollo.me/hireos/screening/library) |
| 会话与视口 | 已登录账号页面显示“蔡敏”；Codex 内置浏览器，英文界面，桌面截图约 1280 × 720；服务端角色未核验 |
| 线上数据 | 列表加载完成后显示 **61 of 61 candidates**；使用已有的 `example.com` / `[UJ-TEST]` 合成候选人记录做只读检查 |
| 方法 | 通过线上 UI 的可访问树、DOM、可见文案和页面刷新检查；搜索、打开详情、查看删除确认后取消。未读取线上 API 响应、DB、审计或服务端日志 |
| 构建 | 线上无可见构建号。本地 HEAD `c0e47a6` 及静态代码仅用于解释可能原因，**不等于线上构建证据** |
| 线上改动 | 无新增、编辑、匹配或删除数据；打开删除确认框后点击 Cancel |

**判定口径：**“失败”只用于已执行且观察到与预期冲突的部分；“部分验证”表示可见 UI 满足一部分，但用例要求的 API、DB、角色或其他状态未覆盖；“未验证”表示缺少前置状态、账号或可安全执行的条件。文档事先标注的 known gap 不自动等于线上实测失败。加载期间短暂显示 `0 of 0`，统计只采用稳定加载后的 61 条。

## 2. 可复核的线上证据

| ID | 操作 / 页面 | 实际观察 |
|---|---|---|
| F04-E01 | 打开[简历库](https://hireos.aipollo.me/hireos/screening/library) | 有说明“Every candidate stays here whether or not they’re linked to a job…”，Paste profile / Upload resumes，显示 `61 of 61 candidates`。表头为 Candidate、Tags、Latest source、Owner、Match status、Last matched、空白操作列；没有独立的关联岗位数列。列表唯一筛选控件是“Search name, email, tag…”文本框。 |
| F04-E02 | 输入合成候选人姓名 `王浩然` | 稳定结果为 `1 of 61 candidates`；[该候选人](https://hireos.aipollo.me/hireos/screening/candidates/185a6f28-f0d1-48b6-8e50-f1f173521ce8)仍在简历库，匹配状态格显示 `1 linked role`。这是 UI 存在性证据，不证明 API 权限过滤。 |
| F04-E03 | 在列表可见 `SQL` 标签时，搜索 `SQL` | 稳定结果为 `0 of 61 candidates`，出现“No candidates match your search”；与同页可见的 `SQL` 标签矛盾。 |
| F04-E04 | 输入 `Nina`，打开[合成 Nina 档案](https://hireos.aipollo.me/hireos/screening/candidates/13d53ef2-ef67-4163-987a-9b44c551f537)，再进入简历库 | 搜索前为 `1 of 61 candidates`；返回后搜索框为空、显示 `61 of 61 candidates`。详情页显示“No matching roles right now”、原因“当前开放岗位未达到匹配阈值”、`Search roles` / `Update profile` / `Match again`；没有“设置复查”。本次未检查滚动位置恢复。 |
| F04-E05 | 对 `王浩然`搜索结果刷新页面 | 刷新后列表重新显示 `61 of 61 candidates`，候选人记录仍存在；搜索词未保留。仅证明 UI 再次加载，不证明数据库持久化、审计或跨会话一致性。 |
| F04-E06 | 在该合成记录点击 Delete，查看确认框后 Cancel | 弹窗写明“This permanently removes the candidate and their resume history from the library. This can't be undone.”；没有执行最终删除。删除后匹配排除和审计未验证。 |
| F04-E07 | 观察 61 条稳定列表记录 | 可见状态包括 `No matching roles` 22 条、`Not matched yet` 3 条、`pending recommendation` 28 条、`linked role` 8 条。此分布仅代表这次账号和当前数据，不能证明其他状态不存在。 |

**隐私处理：**报告只引用明确用于测试的合成候选人；不复制列表中真实候选人的姓名、联系方式或简历内容。上述链接仅供有权登录的人员复核。

## 3. 13 条 User Cases 逐项结果

| 用例 | 优先级 | 线上结果 | 证据与限制 |
|---|---|---|---|
| UC-F04-01 空库 | P2 | **未验证** | 当前库有 61 条，无 `S0_empty` 隔离工作区；搜索无结果不是空库。F04-E01 仅证明上传入口常驻。 |
| UC-F04-02 列表结构与计数 | P1 | **失败** | F04-E01：说明、6 个具名列和 `N of M` 有；PRD 要求的独立“关联岗位数”列缺失，数值混入 Match status（F04-E02）。 |
| UC-F04-03 搜索筛选并保留位置 | P1 | **失败** | F04-E02 姓名搜索有效；F04-E03 标签搜索错误；来源、负责人、匹配状态、入库时间无筛选控件；F04-E04 返回后条件丢失。滚动位置未验证。 |
| UC-F04-04 已关联候选人仍在库中 | P0 | **部分验证** | F04-E02：已有合成候选人在库且显示 `1 linked role`。未准备文档指定的 Nina `S_linked` seed，也未核对 API 与关联记录。 |
| UC-F04-05 四种无推荐状态 | P0 | **部分验证** | F04-E04 的 no match 详情给出原因及搜岗位、补资料、重试；F04-E07 当前数据未覆盖 no open jobs、insufficient data、failed 的可控 seed。定时复查是否仍需独立存在待产品确认，不能据此认定缺陷。 |
| UC-F04-06 设置复查并到期重新匹配 | P1 | **未验证 / known gap** | F04-E04 无复查入口；也无可控时钟、DB 和到期运行记录。不能实测“到期重新匹配”。 |
| UC-F04-07 修改标签与负责人 | P2 | **失败（UI 入口）** | F04-E01 列表的标签和负责人为静态展示，操作列只有 Match again / Delete；F04-E04 详情也没有标签或负责人的编辑入口。修改记录未验证。 |
| UC-F04-08 删除后不再匹配 | P1 | **未验证** | F04-E06 仅检查确认文案。线上弹窗明确不可恢复，未执行永久删除；删除审计与后续新岗位推荐均未验证。 |
| UC-F04-09 无权限候选人不返回 | P0 | **未验证 / known gap** | 没有 `recruiter_other_scope` 会话；未检查受限身份下的 API 响应。 |
| UC-F04-10 Hiring Manager 范围与只读 | P1 | **未验证 / known gap** | 未取得 HM 服务端身份和对应岗位 seed；没有 API 403 证据。 |
| UC-F04-11 HR Approver 只读与删除审计 | P2 | **未验证 / known gap** | 无 approver 会话，也无删除审计记录；UC-F04-08 未执行最终删除。 |
| UC-F04-12 Viewer 只读与受限字段 | P0 | **未验证 / known gap** | 无 viewer 会话；未读取该角色 Network 响应或修改接口 403。 |
| UC-F04-13 刷新后数据保持 | P1 | **部分验证** | F04-E05：刷新后已有记录仍在；筛选词丢失，且未核对 API / DB 或新建、修改后的数据。 |

**整条用例统计：通过 0 / 失败 3 / 部分验证 3 / 未验证 7 = 13。** 失败是 UC-02、03、07；未验证项不能计入通过率。

## 4. User Journey 与验收标准覆盖

| Journey 步骤 | 预期关键结果 | 结果 | 证据 |
|---|---|---|---|
| 1 空库 | 空状态 + 上传 | 未验证；现有库非空 | F04-E01 |
| 2 列表 | 说明、完整列、计数 | 列不完整；计数可见 | F04-E01、E02 |
| 3 搜索筛选与返回 | 多维正确筛选，保留条件与位置 | 标签搜索错误、筛选控件缺失、返回丢条件；位置未验证 | F04-E02～E04 |
| 4 已关联 | 关联后仍在库，数值为 1 | UI 可见同类合成记录；指定 Nina seed/API 未核 | F04-E02 |
| 5 四种无推荐 | 状态与原因分开，下一步齐全 | no match 有原因和人工处理入口；其余三态未覆盖；定时复查需求待定 | F04-E04、E07 |
| 6 设置复查 | 时间保存，到期再匹配 | 无入口，运行未验证；是否需要独立定时复查待产品确认 | F04-E04 |
| 7 改标签/负责人 | 可编辑并留记录 | UI 无入口，记录未验证 | F04-E01、E04 |
| 8 删除 | 列表消失、留审计、不再匹配 | 只查看不可恢复确认框 | F04-E06 |
| 9–12 权限角色 | 列表范围、只读、字段与 API 403 | 无相应角色/API 证据 | 环境限制 |
| 13 刷新 | 数据仍在 | UI 记录仍在；过滤条件丢失 | F04-E05 |

| PRD AC | 判定 | 依据与缺口 |
|---|---|---|
| AC-1 无岗位上传仍入库 | **未验证** | 缺无岗位隔离 seed；当前已有开放岗位，不能用现有记录替代。 |
| AC-2 四种状态分开 | **未验证** | 当前列表未提供四种可控状态；no match 单态有详情原因。 |
| AC-3 已关联仍在库 | **部分验证** | UI 有 `1 linked role` 记录，未核 API / 关系数据。 |
| AC-4 可人工搜岗位或设置复查 | **部分验证 / 产品规则待确认** | 有 Search roles，未验证人工关联完成；“设置复查”是否仍为独立要求待确认。 |
| AC-5 只显示有权限的候选人 | **未验证，验收阻断** | 缺多角色账号及各角色 API 响应，不可从当前单一会话推断安全性。 |
| AC-6 刷新后持久化 | **部分验证** | 页面刷新后记录仍在，未核 DB 和新写入数据；筛选词丢失属于 FR-3/非功能要求。 |

### PRD 功能要求与业务规则追溯

| 需求 | 结果 | 依据 / 尚缺证据 |
|---|---|---|
| FR-1 页面说明 | UI 可见 | F04-E01 |
| FR-2 列表字段与计数 | 部分，字段缺失 | F04-E01、E02；无独立关联岗位数列 |
| FR-3 姓名、标签、来源、负责人、状态、入库时间搜索筛选 | 失败 | F04-E02～E04；姓名可搜，标签错误，其余筛选无入口 |
| FR-4 标签与负责人编辑 | 失败，UI 无入口 | F04-E01、E04；服务端能力未验证 |
| FR-5 七类匹配状态及原因 | 部分观察 | F04-E04、E07；只核 no match 原因，其他状态缺 seed |
| FR-6 无推荐后的四种处理 | 部分观察 / 产品规则待确认 | F04-E04；可搜岗位、补资料、重试；定时复查需求待确认 |
| FR-7 进入详情与适合岗位 | 部分观察 | F04-E04；详情和 Search roles 可打开，人工关联未完成 |
| FR-8 空库状态与上传入口 | 未验证空态 | F04-E01 有上传入口；无空库 seed |
| BR-1、BR-2 候选人与岗位解耦、不造虚拟岗位 | 部分 / 未验证 | F04-E02 已关联仍在库；无岗位数据及 DB 未核 |
| BR-3 暂无岗位不等于不合格 | UI 部分观察 | F04-E04 使用“No matching roles right now”，详情原因描述阈值；业务后续未核 |
| BR-4 无意义待办不反复生成 | 未验证 | 无任务与调度记录 |
| BR-5 已删/受保留限制资料不参与匹配 | 未验证 | 未执行永久删除；无保留策略 seed |
| BR-6 来源不参与评分 | 未验证 | 未读取评分输入、运行记录或对照结果 |

## 5. 缺陷、影响和最小复测条件

| ID / 严重度 | 角色·步骤 | 线上证据 | 用户影响 | 最小修复方向与验收检查 |
|---|---|---|---|---|
| F04-LIVE-01 / **P1** | Recruiter · 3 | F04-E03：可见 `SQL` 标签，搜索结果却为 0 | 按技能找人会漏掉已有候选人 | 让标签参与搜索并与姓名/邮箱规则一致；用同一合成候选人核对 UI 结果和 API 列表。 |
| F04-LIVE-02 / **P1** | Recruiter · 3 | F04-E01、E04：只有通用文本框；返回详情后条件清空 | 不能按来源、负责人、状态、时间缩小列表，反复重搜 | 提供相应筛选并在详情返回时保留条件和滚动位置；分别验证每个条件及组合、返回路径。 |
| F04-LIVE-04 / **P2** | Recruiter · 2、7 | F04-E01：无关联岗位数列，也无标签/负责人编辑入口 | 难以区分匹配结果与岗位关系，无法维护库数据 | 独立显示关联岗位数；提供有权限角色的标签/负责人编辑与变更记录，核对刷新和审计。 |
| F04-LIVE-05 / **P2** | Recruiter · 2 | F04-E01：来源显示内部值 `manual_upload` | 来源类别不易理解，无法快速判断导入渠道 | 显示面向用户的来源名称，仍保留可核对的原始来源；检查上传与粘贴等不同渠道。 |

原 F04-LIVE-03“缺设置复查”暂从缺陷清单撤出：新岗位开放自动匹配已是 F06 的产品要求，独立定时复查是否仍有其他用途尚未确定。线上“没有该入口”的观察仍保留在 F04-E04，不再单独据此要求修复。

**GitHub 跟踪：**为保持一个问题一个 Issue，F04-LIVE-02 拆为[多维筛选 #172](https://github.com/TelyAgent/HireOSV2/issues/172)和[返回条件丢失 #173](https://github.com/TelyAgent/HireOSV2/issues/173)；F04-LIVE-04 拆为[关联岗位数 #174](https://github.com/TelyAgent/HireOSV2/issues/174)和[标签/负责人编辑 #175](https://github.com/TelyAgent/HireOSV2/issues/175)。其余为[标签搜索 #171](https://github.com/TelyAgent/HireOSV2/issues/171)和[来源文案 #176](https://github.com/TelyAgent/HireOSV2/issues/176)。这些 Issue 目前为 `AI Ready=No`，编号 AC 待确认。

**不作为已证实线上缺陷的风险：**权限越界、删除后继续匹配、四态合并、空库文案、分页性能等缺少相应 seed 或服务端证据。F04 原定“定时复查”与 F06 新岗位触发自动匹配的关系也待产品确认。当前本地代码的 `LibraryService.list` 仅按 `displayName` 处理查询，可能解释 F04-LIVE-01；但没有线上构建号，不能把静态代码直接当作线上根因结论。

## 6. UX/UI 与应用性十项（按审查标准 U1–U10）

| 项 | 判定 | 线上依据及限制 |
|---|---|---|
| U1 容易理解 | **部分** | 标题和“简历先于岗位”说明清楚；`manual_upload` 为技术值，`1 linked role` 混在 Match status。 |
| U2 容易上手 | **部分** | 上传和粘贴入口清楚；真正空库状态未验证。 |
| U3 快速完成任务 | **失败** | 多维筛选缺失、标签搜索错误，61 条全部展开；未做性能测量。 |
| U4 下一步明确 | **部分** | no match 有 Search roles、Update profile、Match again；定时复查是否必要待确认。 |
| U5 提示和按钮清楚 | **部分** | 删除弹窗清楚表达不可恢复；来源显示技术值。 |
| U6 符合真实工作方式 | **失败** | 已关联候选人仍在库是正确方向；但维护标签/负责人无法完成。 |
| U7 信息结构符合角色目标 | **失败** | 负责人、来源、状态可见；关联岗位数没有独立列，不能按工作优先级筛选。 |
| U8 减少重复跳转 | **失败** | 从详情回到库后搜索条件丢失，需重新输入；滚动位置未验证。 |
| U9 可恢复、可预期 | **部分** | 删除二次确认明确；匹配失败/超时、复查到期、删除恢复未验证。 |
| U10 可访问、可读、可操作 | **未验证** | 文本和按钮有可访问名称；未完成键盘全流程、焦点、缩放、对比度与屏幕阅读器测试。 |

**页面级结论：**Recruiter 的目标是保存并重新发现候选人。首屏能够显示已有库与基础信息，但搜索、筛选和无推荐后续处理不足以支持完整旅程。P1 未豁免，且 AC-5 权限证据缺失，依标准 §7 判为 **fail**。

## 7. 审查限制和复测安排

1. **安全与权限：**准备 `recruiter_other_scope`、HM、Approver、Viewer 的服务端真实测试会话及差异化候选人；按用例检查列表、详情、Network 响应和修改 API 的 403。当前“蔡敏”账号的页面名称不证明其服务端角色。
2. **业务状态：**在隔离工作区准备空库、无开放岗位、暂无合适岗位、资料不足、AI 失败、已关联岗位等独立 seed；逐一核对原因、下一步与 API 状态。当前 61 条记录的状态分布不是完整状态机测试。
3. **持久化与审计：**在可清理且可恢复的隔离环境，用合成资料修改标签/负责人和删除；核 DB、审计、刷新、重登录与新岗位匹配排除。线上确认框明确删除不可恢复，本次未执行。
4. **产品待决：**用户在 2026-10-15 说明“新岗位开放会自动匹配”。这与 [F06 PRD](../F06_Job_Discovery/PRD.md) FR-8、AC-3 一致，是**产品要求**，本次 F04 测试没有在线上触发新岗位来验证实现。F04 文档仍要求独立“设置复查”，但尚未说明在自动匹配之外的用途；在决定保留或删除该要求前，不把缺复查入口作为独立缺陷。删除软/硬删除与负责人默认分配也仍待确认。该决定需回写到 GitHub Issue/PR 和产品文档。
5. **技术核对：**取得线上构建号和已登录 API / DB / 日志权限后，复核 F04-LIVE-01 的查询逻辑、`take: 200` 对大量候选人的覆盖及数据范围。当前静态代码不是线上证据。
6. **无障碍与视觉：**补键盘、焦点、缩放、移动端、对比度及屏幕阅读器测试；当前仅做桌面可见页面和 DOM 检查。

本次没有执行部署、服务端操作、提交候选人资料、最终删除或创建 Issue/PR。报告文件只记录观察结果，不包含线上候选人个人数据。

## 8. 结构化 AI Review

```yaml
review:
  product: "Resume Screening / F04"
  surface: "Resume Library 与 no-match 候选人详情"
  role: "Recruiter / TA（线上账号服务端角色未核验）"
  journey_goal: "保留未关联岗位的候选人，搜索并继续跟进"
  evidence:
    source: "线上 UI 可访问树、DOM、可见文案、搜索和刷新；F04-E01～E07"
    steps_checked: [2, 3, 4, 5, 7, 8, 13]
  verdict: "fail"
  findings:
    - id: "F04-LIVE-01"
      severity: "P1"
      category: "efficiency"
      step: 3
      title: "标签搜索漏掉可见候选人"
      evidence: "列表可见 SQL 标签，搜索 SQL 后为 0 of 61"
      user_impact: "按技能查找候选人时漏人"
      recommendation: "让标签参与搜索"
      acceptance_check: "同一合成记录在 UI/API 搜索中返回"
    - id: "F04-LIVE-02"
      severity: "P1"
      category: "efficiency"
      step: 3
      title: "缺多维筛选且返回后条件丢失"
      evidence: "只有通用文本框；打开详情再进入简历库后从 1 of 61 变 61 of 61"
      user_impact: "大量候选人中反复寻找同一集合"
      recommendation: "补筛选并保存列表上下文"
      acceptance_check: "每种条件及组合结果正确，详情返回后条件与位置保留"
    - id: "F04-LIVE-04"
      severity: "P2"
      category: "state"
      step: 2
      title: "关联岗位数缺独立列，标签和负责人不可编辑"
      evidence: "表头只有 6 个具名列，操作只有 Match again / Delete"
      user_impact: "岗位关系不易辨识，库数据无法维护"
      recommendation: "单列岗位数并提供有权限的编辑入口"
      acceptance_check: "UI、刷新结果及修改审计一致"
    - id: "F04-LIVE-05"
      severity: "P2"
      category: "clarity"
      step: 2
      title: "来源显示内部值"
      evidence: "列表显示 manual_upload"
      user_impact: "无法快速理解简历的实际来源"
      recommendation: "显示用户可理解的来源名称"
      acceptance_check: "分别核对上传、粘贴等来源的显示与原始记录"
  usability_check:
    understandable: "fail"
    learnable: "unknown"
    efficient: "fail"
    next_action_clear: "unknown"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "unknown"
    no_unnecessary_hops: "fail"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "缺线上构建号、API、DB、审计和服务端角色证明"
    - "缺空库、四态、不同权限身份和可控时钟 seed"
    - "删除明确不可恢复，因此没有执行最终删除"
```
