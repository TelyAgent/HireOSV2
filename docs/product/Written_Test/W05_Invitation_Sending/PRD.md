# W05 产品文档：邀请与批量发送

| 项 | 内容 |
|---|---|
| 模块 | W05 / 主闭环第 3 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter |
| 原型路由 | `#/invitations/new`（批量 Composer）；计划页 **Send to candidate** 抽屉（单人）（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🟡 后端 `POST cases/:caseId/invitations` 冻结题目快照、生成 token，并用工作区 SMTP 账号（`mail-accounts`）发送中文邀请邮件；发信失败时邀请仍创建，只返回 `emailSent=false`，没有重试接口。前端 `SendToCandidateDrawer` 已接真实接口，`InvitationComposerPage` 使用 fixture。批量预览、逐项 Delivery、Retry failed、提交渠道配置未实现。未逐项验证 AC |
| 依据 | [PRD v1.4 §5、§6](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §5、§7](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §5.3、§14.3、P03](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md) |

## 1. 背景与目标

批量发邀请时，如果一封失败就整批回滚，或者重试时给已成功的人再发一次，候选人体验和数据都会出问题。候选人还需要在邀请里清楚看到工作量、期限、规则和怎么提交。

**目标**：对确定的名单逐人预览、获授权后发送、逐项追踪；部分失败只重试失败项；每个候选人收到独立邀请，看不到其他人的邮箱。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 批量 Composer 五步：Recipients → Tests & materials → Timing & submission → Result disclosure → Review & send | 候选人接受与作答（W06） |
| 计划页单人 Send to candidate 抽屉 | 结果通知（W09） |
| Timed / Deadline only、时长、截止时间 | 修订 / 补测轮次的反馈内容（W10，发送沿用本功能） |
| 提交渠道：Portal 上传、邮件 auto-submit、邮件先收后 Portal 确认 | 邮件发送通道本身（平台通知服务，W14） |
| 结果披露方式：Score + summary / Summary only | |
| AI / 网络 / 开卷规则 | |
| 题包释放时机：接受后释放 / 邀请附件 ZIP / 受控链接 | |
| 逐人预览、保存草稿、逐项 Delivery、Retry failed | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | Recipients 步只列出已确认招聘关系（Core Application）的候选人；没有的不能出现在列表里，并说明原因 |
| FR-2 | Tests & materials 步显示每个收件人计划中的测试、预计工作量、材料；收件人没有计划项时提示先去计划页添加 |
| FR-3 | Timing & submission 步：Timed 显示时长 + 截止时间；Deadline only 只显示截止时间；选择提交渠道 |
| FR-4 | 邮件 auto-submit 模式下说明「Complete answers sent from your verified email can be submitted automatically」；确认模式下说明还需在 Portal 确认 |
| FR-5 | Result disclosure 步选择 Score + summary 或 Summary only，并说明永不包含内部排名、评审 notes、内部答案 |
| FR-6 | Review & send 逐人预览：模板、题包版本、预计工作量、时区、From / Reply-To（hr@sendinglabs.com） |
| FR-7 | **Send invitations** 是明确动作；发送后进入逐项 Delivery 列表（Sent / Bounced / Failed），不只弹 toast |
| FR-8 | 失败项单独 **Retry**；重试不影响已成功项 |
| FR-9 | **Save draft & exit** 保存草稿，之后可回来继续 |
| FR-10 | 已批准后又修改了关键条件（收件人、题包、期限、提交渠道、披露方式）时，标记旧批准失效，需要重新确认 |
| FR-11 | 单人发送抽屉提供同样的 Mode、Duration、Deadline、Result disclosure 和 From / Reply-To 预览；未填截止时间不能发送 |
| FR-12 | 邀请内容包含：预计工作量、时区、提交清单、规则、帮助入口；题包默认在接受后释放，提前披露的附件 ZIP 需明确标注 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 邀请前必须有：Core Candidate、已发布的标准 / 策略、邮箱参与者关联、（正式岗位测评的）确认的 Application |
| BR-2 | 每个候选人独立发送，不暴露其他收件人邮箱 |
| BR-3 | 候选人邮件的 From / Reply-To 统一为 hr@sendinglabs.com；每轮用任务名、轮次号、线程和内部安全关联区分，不为每轮建独立邮箱 |
| BR-4 | 部分失败只重试失败项，不回滚成功项；批次重放不重复邀请（幂等键） |
| BR-5 | 邀请冻结发送时的题目版本，之后题库或计划修改不影响已发邀请 |
| BR-6 | 本模块不自行签发登录凭据；候选人身份验证由统一 Identity 完成 |
| BR-7 | 修订 / 补测各自独立邀请，不把所有人锁成同一阶段 |
| BR-8 | 内部员工任务通知由配置的模块通知身份发送，实际别名由平台确认，不编造地址 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Case、AssessmentPlan / PlanItem（W04） | |
| 输出 | Invitation | case、轮次、题目版本快照、mode、duration、deadline、提交渠道、披露方式、状态（draft / sent / opened / accepted / declined / started / submitted / cancelled） |
| 输出 | PolicySnapshot / SubmissionPolicy | AI 规则、网络 / 开卷、auto_submit / confirm |
| 输出 | Delivery ref | 平台通知请求 ref、发送结果、重试次数 |
| 输出 | InvitationBatch | 收件人、逐项结果、幂等键 |

## 6. 权限

- 发送需要对该 Case 的权限；是否需要他人批准见「待确认」第 1 条。
- 候选人只能看到自己的邀请。

## 7. 非功能要求

- 双击发送只发一次；重复提交同一批次不产生重复邀请。
- 发送结果「未知」时先查询平台状态，不直接重发。
- 邮件和 Portal 文案为英文（PRD §14）。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 没有确认招聘关系的候选人不能出现在收件人中 | A、Brief F03 |
| AC-2 | 批量发送两人，一人成功一人模拟退信；只重试失败项，成功的人不收到第二封，不重复创建候选人 | A、Brief P03 |
| AC-3 | 逐人预览显示正确的题包版本、工作量、时区和 From / Reply-To | Brief §5.3 |
| AC-4 | Timed 显示时长和截止；Deadline only 只显示截止 | B |
| AC-5 | 已批准后修改截止时间，旧批准标记失效 | Brief §5.3 |
| AC-6 | 发送后修改题库，邀请内容不变 | A |
| AC-7 | 草稿退出后再进入，内容保留 | Brief §5.3 |

## 9. 依赖与实现

- 后端：`src/invitations`（`invitations.service.ts`）、`src/mail-accounts`（`mail.service.ts`）。
- 前端：`InvitationComposerPage`、`SendToCandidateDrawer`。
- 依赖：W04、W14（平台通知）、W18（Identity）。下游 W06。

## 10. 待确认

1. PRD 写「预览并授权」「获授权发送」，原型写明发送即本人确认、没有审批。批量邀请是否需要第二人批准？
2. 现有实现用工作区自建 SMTP 账号（密码明文存储）发送，PRD 要求经平台公共邮件服务。过渡期是否沿用 SMTP，何时切换？
3. 现有邀请邮件和候选人页面是中文，PRD §14 要求英文界面。候选人端语言是否按岗位 / 候选人可选？
4. 邮件 auto-submit 需要读取 hr@ 收件箱（W07），在收件能力上线前，提交渠道是否只开放 Portal。
