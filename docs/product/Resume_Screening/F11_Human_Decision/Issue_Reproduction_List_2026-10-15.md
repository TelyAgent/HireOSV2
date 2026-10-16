# F11 问题清单与详细复现步骤（2026-10-15）

来源：[F11 线上测试报告](Test_Report_2026-10-15.md)。本清单整理报告中的 **4 项线上可见问题**和 **5 项本地代码风险**。代码风险给出隔离测试环境的验证步骤，**尚未在线上复现**；没有把未执行的 AC 或用例写成产品缺陷。尚未创建 GitHub Issue。

## 复现环境与约定

- 线上入口：[HireOS 简历筛选](https://hireos.aipollo.me/hireos/screening/)，测试时为中文界面，页头显示“蔡敏”。页面说明数据、外发和模型调用均为模拟；线上构建号和服务端角色未取得。
- 只使用虚构候选人。已有测试记录：[测试候选人A 的决定](https://hireos.aipollo.me/hireos/screening/applications/3e7383e3-c838-425b-8df9-87365843299e/decision)、[Ben Test 的决定](https://hireos.aipollo.me/hireos/screening/applications/a5608ced-7da3-4a5c-9d33-23f00b25ef0d/decision)。这两条决定已提交并保留；复现只需查看时不要再次创建。
- 若需重新走提交主流程，使用**新的虚构候选人和隔离岗位**。不要通过撤回已有决定来重置共享数据，也不要对真实候选人提交决定或通知。
- 文中“线上实际”仅指 2026-10-15 的浏览器 UI 观察；服务端持久化、角色权限、真实外发与下游结果需要独立证据。

## 一、线上已复现的问题

### 1. F11-UX-01 · P1 · 拒绝通知发送前没有正文和收件对象预览

**依据**：F11 PRD FR-9、BR-11、AC-4；User Journey 步骤 5～6；UC-F11-05/06；测试报告 E-04/E-05。  
**前置条件**：已登录演示环境；虚构 Ben Test 已在“AI产品经理 / 北京”岗位上提交“不予推进”决定。现有[决定页](https://hireos.aipollo.me/hireos/screening/applications/a5608ced-7da3-4a5c-9d33-23f00b25ef0d/decision)可直接查看。

**复现步骤**：

1. 打开上述 Ben Test 决定页，等待页面加载完成；确认顶部结果为“不予推进”，下方有“发送候选人婉拒通知”按钮。
2. 点击“发送候选人婉拒通知”，停在弹窗，不点击“发送通知”。
3. 检查弹窗是否显示具体收件对象、发送通道、主题/模板及候选人实际会收到的正文，并检查是否能在发送前发现内部评语或排序信息。
4. 点击“取消”，确认仍停留在已记录的决定页；本步骤不产生通知。

**预期**：先预览实际接收人和最终通知内容，再由用户单独确认发送；预览中不含内部评语、排名。  
**线上实际**：弹窗只显示“这是向候选人发送的一条单独、显式的通知，不会改变已记录的决策或已生成的任何报告。”，随后就是“发送通知”按钮，没有收件人或正文预览。见[弹窗截图](Evidence_F11_Notice_2026-10-15.png)。测试人员点击取消，**未发送通知**。  
**影响**：用户无法在最后确认前检查发给谁、发什么，AC-4 的“预览后确认”失败。  
**修复验收**：用新的 `example.com` 虚构候选人提交 Reject；打开通知入口，核对实际收件人、通道和正文；取消后通知 mock 为 0；确认后通知 mock 恰有 1 条，正文不含内部评语和排序，决定本身不改变。当前缺通知 mock 权限，发送与零外发断言**尚未验证**。

### 2. F11-UX-02 · P1 · 决定详情的“决策人”为空

**依据**：F11 PRD FR-5、数据要求；User Journey 步骤 3～5；测试报告 E-03/E-04/E-06。  
**前置条件**：已登录演示环境；测试候选人A 的 Hold、Ben Test 的 Reject 已存在。

**复现步骤**：

1. 打开[测试候选人A 的决定页](https://hireos.aipollo.me/hireos/screening/applications/3e7383e3-c838-425b-8df9-87365843299e/decision)。
2. 等待加载完成，找到结果、理由、`决策人：`、日期和 `状态：` 所在行。
3. 刷新页面，待加载完成后再次检查 `决策人：` 后是否有可识别姓名或账号。
4. 打开[Ben Test 的决定页](https://hireos.aipollo.me/hireos/screening/applications/a5608ced-7da3-4a5c-9d33-23f00b25ef0d/decision)，重复步骤 2～3。

**预期**：两条决定均显示实际决定人及时间；其他有权负责人查看时仍能识别决定人，展示身份与审计 actor 一致。  
**线上实际**：两页的 `决策人：` 后均为空，日期与 `Approved` 有值；刷新后仍为空。见[Hold 截图](Evidence_F11_Hold_2026-10-15.png)、[Reject 截图](Evidence_F11_Reject_2026-10-15.png)。  
**影响**：复核者无法从决定页知道谁作出决定。  
**修复验收**：用隔离测试账号分别提交、刷新、跨负责人查看，并以只读 API/DB 核对 `actorId` 与显示身份映射。本地前端通过 `db.people[decision.decidedBy]?.name` 展示决定人，服务端返回 `actorId`；见 [`DecisionPage.tsx`](../../../../hireos-screening/hireos-screening-front/src/pages/DecisionPage.tsx) 与 [`decisions.service.ts`](../../../../hireos-screening/hireos-screening-backend/src/decisions/decisions.service.ts)。此代码线索不证明线上根因。

### 3. F11-UX-03 · P1 · 已知地点硬冲突没有进入决定摘要

**依据**：F11 PRD FR-3、FR-7、AC-8；User Journey 步骤 1/8；测试报告 E-01 与 F11-UX-03。此项涉及 F06 推荐、F08 评估和 F11 决定之间的信息传递。  
**前置条件**：使用新的虚构测试候选人，档案明确写：`Current location: Singapore. Singapore remote only. Cannot relocate to Beijing or any other city.`，并补充约 4～5 年 AI 产品经理、Agent/RAG 经验以触发相关北京岗位推荐。岗位为开放中的“AI产品经理 / 北京”，标准已确认。已有 [Ben Test 推荐页](https://hireos.aipollo.me/hireos/screening/candidates/e571c2d9-ce4d-42e9-b3aa-0f2d975a1d87/jobs)可只读复核原始证据；Ben 的决定已提交，不能再用其重新打开初始表单。

**复现步骤**：

1. 在简历库用“粘贴档案”新增上述**纯虚构**输入（姓名加 `[UJ-TEST]`，如需邮箱只用 `example.com`）；等待岗位发现完成。
2. 打开该候选人的职位推荐页，找到“AI产品经理 / 北京”推荐；记录理由和关键差距中是否明确识别不能搬迁北京。
3. 在该推荐卡点击“确认职位关联”，核对候选人和岗位后确认；等待自动初筛完成。
4. 打开该申请的初筛页，记录“资格状态”“AI 推荐”“主要顾虑”“待核实事项”。
5. 点击“决定下一步”，在**尚未选择结果、尚未提交决定**的初始页面检查资格、AI 建议及“未处理顾虑”全文。
6. 将推荐页的地点冲突与初筛页、决定页逐项对照：是否出现“不符合北京地点条件”、是否要求例外、是否仍建议推进。停止在查看阶段，不对该新候选人作推进决定。

**预期**：明确不满足的岗位硬条件在推荐、评估、决定三处一致可见；决定页不能把地点冲突隐藏为普通“信息缺失”，人工若要越过底线应进入有效例外审批。  
**线上实际（原 Ben 样本）**：推荐页明确写“无法搬迁北京、仅接受新加坡远程”，但新评估显示“需要核实 / 推进”；决定页只列“产品经验/跨团队推动”和“逻辑与系统设计”两项顾虑，没有地点冲突。原 Ben 已被本轮拒绝，复现初始决定页需新 seed。  
**影响**：负责人只看决定页时会漏掉最关键的已知硬冲突，可能错误推进。  
**修复验收**：同一虚构输入跨三页一致显示已知不合格原因；缺证据与明确不满足分开；如选择推进，需先出现待双人批准的例外提案。需 API/DB 核对结构化资格与 concern 来源，才能最终确定缺失发生在 F06、F08 还是 F11。

### 4. F11-UX-04 · P2 · 中文界面把 Hold/Reject 的状态写为 `Approved`

**依据**：UX/UI 标准 U1、U5；F11 PRD FR-12 对待审批提案与已推进状态的区分；测试报告 E-06。  
**前置条件**：已登录中文界面；两条现有测试决定可访问。

**复现步骤**：

1. 打开[测试候选人A 的决定页](https://hireos.aipollo.me/hireos/screening/applications/3e7383e3-c838-425b-8df9-87365843299e/decision)，确认结果为“暂缓”、页面提示“不交接到下游环节”。
2. 查看理由下方的 `状态：`，记录显示词。
3. 打开[Ben Test 的决定页](https://hireos.aipollo.me/hireos/screening/applications/a5608ced-7da3-4a5c-9d33-23f00b25ef0d/decision)，确认结果为“不予推进”，重复检查状态。

**预期**：中文业务状态清楚区分“决定已记录”“待审批”“已交接”等，不让 Hold/Reject 看起来像推进被批准。  
**线上实际**：两条决定均显示英文 `Approved`。见[Hold 截图](Evidence_F11_Hold_2026-10-15.png)和[Reject 截图](Evidence_F11_Reject_2026-10-15.png)。  
**影响**：跨角色查看时，可能误把已记录的 Hold/Reject 理解为已批准推进。  
**修复验收**：分别创建 Hold、Reject、待例外审批、已批准推进、已交接五种隔离状态，核对结果标签和状态标签使用明确中文词且互不混淆。

## 二、本地代码风险：隔离环境验证步骤

以下风险均来自测试报告 §5 的代码观察。**不要直接在共享线上环境用 API 探测或制造例外、并发及虚假通知。** 使用独立 workspace、虚构申请、独立角色身份和可读取的 DB/审计/通知 mock 验证后，再决定是否建 Bug Issue 或合并到已有 #20/#26/#27。

### 5. F11-CODE-01 · 单人通过 `exceptionApproved` 同时生成 HR 与 HM 批准

**代码线索**：[`DecisionsService.record`](../../../../hireos-screening/hireos-screening-backend/src/decisions/decisions.service.ts) 的 `exceptionApproved` 分支将同一 `identity.actorId` 写入 `hr` 和 `hiring_manager` 两行；前端“批准例外并提交”直接向记录接口传 `exceptionApproved=true`。**线上未验证**。  
**隔离复现步骤**：

1. 建立岗位策略 `assessmentDisposition=required`，使虚构申请没有已完成测评；由 `recruiter_a` 负责该岗位。
2. 以 `recruiter_a` 打开决定页，选“推进 → 进入面试”，填理由，勾选“申请例外”。
3. 在“批准例外”确认框点击提交；记录决定及例外 ID。
4. 查询该决定的 `DecisionExceptionApproval`，逐行比较 `role`、`actorId`、决定版本，并核对是否已有下游交接。

**应有结果**：先成为待批准提案；发起人不能批准；只有不同的 `hm_a` 与 `approver_a` 分别批准同一版本后才交接。  
**代码预示结果**：单次 `recruiter_a` 操作可能写入两种角色的批准，且两行 `actorId` 相同。此项对应 PRD AC-5 与既有 #20；需要隔离实测及线上版本比对。

### 6. F11-CODE-02 · 没有当前评估时仍可能记录决定

**代码线索**：`record` 查询 `freshness='current'` 的评估，但创建决定时使用 `evaluationId: currentEvaluation?.id`，未在为空时拒绝。**线上未验证**。  
**隔离复现步骤**：

1. 在隔离 workspace 造一个有效虚构 Application，确保没有 `freshness=current` 的 ScreeningEvaluation，或把其唯一评估标为 stale。
2. 以有权限的岗位负责人从 API 测试工具调用 `POST applications/:id/decisions`，请求体使用 `{"outcome":"hold","nextStepTarget":"record_only","reason":"[UJ-TEST] stale guard"}`。
3. 记录 HTTP 状态、返回决定 ID；查询 ScreeningDecision 的 `evaluationId`、评估版本和审计记录。

**应有结果**：基于过期或缺失评估的决定按产品策略明确拒绝或进入被批准的旧依据分支；不能产生未绑定评估版本的有效决定。  
**代码预示结果**：Hold 等路径可能创建 `evaluationId=null` 的决定。推进路径也需单独核验。产品尚未确定旧依据批准人，不能擅自用“允许”解释空版本。

### 7. F11-CODE-03 · 第二次提交可能静默返回已有决定而不提示冲突

**代码线索**：`record` 发现已存在 `status='approved'` 的决定时，直接序列化并返回已有对象，没有显式冲突响应。**线上未验证**。  
**隔离复现步骤**：

1. 为新虚构申请准备一份当前评估，由 `recruiter_a` 成功提交 Hold，记下决定 ID、理由和版本。
2. 在另一个有权会话仍显示旧表单的情况下，尝试对同一 Application 提交与第一人相反的结果，例如 Advance + `record_only`，填写不同理由。
3. 记录第二次请求 HTTP 状态、响应决定 ID/结果、第二位用户看到的提示；查询决定表是否新增或覆盖记录。
4. 在双会话同时点击提交的独立测试中再重复一次，检查竞态下是否仅有一条有效决定。

**应有结果**：第二位用户明确看到“已有决定/版本冲突”，不会误以为自己提交的结果生效；没有最后写入覆盖或重复有效决定。  
**代码预示结果**：顺序第二次请求可能返回第一次决定且为成功响应；真正并发行为还要依赖 DB 约束和竞态测试，不可仅凭代码推断。

### 8. F11-CODE-04 · 拒绝通知接口没有在方法中校验 Reject 状态

**代码线索**：`sendDeclineNotice` 只查工作区内 Application 是否存在，随后写审计并返回成功；没有查询已批准的 `do_not_advance` 决定。**线上未验证**。  
**隔离复现步骤**：

1. 准备两条虚构申请：一条没有决定，另一条仅有 Hold。
2. 以有权测试身份分别调用 `POST applications/:id/decline-notice`。
3. 记录 HTTP 状态、返回体及 `candidate_decline_notice_requested` 审计记录；确认两条申请均无 Reject。

**应有结果**：接口拒绝未 Reject 的申请，不生成通知或成功审计。  
**代码预示结果**：只要 Application 存在就可能返回 `succeeded` 并写入通知请求审计。前端隐藏按钮不能代替服务端检查。

### 9. F11-CODE-05 · 拒绝通知请求返回成功，但当前方法只写审计

**代码线索**：`sendDeclineNotice` 写 `candidate_decline_notice_requested` 后返回 `{status:'succeeded'}`，在此方法中未见通知内容生成、队列投递或 mock 消息；前端成功提示为“Decline notice sent (demo)”。**线上未验证**。  
**隔离复现步骤**：

1. 为 `example.com` 虚构候选人准备一条已批准的 Reject 决定，清空隔离通知 mock 的该申请记录。
2. 从决定页单独执行“发送候选人婉拒通知”，或以授权测试工具调用相应接口一次。
3. 比对返回状态、请求审计、通知记录/队列/mock 消息的数量、收件人和正文。
4. 对同一决定再调用一次，核对是否能阻止重复通知或提供清晰的再次发送状态。

**应有结果**：成功状态对应可审计的 1 条实际通知或明确的模拟外发记录；内容可预览且不含内部评语/排序；重复操作遵守已定义的幂等规则。  
**代码预示结果**：可能只有“已请求”的审计，却向 UI 返回成功；不能据此断言线上真的没发通知，需确认部署版本和是否有其他订阅处理器。

## 三、覆盖缺口与数据状态

以下是**待验证条件，不是已复现问题**：AC-2 旧评估阻断与重评、AC-3 required/optional 笔试策略、AC-5 独立 HM/HR 审批、AC-6 并发、AC-7 批量部分失败；UC-F11-14 已交接撤回的下游更正、UC-F11-15/16 权限 API 403、UC-F11-17 双击幂等，以及通知 mock、任务、审计、200% 缩放和完整键盘路径。具体所需 seed、角色和证据见[测试报告 §7](Test_Report_2026-10-15.md)。

本轮已留在演示环境供复核的记录为测试候选人A 的 Hold、Ben Test 的职位关联和 Reject。没有发送婉拒通知；没有执行撤回、例外批准或下游交接。本清单仅新增本地文档，没有提交/推送代码，也没有创建或关闭 Issue。
