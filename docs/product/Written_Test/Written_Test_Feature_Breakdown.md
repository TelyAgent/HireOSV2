# Written Test（Assessment）功能拆分

| 属性 | 内容 |
|---|---|
| 依据 | [Assessment_Written_Test_PRD_v1.4.md](../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Interface Spec v1.4](../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Prototype Design Brief v1.1](../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md)、[原型](../../design/Written_Test/hireos-assessment-prototype.html)、[Agent 对话流程](../../../hireos-written/docs/Written_Test_Agent_Conversation_Flow.md) |
| 日期 | 2026-10-14 |
| 用途 | 把笔试 / 测评模块拆成可独立立项、实现和验收的功能单元，作为后续创建 Issue 的底稿 |

> 拆分原则：PRD v1.4 §1 明确旧 MVP/P0/P1/P2 标签不再用于削减已确认功能。本文的顺序只表示工程依赖，不表示删减或延后范围。
> 「现状」一栏只按代码目录、路由和接口做了初步核对，**没有逐项验证 AC**，立项时需要重新确认。
> 编号用 `W` 前缀，避免与 Design Brief §15 的 Foundation 场景 F01–F12、Screening 的 F01–F19 混淆。

## 1. 总览

主流程：题库与组卷 → 测评项目与候选人关联 → 候选人测评计划 → 邀请发送 → 候选人验证、接受与作答 → 提交与收件 → AI / 人工评分 → 结果发布 → 修订 / 补测 → 交接下游。候选人对比、我的任务与统计贯穿主流程；通知、文件与集成、模型配置、偏好与校准、统一身份与外壳是支撑能力。

| 编号 | 功能 | 类别 | PRD | 原型路由 | 后端模块 | 前端页面 | 验收（PRD §16 / Brief §9、§15） |
|---|---|---|---|---|---|---|---|
| W01 | 题库与题目版本 | 主流程 | §4 | `#/question-bank`、`#/questions/:id` | `questions` | `QuestionBankPage`、`QuestionDetailPage` | A；P01、P02 |
| W02 | 组卷 Builder 与 AI 出题 | 主流程 | §4 | `#/builder/:id` | `ai`（generate-question、extract-competencies） | `BuilderPage` | A；P01、P02、P22 |
| W03 | 测评项目与候选人关联 | 主流程 | §3、§5 | `#/assessments`、`#/assessments/:id` | `intake`（screening-handoff）、`cases` | `AssessmentsListPage`、`ProjectDetailPage` | A；P03；F02、F03、F04 |
| W04 | 候选人测评计划 | 主流程 | §5 | `#/cases/:id/plan` | `plan-items`、`cases` | `PlanPage`、`AssessmentQuestionDrawer` | A；P12 |
| W05 | 邀请与批量发送 | 主流程 | §5、§6 | `#/invitations/new`、计划页 Send to candidate 抽屉 | `invitations`、`mail-accounts` | `InvitationComposerPage`、`SendToCandidateDrawer` | A、B；P03 |
| W06 | 候选人门户：验证、接受与作答 | 主流程 | §6、§7 | `#/candidate`、`#/candidate/invitations/:id`、`#/candidate/attempts/:id` | `invitations`（public） | `CandidateApplyPage` | B、F；P04、P05；F08 |
| W07 | 提交收件与 Submission Inbox | 主流程 | §7 | `#/submissions`、`#/attempts/:id/submission` | **缺失**（仅 Portal 文本提交） | `SubmissionInboxPage`、`SubmissionDetailPage` | B、G；P05–P08；F07 |
| W08 | 评分与人工复核 | 主流程 | §8 | `#/attempts/:id/review` | `ai`（evaluator）、`cases`（finalize） | `EvaluationReviewPage` | C；P09 |
| W09 | 结果发布与候选人通知 | 主流程 | §8 | `#/results/:id/release`、`#/candidate/results/:id` | `cases`（result/release） | `ReleasePage` | C；P10 |
| W10 | 修订、重考与补测 | 主流程 | §9 | `#/cases/:id/revisions/:round` | **缺失** | **缺失** | C；P11、P12 |
| W11 | 下一步决定与交接 | 主流程 | §9 | `#/deliveries/:id` | `cases`（interview-handoff、hold、resume、close） | **缺失**（无交付页） | C、G；P15；F05、F06、F12 |
| W12 | 候选人对比 | 主流程 | §10 | `#/comparisons`、`#/comparisons/:id` | **缺失** | `ComparisonsListPage`、`ComparisonDetailPage`（fixture） | D；P13、P14 |
| W13 | 我的任务与首页统计 | 主流程 / SHARED-08、09 | §12 | `#/tasks` | `tasks` | `TasksPage` | E；P16、P17 |
| W14 | 通知与提醒 | 支撑（SHARED-09） | §12 | 顶栏通知 | `mail-accounts`（SMTP 发送） | — | E |
| W15 | Files & Integrations | 支撑（SHARED-04/05/07） | §13 | `#/files` | `mail-accounts`（只有发信账号） | `SettingsPage` 中的企业邮箱 | E；P18；F11 |
| W16 | AI 模型配置与路由 | 支撑（SHARED-11） | §13 | `#/ai-models` | **缺失**（仅 `ai-json-client`） | **缺失**（路由重定向到设置） | E；P19 |
| W17 | 偏好、校准与 Analytics | 支撑 | §10、§11 | `#/settings`（Preferences） | **缺失** | `SettingsPage` 部分 | D、E；P22 |
| W18 | 统一身份、外壳、权限、外观与审计 | 支撑（SHARED-01–03、10） | §3、§11、§14、§15、§18 | 顶栏、Demo tools | `auth`（workspace guard） | `AppShell` | F、G；P20、P21；F01、F08–F10 |
| W19 | Written Test Agent | 支撑 | Agent 对话流程 | 无独立路由 | **缺失** | **缺失** | Agent 文档 §12、§13 |

## 2. 功能明细

### W01 题库与题目版本

- **目标**：题目可在多个岗位、多种能力之间复用，有版本，发出去的内容不随题库修改而变。
- **范围**：列表搜索 / 岗位 / 能力过滤、收藏、标签；题目详情 Prompt / Materials / Rubric / Usage / Versions；Candidate preview 只渲染白名单；ZIP 导入区分材料、题目、内部答案和旧候选人提交；发布 / 停用 / 历史；概念题（FIN-009/010）不能发送；已见题记录。
- **数据**：Question、QuestionVersion、QuestionRoleMapping、ScoringProfile、Material（= Core FileVersion）。
- **依赖**：W18（Core Job / File）。

### W02 组卷 Builder 与 AI 出题

- **目标**：按「要求 → 能力 → 所需证据 → Blueprint → 题目 → Rubric」生成和编辑题目，评分标准在邀请前就已确定。
- **范围**：Builder 的 Sections、Prompt & materials、Deliverables、能力分配（criterion fraction 和 = 100%）、Quality review、AI generate（loading / 失败 / 重试 / 草稿标识）；编辑生成派生版本；技术题与隔离执行证据；适应性测评分支与轨迹。
- **数据**：Assessment、Blueprint、Section、QuestionVersion、QualityReview、ExecutionProfile、AdaptivePolicy。
- **依赖**：W01、W16。

### W03 测评项目与候选人关联

- **目标**：只有目标或 JD 也能准备测评；正式岗位邀请前，候选人和岗位的招聘关系已由人确认。
- **范围**：项目列表与详情；从 JD 起草项目；新建候选人（先写 Core Candidate）→ Confirm link → Core Application；从 Screening 已筛选候选人中选择；快速创建测评向导；Core 失败 / 响应丢失时的 Reconciling。
- **数据**：AssessmentProject、Case；Core Candidate / Job / Application 引用。
- **依赖**：W18；上游 Screening（经总线）。

### W04 候选人测评计划

- **目标**：为每个候选人 / Case 管理多项测试，区分必评、选评、补证和修订，并冻结成待发送版本。
- **范围**：计划页四个 tab（Assessment plan / Submission / Comprehensive evaluation / Evaluation result）；验证目标、负责人、截止时间；从题库添加或 AI 生成题目；针对该候选人的题目调整；PlanItem 前置条件；计划版本不覆盖已完成 Attempt；跨岗位复用原作答。
- **数据**：AssessmentPlan、PlanItem、PlanReview。
- **依赖**：W01、W02、W03。

### W05 邀请与批量发送

- **目标**：对确定的名单逐人预览、授权、发送并逐项追踪，部分失败只重试失败项。
- **范围**：五步 Composer（Recipients → Tests & materials → Timing & submission → Result disclosure → Review & send）；计划页单人发送抽屉；timed / deadline-only；提交渠道（Portal、邮件 auto-submit、邮件 + Portal 确认）；结果披露方式；From / Reply-To 统一 hr@；保存草稿；关键条件变化使旧批准失效；逐项 Delivery 与 Retry failed。
- **数据**：Invitation、PolicySnapshot、SubmissionPolicy、Delivery ref。
- **依赖**：W04、W14。

### W06 候选人门户：验证、接受与作答

- **目标**：候选人用受邀邮箱经统一身份验证后接受任务，按规则作答并正式提交。
- **范围**：候选人首页；邀请页（工作量、期限、AI 规则、邮箱验证、Accept / Decline）；GET 无副作用；timed 需 Start test；deadline-only 离线作答；材料下载；上传草稿（Uploaded draft / Scanning / Ready / Missing）；Submit answers 最终清单与回执；锁定后不可再编辑；邮件提交说明；手机可用。
- **数据**：Acceptance、Attempt、SubmissionDraft、Receipt。
- **依赖**：W05、W18（Identity 受限参与者）。

### W07 提交收件与 Submission Inbox

- **目标**：邮件和上传两条通道共用提交事务，只有全部条件满足才自动提交，其余进入可处理的问题队列。
- **范围**：Inbox 分类 Received / Needs confirmation / Incomplete / Submitted / Duplicate / Quarantined；线程匹配原因；Confirm assignment / Not a match / Request missing files；SubmissionBundle（ZIP 成员、hash、版本、题目绑定）；冲突版本选择；可信接收时间与处理时间分开；Evidence 定位（PDF 页、Excel 单元格、公式状态）；Source / Issue Register。
- **数据**：MailIngress ref、SubmissionBundle、Response、Evidence、IssueGroup。
- **依赖**：W06、W15。

### W08 评分与人工复核

- **目标**：AI、人工、规则评价独立留存，每个分数能追到证据，必评项 Unknown 时总分为空。
- **范围**：结论 → 维度 / Rubric → Evidence 三层；AI 分与人工分并列；Override 必填理由；Accept all AI scores；Re-run AI；AI 失败转人工；Coverage / Confidence 独立显示；严重问题单独显示；Finalize evaluation。
- **数据**：Evaluation、Score、CriterionScore、Result。
- **依赖**：W07、W16。

### W09 结果发布与候选人通知

- **目标**：候选人只看到经批准的白名单结果投影，发布与送达分开。
- **范围**：Release 页内部参考 / 候选人预览分栏；披露方式（Score + summary / Summary only）；Finalize & publish result；Portal 发布 + 邮件通知；退信重试；未 final 显示 Under review；纠正 / 撤回留历史；候选人结果页。
- **数据**：CandidateResultRelease、Notification ref。
- **依赖**：W08、W14。

### W10 修订、重考与补测

- **目标**：Rescore、Revision、Retake、Supplemental 四种后续各自独立记录，不改写原稿和旧分。
- **范围**：FeedbackPackage（hint_only / issue_specific / worked_solution + 内部 notes）；新轮独立邀请、接受与线程；Original / Feedback / Revised 对照；Not comparable；补测新建 PlanItem；delta 规则。
- **数据**：FeedbackPackage、Revision、Attempt（新轮）、PlanItem（补测）。
- **依赖**：W04、W05、W09。

### W11 下一步决定与交接

- **目标**：负责人从结果页选择下一步；内部交接只走总线、只在文件 ready 后发事件；外部导出与内部交接分开。
- **范围**：Next action（修订、补测、面试、Hold、关闭测评、岗位转看提案）；AssessmentPackage 内容；Handoff 时间线（Finalized → Preparing → File ready → Event queued → Published → Intake received → Imported）；无 ACK；Interview 未启用仍可导出；Report-only。
- **数据**：NextAction、Decision、AssessmentPackage、Outbox 事件、Receipt。
- **依赖**：W09；下游 Interview（经总线）。

### W12 候选人对比

- **目标**：同岗位候选人能并排看能力差异和证据；只有条件等价的成绩才可排序。
- **范围**：2–4 人并排、能力为行；Same stage / Current summary / Changes since last round；Key Differences、只看差异、显示 Unknown、证据下钻、评论、保存快照；Stale；No clear overall leader；导出 PNG / PDF / 报告；逐人下一步但不自动发送。
- **数据**：ComparisonSnapshot、Comment。
- **依赖**：W08；公共 Compare 框架（SHARED-12）。

### W13 我的任务与首页统计

- **目标**：每个人看到自己要做的事，统计数字口径唯一、可下钻到同过滤列表。
- **范围**：My Work 卡片 + More statistics；任务状态过滤与 Cluster by JD；领取 / 转派 / 等待 / 历史；任务只能通过业务动作完成；§12 指标口径；0 / Loading / Unavailable / Stale。
- **数据**：HumanTask、指标快照。
- **依赖**：W03–W11 产生的任务。

### W14 通知与提醒

- **范围**：邀请 / 接受、收件 / 正式提交、补件、临期、待复核、结果、修订 / 补测、取消与异常；直达任务；按角色裁剪；初次分配即时、临期合并；完成 / 取消 / 转派撤销旧提醒；候选人通知 From / Reply-To 统一 hr@。
- **依赖**：平台公共通知服务。

### W15 Files & Integrations

- **范围**：Files / Connections / Activity；Drive 式拖放、多选、进度、预览、下载；读取、提取、业务消费、导出各自状态；邮箱 / 文件夹连接的 Read now、Pause / Resume、重新授权、检查点；部分失败只重试失败项。
- **依赖**：平台公共文件与连接服务。

### W16 AI 模型配置与路由

- **范围**：Catalog / Task policies / Compare & evaluate / Usage & cost / Activity & versions；硬约束 → 质量 → 成本 / 时限 → 偏好；预算预占 / 结算、受控回退、版本发布 / 回滚；No eligible model；任务清单（question_generate、blueprint_generate、quality_review、file_extract、evidence_map、rubric_evaluate、feedback_draft、candidate_compare、calibration_signal）。
- **依赖**：平台公共 AI Service。

### W17 偏好、校准与 Analytics

- **范围**：个人视图偏好不改团队 Rubric；反馈事实 → 信号 → 提案 → 审核生效 → 回滚；受保护特征排除；Analytics 指标标分母、单位、窗口、样本量，修订另分 cohort。
- **依赖**：W08、W11；下游 Interview / Hire 反馈（经授权导入）。

### W18 统一身份、外壳、权限、外观与审计

- **范围**：Shell 组合 / Standalone 两种入口同数据同任务；统一 user_id；候选人是受限参与者；对象 / 用途权限；Light / Dark / Deep / System、Accent、字号；Core / Identity / 总线不可用时的阻塞与草稿；审计与 Timeline；可访问性。
- **依赖**：平台 Identity、Core Record、Audit。

### W19 Written Test Agent

- **范围**：读取 Case / Round / Invitation / Submission / Evidence / Evaluation / Release 上下文；区分事实、建议和动作；涉及状态变化的动作先生成 Proposal 再由负责人确认；异常时停止自动处理；对话审计记录。
- **依赖**：W03–W11、W16。

## 3. 文档与原型之间的差异（立项前需确认）

| # | 主题 | PRD / Brief | 原型 / 现有实现 |
|---|---|---|---|
| D1 | 审批 | PRD §5、§8、§12 有计划批准、发布批准、反馈修订批准等任务，「最终内部结果经授权人确认」 | 原型 Settings「Startup Team Access」：任何在职员工可执行全部动作，**无审批队列、无双签**，发送 / 发布即本人确认 |
| D2 | My Tasks 结构 | PRD §12：Assigned to me / Available to claim / Created or followed / Completed 四个 tab | 原型按候选人状态过滤（Written completed / Pending test / Pending submission / Pending result review）+ Cluster by JD |
| D3 | 题目个性化 | PRD §4：试卷选择精确 QuestionVersion，改题库生成派生版本 | 原型和后端 `PlanItem.customPrompt` 允许只对某个候选人修改题目内容 |
| D4 | 候选人主档 | PRD §1、§3：不建本地可写 Candidate / Job / Application | 后端 Prisma 有本地 `Candidate`、`Job`，以 `coreCandidateId` / `coreJobId` 幂等写入 |
| D5 | 候选人登录 | PRD §6：统一 Identity 受限参与者 + 邮箱验证 | 实现是 `/apply/:token` 免登录链接，文本作答 |
| D6 | 任务模型 | PRD §12：一个 Case 可有多个任务（复核、发布、缺件等） | 后端 `Task` 与 `Case` 1:1 |
| D7 | 评分存储 | Spec §5：Evaluation / Score / Result 独立实体，人工覆盖记录原值 / 新值 | 后端存在 `Submission.evaluation` / `finalEvaluation` JSON 中 |
| D8 | 发信 | PRD §6：经平台公共邮件服务发送 | 后端自建 `MailAccount`（SMTP 明文 app password） |
