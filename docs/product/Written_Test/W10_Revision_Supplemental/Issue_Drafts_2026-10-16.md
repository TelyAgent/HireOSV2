# Written Test 线上观察问题草稿（2026-10-16）

以下是本轮可见页面证据支持的 3 个 Bug 草稿。2026-10-17 经用户确认后：草稿 1 与已有 [Issue #363](https://github.com/TelyAgent/HireOSV2/issues/363) 重复，已在原 Issue 补充 [W10 截图证据](https://github.com/user-attachments/assets/fc7b1442-ecdb-49c4-ac8e-7da0015709d5)；草稿 2、3 分别提交为 [Issue #397](https://github.com/TelyAgent/HireOSV2/issues/397)、[Issue #398](https://github.com/TelyAgent/HireOSV2/issues/398)，并在评论附图。截图均从线上 Chrome 采集并裁去候选人姓名与邮箱。`Severity` 使用 Issue Form 的 S1–S4；线上构建号、后端记录及用户决策链尚未取得，因此描述只限可见结果，不推断错误发生在哪一层。W10 功能缺口与测试环境阻塞见 [测试报告](Test_Report_2026-10-16.md)，没有用不相关的页面截图包装为已复现 Bug。

## 草稿 1｜任务页身份与全局账号不一致

**标题：** `[Bug] Written Test 任务页显示的登录身份与全局账号不一致`

- **Type / Subsystem / Severity / Risk：** Bug / hireos-written / S3 / medium
- **Problem：** 同一线上页面右上角账号显示“蔡敏”，任务区却写 `Signed in as John · HR Head · Aurora Studio`。页面没有说明 John 是演示角色，用户无法判断任务列表、权限与操作将以哪个身份执行。本地任务页从 demo user 对象读取名字（`TasksPage.tsx:160`），但线上身份映射仍需核实。
- **User Outcome：** 用户能明确区分真实登录账号与演示角色，并知道当前任务和操作所使用的有效身份。
- **Scope：** Written Test 的 My Tasks 身份标签及其与全局账号/实际授权身份的对应说明。
- **Non-goals：** 不在本问题中改写统一 Identity 或授权模型；先核实是否为有意的演示模式。
- **Acceptance Criteria：**
  - **AC-1：** My Tasks 显示的有效操作者与全局账号一致；若为演示角色，明确标注“演示角色”且不称其为真实登录身份。
  - **AC-2：** 任务数据和可执行操作使用的身份在页面上可辨认，不会让用户误以为以另一账号操作。
  - **AC-3：** 自动测试覆盖真实账号与演示角色不同的情况。
- **References：** [W10 测试报告 E02](Test_Report_2026-10-16.md#证据与线上步骤)；[UX/UI 标准 U1、U7](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)。
- **Dependencies：** 核实全局账号与 Written demo role 的预期关系。
- **Reproduction：** 登录线上 Written Test → 打开 My Tasks → 对照右上角账号与任务区 `Signed in as`。
- **Expected / Actual：** 预期账号或演示角色语义一致且清晰；实际同屏出现“蔡敏”与 `Signed in as John`，无解释。
- **Environment：** 2026-10-16 线上 Chrome，`https://hireos.aipollo.me/hireos/written/tasks`；构建 SHA 未知。
- **截图：** [任务页身份对照](/Users/apple/work/HireOSV2/docs/product/Written_Test/W10_Revision_Supplemental/evidence/2026-10-16/01-task-identity.png)。

![任务页右上角账号与 Signed in as 不一致](/Users/apple/work/HireOSV2/docs/product/Written_Test/W10_Revision_Supplemental/evidence/2026-10-16/01-task-identity.png)

## 草稿 2｜已发布结果与关闭原因相互矛盾

**标题：** `[Bug] Written Test 已发布结果未达标却显示关闭原因为 Passed`

- **Type / Subsystem / Severity / Risk：** Bug / hireos-written / S2 / medium
- **Problem：** 同一已发布 Case 的候选人预览写 `This assessment did not meet the bar for this role`、最终分数 5/100；下方 Next action 却写 `Testing closed · Reason: Passed`。这可能是人工作出的不同决定，但页面未说明二者为何不同，招聘者难以判断最终业务结论。
- **User Outcome：** 招聘者能区分“测评分数/候选人收到的结果”与“关闭测评的业务原因”，若两者相反，页面显示决策依据或要求复核。
- **Scope：** Written Test Evaluation result 的已发布结果、关闭原因及解释信息的一致性呈现；核对持久化值和审计记录。
- **Non-goals：** 不根据 5/100 自动改写人工决定，也不改变评分阈值或替用户重做招聘决策。
- **Acceptance Criteria：**
  - **AC-1：** 当发布结果“未达标”而关闭原因选 `Passed` 时，确认前提示冲突，并允许查看或填写理由。
  - **AC-2：** 已存在的冲突记录在回看页清楚显示测评结果、关闭决定与决策说明，不把两者合并成一个含糊的“通过”状态。
  - **AC-3：** 自动测试覆盖一致和相反两种组合，确认 UI 与保存值一致。
- **References：** [W10 测试报告 E04](Test_Report_2026-10-16.md#证据与线上步骤)；[W09 PRD 结果发布](../W09_Result_Release/PRD.md)；[UX/UI 标准 U1、U4](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)。
- **Dependencies：** 读取该 Case 的关闭操作审计记录，确认 `Passed` 的业务定义和是否允许与未达标结果并存。
- **Reproduction：** 线上 My Tasks → Testing closed Case → Evaluation result → 对照 Candidate preview、Final overall 和 Next action。
- **Expected / Actual：** 预期结论一致，或对相反决定显示理由；实际 5/100、未达标与 `Reason: Passed` 同屏出现，无解释。
- **Environment：** 2026-10-16 线上 Chrome；已结束并已发布的真实 Case；构建 SHA 未知。截图已裁去候选人身份。
- **截图：** [结果与关闭原因同屏](/Users/apple/work/HireOSV2/docs/product/Written_Test/W10_Revision_Supplemental/evidence/2026-10-16/02-closed-result-contradiction.png)。

![已发布结果未达标与关闭原因 Passed 同屏](/Users/apple/work/HireOSV2/docs/product/Written_Test/W10_Revision_Supplemental/evidence/2026-10-16/02-closed-result-contradiction.png)

## 草稿 3｜已发布反馈与测评能力领域不符

**标题：** `[Bug] Written Test AI 产品岗位的已发布反馈混入会计与差异分析内容`

- **Type / Subsystem / Severity / Risk：** Bug / hireos-written / S2 / medium
- **Problem：** 已发布结果的四项可见评分标准分别是任务拆解、AI Agent 产品方案、产品交付评测、移动端原型；Candidate preview 的 Feedback 却写 `accounting treatment mostly correct with one gap in variance analysis`。这段财务领域反馈无法由可见评分标准解释，且已作为发布结果保存。无法仅凭 UI 判定它来自 AI 摘要、默认模板还是人工输入。
- **User Outcome：** 候选人和招聘者看到与本轮题目、能力项和实际证据相符的反馈；发布前能发现明显跨岗位内容。
- **Scope：** 结果预览/发布时反馈与当前 Case、题目和评分依据的关联校验；定位错误文本的来源并修正相关数据路径。
- **Non-goals：** 不自动重评该候选人，不假定其分数错误，也不直接改写已经发送的消息。
- **Acceptance Criteria：**
  - **AC-1：** 发布预览的反馈明确关联当前 Case 和本轮评估版本，不复用其他岗位或轮次的摘要。
  - **AC-2：** 当反馈出现与当前题目/能力明显不相关的内容时，发布前提示人工复核，不静默发布。
  - **AC-3：** 自动测试覆盖不同岗位并行评估、切换 Case 与重新打开发布页，确保反馈不串用。
- **References：** [W10 测试报告 E04](Test_Report_2026-10-16.md#证据与线上步骤)；[W09 PRD FR-2、FR-5](../W09_Result_Release/PRD.md)；[UX/UI 标准 U1、U6](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)。
- **Dependencies：** 查询该轮 Evaluation summary、Release feedback 与编辑/发布审计记录，以确认文本来源和影响范围。
- **Reproduction：** 线上 My Tasks → Testing closed Case → Evaluation result → 对照左栏四项 AI 产品能力和右栏 Candidate preview Feedback。
- **Expected / Actual：** 预期反馈解释 AI 产品岗位表现；实际反馈讨论会计处理和差异分析，与可见评分项不匹配。
- **Environment：** 2026-10-16 线上 Chrome；已结束并已发布的真实 Case；构建 SHA 未知。截图已裁去候选人身份。
- **截图：** [评分项与反馈同屏](/Users/apple/work/HireOSV2/docs/product/Written_Test/W10_Revision_Supplemental/evidence/2026-10-16/03-feedback-domain-mismatch.png)。

![AI 产品评分项与财务领域反馈同屏](/Users/apple/work/HireOSV2/docs/product/Written_Test/W10_Revision_Supplemental/evidence/2026-10-16/03-feedback-domain-mismatch.png)
