# F11 线上测试问题：GitHub Issue 提交记录（2026-10-15）

来源：[测试报告](Test_Report_2026-10-15.md)、[详细复现清单](Issue_Reproduction_List_2026-10-15.md)、[F11 PRD](PRD.md)及 [UX/UI 标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)。用户确认后已创建 5 张新单，并向 2 张既有 Issue 补充评论；下方保留提交时的草稿内容。#214 已提交为 `AI Ready=Yes`，其余新单因产品规则或依赖待决而提交为 `No`，均有 `needs-triage` 和 `[AI-QUESTION]` 评论。

## 覆盖与去重

| 测试问题 | 拟提交位置 | 当前证据性质 |
|---|---|---|
| F11-UX-01 通知缺预览 | 新单 A / [#212](https://github.com/TelyAgent/HireOSV2/issues/212) | 线上 UI 已复现 |
| F11-UX-02 决策人为空 | 现有 [#24 补充评论](https://github.com/TelyAgent/HireOSV2/issues/24#issuecomment-6191611010) | 线上 UI 已复现 |
| F11-UX-03 地点硬冲突遗漏 | 新单 B / [#213](https://github.com/TelyAgent/HireOSV2/issues/213) | 线上样本已观察；新 seed 完整复现待做 |
| F11-UX-04 `Approved` 误导 | 新单 C / [#214](https://github.com/TelyAgent/HireOSV2/issues/214) | 线上 UI 已复现 |
| F11-CODE-01 单人双批准 | 现有 [#20 补充评论](https://github.com/TelyAgent/HireOSV2/issues/20#issuecomment-6191611738) | 本地代码观察，线上未验证 |
| F11-CODE-02 缺当前评估仍提交 | 新单 D / [#215](https://github.com/TelyAgent/HireOSV2/issues/215) | 本地代码观察，隔离复现待做 |
| F11-CODE-03 第二次提交静默成功 | 新单 E / [#216](https://github.com/TelyAgent/HireOSV2/issues/216) | 本地代码观察，并发待验证 |
| F11-CODE-04 非 Reject 可请求通知 | 新单 A / [#212](https://github.com/TelyAgent/HireOSV2/issues/212) | 本地代码观察，隔离复现待做 |
| F11-CODE-05 请求成功但仅见审计 | 新单 A / [#212](https://github.com/TelyAgent/HireOSV2/issues/212) | 本地代码观察，通知链路待验证 |

新单 A 合并通知的前端预览、服务端准入和成功回执，属于同一次独立通知动作。现有 #20 和 #24 已涵盖对应根因，补充证据而不重复建单。草稿中的仓库文件目前仍有未提交内容；正式创建时须先确认引用文件与截图可由 GitHub 访问，或把证据直接附到 Issue。

## 新单 A

标题：`[Bug] F11 婉拒通知缺发送预览，服务端准入与成功回执不完整`

### Type

Bug

### Subsystem

hireos-screening

### Problem

Reject 决定后的“发送候选人婉拒通知”弹窗只有通用说明和发送按钮，没有收件人、通道或正文预览，用户无法检查将发给谁、发什么。2026-10-15 线上浏览器已复现此 UI 缺陷，测试人员点击取消，**没有发送通知**。

本地代码另显示：`DecisionsService.sendDeclineNotice` 只检查 Application 存在，未检查已批准的 Reject 决定；方法写入 `candidate_decline_notice_requested` 审计后返回 `succeeded`，方法内未见通知或 mock 记录。后两项**尚未在线上复现**，也未排除部署版本不同或另有处理器。

### User Outcome

负责人能够在发送前看清收件对象和最终正文；未 Reject 的申请不能触发婉拒通知；确认后的成功提示与可核对的发送或模拟记录一致。

### Scope

- Reject 决定页的通知预览、取消和显式确认。
- 服务端校验通知仅能基于当前有效的 Reject 决定发起。
- 返回状态、通知/mock 记录和审计状态保持一致；验证重复请求的行为。
- 保障通知不含内部评语或排序。

### Non-goals

- 不改变 Reject 决定本身及其交接规则。
- 不在此单实现邮件提供商或其他真实外发通道；实际通道仍待产品确认。
- 不扩展到所有候选人消息模板。

### Acceptance Criteria

- AC-1: 对已记录的 Reject，打开通知确认页可见实际收件对象、发送通道或“仅模拟”的明确标识、以及将发送的完整正文；缺收件地址时阻止确认并说明原因。
- AC-2: 在确认页取消，通知/mock 记录为 0，决定及其状态不变。
- AC-3: 无决定、Hold 或其他非 Reject 申请调用通知接口时返回明确 4xx，通知/mock 记录和“已发送”审计均不增加。
- AC-4: 对 `example.com` 虚构候选人确认一次后，成功响应可关联到恰好一条可核对的通知或模拟记录；收件对象与预览一致，正文不含内部评语、排名或评分细节，决定不改变。
- AC-5: 对同一决定重复确认时，不产生无提示的重复通知；页面与 API 明确返回已处理状态或经产品确认的重发结果，并可核对记录数。
- AC-6: 前后端自动测试分别覆盖预览、取消、非 Reject 拒绝、一次确认、重复请求和敏感内容排除。

### References

- `docs/product/Resume_Screening/F11_Human_Decision/PRD.md`：FR-9、BR-11、AC-4。
- `docs/product/Resume_Screening/F11_Human_Decision/Issue_Reproduction_List_2026-10-15.md`：F11-UX-01、F11-CODE-04、F11-CODE-05。
- `docs/product/Resume_Screening/F11_Human_Decision/Evidence_F11_Notice_2026-10-15.png`。
- `hireos-screening/hireos-screening-front/src/pages/DecisionPage.tsx`；`hireos-screening/hireos-screening-backend/src/decisions/decisions.service.ts`。

### Dependencies

通知模板、发送通道以及重复发送规则须由产品确认。若仅提供 mock，验收应以模拟记录为准；不依赖真实外发账号。

### Risk

high

### Owner

@JsonSuCoder

### AI Ready

No

### Reproduction

**线上已复现的 UI 路径**：

1. 在中文演示环境打开虚构 Ben Test 的[已提交 Reject 决定](https://hireos.aipollo.me/hireos/screening/applications/a5608ced-7da3-4a5c-9d33-23f00b25ef0d/decision)。
2. 点击“发送候选人婉拒通知”，停在弹窗，检查收件人、通道、主题与正文是否可见。
3. 点击取消；不要点击“发送通知”。

**隔离环境待复现的服务端路径**：

4. 准备无决定、Hold 和 Reject 三条 `example.com` 虚构申请，分别调用 `POST applications/:id/decline-notice`，记录响应、审计、通知/mock 记录。
5. 对 Reject 申请确认一次并重复请求一次，核对收件对象、正文、状态与记录数。

### Expected / Actual

预期：先预览再确认；未 Reject 请求被拒绝；成功对应一条真实或明确模拟的记录；重复操作不静默重复发送。

实际：线上弹窗只有通用说明和发送按钮，未发送。当前本地方法只见 Application 检查、审计写入和 `succeeded` 返回；其线上行为及完整通知链路仍待隔离验证。

### Environment

线上：2026-10-15，`https://hireos.aipollo.me/hireos/screening/`，中文界面，浏览器 UI；线上构建号、浏览器版本及通知 mock 权限未知。代码观察：本工作区当前文件，不能代表线上构建。截图与报告见 References。

### Severity

S2

## 新单 B

标题：`[Bug] F06/F08/F11 已知地点硬冲突未传到人工决定摘要`

### Type

Bug

### Subsystem

hireos-screening

### Problem

虚构 Ben Test 的岗位推荐明确指出只能在新加坡远程工作、无法搬迁北京，但随后评估显示“需要核实 / 推进”，决定页只列产品经验与系统设计两项顾虑，未显示已知地点冲突。负责人仅看决定页可能把明确不满足的岗位条件当成普通信息缺失。原 Ben 已提交 Reject；完整初始表单复测需要新虚构 seed。缺失发生于推荐、评估或决定哪一层，仍待 API/DB 定位。

### User Outcome

负责人在推荐、评估和人工决定三个环节都能看见同一条已知硬条件冲突；越过条件时进入有效例外审批。

### Scope

- 核对 F06 推荐依据、F08 资格/顾虑产物和 F11 决定输入的结构化传递。
- 在决定摘要展示明确不满足的岗位条件及来源，区分“已知不满足”和“待核实”。
- 对越过明确底线的推进执行例外要求。

### Non-goals

- 不修改岗位地点标准本身，也不为候选人自动决定。
- 不扩大到所有 AI 评分模型的准确率整改。

### Acceptance Criteria

- AC-1: 对标准明确要求北京到岗、档案明确“Singapore remote only / cannot relocate”的虚构申请，推荐、评估、决定三处均显示地点不匹配及来源，不把该项归为“信息缺失”。
- AC-2: 该冲突在 F11 的未解决顾虑或独立资格阻断区可见；刷新与跨负责人查看仍一致。
- AC-3: 在此冲突未解除且无有效例外审批时，推进到笔试或面试被服务端拒绝；人工仍可选择 Hold 或 Reject 并记录理由。
- AC-4: 冲突被明确解决或两名独立批准人完成有效例外后，状态和决策依据按最终证据更新；例外批准要求与 #20 一致。
- AC-5: 使用同一虚构输入的跨 F06/F08/F11 自动或集成测试能断言以上结果。

### References

- `docs/product/Resume_Screening/F11_Human_Decision/PRD.md`：FR-3、FR-7、AC-8。
- `docs/product/Resume_Screening/F11_Human_Decision/Issue_Reproduction_List_2026-10-15.md`：F11-UX-03。
- `docs/product/Resume_Screening/F06_Job_Discovery/PRD.md`；`docs/product/Resume_Screening/F08_AI_Screening_Evaluation/PRD.md`。
- 虚构 Ben 的[推荐页](https://hireos.aipollo.me/hireos/screening/candidates/e571c2d9-ce4d-42e9-b3aa-0f2d975a1d87/jobs)和[决定页](https://hireos.aipollo.me/hireos/screening/applications/a5608ced-7da3-4a5c-9d33-23f00b25ef0d/decision)。

### Dependencies

Refs #20（底线例外审批）、#27（决定页顾虑展示，已关闭）。需要新虚构申请与只读评估/顾虑数据定位缺失环节。

### Risk

high

### Owner

@JsonSuCoder

### AI Ready

No

### Reproduction

1. 在隔离岗位设“AI产品经理 / 北京”，确认其地点为明确资格条件。
2. 新增纯虚构档案：`Current location: Singapore. Singapore remote only. Cannot relocate to Beijing or any other city.`，其余经验满足岗位；如需邮箱使用 `example.com`。
3. 等待推荐，在职位推荐页记录“无法搬迁”的依据；确认职位关联并等待评估。
4. 在初筛页记录资格、AI 建议、顾虑与待核实项。
5. 打开“决定下一步”的初始表单，不提交推进；逐项对照推荐、评估、决定三处的地点判断。
6. 只读核对 API/DB 中资格与 concern 的结构化数据，定位信息丢失环节。

### Expected / Actual

预期：明确不满足的地点条件始终可见并阻止无例外推进。

实际：原 Ben 样本推荐页识别冲突，评估为“需要核实 / 推进”，决定页未列地点冲突。原样本已 Reject；新 seed 的完整重现与服务端阻断尚未执行。

### Environment

线上：2026-10-15，中文演示环境，`https://hireos.aipollo.me/hireos/screening/`；构建号、浏览器版本未知。原样本为虚构数据；新 seed、API/DB 检查待执行。

### Severity

S2

## 新单 C

标题：`[Bug] F11 中文决定详情把 Hold 和 Reject 状态显示为 Approved`

### Type

Bug

### Subsystem

hireos-screening

### Problem

中文界面中，已记录的 Hold 和 Reject 决定都显示 `状态：Approved`。此词未翻译，且会让跨角色查看者误以为候选人的推进已获批准。线上两条虚构申请刷新后仍可复现。

### User Outcome

负责人能准确区分决定已记录、待例外审批、例外已批准和下游交接状态。

### Scope

- F11 决定详情的状态名称与中文翻译。
- 分离“决定记录状态”与“推进/审批/交接状态”的展示语义。
- 覆盖 Hold、Reject、待审批、已批准、已交接的展示测试。

### Non-goals

- 不改变决定状态机、数据库字段或审批权限。
- 不做全站国际化重构。

### Acceptance Criteria

- AC-1: 中文界面中，已记录的 Hold 和 Reject 不显示 `Approved`，而是显示明确的“决定已记录”或经确认的等价业务文案。
- AC-2: 待例外审批、例外已批准和已交接各有互不混淆的标签；结果（Hold/Reject/Advance）与流程状态分别展示。
- AC-3: 刷新和跨负责人查看保持同一语义；英文界面使用对应英文词，不出现缺失翻译 key。
- AC-4: 前端状态映射测试覆盖上述五类样本。

### References

- `docs/product/Resume_Screening/F11_Human_Decision/Issue_Reproduction_List_2026-10-15.md`：F11-UX-04，含详细步骤。
- `docs/product/Resume_Screening/F11_Human_Decision/Evidence_F11_Hold_2026-10-15.png`；`docs/product/Resume_Screening/F11_Human_Decision/Evidence_F11_Reject_2026-10-15.png`。
- `docs/product/Resume_Screening/F11_Human_Decision/PRD.md`：FR-12。
- `docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md`：U1、U5。
- `hireos-screening/hireos-screening-front/src/pages/DecisionPage.tsx`。

### Dependencies

Refs #26（既有中文文案 Issue，已关闭）；本单为线上新见的具体状态语义缺陷。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

1. 切到中文界面，打开虚构[测试候选人 A 的 Hold 决定](https://hireos.aipollo.me/hireos/screening/applications/3e7383e3-c838-425b-8df9-87365843299e/decision)，确认结果“暂缓”且未交接。
2. 查看理由下方的 `状态：` 并刷新再看。
3. 打开虚构 [Ben Test 的 Reject 决定](https://hireos.aipollo.me/hireos/screening/applications/a5608ced-7da3-4a5c-9d33-23f00b25ef0d/decision)，确认“不予推进”，查看同一状态字段。

### Expected / Actual

预期：两条均显示“决定已记录”或等价准确文案，不暗示推进批准。

实际：两条均显示英文 `Approved`；见 References 中的截图。

### Environment

线上：2026-10-15，中文演示环境，`https://hireos.aipollo.me/hireos/screening/`；构建号及浏览器版本未知。复现为只读查看。

### Severity

S3

## 新单 D

标题：`[Bug] F11 决定接口可能允许没有当前评估版本的有效决定`

### Type

Bug

### Subsystem

hireos-screening

### Problem

本地 `DecisionsService.record` 查询 `freshness='current'` 的评估，但创建决定时使用可空的 `evaluationId: currentEvaluation?.id`，未见缺失或 stale 评估的统一拒绝条件。因而 Hold、Reject 或推进路径可能生成没有当前评估版本的有效决定，违背 F11 决定绑定依据的要求。**线上未复现**；这是待隔离验证的代码风险。

### User Outcome

负责人能清楚知道依据是否过期；任何有效决定都有可追溯的评估版本，旧依据的使用遵守明确批准规则。

### Scope

- 决定提交时对当前评估及版本的服务端检查。
- stale 或缺评估时的 UI/API 错误与重评入口。
- 根据产品确认的策略处理非推进类决定和旧依据批准分支。

### Non-goals

- 不修改评估分数生成逻辑。
- 不凭本单决定旧依据的批准角色。

### Acceptance Criteria

- AC-1: 对不存在当前评估、或仅有 stale 评估的虚构申请，直接推进到笔试/面试的 API 请求返回明确 4xx，不创建有效决定、交接事件或已完成任务。
- AC-2: 对 Hold、Reject 等仅记录决定，系统按产品确认的评估版本策略执行；若允许，则记录可追溯的具体依据和授权事实，不能静默创建 `evaluationId=null` 的有效决定。
- AC-3: 完成新评估后，负责人重新确认，成功决定绑定该评估 ID 和版本；页面可见对应时间/版本。
- AC-4: 后端自动测试分别覆盖缺评估、stale、重评后提交以及任务/交接副作用。

### References

- `docs/product/Resume_Screening/F11_Human_Decision/PRD.md`：FR-6、BR-2、AC-2。
- `docs/product/Resume_Screening/F11_Human_Decision/Issue_Reproduction_List_2026-10-15.md`：F11-CODE-02。
- `hireos-screening/hireos-screening-backend/src/decisions/decisions.service.ts`。

### Dependencies

Blocked by: 产品确认缺评估或 stale 时 Hold/Reject 是否允许，以及旧依据批准人和审计字段；F11 PRD §10 第 3 项待决。可先执行隔离复现和无争议的推进阻断验证。

### Risk

high

### Owner

@JsonSuCoder

### AI Ready

No

### Reproduction

1. 在隔离 workspace 创建有效虚构 Application，确保没有 `freshness=current` 的 ScreeningEvaluation，或把唯一评估标为 stale。
2. 以有权限的负责人调用 `POST applications/:id/decisions`，请求体：`{"outcome":"hold","nextStepTarget":"record_only","reason":"[UJ-TEST] stale guard"}`。
3. 记录 HTTP 状态及决定 ID，查询决定的 `evaluationId`、审计和任务状态。
4. 对 `advance` + `move_to_interview` 重复一次，并核查交接 outbox；随后生成新评估再提交。

### Expected / Actual

预期：推进被阻止；其他决定遵守经确认的旧依据策略；成功决定绑定可追溯版本。

实际：本地代码允许 `currentEvaluation` 为空并写入可空 `evaluationId`；隔离执行结果、线上版本与实际响应尚未知。

### Environment

本地代码审查：2026-10-15 当前工作区，`decisions.service.ts`；无线上构建号，也无隔离 API/DB 测试结果。不得表述为线上已复现。

### Severity

S2

## 新单 E

标题：`[Bug] F11 第二次提交可能成功返回别人的既有决定，缺版本冲突提示`

### Type

Bug

### Subsystem

hireos-screening

### Problem

本地 `DecisionsService.record` 在发现已有 `status='approved'` 决定时，直接返回该决定对象，未根据第二次请求的结果、理由或预期版本提示冲突。第二位负责人可能看到成功响应，却不知道自己的不同决定没有生效。真正同时提交是否出现双写，仍需数据库约束和竞态测试确认；**线上未复现**。

### User Outcome

第二位负责人清楚看到已有决定及其负责人、时间和版本；系统不会静默接受冲突请求或覆盖第一份决定。

### Scope

- 决定 API 的版本前置条件与顺序冲突反馈。
- 决定页冲突提示和既有决定读取。
- 并发下唯一有效决定、任务和交接副作用验证。

### Non-goals

- 不做批量决定流程。
- 不实现撤回或更正已交接决定。

### Acceptance Criteria

- AC-1: 第一人提交 Hold 后，第二个旧页面提交不同结果/理由时，API 返回明确冲突响应及已有决定的可查看引用；页面明确提示未采用第二次提交，并保留其输入供查看。
- AC-2: 两人真正并发提交时，同一申请与版本最多一条有效决定；失败方收到冲突提示，不产生第二份有效交接、任务完成或覆盖写入。
- AC-3: 对网络重试且请求内容完全相同的情况，系统按明确的幂等规则响应，不误报“新决定已创建”；返回内容使客户端能识别已有结果。
- AC-4: 后端并发/顺序测试与前端冲突展示测试覆盖上述路径，并核对决定、审计、任务与 outbox 数量。

### References

- `docs/product/Resume_Screening/F11_Human_Decision/PRD.md`：BR-3、AC-6。
- `docs/product/Resume_Screening/F11_Human_Decision/Issue_Reproduction_List_2026-10-15.md`：F11-CODE-03。
- `hireos-screening/hireos-screening-backend/src/decisions/decisions.service.ts`。

### Dependencies

Refs #23（此前已关闭的提交按钮防双击/撤回问题）。需要确认同内容网络重试的幂等响应契约；不同内容冲突行为已由 F11 PRD BR-3 指定。

### Risk

high

### Owner

@JsonSuCoder

### AI Ready

No

### Reproduction

1. 在隔离 workspace 为虚构申请准备当前评估；以负责人 A 提交 Hold，记下决定 ID、理由和版本。
2. 在负责人 B 的旧表单上对同一申请提交 Advance + `record_only` 和不同理由；记录 HTTP 状态、响应、页面提示与决定表。
3. 再用两个会话同时提交不同结果，读取有效决定、任务、审计与 outbox，判断有无双写。
4. 另以相同请求体重试一次，记录客户端能否辨认原决定。

### Expected / Actual

预期：不同结果的第二次请求为清晰冲突，不覆盖；并发最多一条有效决定。

实际：本地顺序分支直接返回已有决定，未见冲突判断；线上和真实并发尚未验证。

### Environment

本地代码审查：2026-10-15 当前工作区，`decisions.service.ts`；线上构建号与并发测试环境未知。该现象是代码风险，非线上 UI 实测。

### Severity

S2

## 现有 #24 的补充评论草稿

> [AI-EVIDENCE] F11 线上复测（2026-10-15）补充了用户可见症状：在中文界面，虚构测试候选人 A 的 Hold 决定页和 Ben Test 的 Reject 决定页均显示“决策人：”后为空；刷新后仍为空，日期和状态有值。只读复现：打开 `https://hireos.aipollo.me/hireos/screening/applications/3e7383e3-c838-425b-8df9-87365843299e/decision`，查看“决策人：”并刷新；再对 `https://hireos.aipollo.me/hireos/screening/applications/a5608ced-7da3-4a5c-9d33-23f00b25ef0d/decision` 重复。预期为实际决定人的可识别姓名/账号，并与审计 actor 对应。本地 `DecisionPage.tsx` 通过 `db.people[decision.decidedBy]?.name` 映射，服务端 `decidedBy` 来自 `actorId`；这只是排查线索，线上根因和构建版本未核。建议给本 Issue 的验收补充“Hold/Reject 刷新与跨负责人查看仍显示决策人”的 UI/API 断言。证据：`docs/product/Resume_Screening/F11_Human_Decision/Evidence_F11_Hold_2026-10-15.png`、`Evidence_F11_Reject_2026-10-15.png` 和同目录 `Issue_Reproduction_List_2026-10-15.md`（发布前须确保 GitHub 可访问）。

## 现有 #20 的补充评论草稿

> [AI-EVIDENCE] F11 本地代码复核（2026-10-15）与本 Issue 一致：`DecisionsService.record` 接收 `exceptionApproved=true` 后，单次事务向 `DecisionExceptionApproval` 写入 `role='hr'` 与 `role='hiring_manager'` 两条记录，二者均使用同一个 `identity.actorId`；决定可继续创建。前端“批准例外并提交”也由当前用户单次操作触发。隔离复现：建立 `assessmentDisposition=required` 且未完成测评的虚构申请，以单一负责人选择推进和例外，提交后读取两条审批记录，比较 `actorId` 和是否已下游交接。应为两名不同、具备相应角色且非发起人的批准人分别确认同一版本；实际线上行为、部署版本和 DB 记录本轮未验证。此证据应纳入 #20，不另建重复 Bug。来源：`docs/product/Resume_Screening/F11_Human_Decision/Issue_Reproduction_List_2026-10-15.md` 的 F11-CODE-01；正式评论前须确保文件可访问。

## 提交后待解决的产品问题

1. **5 张新单 + #20/#24 各 1 条证据评论** 的去重方式已获用户确认并提交，覆盖上述 9 项。
2. 通知：本期采用哪种模板与发送通道？“成功”是否必须对应真实发送，或可对应可查的模拟消息？同一决定重复请求是拒绝还是允许显式重发？
3. 评估版本：没有当前评估或仅有 stale 评估时，Hold/Reject 是否允许仅记录？如可使用旧依据，由谁批准？
4. 状态文案：已记录的 Hold/Reject 是否统一显示“决定已记录”？
5. 在提交 GitHub 前，是否先将本地报告、截图与规格文件提交/推送，使 Issue 引用可访问？若不推送，应将必要证据直接粘贴或附件上传到 Issue。

以上未决行为已经在 #212、#213、#215、#216 用 `[AI-QUESTION]` 留下解除条件；解决并确认相关 AC 后再将相应 Issue 的 `AI Ready` 改为 `Yes`。本地报告与截图尚未提交到 GitHub；各 Issue 已写明关键证据和复现步骤，文件入库后补可访问链接。
