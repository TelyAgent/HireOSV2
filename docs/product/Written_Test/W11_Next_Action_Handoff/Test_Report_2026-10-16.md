# W11 下一步决定与交接：线上测试报告（2026-10-16）

## 结论

**线上验收结论：未验证，不能判定通过。** 本轮实际访问了线上 Written Test 任务队列、1 条待发布 Case 的结果页和 1 条已关闭 Case 的结果页，并请求健康端点。队列没有 `S_result_released`（已发布且待决定下一步）的隔离测试 Case：`Awaiting next step (0)`、`On hold (0)`、`Handed off to interview (0)`。因此 11 条用例为 **0 完整通过、1 部分观察、10 阻塞**；AC-1～AC-6 均未得到完整线上验证。没有对真实候选人执行发布、暂缓、关闭或交接，也没有故障注入、认证业务 API、DB、Outbox 和 Interview 接收方的读写证据。

已关闭样本有一项**线上可见的 P1 状态解释冲突**：人工总分 `5/100`，候选人结果为 `This assessment did not meet the bar for this role`，但 Next action 显示 `Testing closed · Reason: Passed`。本报告仅确认页面信息冲突，不能由此推断关闭决定本身错误；需要决策记录说明 `Passed` 的业务含义和人工覆核依据。

本地参考源码可确认 W11 所需的交付包、Outbox/回执时间线和 report-only 导出尚无对应前后端实现，现有交接为同步 HTTP。**源码证据不是线上构建证明**，故单列为已知实现差距，不计作线上复现。当前报告是探索性线上测试及 UX/UI 评审，不是绑定 PR head 或合并 SHA 的正式 Codex QA。

## 依据、环境和方法

| 项 | 本轮情况 |
|---|---|
| 需求基线 | [PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop IO](Loop_IO.md)、[公共测试约定](../README.md) |
| UX/UI 规则 | [HireOS Command UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)：借用旅程逐步审查、U1～U10、P0～P3 与证据门槛；JD 专用的职位字段和发布渠道不套用 W11 |
| 线上入口 | [My Tasks](https://hireos.aipollo.me/hireos/written/tasks)，已登录 Chrome，桌面约 1167×713；界面为英文。线上构建号未知 |
| 身份 | 顶栏显示“蔡敏”，任务页显示 `Signed in as John · HR Head · Aurora Studio`；未能核实身份映射，不能声称已用 `hr_emma` 或受限角色测试 |
| 样本 | 队列 4 条：Pending test 2、Pending release 1、Testing closed 1；只读查看后两条的结果页。页面截图含真实候选人姓名和联系方式，仅供有权限的内部人员查看 |
| 健康检查 | `GET /hireos/written/api/health`：curl 退出码 0、HTTP 200、`phase-0`；只证明健康端点可达 |
| GitHub | 未提供 W11 主 Issue/PR；以 `gh issue list --state all --limit 500` 搜索标题未发现 W11 专属 Issue，不能引用不存在的 AC 评论或标记正式 QA |
| 源码参照 | 本地 HEAD `c4b610500d33a279c03251091c5f0af13b831318`；未确认与线上一致 |
| 测试边界 | 线上只读 UI 导航、截图与公开健康请求。没有运行本地 build/lint/type/unit/integration；这些检查均**未执行** |

测试日期为 2026-10-16（Asia/Shanghai）。文档中“✅ 可测 / 🟡 部分可测 / ❌ 未实现”是执行前预判，以下结果只按本轮证据记录。

## 证据索引

| ID | 证据 | 能证明什么 |
|---|---|---|
| E01 | [任务列表截图](evidence/2026-10-16/task-list.png)、[可访问树](evidence/2026-10-16/task-list-dom.txt) | 4 条任务、各状态数量、顶栏与任务页身份文字不一致；没有已发布待下一步 seed |
| E02 | 待发布结果截图（本地证据，含个人信息，未入库）、[可访问树](evidence/2026-10-16/pending-release-dom.txt) | Final 0/100，尚有 Approve & publish；Next action 区未出现，不能用此样本测 W11 动作 |
| E03 | 已关闭结果全页截图（本地证据，含个人信息，未入库）、[可访问树](evidence/2026-10-16/closed-result-dom.txt) | 已发布、Testing closed、关闭时间与 `Reason: Passed`；同页人工 5/100 和候选人预览的未达标文案 |
| E04 | [健康响应头](evidence/2026-10-16/health-headers.txt)、[响应体](evidence/2026-10-16/health-body.json) | HTTP 200、`phase-0`，不证明 W11 链路可用 |
| E05 | [前端 ReleasePage.tsx](../../../../hireos-written/hireos-written-front/src/pages/ReleasePage.tsx) 第 1～27、239～313 行；[路由](../../../../hireos-written/hireos-written-front/src/App.tsx) 第 91 行 | 本地源码仅有 Move to interview、补测、Not passed、Candidate withdrew、Hold；交接确认弹窗只说创建 Interview task；未见交付包预览、交付页和导出入口 |
| E06 | [后端 case-lifecycle.service.ts](../../../../hireos-written/hireos-written-backend/src/cases/case-lifecycle.service.ts) 第 109～190 行；[控制器](../../../../hireos-written/hireos-written-backend/src/cases/cases.controller.ts) 第 29～50 行 | 本地实现的 Hold/Resume/Close/同步 Interview handoff；这不是线上 API 执行证据 |

E01～E03 的原始文件含个人信息，不应向外部公开或贴入 GitHub 公共 Issue。报告正文使用角色和状态描述，避免重复个人标识。

## 用例执行明细

| 用例 | 结果 | 本轮线上观察与缺口 |
|---|---|---|
| UC-W11-01 Next action 选项与说明 / P1 | **阻塞** | E02 为待发布，尚无 Next action；E03 为终态，只显示关闭原因。没有已发布且未决定的样本，不能验证五种选项、提案说明或交接确认。E05 显示本地选项与 PRD 不同，待隔离 seed 在线核对 |
| UC-W11-02 Hold→Resume / P0 | **阻塞** | 队列 `On hold (0)`，无隔离已发布 Case；未操作真实候选人，未核 `statusBeforeHold` 和恢复状态 |
| UC-W11-03 暂缓期间进度事件 / P1 | **阻塞** | 无已 Hold 且待提交的测试 Case，也无受控候选人提交；未核进度事件和恢复目标 |
| UC-W11-04 Close testing 终态 / P0 | **部分观察** | E03 可见一个既有 `Testing closed`、关闭时间和原因；没有执行三种合法原因、非法原因 4xx、任务完成或终态后事件忽略。可见状态解释冲突见 F01 |
| UC-W11-05 交付包预览 / P1 | **阻塞** | 无可执行交接的已发布 seed；本地前端只有“创建面试任务”确认文字（E05），不能在线核预览内容和预览阶段副作用 |
| UC-W11-06 正常交接与时间线 / P0 | **阻塞** | 队列 `Handed off to interview (0)`；未创建 Interview task。无交付页、事件、包 ref、Interview 接收方证据；E06 显示本地同步 HTTP 实现 |
| UC-W11-07 文件未 ready / P0 | **阻塞** | 无 Core File 状态/故障注入、Outbox 查询；不能验证 Uploading/Failed 时不发事件 |
| UC-W11-08 总线宕机与无 ACK / P0 | **阻塞** | 无总线故障注入、Outbox/Inbox/回执读取；不能验证 pending、恢复、Awaiting confirmation |
| UC-W11-09 双击与重投幂等 / P0 | **阻塞** | 无隔离已发布 Case 和 Interview intake 计数；未双击或重投，不能由 E06 的终态检查推断并发幂等 |
| UC-W11-10 Interview 未启用导出 / P1 | **阻塞** | 无受控 Interview disabled 环境或可用交付页；未生成报告包。E05 未见导出入口，仅是本地源码证据 |
| UC-W11-11 Fail/证据不足独立报告 / P2 | **阻塞** | E02 有 0 分待发布样本，但未发布、未导出；没有 report-only 功能或文件证据，不能宣称 AC-6 失败已在线复现 |

**统计口径**：用例的全部预期都有线上证据才算通过；既有终态显示只能算“部分观察”。阻塞不等于通过，也不自动等于产品缺陷。

## Acceptance Criteria 对照

| AC | 线上结论 | 解除条件 |
|---|---|---|
| AC-1 Uploading 禁发，Ready→Queued→Published→Imported | **未验证** | 创建隔离已发布 Case、受控 Core File 上传状态、交付页及 Outbox/Inbox 只读证据，按时间核对 |
| AC-2 总线宕机、重投、乱序及幂等 | **未验证** | 隔离测试总线、Outbox/Inbox、Interview intake 计数和重放权限；核结果不变、仅一条 intake |
| AC-3 Interview 未启用仍可导出 | **未验证** | 可切换 entitlement 的测试 workspace；核 JSON/PDF 或最终确认的格式、无内部事件 |
| AC-4 无回执显示 Awaiting confirmation | **未验证** | 可控制下游 ACK 的隔离环境、交付页与回执记录 |
| AC-5 Hold/Resume 原状态；Close 终态/Task 完成 | **部分观察，未验收** | E03 仅证明既有 Case 页面为 closed；需 `[UJ-TEST]` seed 执行 Hold/Resume、三种 Close、非法原因、DB Task 与终态事件 |
| AC-6 Fail/证据不足仍能出独立报告 | **未验证** | Fail 与 Unknown/证据不足各一条隔离 seed，下载并核内容、引用和文件状态 |

## 旅程和 UX/UI 审查

**角色与目标**：HR / Recruiter 在结果发布后决定下一步；若交接面试，面试官应拿到完整、一致的资料。线上任务页显示 HR Head，但顶栏身份文字不同（E01），角色归属仍需核实。已观察路径是 `My Tasks → 已关闭 Case → Evaluation result → Next action 终态说明`；核心的“已发布→选择动作→确认→交付”路径因 seed 缺失未走通。

| Step | 用户动作 | 预期 | 实际与证据 | 结论 |
|---|---|---|---|---|
| 入口 | 找已发布、待下一步的 Case | 能进入 Next action | Awaiting next step 为 0（E01） | 环境阻塞 |
| 1 | 查看可选下一步 | 修订、补测、准备交接、Hold、Close，有人确认说明 | 待发布页未显示；已关闭页只显示终态（E02/E03） | 未验证 |
| 2～4 | Hold、Resume、Close | 状态与任务一致，可恢复或明确终态 | 仅看到既有关闭状态；分数/结果与 `Passed` 原因冲突（E03） | 部分观察；F01 |
| 5～6 | 预览并确认交接 | 展示包内容、文件和时间线 | 未触发；本地源码确认弹窗仅说明创建 task（E05） | 线上未验证；实现差距 |
| 7～9 | 文件失败、总线失败、无 ACK | 准确显示待处理/失败，可重试 | 无受控故障注入（E01/E06） | 未验证 |
| 10～11 | Interview 未启用或 Fail 时导出 | 独立报告可下载 | 未见可执行样本或入口（E02/E05） | 未验证；实现差距 |

### 应用性 U1～U10

| 项 | 结果 | 依据与限制 |
|---|---|---|
| U1 容易理解 | **失败（已关闭页）** | `5/100`、未达标结果、`Reason: Passed` 并列，缺解释；身份文字也不一致（E01/E03） |
| U2 容易上手 | **未验证** | 无可操作的已发布待决定样本；既有关闭页无法说明首次选择流程 |
| U3 快速完成任务 | **未验证** | 未执行写动作，无法测步骤、等待反馈或耗时 |
| U4 下一步明确 | **部分** | 已关闭页明确终态和时间；`Passed` 与结果冲突影响下一步判断；无交接目标或负责人（E03） |
| U5 提示和按钮清楚 | **未验证** | 已关闭页无决策按钮；本地弹窗仅有“Create interview task”不能代表线上状态（E05） |
| U6 符合真实工作方式 | **未验证** | 无已发布待决定、可交接样本；无法判断面试官是否收到资料 |
| U7 角色信息结构 | **未验证** | 只有一个未核实身份，不能比较 HR、Manager、受限角色 |
| U8 减少跳转重复 | **部分** | 已关闭页在同一 Case 的 Evaluation result 可见终态；交接工作流未运行 |
| U9 可恢复和可预期 | **未验证** | 未做失败、并发、重试、权限变化；E06 只是源码风险 |
| U10 可访问可操作 | **未验证** | 有可读状态文字（E03），但未测键盘焦点、200% 缩放、弹窗和错误关联；不宣称无障碍合规 |

**design-review 评分：2/4（仅已关闭结果页，Needs work）。** 页面把评分、候选人预览和终态放在一屏，结构可读；但核心业务状态的自相矛盾破坏结果可信度。依据 *Nielsen heuristic #1 — Visibility of system status* 和 *#4 — Consistency and standards* 作启发式判断，不代表用户研究或完整无障碍结论。交接主流程证据不足，不评分。

## 发现和修复验收

| ID / 级别 | 角色、步骤与可观察证据 | 用户影响 | 最小修复与复测 |
|---|---|---|---|
| F01 / **P1，线上复现** | HR，步骤 4；E03 同页显示人工 `5/100`、`did not meet the bar` 和 `Testing closed · Reason: Passed`，没有原因解释 | 负责人或后来接手者无法判断 Passed 是测评通过、仅结束流程，还是人工覆盖结论；交接判断容易被误导 | 澄清 `passed` 语义，显示明确的关闭理由及决策人/时间/覆盖依据；如只是流程结束，改用不暗示能力达标的文案。用低分、正常通过、人工覆盖三种 seed 核结果与关闭文案一致 |
| F02 / **P1，线上观察的身份歧义** | HR，入口；E01 顶栏“蔡敏”与 `Signed in as John · HR Head · Aurora Studio` 同屏 | 操作者难确认当前授权身份，进而难确认谁能批准下一步 | 核对会话身份与演示用户映射，顶部、任务区和审计操作者一致；以两个授权账号分别复测。未证明后端权限错配 |
| G01 / **P0 规格差距，非线上复现** | HR/Interview，步骤 5～9；E05/E06 本地仅有同步交接，无包 ready→Outbox→回执时间线 | 不能满足 AC-1、AC-2、AC-4 的可靠交付与可追踪要求；当前线上部署状态未知 | 先确定 PRD 待确认的过渡策略；实现后用隔离 Core/总线/Interview 环境核完整状态链、ACK、重投和唯一 intake |
| G02 / **P1 规格差距，非线上复现** | HR，步骤 10～11；E05 本地无 report-only 导出入口 | Interview 未启用或结果 Fail 时缺独立交付路径；线上部署状态未知 | 确定包格式/保留期限后实现；用 disabled entitlement、Fail 与 Unknown seed 下载并核 JSON/PDF、权限与无内部事件 |

F01 的 `Passed` 与低分可能来自真实的人工决定；在缺审计记录前不把“决策错误”作为事实。F02 也只是界面身份文字冲突，不推断越权。

## 审查限制与下次可执行条件

1. 需要隔离线上测试 workspace：至少提供 `S_result_released`、待 Hold 的邀请、Fail/Unknown 结果、Interview enabled/disabled，以及 `[UJ-TEST]` / `example.com` 合成候选人。避免把现有真实候选人作为可写 seed。
2. 需要测试身份、只读 DB/API/Outbox/Inbox/Interview intake 查询及 Core File、总线、ACK 故障注入。没有这些只能评价可见 UI，不能验证持久化、权限、幂等和交付顺序。
3. PRD 的同步 HTTP 过渡策略、Close rejected 的通知规则、导出格式/保留期限仍待产品决定；需记录到主 Issue 后再实现依赖部分。
4. 修复后按 UC-W11-01～11 和 AC-1～6 完整重跑，保存每步截图/请求状态/DB 与下游记录，并记录线上构建 SHA。正式 PR QA 仍须按仓库工作流绑定目标提交。
