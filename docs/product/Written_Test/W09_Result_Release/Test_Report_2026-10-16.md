# W09 结果发布与候选人通知线上测试报告（2026-10-16）

## 结论

**本轮验收不通过。** 在生产域名的已登录页面完成了只读探索测试：10 条 User Case 中 **0 完整通过、2 失败、3 部分验证、5 阻塞**。5 项 PRD AC 中 **AC-3 仅部分验证，其余 4 项未验证**。这不是绑定 PR head 或合并提交的正式 Codex QA。

已在线上复现两个交互问题：发布按钮在零项或仅一项确认时仍可点击，且 Release 页没有披露方式切换控件。已发布的一条记录还出现 `Disclosure policy: Score + summary` 与预览不显示 Score 的矛盾。没有隔离测试 Case、候选人账号、通知适配器或业务 API/DB 读取权限，因而未对真实候选人点击发布、发送通知、改结果、注入退信或并发请求。缺少证据的结果均不计为通过。

## 环境、依据与方法

| 项 | 记录 |
|---|---|
| 时间和入口 | 2026-10-16 约 12:09–12:12，Asia/Shanghai；[线上 My Tasks](https://hireos.aipollo.me/hireos/written/tasks) → Case → Evaluation result |
| 客户端 | 已登录 Chrome 桌面，约 1470×675 可视区域，英文界面 |
| 身份 | 顶栏为中文姓名，My Tasks 同时显示 `Signed in as John · HR Head · Aurora Studio`；未能核实真实权限主体，不能据此声称已测 HR/HM/候选人权限 |
| 线上数据 | All tasks 4；Pending release 1、Pending test 2、Testing closed 1、Pending result review 0。查看 1 个未发布 final、1 个非 final 的 Pending test、1 个已发布后关闭的 Case。均为真实候选人，不是文档规定的 `[UJ-TEST]` seed |
| 规格 | [PRD](PRD.md)、[User Cases](User_Cases.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[公共约定](../README.md)、[UX/UI 标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) |
| 健康 | `GET /hireos/written/api/health` HTTP 200，见 E05；只证明健康端点可达 |
| 版本 | 本地源码参考 `c4b610500d33a279c03251091c5f0af13b831318`，**不是线上构建 SHA** |
| GitHub | 未提供 W09 主 Issue/PR；按标题检索未找到明确对应的 W09 主 Issue。相关已知并发/恢复风险见 [#132](https://github.com/TelyAgent/HireOSV2/issues/132)、[#118](https://github.com/TelyAgent/HireOSV2/issues/118)，两者均为源码审计而非本轮线上复现 |
| 边界 | 仅页面导航、无持久副作用的勾选/取消、截图/DOM 和只读健康请求。未执行认证业务写 API、邮件发送、故障注入或本地 CI |

UX/UI 标准原适用 JD Management；本轮复用旅程、U1–U10、证据和分级，JD 专属的职位字段、激活及渠道发布项不直接套用。截图与 DOM 包含真实候选人资料，仅供仓库内授权人员查看，不外发。

## 证据索引

| ID | 文件 | 可确认事实 |
|---|---|---|
| E00 | [任务列表截图](evidence/2026-10-16/00-task-list.png) · [DOM](evidence/2026-10-16/00-task-list-dom.txt) | 队列数量、缺指定 W09 seed、顶栏与工作台身份文案不一致 |
| E01 | [未发布 final 结果截图](evidence/2026-10-16/01-release-preview.png) · [DOM](evidence/2026-10-16/01-release-dom.txt) | 左侧人工总分/criterion/定稿人、右侧候选人预览、两项确认和发布按钮；披露策略只是文本，没有切换控件；零项确认时按钮可用 |
| E02 | [只勾一项截图](evidence/2026-10-16/02-one-confirmation.png) · [DOM 与按钮状态](evidence/2026-10-16/02-one-confirmation-dom.txt) | `Internal review complete` 勾选、另一项未勾，`Finalize & publish result` 仍 `button_enabled=true`；检查后已取消勾选 |
| E03 | 非 final 结果截图（本地证据，含个人信息，未入库） · [DOM](evidence/2026-10-16/03-nonfinal-result-dom.txt) | Pending test Case 的 Evaluation result 显示 `No finalized result for this round yet.`，没有发布按钮；不是要求的 Taylor AI draft seed |
| E04 | 已发布后关闭的结果截图（本地证据，含个人信息，未入库） · [DOM](evidence/2026-10-16/04-closed-result-dom.txt) | 左侧 final、右侧已发布预览、Published 时间与 Next action；策略文本为 Score + summary，预览却没有 Score；只有 Delivery 说明文案，无 Sent/Failed 状态或 Retry |
| E05 | [健康响应头](evidence/2026-10-16/05-health-headers.txt) · [响应体](evidence/2026-10-16/05-health-body.txt) | `curl` 退出码 0、HTTP 200；不证明发布/邮件链路 |
| E06 | [前端发布实现](../../../../hireos-written/hireos-written-front/src/pages/ReleasePage.tsx) 约 92–146、188–236 行；[路由](../../../../hireos-written/hireos-written-front/src/App.tsx) 约 91 行 | 本地代码在点击处理函数内检查两项确认，但按钮仅因 busy 禁用；策略来自 invitation 而非发布页选择；成功 toast 声称 Portal/notification queued。**源码参照，不等于线上部署证明** |
| E07 | [后端发布实现](../../../../hireos-written/hireos-written-backend/src/invitations/invitations.service.ts) 约 148–158 行；[DTO](../../../../hireos-written/hireos-written-backend/src/invitations/case-result.dto.ts)；[控制器](../../../../hireos-written/hireos-written-backend/src/invitations/case-result.controller.ts) | 本地实现把 release JSON 写入 Submission 并推进 Case；DTO 无确认项。通知/版本/候选人白名单接口缺口属源码风险，未直接核验线上 DB/API |

## 10 条 User Case 执行结果

| 用例 | 结果 | 线上观察、未完成断言与复测条件 |
|---|---|---|
| UC-W09-01 Release 双栏 / P1 | **部分验证** | E01 有人工总分、criterion、定稿人及右侧 Outcome/Score/Feedback/Next step/不含内部信息说明；指定 Alex=70、覆盖差异记录未提供，无法完整核对 |
| UC-W09-02 披露方式切换 / P1 | **失败** | E01 发布页仅显示 `Disclosure policy: Score + summary` 文本，DOM 中无切换控件，不能按步骤改为 Summary only 或验证即时预览。E04 的已发布预览还与策略标签不一致 |
| UC-W09-03 两项确认门禁 / P0 | **失败** | E01 零项确认与 E02 仅一项确认时，发布按钮均可用，未解释禁用原因。未点击按钮，不能断言服务端会绕过确认；E06 本地点击处理函数有前端拦截 |
| UC-W09-04 发布成功与通知 / P0 | **部分验证** | E01 有待发布 final，E04 可见另一 Case 的 Published 时间和 Next action；没有对隔离 Case 发布，无法把这两条记录串成一次事务，亦无候选人邮件、Delivery、DB 和统计前后证据 |
| UC-W09-05 退信与重试 / P0 | **阻塞** | 无 `mail_bounce`、mock inbox、Delivery 记录；E04 已发布页未出现 Retry，但未制造失败态，不能以此单独判定失败路径 |
| UC-W09-06 双击幂等 / P1 | **阻塞** | 不对真实候选人双击发布；缺隔离 Case、通知计数和数据库版本计数。#132 的静态风险不能当成本轮线上复现 |
| UC-W09-07 候选人白名单 / P0 | **阻塞** | 无候选人身份/结果链接及候选人 API 响应；E01/E04 是内部预览，不能证明外部 DOM/API 无 notes、排名、AI 分、答案和诚信信号 |
| UC-W09-08 非 final Under review / P0 | **阻塞** | E03 是雇主端 Pending test 空态，不是候选人 Taylor 的 submitted AI draft；无候选人结果页或 API，不可替代该用例 |
| UC-W09-09 非 final 不能发布 / P0 | **部分验证** | E03 雇主端无发布控件，显示无 final；但样本未提交，不是指定的 AI draft，且未对隔离 Case 发 release API 核服务端 4xx |
| UC-W09-10 纠正生成 v2 / P1 | **阻塞** | 无隔离的已发布 Case、版本历史或候选人结果读取；未改真实 Feedback。E04 仅有单次 Published 视图 |

**统计口径**：完整通过要求用例内所有 UI/API/DB/外部断言都取得线上证据；“部分验证”仅表示其中可观察的片段。文档中的 ✅/🟡/❌ 是执行前实现判断，不作为本轮结果。

## PRD Acceptance Criteria

| AC | 结论 | 证据与解除条件 |
|---|---|---|
| AC-1 候选人白名单结果 | **未验证** | E01/E04 仅为雇主端预览；需要隔离发布、候选人登录/链接、DOM 与 API 原始响应，核敏感内部字段均不存在 |
| AC-2 退信仍 Published、可重试 | **未验证** | 需要 simulation_only 邮件适配器注入 bounce，核 Release/Delivery 状态、只补发一次与 DB 计数 |
| AC-3 非 final 不能发布、候选人 Under review | **部分验证** | E03 只验证雇主端 Pending test 无发布入口；需要 Taylor AI draft、服务端 release 4xx 与候选人 Under review/API 不含 draft 分 |
| AC-4 Summary only 不显示分数 | **未验证** | 发布页无法切换；需要已配置 Summary only 的隔离邀请，核预览、已发布候选人 UI 和 API 都无分数。E04 另有 Score + summary 标签和隐藏分数不一致问题 |
| AC-5 纠正版本历史 | **未验证** | 需要隔离已发布结果，纠正后核 v2、v1 历史和候选人最新版 |

## 用户旅程与 UX/UI 标准

**角色与目标**：HR 核对内部 final 与对外内容，选择披露方式并批准发布，确认送达后交给下一步；候选人查看本人已批准的结果。实际只走了 `My Tasks → Evaluation result` 的待发布、非 final 和已发布后关闭三类**只读**路径。发布/候选人/通知的完整交接没有执行。

| Step | 用户操作 | 预期 | 实际与证据 | 判定 |
|---|---|---|---|---|
| 入口 | 从任务队列进入待发布 Case | 找到本人待处理项和身份 | Pending release 1，但顶栏与任务页身份文案不同（E00） | 部分 |
| 1 | 检查内部参考和候选人预览 | 分栏、人工分、定稿人、披露文案 | 基本可见；无 Alex seed，是否覆盖未能验证（E01） | 部分 |
| 2–3 | 切换披露方式、编辑外发文案 | 即时预览 Score/summary | 文案输入存在；策略不可切换（E01），未持久修改真实记录 | 失败 / 部分 |
| 4 | 只勾一项确认 | 发布禁用并解释 | 按钮仍可用（E02） | **失败** |
| 5–6 | 发布、确认 Delivery、退信恢复 | Portal + 通知分开可见 | E04 只有历史 Published 与泛化 Delivery 文案，无可核验交付状态；未发起本轮发布 | 未验证 |
| 7–8 | 候选人查看 final/非 final | 白名单结果或 Under review | 无候选人身份/页面/API（E03 是雇主端） | 阻塞 |
| 9 | 纠正已发布结果 | 新版本、旧版历史 | 未执行；无历史入口证据（E04） | 阻塞 |

| 标准 | 结果 | 本轮证据边界 |
|---|---|---|
| U1 容易理解 | **部分** | E01 双栏和状态可读；E04 披露策略与可见内容矛盾，E00 身份文案不一致 |
| U2 容易上手 | **部分** | E00 可从 Pending release 进 Case；E01 没有披露方式选择入口 |
| U3 快速完成 | **未验证** | 无隔离数据，不计时发布与通知流程；未改外发内容 |
| U4 下一步明确 | **部分** | E04 有 Next action；缺 Delivery Sent/Failed 及通知重试状态 |
| U5 提示和按钮清楚 | **失败** | E02 只勾一项时发布按钮仍可点击，禁用原因未展示 |
| U6 符合真实工作 | **失败** | HR 在发布前不能按 W09 旅程选择 Score + summary / Summary only（E01） |
| U7 角色信息结构 | **未验证** | 仅当前会话，顶栏与任务页身份不一致；无候选人或受限账号 |
| U8 减少重复跳转 | **部分** | My Tasks → Case → Evaluation result 可达；未测返回保留及真实发布交接 |
| U9 可恢复和可预期 | **未验证** | 无退信/超时/未知/并发注入；E04 无 Delivery 实际状态 |
| U10 可访问可操作 | **未验证** | 两项复选框和按钮在 DOM 有语义；未测键盘顺序、200% 缩放、焦点和错误关联 |

按标准的 UI 观察部分为 **conditional_pass**：有未豁免 P1 且无本轮证据确认的 P0 权限/外发事故。W09 **业务验收仍不通过**，因为核心 AC 未完整验证且可测的交互用例失败。截图不能证明服务端权限、持久化、幂等或真实送达。

## 发现与优先级

| ID / 级别 | 角色、步骤和证据 | 用户影响 | 最小修复与复验 |
|---|---|---|---|
| W09-LIVE-01 / **P1** | HR 步骤 4，E01–E02：零项/单项确认时按钮可用 | 误以为可发布，点击后才知道被拒；高影响动作的前置条件不清楚 | 按钮在条件不全时禁用并逐项解释；两项都勾选后才启用。隔离 Case 测 UI 与服务端拒绝绕过 |
| W09-LIVE-02 / **P1** | HR 步骤 2，E01：发布页只有披露策略文本 | HR 不能在发布前完成规定的披露选择，AC-4 的 UI 路径不可测 | 在发布页提供策略选择并即时更新预览；隔离 Score + summary / Summary only 双路径核 UI/API |
| W09-LIVE-03 / **P1** | HR 回看已发布结果，E04：Score + summary 标签下无 Score | 已发布内容与披露设置不一致，HR 无法确认候选人实际看到什么 | 展示发布时固定的策略和内容快照，发现不一致时明确警示；核 API `showScore`、策略来源和候选人 UI |
| W09-LIVE-04 / **P1** | HR 步骤 5–6，E04：Published 后只有说明文字，无 Delivery 状态 | 无法确认 Sent、Failed、Unknown 或需要重试 | 为每次发布显示独立 Delivery 状态、时间、失败原因和受控重试；以模拟发送/退信验证 |
| W09-RISK-05 / **待线上复现** | E06–E07 本地源码：先本地标记 published，后请求服务端；catch 后仍显示成功 toast；后端仅写 Release JSON | 服务端失败时可能错误呈现已发布，刷新后回退；无版本/通知证据 | 隔离 Case 注入服务端失败并核 UI/DB 状态一致；实现成功后再更新 UI，发布/送达独立记录。此项**不是线上已复现缺陷** |

## 执行记录与复测条件

| 检查 | 实际状态 |
|---|---|
| 线上 UI | 已执行：任务队列、未发布 final、非 final、已发布后关闭记录；零项/单项确认按钮状态，最后恢复复选框为未勾选 |
| 线上健康 | 已执行：`curl -sS --max-time 15 -D .../05-health-headers.txt -o .../05-health-body.txt -w 'http_code=%{http_code}' https://hireos.aipollo.me/hireos/written/api/health`；退出码 0、HTTP 200 |
| 发布/邮件/候选人/故障/并发 | **未执行**：无安全隔离的 `[UJ-TEST]` Case、simulation_only adapter、候选人及受限账号、DB/API/日志读取与注入点 |
| build/lint/type/unit/integration | **未执行**：本轮只做线上探索和报告，没有修改应用代码；不将本地代码阅读当作线上通过 |
| 正式 QA JSON | 未生成：无 W09 主 Issue/PR、线上/合并 SHA 及仓库 QA context；本报告不冒充正式 QA |

复测需先提供隔离 workspace 和 `S_result_final_unreleased`、`S_result_released`、`S_attempt_submitted_ai_draft`，使用 `[UJ-TEST]` + example.com 和 simulation_only 通知；提供 HR、候选人、受限/跨 workspace 身份及只读 Release/Delivery/API/DB 证据。分别注入 `mail_bounce`、双击、并发和服务端失败，逐项核 UC-W09-01–10 与 AC-1–5。还需确认 W09 主 Issue/PR 与线上构建 SHA，并将发布审批人、候选人结果访问方式和版本模型的产品决定回写 GitHub。

本轮仅保存本地报告与证据，未创建 Issue/PR、发送通知或改变线上候选人结果。
