# W08 评分与人工复核线上测试报告（2026-10-16）

## 结论

**不通过（fail），线上探索测试。** 评审页能够从 Submission 进入，展示已定稿的人工作分、AI 参考分、四项 criterion 和只读最终结果；但本轮可访问的已定稿提交中，四项 `View evidence` 展开后均只有 `Source: AI evaluation`，没有评分理由、原文片段或页码/单元格定位。Hiring Manager 无法按 W08 的核心目标核对评分依据，**AC-5 失败，按指定 UX/UI 标准定为 P0**。这不证明该候选人的 0 分错误：Submission 中的答案主要重复任务要求，分数正确性需独立评估。

线上队列显示 `Pending result review (0)`，没有 W08 文档规定的 Alex/Taylor/Casey 测试 seed，也没有独立测试身份、认证业务 API/数据库只读权限或故障注入。12 条用例：**0 完整通过、1 失败、2 部分验证、9 阻塞**；7 项 AC：**AC-5 失败、AC-6 部分验证、其余 5 项未验证**。阻塞项不计为产品缺陷，也不计为通过。本报告不是绑定 PR head 或合并 SHA 的正式 Codex QA。

## 范围、环境与方法

| 项 | 本轮实际情况 |
|---|---|
| 依据 | 同目录 [PRD](PRD.md)、[Loop_IO](Loop_IO.md)、[User_Journey](User_Journey.md)、[User_Cases](User_Cases.md)、[Written Test 公共约定](../README.md)；[UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) |
| 时间 | 2026-10-16 约 11:58–12:04，Asia/Shanghai |
| 线上入口 | [My Tasks](https://hireos.aipollo.me/hireos/written/tasks) → 一条 Pending release 的 Case → Submission / Comprehensive evaluation / Evaluation result |
| 浏览器与身份 | 已登录 Chrome，桌面约 1167×713；页面顶部账号显示中文姓名，而任务页另显示 `Signed in as John · HR Head · Aurora Studio`。本轮无法核实两处身份映射，不能据此认证 `hm_daniel` 权限 |
| 样本 | 队列共 4 项：Pending test 2、Pending release 1、Testing closed 1、Pending result review 0。只读查看 1 份已定稿提交；报告正文匿名化，原始截图含候选人个人信息，仅限内部受权查看 |
| 线上健康 | [健康响应](evidence/2026-10-16/06-health.txt)：`GET /hireos/written/api/health` HTTP 200、`phase-0`；仅证明健康端点可达 |
| 版本 | 本地参考 HEAD `c4b610500d33a279c03251091c5f0af13b831318`，**不是线上构建 SHA** |
| GitHub | 未提供 W08 主 Issue/PR；`gh issue list --state all --limit 500` 未发现标题命中 W08 / Written 评分复核的专属 Issue。无法读取不存在的关联 Issue 评论，也不虚构 QA 身份 |
| 操作边界 | 线上仅做只读导航、展开和健康请求。未改真实候选人分数、未 Finalize/Publish、未发送消息、未模拟故障。没有运行本地 build/lint/type/unit/integration，不能将其记为通过 |

标准原适用 JD Management。本轮复用其旅程、U1–U10、证据及 P0–P3 判级；JD 专属的职位字段、审批、激活、发布渠道不套用到 W08。截图可证明当前可见 UI，不能单独证明后端权限、持久化、并发、幂等或数据版本。

## 可复核证据

| ID | 证据 | 可确认内容 |
|---|---|---|
| E01 | [任务队列截图](evidence/2026-10-16/00-task-list.png) · [DOM](evidence/2026-10-16/00-task-list-dom.txt) | 4 项任务，Pending result review 为 0；没有指定演示 seed |
| E02 | 评估页截图（本地证据，含个人信息，未入库） · [DOM](evidence/2026-10-16/04-evaluation-dom.txt) | 当前样本 Final；human / AI 均为 0/100，四项 criterion 满分合计 100；人工输入只读；AI 卡片有 `Draft only, not a hiring probability` |
| E03 | 单项证据展开截图（本地证据，含个人信息，未入库） | 第一项展开后只出现 `Source: AI evaluation` |
| E04 | [四项证据展开截图](evidence/2026-10-16/05-four-evidence-expanded.png) · [DOM](evidence/2026-10-16/05-four-evidence-expanded-dom.txt) | 四项均只有来源标签，没有理由、引文或文件位置；截图仅展示可视区域，DOM 记录覆盖四项 |
| E05 | 结果页截图（本地证据，含个人信息，未入库） | Internal reference 显示最终 human 0/100、`Finalized by John` 与时间；Candidate preview 与发布勾选项存在。未点击发布 |
| E06 | Submission 页可访问树（本轮线上观察） | 提交状态为 Submitted，显示题目与答案；答案主要重复 7 条任务要求，页面有 `Go to evaluation`，点击可到评审页。未保存含完整答案的文件，以减少个人资料副本 |
| E07 | [前端评审实现](../../../../hireos-written/hireos-written-front/src/pages/EvaluationReviewPage.tsx) 120–179、335–353 行 | 本地代码的 Re-run 使用随机扰动；真实 Case 的 Finalize 请求未等待成功便本地标为 final；证据区显示 `c.evidence`。这是源码风险，**未经线上未定稿样本复现** |
| E08 | [后端 Finalize](../../../../hireos-written/hireos-written-backend/src/invitations/invitations.service.ts) 132–145 行 · [DTO](../../../../hireos-written/hireos-written-backend/src/invitations/case-result.dto.ts) | 本地代码检查 `finalizedAt` 和分数范围/总分；DTO 的 `overrideReason` 可选，服务端未在此处显式检查 override 理由、缺件、AI 与人工版本。仍需线上认证 API/DB 验证 |

E01–E06 属于线上页面或只读请求；E07–E08 是本地参考源码，不能推定已经部署。截图中有招聘个人信息，勿外发。

## 用例执行结果

| 用例 / 优先级 | 结果 | 实际观察、证据与未完成部分 |
|---|---|---|
| UC-W08-01 AI 初评草稿 / P0 | **阻塞** | 无 Jordan 提交 seed 和新提交操作；E02 只能证明已定稿样本保留 AI 参考分，不能证明提交触发 AI、criterion 理由/证据/运行 ID 或 AI draft 不进入待发布 |
| UC-W08-02 AI 失败转人工 / P0 | **阻塞** | 无 `llm_fail` 注入或可评分测试提交；未验证不写 0、失败原因、人工 Finalize |
| UC-W08-03 三层评审页 / P1 | **部分验证** | E02 可见首层 human / AI / Coverage、criterion 满分、AI/人工分与 Confidence/Coverage；四项均缺可见评分理由，Coverage 总卡只有 `Full`，无定义或具体覆盖口径；Evidence 层见 UC-04 |
| UC-W08-04 分数下钻到证据 / P0 | **失败** | E03–E04：四项 `View evidence` 展开后仅显示来源标签，没有理由、原文或位置，也没有打开原文件的入口。该样本是文字答案，至少应有对应片段或缺证原因；Excel 单元格路径仍需专用 seed 验证 |
| UC-W08-05 Override 理由与历史 / P0 | **阻塞** | 已定稿样本只读，无法安全改真实分数；未执行 UI 无理由、保存、历史与 API 4xx。E08 提示服务端缺少显式理由检查，列为待验证风险 |
| UC-W08-06 必评 Unknown / P0 | **阻塞** | 无可编辑必评 criterion，也无 `required_unknown` seed；未验证 Overall=null、非 0 与不重归一化 |
| UC-W08-07 Alex=70 / P0 | **阻塞** | 无 Accounting/Analysis/Communication 的 Alex 样本；现有四项总分 100 且锁定，不能代替多题权重算法验证 |
| UC-W08-08 Accept all AI / P1 | **阻塞** | 无未定稿可编辑评估；E07 仅见本地逻辑，不能证明线上人工确认、持久化或 finalizedBy |
| UC-W08-09 Re-run AI / P1 | **阻塞** | Final 状态无 Re-run 操作；E07 本地实现是随机修改分数，缺版本留存证据；待隔离数据实测 |
| UC-W08-10 缺件禁 Finalize / P0 | **阻塞** | 无 Casey 缺件 seed、认证 finalize API；线上未直接调用写接口；不能从当前已提交样本推断 4xx 门禁 |
| UC-W08-11 唯一 Finalize / P0 | **部分验证** | E02/E05 当前样本已有一个可见 final、评分输入只读且处于 Pending release；未执行双击、并发、DB 计数和任务变化，不能断言幂等或冲突提示 |
| UC-W08-12 大分差复核 / P2 | **阻塞** | 无可编辑 AI=80/human=40 样本，产品阈值未确认；未实测提示 |

**统计口径**：整条用例所有断言都得到线上证据才算“通过”；“部分验证”只表示部分 UI 断言成立；“阻塞”表示缺少必要 seed、身份或注入。既有文档标记的 ✅/🟡/❌ 是执行前实现判断，不作为本轮结果。

## Acceptance Criteria 对照

| AC | 结论 | 证据 / 解除条件 |
|---|---|---|
| AC-1 Alex 70 | **未验证** | 缺 `alex_scores`、已提交独立样本和后端结果读取；需按 30/40、20/40、20/20 输入并核 UI/API/DB |
| AC-2 必评 Unknown → null | **未验证** | 缺必评 Unknown 操作及结果读取；需核 UI 不显 0、API/DB `overall=null`、无重归一化 |
| AC-3 AI 超时转人工 | **未验证** | 缺 `llm_fail` 控制与专用提交；需核提交成功、失败原因、人工可 Finalize、AI 未写 0 |
| AC-4 Override 无理由禁存与旧值历史 | **未验证** | 缺可编辑评估和认证 API；需 UI/服务端 4xx、原值/新值/理由/人/时间/版本核验 |
| AC-5 每个分数可定位证据 | **失败** | 当前已定稿样本四项展开无理由、引文和位置（E03–E04）。需修复后在文本页码和 Excel 单元格两个样本复测 |
| AC-6 Taylor AI draft 80 不进待发布 | **部分验证** | 已定稿样本确在 Pending release、Final 输入只读（E01–E05）；没有 Taylor draft=80，不能验证 draft 隔离 |
| AC-7 缺件不能 Finalize | **未验证** | 缺 Casey incomplete seed 与 API 4xx；需要隔离 Case 逐项验证 UI 与服务端 |

## 旅程与应用性审查

**角色与目标**：Hiring Manager / Reviewer 从复核任务进入，核对 AI 分数依据，必要时修改并留痕，再交给 W09 发布。线上登录身份显示有歧义，未能确认为该角色。本轮只读路线是 `My Tasks → Pending release Case → Submission → Go to evaluation → View evidence → Evaluation result`；这是已定稿状态的回看路线，无法走完整评分主流程。

| Step | 用户操作 | 预期 | 实际 / 证据 | 结论 |
|---|---|---|---|---|
| 入口 | 在 My Tasks 找待复核 | 有待处理评分任务并可进入 | `Pending result review (0)`，无 Taylor seed（E01） | 主路径环境阻塞 |
| 1–2 | 查看总结和 criterion | 分数、覆盖、信心、理由分层 | 分数、满分、Coverage/Confidence 可见；理由未显示（E02） | 部分 |
| 3 | View evidence | 理由→原文→页码/单元格 | 四项仅来源标签（E03–E04） | **失败 / P0** |
| 4–8 | 改分、Unknown、Accept all、Re-run、AI 失败 | 可操作且留痕、恢复 | Final 样本锁定；无注入或 draft（E02） | 未验证 |
| 9–10 | 缺件门禁、Finalize | 不完整禁定稿；完整二次确认且唯一 | 当前样本只读并可见 final；没有重做写操作（E02/E05） | 部分 / 未验证 |
| 11 / 交接 | Profile 更新、待发布 | 显示 profile 版本和待复核；仅 final 进入发布 | 当前可见 Pending release 与结果预览；没有 profile 版本和更新样本（E01/E05） | 部分 / 未验证 |

### U1–U10 检查

| 项 | 结果 | 依据和限制 |
|---|---|---|
| U1 容易理解 | **部分** | Case 状态、Final、人/AI 分分开；顶部中文账号与任务页 `Signed in as John` 不一致，无法确认操作者；当前页未显示 profile 版本（E01/E02） |
| U2 容易上手 | **部分** | Submission 有 `Go to evaluation`；无待复核任务可验证首次评分引导（E01/E06） |
| U3 快速完成 | **未验证** | 只读样本不能测评分、保存和等待反馈；页面间跳转可达 |
| U4 下一步明确 | **部分** | Final 可到 Evaluation result，状态 Pending release；缺 profile 待复核与负责人/截止信息（E02/E05） |
| U5 提示和按钮清楚 | **部分** | `View final result`、AI Draft 文案清楚；`View evidence` 展开无有用内容（E02–E04） |
| U6 符合真实工作 | **失败** | 无证据时无法完成“判断 AI 评分是否有依据”的关键工作（E04） |
| U7 角色信息结构 | **未验证** | 仅一个已登录身份，不能比较 HR/HM/受限范围；顶部身份与任务身份不一致需核映射 |
| U8 减少跳转重复 | **部分** | Submission → evaluation → result 在同一 Case tab 内；未测返回位置/输入保留（E06） |
| U9 可恢复和可预期 | **未验证** | 未注入超时、500、并发、权限撤销；E07 仅提出源码风险 |
| U10 可访问可操作 | **未验证** | 浏览器 DOM 有按钮、标签和文本状态；未完成键盘、焦点、200% 缩放及错误关联测试，不能声称无障碍合规 |

权限、评分持久化、AI/人工/规则评价分离、Profile 版本、严重问题、Excel 公式提示、并发和下游统计均缺线上证据。JD 标准的审批/激活/发布渠道清单对 W08 不适用；W09 发布也未执行。

## 发现与优先级

| ID / 级别 | 角色·步骤·证据 | 用户影响 | 最小修复与验收方式 |
|---|---|---|---|
| W08-LIVE-01 / **P0，线上复现** | Reviewer，步骤 3；四项 `View evidence` 只有来源（E03–E04） | 无法核对分数依据，AC-5 失败；已定稿结果也不可复核 | 保存并展示 criterion 理由与受控证据引用；无证据时显式标 Unknown/缺证原因。用文本页码、Excel 单元格样本逐项点击定位，核 API 引用与 UI 一致 |
| W08-LIVE-02 / **P1，线上观察** | Reviewer，步骤 1–2；总卡 `Coverage: Full`，四项均 `Coverage: Full`，但展开无证据或解释（E02–E04） | 用户可能将 Full 误读为证据充分；本轮不能断定 Coverage 计算错误 | 定义 Coverage 分母和覆盖判定，展示未覆盖项与证据处理状态；用缺证/部分/完整三类 seed 验证 |
| W08-RISK-03 / **P1，源码待线上复现** | Reviewer，步骤 10；前端 Finalize Promise 未等待成功即本地显示 final（E07），后端随后可能拒绝（E08） | 失败时页面可能短暂显示成功/只读，造成结果状态误判 | 等服务端成功后再更新 UI/跳转；在隔离 Case 注入 500/409，确认不显示成功、不创建本地 final 且可恢复 |
| W08-RISK-04 / **P1，源码待线上复现** | Reviewer，步骤 4、9；后端 DTO 理由可选且 Finalize 只检分数，未见缺件门禁（E08） | 可能绕过前端提交无理由覆盖或不完整提交；尚非线上实证 | 在服务端校验原 AI 值、差异理由、证据/提交完整性及授权；隔离 seed 直接 POST，核 4xx 和无状态变更 |
| W08-RISK-05 / **P2，源码待线上复现** | Reviewer，步骤 7；本地 Re-run 只随机改 AI 数值（E07） | 无真实 AI 版本和可解释运行记录 | 接真实重评服务并保留版本/运行 ID；同输入跑两次，核旧版与人工分不变 |

W08-LIVE-01/02 是本轮可见线上行为。W08-RISK-03–05 不能当作线上已复现缺陷。候选人 0 分本身未列缺陷；其提交内容和评分正确性尚需独立质量评审。

## 结构化 UX Review

```yaml
review:
  product: "Written Test"
  surface: "W08 Comprehensive evaluation / Evaluation result"
  role: "Hiring Manager / Reviewer（线上身份映射未核实）"
  journey_goal: "核对 AI 评分依据，必要时人工修正并定稿交给发布"
  evidence:
    source: "线上 Chrome 页面与 DOM E01–E06；本地源码风险 E07–E08"
    steps_checked: [1, 2, 3, 10, 11]
  verdict: "fail"
  findings:
    - id: "W08-LIVE-01"
      severity: "P0"
      category: "clarity"
      step: 3
      title: "四项评分无法下钻到证据"
      evidence: "E03–E04：展开后仅 Source: AI evaluation"
      user_impact: "评审人无法核对 AI 分数依据"
      recommendation: "展示理由、受控原文引用和位置；无证据时说明原因"
      acceptance_check: "逐项打开文字页码和 Excel 单元格证据，与 API 引用核对"
    - id: "W08-LIVE-02"
      severity: "P1"
      category: "state"
      step: 2
      title: "Full 覆盖率缺少可解释依据"
      evidence: "E02–E04：Full 与空证据展开同时出现"
      user_impact: "可能误判评分证据充分性"
      recommendation: "显示 Coverage 口径及未覆盖项"
      acceptance_check: "缺证、部分、完整 seed 各核一次 UI/API 状态"
  usability_check:
    understandable: "unknown"
    learnable: "unknown"
    efficient: "unknown"
    next_action_clear: "unknown"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "无待复核 draft、Alex/Taylor/Casey seed 和独立角色"
    - "无认证业务 API、数据库、服务端日志、故障注入或线上构建 SHA"
    - "截图不能证明权限、持久化、幂等或真实发布"
```

## 后续复测条件

1. 提供隔离的线上测试 Workspace、`hm_daniel` / `hr_emma` / 受限身份、`S_attempt_submitted_ai_draft`、`S_inv_started_missing`、Alex/Taylor/Casey 样本及清理方式；候选人使用 `[UJ-TEST]`、example.com，通知走 simulation adapter。
2. 提供线上构建 SHA、W08 主 Issue/PR、认证只读业务 API/DB 和可控 `llm_fail`、500、双击、并发注入。先修 W08-LIVE-01，再按 UC-W08-01–12 及 AC-1–7 全量复测；AI 同输入至少执行两次并记录运行 ID/版本。
3. 产品确认 Finalize 授权或双人要求、评价版本存储、AI 与人工分差阈值，并回写关联 Issue/PR。复测中核 Score/Coverage/Confidence 分离、Override 历史、Unknown=null、缺件 4xx、幂等与 W09/W13 状态交接。

本轮仅保存本地报告与证据，未创建 Issue/PR、发布 GitHub 评论或更改线上招聘数据。
