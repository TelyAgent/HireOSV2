# W06 产品文档：候选人门户：验证、接受与作答

| 项 | 内容 |
|---|---|
| 模块 | W06 / 主闭环第 4 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Candidate（统一 Identity 受限参与者） |
| 原型路由 | `#/candidate`、`#/candidate/invitations/:id`、`#/candidate/attempts/:id`（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🟡 前端 `CandidateApplyPage`（`/apply/:token`）免登录打开，文本作答后提交；后端 `GET public/invitations/:token` 首次打开即把邀请改为 `opened` 并推进 Case 状态，`POST public/invitations/:token/submit` 提交并触发 AI 初评。邮箱验证、Accept / Decline、Start test 计时、文件上传草稿、提交回执未实现。未逐项验证 AC |
| 依据 | [PRD v1.4 §6、§7、§15](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §5、§7](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §3.2、§5.4、P04、P05、F08](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md) |

## 1. 背景与目标

候选人通过邮件进入测评。如果点开链接就算接受或开始计时，邮件安全扫描器的预取就会误触发；如果上传即提交，候选人就无法修改或补交；如果模块自己发账号密码，就会出现第二套身份。

**目标**：候选人用受邀邮箱经统一 Identity 验证后明确接受；接受、开始、上传、提交各自独立；正式提交后锁定并给出回执；手机上也能完成接受、上传和查看结果。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 候选人首页：本人待接受 / 进行中 / 结果 | 雇主端任何页面 |
| 邀请页：公司 / 岗位、题目、工作量、期限、AI 规则、邮箱验证、Accept / Decline | 邮件收件与自动提交处理（W07） |
| Timed：Start test 后计时；Deadline only：Open assignment，离线作答 | 结果页内容（W09） |
| 作答页：Materials / Required deliverables / Your answers | 修订 / 补测的接受（W10，沿用本页） |
| 上传草稿、扫描状态、离开再回来 | |
| Submit answers 最终清单确认、回执、锁定 | |
| 邮件提交说明（Email option） | |
| 手机端适配 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 候选人首页列出本人所有任务（待接受、进行中、已提交、结果可查看），无任务时显示「No assessments yet.」 |
| FR-2 | 邀请页显示公司、岗位、题目名称、预计工作量、期限、AI use policy（如 Open-book; cite sources）、时区和帮助入口 |
| FR-3 | **Verify your email**：通过统一 Identity 发送验证码到受邀邮箱；页面说明这是统一 HireOS 身份入口 |
| FR-4 | 验证后显示 **Accept** 和 **Decline**；接受成功显示「Invitation accepted」；拒绝前二次确认「You can't undo this from the portal. HR will be notified.」 |
| FR-5 | Timed 测评接受后显示 **Start test** 并提示点击后开始计时；开始后显示倒计时（Timer running） |
| FR-6 | Deadline only 测评接受后显示 **Open assignment**，只显示截止日，不显示倒计时 |
| FR-7 | 作答页顶部显示当前轮次和期限；分 Materials（可下载）、Required deliverables、Your answers 三块 |
| FR-8 | 上传的文件逐行显示 Uploaded draft / Scanning / Ready / Missing；页面说明「Uploads are drafts until you submit. You can leave and come back.」 |
| FR-9 | 离开有未提交草稿的页面时提示 |
| FR-10 | **Submit answers** 打开最终清单（已上传 / 缺失项）；确认后显示回执时间和「Your answers are submitted.」 |
| FR-11 | 提交后该轮锁定，显示「Further edits aren't possible on a locked round.」 |
| FR-12 | 带缺失项提交时提示「Submitted with missing items — HR will follow up.」（是否允许见待确认第 2 条） |
| FR-13 | Email option 显示统一 hr 邮箱、本轮回复线程、附件要求，以及何时算正式提交 |
| FR-14 | 结果未发布时显示「Under review」进度说明，明确这不是最终结果 |
| FR-15 | 复杂 Excel / 代码作答提示 Open on desktop，但手机上仍可查看任务、上传已完成的文件 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | GET 打开链接不消耗验证、不接受、不开始计时，没有业务副作用 |
| BR-2 | 打开 ≠ 接受 ≠ 开始；Timed 接受后仍需 Start test |
| BR-3 | 上传是草稿；只有明确 Submit answers（或 W07 的合规邮件 auto-submit）才锁定 |
| BR-4 | 候选人不需要雇主成员账号；本模块不签发登录凭据 |
| BR-5 | 同一邮箱有多个岗位任务时彼此隔离，只能看到对应任务 |
| BR-6 | 验证邮箱只证明邮箱控制权，不证明法律身份 |
| BR-7 | 新修订 / 补测需要重新接受新安排 |
| BR-8 | Portal 提交以正式提交命令的时间判断是否按时 |
| BR-9 | 保存或解析失败不是零分 |
| BR-10 | 候选人页面不出现评分、认证通过等由候选人自己选择的按钮 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Invitation（W05） | 状态、mode、deadline、题目快照 |
| 输入 | Identity participant | participant_user_id、authorization_ref |
| 输出 | Acceptance | accepted / declined、时间 |
| 输出 | Attempt | 轮次、started_at、状态、锁定时间 |
| 输出 | SubmissionDraft | 文件（FileVersion ref）、扫描状态、题目绑定 |
| 输出 | Receipt | 提交时间、清单、缺失项 |

## 6. 权限

- 候选人只能访问自己的邀请、作答和已发布结果；不显示员工菜单。
- 转发的链接在没有对应邮箱验证时被拒绝。
- 会话过期后要求重新统一认证，不切换为本地登录。

## 7. 非功能要求

- 支持 390×844 手机和桌面；底部主操作在安全区内可见；长文件名换行。
- 200% 缩放时主要操作和 Close 可达；键盘可完成全部操作。
- 双击 Submit 只提交一次。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 仅打开邀请链接（GET）后，邀请未被接受、计时未开始、验证码未被消耗 | B、Brief P04 |
| AC-2 | 邮箱验证后 Accept，状态变为已接受；Timed 需再点 Start test 才开始计时 | B、Brief P04 |
| AC-3 | Deadline only 接受后无倒计时，只显示截止日 | B、Brief P04 |
| AC-4 | Decline 后 HR 收到通知，候选人不能再接受该邀请 | Brief P04 |
| AC-5 | 上传后离开再回来，草稿仍在；Submit 后显示回执，旧答案锁定 | B、Brief P05 |
| AC-6 | 提交后对应 Task、评分队列和候选人回执同步更新 | Brief P05 |
| AC-7 | 用未验证的邮箱或其他候选人的会话访问被拒绝，且页面不短暂闪现数据 | Brief P21、F08 |
| AC-8 | 在手机宽度下完成接受、上传、提交、查看结果 | F |

## 9. 依赖与实现

- 后端：`src/invitations`（`public-invitations.controller.ts`、`invitations.service.ts` 的 `getPublic`、`submit`）。
- 前端：`CandidateApplyPage`。
- 依赖：W05、W18（Identity 受限参与者）、W15（文件存储与扫描）。下游 W07、W08。

## 10. 待确认

1. 现有 `GET public/invitations/:token` 会把邀请改成 `opened` 并推进 Case 到「待提交」，与 BR-1「GET 无副作用」冲突。是否改为由显式动作推进？
2. 原型允许带缺失项提交（「Submitted with missing items」），PRD §7 写「缺件不作完成」。Portal 是否允许带缺失项提交，提交后状态是什么？
3. 统一 Identity 的受限参与者流程尚未提供，过渡期是否继续使用 token 链接？如继续，需要什么额外保护（有效期、绑定邮箱）。
4. 现有作答方式是逐题文本输入，PRD 以文件交付为主。两种方式是否都需要？
