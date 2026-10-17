# W06 候选人门户线上测试报告（2026-10-16）

## 结论

**验收未通过，核心流程未验证。** 尝试线上 `/hireos/written/candidate` 与 PRD 所列原型 hash 路径 `#/candidate`，均跳到雇主端 `My Tasks`，未呈现候选人任务首页。PRD 没有指定正式线上首页 URL，因此该观察尚不能证明正式候选人入口有缺陷。无效邀请链接显示错误、对应公共 API 返回 404；这只证明无效 token 的处理。由于没有隔离的有效邀请、候选人测试身份、只读业务记录和线上构建号，14 条 W06 用例均不能完整执行，**0 完整通过、0 完整失败、14 阻塞/仅局部观察**。不得把这些阻塞项记作功能通过或生产缺陷复现。

本报告是线上探索测试和 UX/UI 审查，**不是**关联 Issue/PR/合并提交的正式 Codex QA。按[指定标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)的门槛，核心权限、状态持久化和提交交接没有证据时，不能给出通过结论。

## 范围与环境

| 项 | 实际情况 |
|---|---|
| 依据 | [W06 PRD](PRD.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[14 条用例](User_Cases.md)、指定 UX/UI 标准 |
| 时间 | 2026-10-16 12:00–12:01，Asia/Shanghai |
| 线上地址 | `https://hireos.aipollo.me/hireos/written/`；候选人首页尝试 `/candidate`；无效邀请测试 `/apply/w06-invalid-token-probe` |
| 浏览器 | Chrome，已有雇主登录会话；没有候选人受限参与者测试会话 |
| 数据 | 未取得 `S_inv_sent_timed`、`S_inv_sent_deadline`、`S_inv_accepted_deadline`、`cand_other` 或隔离文件样本 |
| GitHub 对象 | 未提供 W06 主 Issue/PR；检索 Issue 标题未找到明确的 W06 候选人门户主 Issue。未创建 Issue 或发布评论 |
| 代码参照 | 本地 HEAD `c4b610500d33a279c03251091c5f0af13b831318`，**并非已核实的线上构建 SHA** |
| 线上操作 | 只读导航与无效 token GET；未打开真实 token，未触发邀请状态、验证码、上传、提交或发信 |

指定标准原适用于 JD Management；此处复用其旅程检查、U1–U10、证据要求和 P0–P3 门槛。JD 专属审批、激活、发布字段不套用到候选人门户。

## 证据

| ID | 文件 / 定位 | 可证明的事实 |
|---|---|---|
| E01 | [无效邀请页面](evidence/2026-10-16/01-invalid-invite.png) | `/apply/w06-invalid-token-probe` 显示 `This link is invalid or has expired.`，页面未出现雇主导航 |
| E02 | [候选人入口跳转](evidence/2026-10-16/02-candidate-route-redirect.png) | 访问 `/candidate` 最终到 `/tasks`，显示雇主 `My Tasks`、`HR Head` 文案；截取页面顶部，未保存候选人列表 |
| E03 | [无效 token API 响应](evidence/2026-10-16/03-invalid-api-response.json) | `GET /api/public/invitations/w06-invalid-token-probe` HTTP 404，`INVITATION_NOT_FOUND` |
| E04 | [健康接口响应](evidence/2026-10-16/04-health-response.json) | Written backend health HTTP 200、`phase-0`；只证明健康端点可达 |
| E05 | [执行上下文与命令](evidence/2026-10-16/00-run-context.txt) | 操作、时间、退出码与限制 |
| C01 | [前端路由](../../../../hireos-written/hireos-written-front/src/App.tsx) | 本地代码只有 `/apply/:token` 候选人页；未知路径回 `/tasks`。仅用于解释观察，不能独立证明线上代码版本 |
| C02 | [候选人页面实现](../../../../hireos-written/hireos-written-front/src/pages/CandidateApplyPage.tsx) | 本地实现为免登录文本作答和直接 Submit；没有验证、Accept/Decline、计时开始、文件草稿 UI。**源码风险，未以有效线上邀请复现** |
| C03 | [公共邀请控制器](../../../../hireos-written/hireos-written-backend/src/invitations/public-invitations.controller.ts)、[服务](../../../../hireos-written/hireos-written-backend/src/invitations/invitations.service.ts) | 本地 `getPublic` 对 sent 邀请写 opened 状态；未用线上有效 token 验证数据库副作用 |

E01–E04 为本轮线上证据；C01–C03 为本地源码证据。截图不能证明权限、数据库状态或交付结果；健康 200 不能证明业务流程正常。

## 逐项用例结果

| 用例 | 结果 | 实际证据 / 阻塞点 | 复测所需 |
|---|---|---|---|
| UC-W06-01 邀请页信息 | 阻塞 | 只有无效 token 错误页 E01，无有效邀请内容 | 隔离有效邀请，核公司、岗位、题、工作量、期限/时区、AI 规则、帮助 |
| UC-W06-02 GET 无副作用 | 阻塞；源码高风险 | 无效 token 404 E03；不能证明有效邀请 GET 无副作用。C03 的本地实现会改 `opened` | 受控 sent 邀请，GET 前后查 Invitation/Case/Attempt/OTP，连续 3 次 |
| UC-W06-03 验证并接受 | 阻塞 | 无 OTP、Accept 入口或候选人身份；C02 不含该 UI | 有效 timed 邀请、Identity 参与者、只读状态查询 |
| UC-W06-04 错误/过期验证码 | 阻塞 | 无 OTP 测试身份 | 可控错误与过期 OTP、重发记录 |
| UC-W06-05 拒绝邀请 | 阻塞 | 无可拒绝的隔离邀请；不能用真实候选人邀请做不可逆测试 | deadline-only 隔离邀请、HR 通知记录、再次 Accept 的 4xx |
| UC-W06-06 Timed Start test | 阻塞 | 无已接受 timed 邀请 | 点击前后 `started_at` 与 90 分钟倒计时 |
| UC-W06-07 Deadline only | 阻塞 | 无已接受 deadline-only 邀请 | 页面显示截止日，无倒计时 |
| UC-W06-08 上传草稿与恢复 | 阻塞 | 无有效作答页、文件存储/扫描 seed；C02 仅文本框 | 隔离文件、刷新/重开、Draft/Receipt 前后记录 |
| UC-W06-09 正式提交/回执/锁定 | 阻塞 | 无隔离可提交邀请；未执行任何提交 | 最终清单、回执时间、锁定后 4xx、Task/队列同步记录 |
| UC-W06-10 双击幂等 | 阻塞 | 无可安全双击的隔离提交 | 受控并发、Submission/Receipt/AI 任务唯一计数 |
| UC-W06-11 宏文件隔离 | 阻塞 | 无文件上传入口与隔离样本 | xlsm 样本、扫描/绑定记录 |
| UC-W06-12 缺件清单 | 阻塞；规则待确认 | 无文件清单；PRD 待确认是否允许缺件提交 | Owner 确认规则后用隔离缺件 seed 测试 |
| UC-W06-13 越权与会话过期 | 阻塞；局部观察 | 无效 token API 404 且无候选人资料 E01/E03；没有他人有效 token/双身份，无法证明 AC-7 | 两个测试身份、交叉 token、API 响应体、加载过程、过期会话 |
| UC-W06-14 手机端全程 | 阻塞 | 没有有效邀请，无法完成接受/上传/提交；未以错误页代替主流程测试 | 390×844、200% 缩放、键盘、长文件名、完整流程 |

**辅助只读检查**：无效 token 的 API 404 与页面错误提示符合预期；该检查不计入 14 条用例的完整通过数。

## 验收标准覆盖

| AC | 结论 | 原因 |
|---|---|---|
| AC-1 | 未验证；源码风险 | 缺有效 sent 邀请与前后记录；C03 与 GET 无副作用规则冲突 |
| AC-2 | 未验证 | 无邮箱验证、接受及 timed start 的线上数据 |
| AC-3 | 未验证 | 无已接受 deadline-only 邀请 |
| AC-4 | 未验证 | 无受控拒绝场景和通知记录 |
| AC-5 | 未验证 | 无上传、草稿恢复、正式回执与锁定场景 |
| AC-6 | 未验证 | 无提交、Task、评分队列或回执同步记录 |
| AC-7 | 未验证 | 无效 token 的 404 不等于已验证对其他候选人的授权隔离 |
| AC-8 | 未验证 | 没有手机端完整候选人旅程 |

## 用户旅程与 UX/UI 审查

角色为 Candidate；目标是确认受邀测评、理解期限、接受、完成作答并取得回执。预期交接到 W07/W08。**检查范围只有入口跳转和无效邀请错误页，无法给完整候选人界面评分**。按 design-review 的评分范围规则，候选人主流程评分暂缓。

| 步骤 | 用户动作 | 预期 | 线上实际 | 发现 / 限制 |
|---|---|---|---|---|
| 入口 | 打开候选人首页 `/candidate` | 本人任务与 `No assessments yet.` 空态 | 跳到雇主 `My Tasks`（E02） | FR-1 入口不可用；未用候选人身份验证是否另有首页 |
| 1 | 打开邀请链接 | 邀请详情，不自动接受或计时 | 仅用无效 token，显示统一错误（E01/E03） | 无法判断有效链接内容及 GET 副作用 |
| 2–9 | 验证、接受、开始、作答、上传、提交 | 独立状态、回执与锁定 | 未执行 | 缺隔离邀请、身份、文件与只读状态证据 |
| 异常 | 打开无效链接 | 清楚说明错误和恢复方式 | 显示无效或过期，没有重试/联系 HR 的下一步（E01） | P2 可恢复性问题；应区分错误原因并给联系/重发路径，同时避免泄露 token 是否存在 |

### 指定标准 U1–U10

| 项 | 结论 | 依据 |
|---|---|---|
| U1 容易理解 | 局部通过 | 无效链接的错误含义清楚 E01；有效邀请不可评 |
| U2 容易上手 | 未验证；路径风险 | 已测试的两个路径落在雇主任务页 E02；正式线上候选人入口未知 |
| U3 快速完成 | 未验证 | 无主流程 |
| U4 下一步明确 | 失败（错误态） | E01 没有重发或联系支持的操作 |
| U5 提示和按钮清楚 | 未验证 | 无有效邀请控件；错误页无操作 |
| U6 符合真实工作方式 | 未验证 | 无实际作答/文件流程 |
| U7 角色信息结构 | 未验证 | 现有登录是雇主会话；无法据此断言候选人权限泄露 |
| U8 少跳转少重复 | 未验证 | 无主流程 |
| U9 可恢复可预期 | 失败（错误态） | E01 只说明失败，没有恢复动作；持久化与并发未验证 |
| U10 可访问可操作 | 未验证 | 未进行有效流程的键盘、200% 和手机检查；截图不能证明无障碍合规 |

### 优先级发现

1. **W06-LIVE-01 / P1 待分诊 / 候选人首页缺少可验证入口。** 打开 `/hireos/written/candidate`，实际跳至雇主 `My Tasks`（E02）；PRD 仅列原型 hash 路径，尚未确认正式线上 URL。先确认入口与候选人测试身份，再核本人待办、空态和多任务隔离。[GitHub Issue #375](https://github.com/TelyAgent/HireOSV2/issues/375) 已记录这一限制与截图。
2. **W06-LIVE-02 / P2 / 无效邀请缺少恢复路径。** E01 文案可理解，但未说明下一步。建议提供安全的联系 HR / 请求新邀请方式；复测不应透露 token 是否存在。依据指定标准 U4/U9，也符合 Nielsen heuristic #9「帮助用户识别、诊断并从错误中恢复」的启发式判断。[GitHub Issue #376](https://github.com/TelyAgent/HireOSV2/issues/376) 附有线上截图。
3. **W06-CODE-01 / P0 待线上复现 / GET 修改业务状态。** 本地 C03 的 `getPublic` 把 sent 邀请写为 opened，与 AC-1/BR-1 冲突；邮件预取可能推进业务状态。**这是源码风险，不计线上缺陷**。用隔离有效 token 连续 GET 并查 Invitation/Case/Attempt/OTP 才能判定线上行为。修复方向：GET 纯读，由明确动作推进状态。
4. **W06-CODE-02 / P0 待线上复现 / 候选人核心动作缺失。** 本地 C02 只有文本框和直接 Submit，与验证→接受→开始→文件草稿→提交的 W06 目标不一致。**未核实线上构建与有效邀请页，不能记为线上复现**。提供线上构建 SHA 和测试邀请后逐项复测 AC-2/3/5/6/8。

## 审查结构化摘要

```yaml
review:
  product: "Written Test"
  surface: "W06 候选人首页入口与无效邀请错误态"
  role: "Candidate"
  journey_goal: "查看本人测评、确认邀请、接受、作答并取得回执"
  evidence:
    source: "线上 Chrome 页面、只读 API、E01–E05；C01–C03 为本地源码"
    steps_checked: ["入口", "无效邀请异常"]
  verdict: "insufficient_context"
  findings:
    - id: "W06-LIVE-01"
      severity: "P1"
      category: "next_action"
      step: "入口"
      title: "候选人首页入口跳至雇主任务页"
      evidence: "E02"
      user_impact: "无法从该入口查看本人测评任务"
      recommendation: "提供候选人首页路由和本人任务空态/列表"
      acceptance_check: "候选人身份下核待接受、进行中、已提交、结果与空态"
    - id: "W06-LIVE-02"
      severity: "P2"
      category: "state"
      step: "无效邀请异常"
      title: "错误页无恢复动作"
      evidence: "E01"
      user_impact: "遇到过期链接后不知道如何继续"
      recommendation: "提供联系 HR 或请求新邀请的安全路径"
      acceptance_check: "无效/过期链接均可找到下一步且不泄露 token 存在性"
  usability_check:
    understandable: "pass"
    learnable: "unknown"
    efficient: "unknown"
    next_action_clear: "fail"
    controls_clear: "unknown"
    real_workflow_fit: "unknown"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "fail"
    accessible: "unknown"
  limits:
    - "无隔离有效邀请、候选人身份和只读业务记录"
    - "线上构建 SHA 未知；无法把本地源码风险视为线上复现"
    - "未执行完整键盘、缩放、手机与服务端权限测试"
```

## 复测条件与顺序

1. 准备隔离的 `example.com` 候选人和雇主测试身份，以及 timed/deadline-only 两种有效 sent 邀请；记录 seed ID、线上构建 SHA 与清理方式。使用独立 seed 执行每条用例，避免上一条改变下一条的前置状态。
2. 提供受限参与者 Identity 验证、测试 OTP、两个候选人会话、文件存储/扫描样本，以及 Invitation、Attempt、SubmissionDraft、Receipt、Task、评分队列的只读查询/日志。
3. 先测 AC-1 与 AC-7（GET 副作用和越权）；再测接受/拒绝/计时；最后用隔离数据测上传、提交、双击、手机。缺件提交前须由 Owner 确认 PRD 待确认规则。
4. 关联 W06 主 Issue/PR 和实际合并提交后，按仓库 `.agents/skills/qa/SKILL.md` 与 `.github/schemas/qa.json` 生成正式 QA 记录。本轮未运行本地 build、lint、type、unit、integration；这些检查不能被记为通过。
