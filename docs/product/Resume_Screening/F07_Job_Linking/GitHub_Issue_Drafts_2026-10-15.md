# F07 线上测试问题：GitHub Issue 草稿与提交记录

依据：[线上测试报告](Test_Report_2026-10-15.md)、[PRD](PRD.md)、[User Cases](User_Cases.md) 和 [UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)。**六份 Issue 已于 2026-10-15 按用户确认提交 GitHub。** #186、#187 因产品口径未决保留 `AI Ready=No` 并附 `[AI-QUESTION]` 评论；#188～#191 的 AC 已获用户确认，`AI Ready=Yes`。不把 12 条“未验证”写作 12 个线上缺陷。草稿 6 根据用户补充反馈和推荐页代码/线上 E-02 追加。

共同环境：2026-10-15 约 10:06–10:08 CST，Chrome/macOS，`https://hireos.aipollo.me/hireos/screening/` 已登录中文页面。以虚构“测试候选人A”确认一次“AI产品经理”岗位关联。线上构建号、已登录 API/DB、通知、任务审计及多角色会话未知。本地 HEAD `c0e47a6` 只用于静态核对，不等于线上版本。测试证据 E-01～E-06 见报告。

去重：[#138](https://github.com/TelyAgent/HireOSV2/issues/138) 是跨模块权限调查，[#24](https://github.com/TelyAgent/HireOSV2/issues/24) 是身份映射；草稿 1 聚焦 F07 的具体授权行为，依赖/引用二者。[#25](https://github.com/TelyAgent/HireOSV2/issues/25) 已覆盖通用键盘与 toast 无障碍，不重复立项。本次没有发现线上已复现的通知外发、重复 Application、并发失效或 DB 审计缺失。

## 草稿 1 — [Bug] F07 岗位关联操作缺少岗位负责人授权校验

### Type

Bug

### Subsystem

hireos-screening

### Problem

F07 PRD §6 要求仅岗位负责人 Recruiter/TA 或 Hiring Manager 能确认推荐，HR Approver 与 Viewer 不得确认。当前仓库的 `linking.controller.ts` 对 `POST recommendations/:id/confirm-link` 仅使用 `WorkspaceGuard`；`linking.service.ts` 确认路径检查工作区、岗位、候选人和版本，但未见角色或岗位负责人判断。前端 `JobRecommendationsPage.tsx` 对 proposed 推荐按状态展示确认、拒绝、暂缓操作，也未见负责人过滤。该缺口**仅由当前仓库静态确认**；未用低权限线上账号复现越权，不声称生产环境已发生越权。F07 测试报告 UC-F07-12～15 因缺角色证据未验证。

### User Outcome

只有该岗位的授权负责人能确认、拒绝或暂缓推荐；其他角色可按既定权限查看，但无法通过界面或直接 API 改变关联状态。每次操作可追溯到真实操作者。

### Scope

F07 推荐确认、拒绝、暂缓及人工另选岗位动作的服务端岗位范围与角色授权；界面动作可见性/禁用理由；Recruiter、岗位负责人 HM、非负责人 HM、HR Approver、Viewer 的自动化与隔离环境 API 验证。需要先对齐 #24 的真实身份和岗位负责人标识。

### Non-goals

调整 F02 受限内容权限（#21）、重构全站权限（#138）、更改岗位负责人分配规则、迁移历史身份数据、在线上真实候选人资料上做越权试验。

### Acceptance Criteria

AC-1：使用两名位于同一工作区、分别为岗位负责人和非负责人的测试账号，对同一有效推荐调用确认接口；负责人成功，非负责人返回 403，非负责人调用后推荐、Application、LinkDecision 和任务数量均不变。自动 API 测试覆盖。

AC-2：对拒绝、暂缓和人工另选岗位执行同样的负责人范围校验；非负责人、HR Approver、Viewer 的直接 API 写请求均返回 403，且无持久化副作用。自动 API 测试覆盖。

AC-3：Recruiter/TA 与 Hiring Manager 担任该岗位负责人时都可完成授权操作；非负责人界面不提供可执行写操作，若展示禁用态则说明原因。浏览器角色用例覆盖正反两侧。

AC-4：授权写入记录的操作者 ID 与登录身份一致，审计可显示该人的姓名/标识；重复或失败请求不能留下误导性的成功审计。与 #24 的身份契约一起验证。

### References

`docs/product/Resume_Screening/F07_Job_Linking/PRD.md` §6、BR-5、AC-3；同目录 `User_Cases.md` UC-F07-12～15、`Test_Report_2026-10-15.md` §3/5；`hireos-screening/hireos-screening-backend/src/linking/linking.controller.ts`、`linking.service.ts`、`hireos-screening/hireos-screening-front/src/pages/JobRecommendationsPage.tsx`。

### Dependencies

Refs #24、#138；角色与岗位负责人 ID 的正式映射须先明确。#21 只覆盖受限内容，不替代本 Issue。

### Risk

high

### Owner

@JsonSuCoder

### AI Ready

No

### Reproduction

当前为**静态复现步骤**：检查 `linking.controller.ts` 确认端点的 guard，沿调用进入 `linking.service.ts`，再检查前端 proposed 推荐动作条件。线上复现尚未执行；需建立同工作区不同岗位范围的隔离账号，按 AC-1/2 调用 API 并核对 DB/审计。静态观察 1/1；线上频率未知。

### Expected / Actual

预期：按真实角色及岗位负责人范围执行服务端授权，未授权写入返回 403 且无副作用。当前仓库实际：确认路径只见工作区/状态/版本检查，未见角色与岗位负责人检查；线上行为未知。

### Environment

共同环境见文件首段；本地 HEAD `c0e47a6` 为静态证据，不代表线上构建。无低权限在线请求、DB 或审计响应。

### Severity

S2

## 草稿 2 — [Bug] F07 关联后的人工状态与验收用词不一致

### Type

Bug

### Subsystem

hireos-screening

### Problem

F07 PRD FR-4、AC-4 和 User Journey 步骤 3 规定关联后人工状态为“等待推进”。线上 E-04 成功提示“已进入初筛队列”，E-05 初筛详情为“待人工复核”，E-06 岗位工作台为“待复核”。这些文字均没有写“已推进”，但未用同一状态词解释关联、AI 初筛与人工下一步的关系，用户可能误以为“进入初筛队列”已完成推进。本问题是**线上可见文案不一致**，不推断底层状态字段错误。

### User Outcome

Recruiter 关联后能从推荐页、岗位工作台和初筛详情明确知道候选人已关联、AI 初筛状态，以及人工尚需做的下一步决定。

### Scope

统一 F07 关联后的人工状态名称与说明；同步推荐页成功反馈、初筛详情、岗位工作台及相关任务入口；覆盖自动筛选未开始、运行中、完成与失败状态的文案回归。

### Non-goals

更改 F08 评分、F11 决策规则、Application 数据模型；在关联时自动推进、邀请或通知候选人。

### Acceptance Criteria

AC-1：确认关联后且尚无人工下一步决定时，推荐页、岗位工作台、初筛详情对**人工状态**使用同一经批准的术语，并明确“已关联，尚待人工决定下一步”；AI 初筛状态作为独立信息展示。浏览器测试覆盖刷新前后。

AC-2：初筛自动运行完成、失败或未开始时，人工状态仍不显示为“已推进”；只有提交 F11 人工推进决定后才出现已决策状态。自动化用例覆盖各状态转换。

AC-3：成功反馈提供可进入当前申请/初筛的下一步入口，并显示所需处理动作；中英文文案含义一致。

### References

`docs/product/Resume_Screening/F07_Job_Linking/PRD.md` FR-4、AC-4；同目录 `User_Journey.md` 步骤 3、`Test_Report_2026-10-15.md` E-04～E-06/UX-F07-01；`docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md` U1/U4/U5；`hireos-screening/hireos-screening-front/src/pages/ScreeningWorkspacePage.tsx`、`ScreeningDetailPage.tsx`、`data/i18n.ts`。

### Dependencies

需 Owner 确认最终业务状态词：沿用 PRD 的“等待推进”，或将 PRD 和用例统一改为“待人工复核”。若涉及任务入口，Refs #18。

### Risk

low

### Owner

@JsonSuCoder

### AI Ready

No

### Reproduction

打开测试报告中的虚构候选人推荐页，确认其与 AI产品经理岗位的关联；查看成功 toast、申请初筛页及岗位工作台。E-04～E-06 记录了上述三种用词。本次线上观察 1/1，未核对 API/DB 状态。

### Expected / Actual

预期：人工状态一致且与 AI 初筛状态区分，清楚指向下一步人工决定。实际：成功 toast 写“进入初筛队列”，详情写“待人工复核”，列表写“待复核”，PRD 指定“等待推进”。

### Environment

共同环境见文件首段；测试对象与页面链接见 `Test_Report_2026-10-15.md` E-04～E-06；线上构建号未知。

### Severity

S3

## 草稿 3 — [Bug] F07 确认成功后推荐卡短暂保留待确认状态和操作

### Type

Bug

### Subsystem

hireos-screening

### Problem

线上一次确认提交后，成功 toast 已出现，但推荐卡仍短暂显示“待确认”及确认、拒绝、暂缓按钮；刷新后才显示“已确认”。同一页面在这一窗口内给出相互矛盾的成功/待处理信号，用户可能再次点击或改变推荐状态。报告 UX-F07-03，截图记录了成功 toast 与旧卡片并存。当前仓库 `ConfirmLinkModal.confirm` 先 `say(...)` 再调用 `onConfirmed(app.id)`，而详情通过异步 `load()` 重新拉取，符合这一可见时序；不据此推断服务端重复创建数据。

### User Outcome

点击确认后，用户只看到一个明确的处理中或已确认状态，不会在成功提示后继续看到可操作的旧推荐。

### Scope

确认提交后的推荐卡状态同步及按钮禁用、失败时恢复与重试；覆盖缓慢网络和重复点击的前端回归。

### Non-goals

改变服务端 Application 唯一约束、并发事务规则、F08 自动筛选行为。

### Acceptance Criteria

AC-1：用户确认后至服务端响应前，当前推荐的确认、拒绝和暂缓操作不可再次触发，页面显示明确处理中状态；自动 UI 测试以延迟响应验证。

AC-2：成功响应后，成功反馈与推荐卡状态一致；无需手动刷新即可显示“已确认”和打开申请/初筛入口，不再显示确认、拒绝或暂缓动作。自动 UI 测试验证。

AC-3：若请求失败，保留待处理推荐与用户已填原因，展示可理解的错误和重试入口；没有成功反馈。自动 UI 测试覆盖网络失败及过期推荐。

### References

`docs/product/Resume_Screening/F07_Job_Linking/Test_Report_2026-10-15.md` E-04、UX-F07-03；同目录 `PRD.md` FR-4、AC-5；`hireos-screening/hireos-screening-front/src/pages/JobRecommendationsPage.tsx` 的 `ConfirmLinkModal.confirm`、`load()` 和推荐卡条件；`docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md` U4/U5/U9。

### Dependencies

None；与 #187 同时修改成功态文案时需协调，但验收可独立完成。

### Risk

low

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

从虚构测试候选人的待确认推荐进入确认弹窗并提交；在出现成功 toast 时立即查看推荐卡，仍显示待确认及旧按钮；稍后刷新页面变为已确认。本次线上观察 1/1，未测试不同网络延迟的频率。截图：`docs/product/Resume_Screening/F07_Job_Linking/Evidence_F07_Confirmed_2026-10-15.png`，报告 E-04。

### Expected / Actual

预期：成功提示与卡片业务状态同步，成功后无重复操作入口。实际：成功 toast 与旧“待确认”卡片短暂并存；刷新后状态正确。

### Environment

共同环境见文件首段；Chrome/macOS，线上构建号未知；未读取接口响应及 DB。

### Severity

S3

## 草稿 4 — [Design] F07 推荐文字等级缺少含义解释

### Type

Design

### Subsystem

hireos-screening

### Problem

UC-F07-01 写“显示置信度”；线上 E-02 显示 `Strong match signal`，但页面没有解释该文字等级代表什么、依据何在以及它不等于人工关联决定。当前仓库 `confidenceLabel()` 将内部数值映射到文字等级。用户已决定**保留文字等级并补解释，不显示具体数值或百分比**。本问题是解释与验收口径缺失，不能将当前文字等级本身判为错误。

### User Outcome

招聘人员能理解 AI 推荐信号的含义和局限，产品与测试对“置信度”的验收口径一致。

### Scope

保留现有文字等级，补充等级含义、依据与 AI 建议边界的可见解释；同步 F07 PRD、User Cases、UI 状态与中英文术语；对信号缺失、人工添加和不符合资格状态定义展示。

### Non-goals

显示具体置信数值或百分比；改动匹配模型和评分算法；把 AI 推荐信号当成人工录用或推进决定。

### Acceptance Criteria

AC-1：F07 推荐卡继续显示文字等级，不显示具体置信数值或百分比；用户能在同一页面获得简短解释，说明等级反映当前档案与岗位标准的匹配证据强弱，不代表已关联、已推进或录用结论。

AC-2：一般推荐、证据不足、人工添加和不符合资格四种状态均有准确的文字等级或非等级提示，并能查看其含义；自动 UI 测试逐一核对，不以内部数值代替页面解释。

AC-3：F07 PRD 与 UC-F07-01 将“置信度”明确为文字等级及解释；在常用桌面宽度和 200% 缩放下，等级、解释、理由与关键未知项可读，不依赖颜色单独传达含义。

### References

`docs/product/Resume_Screening/F07_Job_Linking/User_Cases.md` UC-F07-01；同目录 `Test_Report_2026-10-15.md` E-02/UX-F07-02；`hireos-screening/hireos-screening-front/src/lib/scoring.ts` `confidenceLabel()`；`docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md` U1/U5/U7/U10。

### Dependencies

展示口径已由用户决定：保留文字等级并补解释。无其他已知前置 Issue；AC 已获用户确认。

### Risk

low

### Owner

@JsonSuCoder

### AI Ready

Yes

### User Flow

Recruiter 打开候选人的职位推荐页，看到岗位、文字等级、简短解释、理由和关键未知项，理解信号只用于决定是否纳入岗位考虑；人工添加或证据不足时显示不同状态，不暗示已确认关联。

### Target Platforms

桌面 Web 优先；覆盖常用桌面宽度和浏览器 200% 缩放。移动端专门交互不在本 Issue 范围。

### Component Constraints

沿用现有推荐卡、徽标与文字体系；状态不能仅靠颜色区分；信号说明应可键盘聚焦/读屏读取。

### UI States

loading：信号仍在计算时标明处理中。empty/unknown：证据不足时不显示确定等级。error：信号不可用时保留理由与可恢复动作。permission：无权查看的字段不下发；本 Issue 不决定新权限规则。另覆盖人工添加和不符合资格。

### Design Handoff

用户已确认保留文字等级并补解释。后续在 `docs/design/189/` 交付 `design-spec.md`、`states.md` 及必要的 handoff；当前尚无设计资产。

## 草稿 5 — [Tech Debt] F07 缺少可执行的隔离验收数据与跨层自动验证

### Type

Tech Debt

### Subsystem

hireos-screening

### Problem

F07 报告 15 条用例中 12 条未验证，主要因为文档定义的 `S_dataset`、`S_linked`、`S_job_closed`、角色账号、通知 mock、并发及 `llm_fail` 注入条件在本次线上测试中不可用。当前仓库未找到 F07 专项自动测试。由此无法证明通知为零、任务/审计持久化、重复与并发唯一、角色 403 或自动筛选失败不回滚；这些是**验证缺口，不是已复现产品失败**。

### User Outcome

开发者能在隔离环境一键建立虚构 F07 前置状态，并运行覆盖 PRD AC-1～6 的 UI、API、DB、审计和通知断言；报告可明确区分通过、失败与未执行。

### Scope

可重复且可清理的虚构 seed；测试角色与岗位负责人配置；通知 stub、自动筛选失败注入；F07 关键路径的后端自动测试及必要浏览器测试；输出测试命令、环境与断言证据。

### Non-goals

在生产环境故障注入或制造并发负载；使用真实候选人数据；以测试脚本代替#186 的权限修复；改变产品行为或 PRD 验收规则。

### Acceptance Criteria

AC-1：隔离环境可重复生成 `S_dataset`、`S_linked`、`S_job_closed`、过期推荐及两名不同岗位权限账号；重复执行 seed 不累积真实或测试 Application，清理后恢复基线。自动测试核对。

AC-2：确认、拒绝、暂缓、多岗位、重复/双击、并发、关闭/过期、负责人正反权限、自动筛选失败路径均有可执行断言；至少核对 UI/API 与 DB 结果，涉及通知和任务的路径同时核对 mock/审计。用例 ID 对齐 UC-F07-01～15。

AC-3：测试报告输出每条用例的实际命令、退出码、环境版本、证据位置和未覆盖原因；不能把未运行或仅静态阅读写作通过。

### References

`docs/product/Resume_Screening/F07_Job_Linking/PRD.md` AC-1～6；同目录 `User_Cases.md`、`Loop_IO.md` §3～4、`Test_Report_2026-10-15.md` §3/4/6；`hireos-screening/hireos-screening-backend/package.json`、`hireos-screening/hireos-screening-front/package.json`。

### Dependencies

Refs #24、#138；权限用例的产品语义须与#186 及身份决定一致。隔离通知和故障注入设施可独立先建。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Technical Evidence

报告 UC-F07-03～06、08～15 等 12 条标为未验证；F07 文档定义了 seed 与注入点，但本次线上环境缺少相应隔离账号、mock 和 DB/审计访问；静态搜索未找到 `hireos-screening/hireos-screening-backend/test` 中 F07 linking 专项用例。本 Issue 只解决可执行验证与证据缺口，不能预判实现一定通过。

### Compatibility / Rollback

测试 seed、通知 stub 与故障注入只在隔离测试环境启用，不能对生产配置或数据生效；不改变产品 API/DB 契约。回滚为移除测试配置与种子，隔离环境重新初始化；已有生产关联不受影响。

## 草稿 6 — [Bug] F07 职位推荐页缺少查看候选人资料的稳定入口

### Type

Bug

### Subsystem

hireos-screening

### Problem

职位推荐页只显示岗位、AI 理由与关键未知项，没有明确的“查看候选人档案/简历”入口。页面顶部仅有历史返回箭头；`PageHeader` 使用 `useGoBack()`，从岗位工作台进入时返回会先回岗位工作台，不保证到该候选人档案。审核人缺少稳定路径核对工作经历、技能和简历版本，难以独立判断是否应关联。线上 E-02 可见页面入口缺失；用户于 2026-10-15 补充指出该问题。当前候选人档案可显示结构化资料和简历版本名称，但原始简历阅读能力不在本问题中臆定为已有。

### User Outcome

审核人在决定确认、拒绝或暂缓推荐前，能从当前推荐直接查看对应候选人的简历/档案信息，再返回同一推荐继续处理。

### Scope

推荐页为当前候选人提供明确、可识别的资料入口；查看已存在的档案信息与可用简历版本；返回时保留候选人、岗位和推荐状态；入口遵守现有候选人资料权限。覆盖从候选人档案、岗位工作台与直达链接进入推荐页的路径。

### Non-goals

重做候选人档案解析或原文定位（见 #155）；改变 AI 推荐理由、评分或关联决定规则；向无权角色增加候选人资料可见性。

### Acceptance Criteria

AC-1：待确认或暂缓推荐页有明确的“查看候选人档案/简历信息”入口；点击后打开**当前推荐对应**候选人的可用资料，包括工作经历、技能与简历版本信息，不依赖历史返回箭头查找候选人。

AC-2：审核人查看资料后可返回同一候选人、同一岗位的推荐继续确认、拒绝或暂缓；从候选人档案、岗位工作台及直达链接进入时均成立，未提交的关联决定不因查看资料而改变。

AC-3：如果只有结构化档案而无可阅读的原始简历，入口和目标页明确说明可查看的资料范围，不把文件名当作可阅读简历；无权查看资料的角色不能通过该入口获得额外数据。自动浏览器测试覆盖有文件、仅结构化档案和无权限状态。

### References

`docs/product/Resume_Screening/F07_Job_Linking/PRD.md` FR-1、BR-5；同目录 `Test_Report_2026-10-15.md` E-02/UX-F07-04；`docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md` U6～U8；`hireos-screening/hireos-screening-front/src/pages/JobRecommendationsPage.tsx`、`CandidateProfilePage.tsx`、`src/lib/navigation.ts`。

### Dependencies

Refs #155：原文定位/阅读能力若需扩展由该 Issue 处理；本 Issue 保证 F07 进入现有可用资料并准确标注范围。角色可见性与#186 保持一致。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

从岗位工作台打开虚构测试候选人的推荐页：页面展示 AI 理由与未知项、关联处理按钮，但没有“查看候选人档案/简历”入口；仅有“返回”箭头。按返回时路径依赖浏览历史，从岗位工作台进入会先回工作台。线上 E-02 的入口缺失已观察；不同进入路径的返回行为由当前代码静态核对，仍需浏览器回归。

### Expected / Actual

预期：审核人可在推荐处理流程中稳定查看该候选人的资料，并回到原推荐作决定。实际：推荐页没有明确资料入口；历史返回不能保证进入候选人档案。

### Environment

共同环境见文件首段；线上页面 `https://hireos.aipollo.me/hireos/screening/candidates/fb1c62b1-40d1-4396-9374-2b51845e1497/jobs`；线上构建号未知。工作区代码只用于核对导航方式。

### Severity

S2

## 已提交的 Issue

1. [#186 岗位关联操作缺少岗位负责人授权校验](https://github.com/TelyAgent/HireOSV2/issues/186) — `AI Ready=No`；待确认身份与岗位负责人映射。
2. [#187 关联后的人工状态与验收用词不一致](https://github.com/TelyAgent/HireOSV2/issues/187) — `AI Ready=No`；待确认统一状态词。
3. [#188 确认成功后推荐卡短暂保留待确认状态和操作](https://github.com/TelyAgent/HireOSV2/issues/188) — `AI Ready=Yes`。
4. [#189 推荐文字等级缺少含义解释](https://github.com/TelyAgent/HireOSV2/issues/189) — `AI Ready=Yes`。
5. [#190 缺少可执行的隔离验收数据与跨层自动验证](https://github.com/TelyAgent/HireOSV2/issues/190) — `AI Ready=Yes`。
6. [#191 职位推荐页缺少查看候选人资料的稳定入口](https://github.com/TelyAgent/HireOSV2/issues/191) — `AI Ready=Yes`。
