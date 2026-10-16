# W07 产品文档：提交收件与 Submission Inbox

| 项 | 内容 |
|---|---|
| 模块 | W07 / 主闭环第 5 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter、Operations（身份 / 附件异常）；Candidate（补件） |
| 原型路由 | `#/submissions`、`#/attempts/:id/submission`（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🔴 后端只有 Portal 文本提交（`Submission.answers`），没有收件箱读取、邮件匹配、附件、SubmissionBundle、去重、冲突处理；`MailAccount` 只用于发信。前端 `SubmissionInboxPage` 使用 fixture，`SubmissionDetailPage` 读取真实提交。未逐项验证 AC |
| 依据 | [PRD v1.4 §7](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §5、§7.1、§7.2](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §5.5、§14.3、P05–P08、F07](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md) |

## 1. 背景与目标

Take-home 测评的候选人常直接回复邮件发附件。所有轮次共用一个 hr@ 邮箱，同一人可能同时有多个岗位的任务，旧轮的回复也可能晚到。如果按主题或姓名猜测归属、把咨询邮件当提交、或者让后到的文件覆盖已提交的答案，结果就会落错 Case。

**目标**：邮件和 Portal 两条通道共用一套提交事务和去重；只有身份、线程、轮次、必交物、安全、期限全部满足才自动提交；其余进入可处理、有原因的问题队列；每份证据可定位到原文件的具体位置。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| Submission Inbox 列表与分类 | 读取连接邮箱的底层能力（平台，W15） |
| 邮件详情：发件人、可信接收时间、匹配原因、附件、缺失项 | 候选人 Portal 上传界面（W06） |
| Confirm assignment / Not a match / Request missing files | 评分（W08） |
| 自动提交条件判断 | 读取候选人个人邮箱 |
| SubmissionBundle：原 ZIP、成员、hash、版本、题目绑定 | |
| 去重、版本冲突选择、提交后迟到文件 | |
| Submission 详情：原始压缩包、交付文件、身份与轮次匹配 | |
| Evidence 定位与 Source / Issue Register | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | Inbox 按任务匹配和状态为第一层：Received、Needs confirmation、Incomplete、Submitted、Duplicate、Quarantined；Message-ID、DKIM / SPF、hash 放在 Technical details |
| FR-2 | 邮件详情显示 From、可信接收时间、匹配结果和原因（如「Matched by reply thread」「Round 1 — closed」「More than one assignment found」）、附件、缺失项 |
| FR-3 | **Confirm assignment** 由 HR 复核或候选人在统一身份会话中选择本人待办；不能只凭主题或姓名确认 |
| FR-4 | **Not a match** 把邮件标为非提交（咨询、自动回复等） |
| FR-5 | **Request missing files** 向候选人发送补件通知；补齐后恢复处理 |
| FR-6 | 发件认证失败或附件为受限类型（如含宏）时进入 Quarantined，提示「Held for Operations review — not auto-processed」 |
| FR-7 | 满足全部条件的邮件自动提交，列表、Task、候选人回执、评分队列同步更新 |
| FR-8 | 邮件收件回执与正式提交回执分开发送 |
| FR-9 | Submission 详情显示 Received 与 Processed 两个时间、原始压缩包（可下载）、交付文件逐项（Preview / Missing）、Candidate / Round / Task binding |
| FR-10 | 同一附件经邮件和上传各来一次，只产生一次提交（Duplicate） |
| FR-11 | 不同版本草稿冲突时左右对比文件差异，由人选择 |
| FR-12 | 正式提交后到达的不同文件不覆盖原提交，需新修订轮或经批准的更正 |
| FR-13 | Evidence 支持文本范围、PDF 页码、文档段落、Excel 工作表 / 区域 / 公式 / 缓存值及计算状态 |
| FR-14 | Source / Issue Register 区分：题目故意缺文件、候选人缺交付、系统尚未取得资料 |
| FR-15 | 打开附件不会触发自动提交 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 自动提交需同时满足：发件人是已验证邮箱、认证通过、线程关联、已接受、轮次正确、必交物齐全、格式 / 安全通过、在期限内 |
| BR-2 | 咨询、自动回复、附件外链、身份不明、缺件、匹配多个任务的邮件都不算完成 |
| BR-3 | AI 的匹配猜测不能自动确认 |
| BR-4 | 旧轮线程的回复不重定向到新轮 |
| BR-5 | 期限判断：邮件 auto-submit 按可信服务接收时间；确认模式 / Portal 按正式提交命令时间；补件按最后一个必需件到达时间。扫描或回调延迟不把按时邮件判为迟交，日志仍记录实际处理完成时间 |
| BR-6 | 一个 ZIP 可含多个案例，但每个文件到题目的绑定必须确定 |
| BR-7 | 邮件和上传共用提交事务与去重 |
| BR-8 | 宏和外链不自动执行；未重算的公式不能声称计算正确 |
| BR-9 | 保存或解析失败不是零分 |
| BR-10 | 只读企业连接的接收邮箱，不改写源邮件 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | MailIngress ref（平台） | 发件人、认证结果、线程、附件 FileVersion、可信接收时间 |
| 输入 | Invitation / Attempt（W05、W06） | 轮次、线程关联标识 |
| 输出 | MailConsumption | 匹配结果、原因、分类、处理人 |
| 输出 | SubmissionBundle | 原 ZIP、成员、hash、版本、题目绑定 |
| 输出 | Response / Receipt | 提交时间、来源通道、锁定状态 |
| 输出 | Evidence | FileVersion、定位（页 / 段 / 单元格 / 范围）、计算状态 |
| 输出 | IssueGroup | 问题类型、状态、去重键 issue_group_id |

## 6. 权限

- 普通 HR 看可读说明；技术细节对 Operations 可见。
- 只显示有权限的 Case 的邮件；同一 hr 邮箱下不同 workspace 的邮件不能互相可见。

## 7. 非功能要求

- 同一邮件重复投递只处理一次。
- 邮箱断连恢复后从检查点继续，不漏收、不重复提交。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 已验证邮箱在正确线程发来完整附件，自动提交；Received 和 Processed 时间不同且都显示 | B、Brief P06 |
| AC-2 | 同一附件经邮件和上传各提交一次，只有一个提交 | Brief P07 |
| AC-3 | 已提交后到达的不同附件进入冲突或新轮，原提交不被覆盖 | Brief P07 |
| AC-4 | 错误邮箱、模糊轮次、缺件、恶意文件分别进入 Needs confirmation / Incomplete / Quarantined；补件后恢复 | Brief P08 |
| AC-5 | 同一 hr 邮箱下同一人两个岗位任务、旧轮迟到回复、无线程新邮件，均不自动落到最近轮次 | G、Brief F07 |
| AC-6 | 扫描延迟导致处理时间晚于截止，但可信接收时间在截止前，判定为按时 | PRD §7 |
| AC-7 | Excel 证据显示公式和「Calculation not verified」，不显示编造的重算结果 | Brief §5.5 |

## 9. 依赖与实现

- 后端：需新建收件消费模块；现有 `src/invitations`（Portal 提交）。
- 前端：`SubmissionInboxPage`、`SubmissionDetailPage`。
- 依赖：W06、W15（平台收件与文件）、W14（补件通知）。下游 W08。

## 10. 待确认

1. 平台公共收件服务尚未提供，Assessment 是否先自建 IMAP 读取 hr@ 邮箱作为过渡？（Spec 规定原信接收归平台）
2. 补件通知是否需要 HR 确认后才发送，还是检测到缺件自动发送。
3. 「Duplicate」判定依据：文件 hash 完全一致，还是内容一致即可。
