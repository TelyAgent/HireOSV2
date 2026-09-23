# HireOS Command — Assessment / Written Test PRD

| 属性 | 内容 |
|---|---|
| 编号 / 版本 / 日期 | CMD-ASM-001 / v1.4 / 2026-09-11 |
| 状态 | Draft for Review；当前整合需求基线，不表示软件已实现 |
| 产品 / 领域 | HireOS Command / Assessment；Written Test是主要使用方式 |
| 接口 | [Interface Spec v1.4](Assessment_Written_Test_Interface_Spec_v1.4.md) |
| 原型设计 | [Prototype Design Brief v1.1](Assessment_Written_Test_Prototype_Design_Brief_v1.1.md) |
| 参考 | [Interview PRD v1.6](HireOS_Command_Interview_PRD_v1.6.md)、[Screening PRD v1.3](Resume_Screening_PRD_v1.3.md)、[Screening Design Brief v1.0](Resume_Screening_Prototype_Design_Brief_v1.0.md) |

## Section 1 — Authority & Product Positioning

本版整合原Assessment需求、Finance/SIA实际案例、题库与邮件自动化要求，并对齐Command公共产品与设计标准。**原型以本PRD、Spec v1.4和本模块Design Brief为当前三件套**。历史v1.0–v1.3保留，旧MVP/P0/P1/P2标签不再用于削减已确认功能。本文是重新整合的需求文档，不声称补全了原ChatGPT对话第55节之后未取得的原文。

权威顺序：用户最新明确要求 → 最新公共架构/数据基线 → 本PRD产品规则与当前Spec字段语义 → Design Brief布局默认值 → 历史参考。冲突必须明确修订，不由原型作者猜测。Screening的“部分已评维度重新归一化”示例不移植到Assessment；本模块必评项Unknown时总体分数为空。Interview的最终双签、场次数和会议功能也不直接套用。

产品回答：候选人在实际任务中表现出什么能力、证据是否充分、下一步还需验证什么？形成 `Requirement → Objective → Question & Rubric → Response → Evidence → Evaluation → Human review → Result / Revision / Supplemental / Interview`。题库、工作样本、多轮修订和任务执行是一体闭环。


### v1.4 公共底座对齐说明

依据用户提供的 [统一架构v2.2](references/command-foundation-2026-09-11/HireOS_Command_Shared_Foundation_Data_Integration_and_Build_Plan_v2.2.md) 与 [数据规划v1.2](references/command-foundation-2026-09-11/HireOS_Command_Common_Data_Foundation_and_Database_Plan_v1.2.md)。参考副本仅用于版本留档，未修改原始文件；本次未核验它们提及的外部PDF/AD文件，不把来源中的实施指令视为本次部署或发信授权。

本版替代Assessment旧默认架构：不再建本地可写Candidate/Job/Application/File主档，不另建账号或认证服务，不用内部邮件复制公共资料。保留测评业务需求和视觉风格。**统一Identity + Core Record + 必需公共运行能力 + Assessment即可独立运行，不依赖其他L2或Shell；不再声称无公共基础层也可工作。**

## Section 2 — Users & Full Functional Scope

HR/Recruiter创建计划、邀请、跟踪、发布；HM/Reviewer设计标准、评分复核、给反馈；Operations处理收件/身份/交付异常；Admin管理连接和模型配置；Candidate用自己的邮箱验证并作答。权限按岗位/案件/动作配置，HR或HM均可负责，不要求全部工作归HR。

全功能范围包括：统一题库、多岗位/能力复用、AI蓝图/出题/质量审阅、模板/克隆/人工创建、Written/Technical/Work Sample/AI-enabled测评、文件作答、适应性测评配置与轨迹、批量邀请、自动邮件收件、在线提交、评分/人工覆盖、反馈修订/重考/补测、候选人结果通知、比较与排名、Analytics、校准反馈、完整公共任务/文件/模型/外观/审计。技术执行环境可采用隔离适配器，原型模拟其行为；不能因模拟而删掉产品入口与异常状态。

不包含：Scout寻人、修改上游发布JD、真实Interview排期执行、Offer审批发放、自动招聘拒绝、根据敏感属性推断能力。AI-assisted detection仅非结论性信号，不能当作作弊证明或自动扣分依据。

## Section 3 — Module Context & Boundaries

```text
L0: Postgres / Redis Queue / Redis Streams / Object storage
L1: Identity / Core Record / Audit；公共AI、邮件、文件执行能力
L2: Screening ──事件总线── Assessment ──事件总线── Interview
                               ↕ 公共通知/邮箱服务
                         Candidate Portal / hr@邮箱
L3: Shell / My Focus / Task Feed / Jobs / Overview / Settings / Copilot
```

| 数据/边界 | 权威与访问 |
|---|---|
| User / Workspace / Membership / Participant | Identity统一user_id；候选人是受限参与者，不需员工Membership |
| Candidate / Job / Application / File及其版本 | Core Record唯一写入方；所有主档读写同步Core API，无数据库直连 |
| AssessmentProject / Case / Plan / Question / Attempt / Response / Evidence / Result | Assessment私有schema和后端；逻辑引用公共ID/版本 |
| HumanTask / Decision / Approval | 来源Assessment持有完成规则及事实；L3只读聚合 |
| 文件内容与FileVersion | 公共File登记/验权，对象存储承载内容；Material是别名，不再另一主表 |
| Connection / Notification / Delivery执行 | 平台公共服务自有schema，Assessment仅保留命令意图和受控ref |
| Model/Policy/Run/Budget | 公共AI Service；Assessment保留领域Prompt/Rubric及输出验证 |
| Audit / Timeline | 公共审计消费本地可靠发布的事实，不直接写audit表 |
| Screening / Interview / Offer | L2之间只经总线传递请求/事实/回执，详细产物引用Core FileVersion |

只需目标或JD即可起草项目、题库和试卷；需岗位时由Assessment UI经Core创建/引用Job，无需JD前端。邀请前确认公共Candidate、已发布标准/策略、邮箱参与者关联及批准。通用能力测评可无Job/Application；正式岗位招聘测评在邀请前通过获授权的关联决定创建/复用Core Application，草稿及历史待核验Intake可暂缺，不能由收到邮件自动建关系。已有有效人工关联直接复用。

共享记录不意味共享私有表。Assessment从第一天独立前端bundle/API/schema/凭据，仅直读写自身schema；不读core/iam或其他L2表，不做跨域JOIN/物理FK/跨服务事务。公共主档API、Identity/AI等平台调用允许；L2同步直调、借BFF/Worker绕行不允许。

内部交接：来源先注册并校验JSON详细产物为FileVersion ready，再以Outbox发轻量事件；目标通过Core API验权取得资料，保存本域输入manifest。Email继续用于候选人/员工通知、外部/跨部署交换和人工恢复，不作为同部署主档同步路径。外部映射仅第三方/跨部署；输入快照与可重建只读投影不成为第二可写主档。

Identity/Core不可用会阻塞身份/当前主档依赖动作；已固化输入且权限仍有效的草稿可继续，本地结果可保存但文件注册/交接等依赖动作等待恢复。总线不可用保留业务结果与Outbox；不回退为跨L2同步调用。Shell离线仍能打开Assessment独立入口和本域Tasks。

## Section 4 — Question Bank & Assessment Design

QuestionBank是独立主导航。Question有稳定编号、版本、书面/文件/口头使用方式、语言、难度、预计时长、提示、材料、交付清单、能力/岗位映射、Rubric、内部答案、AI指令、作者、来源、质量审阅和发布状态。

一个题可用于多个RoleProfile/Job，测试多个Competency/Skill。QuestionRoleMapping描述适用性；ScoringProfile描述该岗位如何评价。试卷选择精确QuestionVersion和ScoringProfile；更改题库不影响已发送内容。题目重复使用展示候选人已见题/提示记录；无外部记录显示Unknown。

支持搜索/过滤、收藏、标签、AI生成、模板、克隆、手工编辑、ZIP导入、预览、发布/停用及历史。ZIP导入先分材料和题目，人工确认内部答案及旧候选人提交不会外发。FIN-001/002/004/008是参考案例；FIN-003为follow-up guide；FIN-009/010仍是待编写概念，不能直接发送。

AI按 `要求→能力→所需证据→Blueprint→题目→Rubric`生成。质量审阅覆盖目标覆盖率、难度、时间、歧义、重复、评分合理性和不相关偏差；显示问题与人工处置，不只给质量总分。主观题有criterion与anchors，未知标准不得先邀请后补。

技术题支持代码/SQL/模型文件、隔离执行结果与版本化测试证据；不能在雇主设备或收件服务直接运行候选人代码/宏。适应性路径要有固定分支策略、选题理由、曝光和轨迹；不同路径无校准不可混排。所有这些功能可在原型中用合成输入模拟。

## Section 5 — Plans, Roles & Batch Work

AssessmentProject管理目标，Assessment是一份发布测评，AssessmentPlan管理某Candidate/Case的多项测试。PlanItem区分必评、选评、补证和修订；前置条件可串行或并行，满足条件仅生成待确认任务。Finance参考001+002；SIA参考004+008；Hybrid按必要性选择，不强制四题。

新增计划版本不覆盖已完成Attempt。跨岗位复用原作答需要权限和新岗位标准评价；岗位转看只产生关联提案，不替换原Case。

批量从精确名单预览→逐人策略验证→获授权发送→逐项追踪。部分失败只重试失败项，不回滚成功项、不因批次重放重复邀请。候选人修订/补测仍单独记录，不把所有人锁成同一阶段。

## Section 6 — Candidate Invitation, Email Login & Delivery

HR按邮箱选择计划/题包、截止、AI/网络/开卷规则、提交渠道和结果披露方式，预览并授权；系统通过平台公共邮件服务逐人发送，不暴露其他邮箱。候选人From/Reply-To统一hr@sendinglabs.com；内部任务由配置的模块通知身份发至员工个人公司邮箱，实际Assessment内部别名由平台确认，不编造已开通地址。题包默认接受后释放，也支持明确标注提前披露的邀请附件ZIP；受控链接用于大包。

Candidate使用统一Identity的受限参与者流程验证受邀邮箱并明确接受，可拒绝；无需雇主成员账号，禁止Assessment自行发登录凭据。GET点击不消耗验证、不接受、不开始计时。接受后timed仍需Start test；deadline_only接受后可离线作答，仅截止日，无伪在线倒计时。新修订/补测需接受新安排。同邮箱多岗位任务隔离，验证邮箱只证明邮箱控制，不证明法律身份。

邀请提供预计工作量、时区、提交清单、策略和帮助入口；候选人方便使用手机接受、查看结果和上传文件，复杂Excel/代码作答可提示桌面更合适，不封死移动端。

## Section 7 — Submissions & Evidence Files

Portal上传为草稿，明确Submit answers才锁定。Take-home默认允许verified邮箱向统一hr邮箱下该轮已确认线程/安全关联标识发完整附件自动提交；也可配置邮件先接收后Portal确认。系统只读企业连接的接收邮箱，不需读候选人个人收件箱。

身份、认证、线程关联、接受、轮次、必交物、格式/安全、截止均通过才自动提交。咨询、自动回复、附件外链、身份不明、缺件和模糊任务不作完成。邮件收件回执与正式提交回执分开；不完整项提示所缺资料和处理入口。

SubmissionBundle保存原ZIP及成员、hash、版本和题目绑定；一个ZIP可含多案例，绑定必须确定。邮件/上传共用提交事务与去重。不同版本草稿冲突需选择；提交后后到文件不覆盖，需新修订或批准更正。

可信服务接收时间用于email auto_submit期限；确认模式/Portal按正式提交命令时间；补件按最后必需件时间。扫描或回调延迟不误判按时邮件，处理日志仍保留实际完成时间。保存/解析失败不是零分。

Evidence支持文本范围、PDF页码、文档段落、Excel工作表/范围/公式/缓存值及计算状态。未重算公式不可声称正确；宏/外链不自动执行。Source/Issue Register区分题目故意缺文件、候选人缺交付、系统尚未取得资料。

## Section 8 — Scoring, Review & Result Publication

每个criterion有满分、理由、证据和Confidence。题目多能力按criterion fraction分配，和=1；标签不额外计分。Overall为题目权重下criterion贡献和，任一必评Unknown则Overall=null，不采用Screening示例的缺项再归一化。界面分开Score、Coverage、Confidence，分数不是录用概率。

AI、人工和规则评价独立留存，AI失败可有界重试/人工接手；最终内部结果经授权人确认，覆盖记录原值/新值、理由、时间与版本。严重问题独立显示，不被平均分掩盖；不自动拒绝。

CandidateResultRelease是候选人可见投影，至少说明结果和下一步；可选summary或score+summary，默认不含内部排名、notes、参考答案或Integrity原始信号。发布批准可与内部final确认一次完成；随后自动Portal发布和邮件通知。发布不等于送达，退信不回滚评分。待复核发送进度通知，不冒充最终结果。纠正/撤回留历史，无法保证收回外部邮件。

## Section 9 — Revision, Retake, Supplemental & Handoff

Rescore=同答案新评价；Revision=见提示后新Attempt；Retake=重考新Attempt；Supplemental=新能力新PlanItem。FeedbackPackage区分hint_only/issue_specific/worked_solution及内部notes；发送前固定内容和批准。每次新轮独立邀请/接受/线程关联，统一邮箱下旧线程不重定向新轮。

并列初始/修订/披露条件、修正点与未解决问题。没有同标准同条件比较时delta=null；不能仅凭提高分数推断学习能力。负责人从结果页选择修订、补测、面试、Hold、关闭测评或岗位转看提案；批准后执行自动发信、收件、排队和提醒，AI建议不直接推进。

AssessmentPackage/AssessmentPlanPackage交付当前结果、精确快照、证据、已做案例、反馈披露、未测能力、关键冲突和InterviewFocus。独立报告在Fail/Hold/证据不足时也可出具；招聘与Offer决定不由本模块替代。只上传历史摘要时保留approximate/range与未核验，不伪造有效分数或附件hash。

## Section 10 — Candidate Comparison & Analytics

与Screening共享Compare视觉/交互：2–4人默认舒适并排，能力为行；Same stage、Current summary、Changes since last round；Key Differences、只看差异、显示Unknown、证据下钻、评论、保存快照、逐人下一步。

Assessment准备/历史复核可比较同岗位Case但不做正式排名；正式岗位测评引用同一Core招聘关系，通用能力测评可无Application；跨阶段资料展示来源/覆盖，只有同岗位、有效量尺/Rubric/试卷等价及曝光条件的成绩可排序。初稿与见答案后修订不混排；没有明确领先者可显示No clear overall leader。AI摘要每个重要论点有证据，不能强选赢家。

刷新生成新ComparisonSnapshot，旧版保留；源更新显示Stale。导出单页PNG/PDF及完整报告默认浅色，超过舒适人数明确子集/分页，禁止缩字或静默漏人。生成对比/导出不发送邀请。

Analytics包括邀请接受率、开始/提交率、评估耗时、题目表现、同等条件排名和版本化校准；每个指标标分母、单位、窗口、样本量，修订另分cohort。后续Interview/Hire/Performance反馈经授权导入用于校准候选规则草案，不自动改当前评分；标选择偏差和相关性限制。支持反馈事实→信号→提案→审核生效，个人视图偏好不改变团队Rubric。

## Section 11 — Shared Capabilities & Ownership

| 公共编号 | Assessment落地 | 业务边界 |
|---|---|---|
| SHARED-01 | workspace、actor、对象/用途权限 | 不自动授予候选人雇主成员身份 |
| SHARED-02/03 | Light/Dark/Deep/System；Blue/Teal/Violet；14/16/18字号 | 统一user_id账号级偏好；Candidate/Employer访问scope隔离 |
| SHARED-04 | Files、预览、版本、下载与导出 | 文件可Available但业务未绑定 |
| SHARED-05/06 | 企业邮箱/文件夹规则、Read now、监控、检查点 | 文件层不自动接受/提交；Assessment策略决定 |
| SHARED-07 | 批次/机器Job/Attempt运行历史 | 机器成功不是人工Task完成 |
| SHARED-08 | 首页分组、折叠、指标刷新/下钻 | Assessment定义自己的单位与权限 |
| SHARED-09 | My Tasks、领取/转派、等待、通知 | 业务动作成功才完成任务 |
| SHARED-10 | 来源、审计、保留、撤回 | 不因日志保留无限复制候选人内容 |
| SHARED-11 | AI Models目录/策略/质量/成本/回退 | 模型配置不改变岗位标准/人工结论 |
| SHARED-12（公共规范已登记） | Compare框架、快照、导出、批注 | 本模块定义可比性；来源旧文待编号不再重复造ID |

公共功能按完整范围设计，继承Interview v1.6 §8.2–8.8及Screening v1.3 §13的机制；统一平台owner建设一次、独立版本管理，不在每个业务模块复制本地实现。来源旧P1标签不延后自动价格同步（供应商支持时）、质量回归、受控灰度和告警；未知外部能力显示限制。自适应模型路由不默默启用，仍需版本化策略评测与批准。

## Section 12 — My Tasks, Statistics & Notifications

My Tasks标签：Assigned to me / Available to claim / Created or followed / Completed。任务包含题目发布复核、计划批准、身份/附件绑定、评分复核、结果发布、反馈修订批准、补测批准、对比评审、交付异常。支持领取、转派、优先级、期限、开始、等待、评论、历史和深链接。

每个活动Task恰有引用统一user_id的assignee或授权queue；无岗位路由Assessment队列。状态open/in_progress/waiting/completed/cancelled；waiting需原因和恢复时间/事件；overdue为派生标记，默认不暂停期限。业务成功后完成Task，不提供绕过审批的勾选完成。转派不授予数据权限；并发领取有冲突处理，版本过期禁用旧动作。

首页默认My Work → Workspace Overview → More statistics → Projects。T1/T2/T3只是展示优先级，全功能都保留。My Work按个人；Assessment的Workspace Overview采用**当前用户获授权记录范围**，显示Accessible workspace，不复制Interview“所有雇主见全部汇总”。Admin可见完整授权workspace。范围切换清旧缓存，不闪现上一身份数字。

| 指标 | 单位与精确口径 |
|---|---|
| My open tasks | 唯一task_id；本人open/in_progress/waiting，父容器不重复加子任务 |
| Reviews awaiting me | 上述任务中evaluation_review/result_release/feedback_review子集，不与总数相加 |
| Due today / Overdue | 有效时区今天窗口 / due_at<now且未结束；等待默认仍计 |
| Available to claim | 当前有资格的queue任务，独立于My open |
| Active projects | 授权范围project.status=active，非归档/删除，唯一project_id |
| Awaiting acceptance | sent/opened的有效Invitation，唯一invitation_id；退信仍待接受但显示交付问题 |
| Awaiting submission | accepted/started未终态邀请，唯一invitation_id；修订轮分标签 |
| Submission issues | 未关闭的MailIngress/SubmissionDraft问题经issue_group_id去重，不按每封通知数 |
| Results to release | final结果尚无当前published Release的唯一Case；不算历史多版本 |
| Delivery issues | 需人工处理的唯一逻辑Delivery，不累加每次retry |
| Completion / acceptance rate | 明确邀请cohort及as_of；accepted含已开始/提交者，submitted按该cohort唯一邀请；取消排除并单列，迟到修订不计原轮 |

每张指标点入相同过滤/快照列表；0/loading/unavailable/stale不同。业务成功、回前台、手动刷新后更新；局部失败不清空其他卡。团队工作量按权限，不把Task数当Candidate人数或员工绩效。

通知覆盖邀请/接受、收件/正式提交、补件、临期、评估待复核、结果、修订/补测、取消与异常；直达具体任务，角色裁剪。初次分配即时，临期/逾期按策略合并，完成/取消/转派撤销旧提醒。读取邮件不是发送授权，候选人结果按已批准release自动发送。

## Section 13 — Files & Integrations / AI Models

Files & Integrations使用共享UI和平台服务，独立工作区有Files / Connections / Activity；公共File/FileVersion是唯一文件主档。Drive式拖放、多选、进度、预览关闭返回原位置、单/多文件下载、Preparing、来源版本与历史。文件读取、提取、业务消费、导出生成分别有状态；Unassigned不等于失败。连接有授权范围、规则、Read now、Pause/Resume、重新授权和检查点；仅重试失败项，成功材料业务导入失败只重投递，不重新下载。所有读取含空结果、跳过、失败和重试留记录，不改写源邮箱/文件夹。

AI Models有Catalog / Task policies / Compare & evaluate / Usage & cost / Activity & versions，支持多供应商、凭据引用、能力/地域/保留复核、价格单位/来源/生效时间、样本数和P50/P95、任务质量门槛、预算预占/结算、在途并发、受控回退、版本发布/回滚、自动同步/回归/灰度/告警配置。未知价格不是免费，未评测不是达标。

顺序固定为硬约束→质量→成本/时限→已发布偏好。任务包括question_generate、blueprint_generate、quality_review、file_extract、evidence_map、rubric_evaluate、feedback_draft、candidate_compare、calibration_signal。普通HR使用已发布策略，管理员配置连接/预算，领域负责人确认任务质量。失败显示No eligible model及原因，保留人工路径。所有原型价格/质量/时延标Sample data，不调用真实供应商。

## Section 14 — Design System & Interaction

英文界面、Google Workspace风格、舒适间距、蓝色主操作；不采用Attio/Linear主风格。任务/列表用Gmail式层级，报告/评论用Docs式阅读，文件用Drive式操作；不复制Google商标。

雇主端1440×900设计、1366×768验证；Candidate端390×844及桌面都覆盖。除明确Compare/电子表格区域外避免横向溢出。采用 `Decision / Next action → Explanation → Evidence`，不可首屏堆全部JSON、hash、ID、模型参数。技术信息只在详情/审计供运营使用。

Light默认，Dark中性灰、Deep海军蓝、System跟系统；Accent Blue/Teal/Violet；Text size Small/Medium/Large默认16px，建议14/16/18。跨组件即时生效，保留表单/筛选；账号级偏好与user+workspace+module局部视图分开，保存失败可重试。Reset只重置外观/布局，不删业务稿件。导出默认浅色。

键盘、焦点、Escape关闭并回到触发点、200%缩放、读屏标签、非纯颜色状态、长文换行均需验证。未保存离开有提示；等待/失败可恢复，空状态给下一步。显示偏好和个人Compare视图不改变Rubric或团队分数。

## Section 15 — Reliability, Security & Versioning

公共ID/精确版本Ref、冻结输入manifest、事实所有权、tenant隔离、source/provenance/model/prompt/policy版本、confidence与审计沿用Spec。每次邀请/提交/结果/通知幂等，source更新不覆盖已发布结果。保存原稿、反馈、修订版本和来源，Evidence必须能定位。

候选人token由统一Identity签发，短期、用途限定、平台端安全存储；GET无业务副作用。文件安全/隔离与模型输入最小化，附件代码不执行，内容指令不改变系统行为。所有读写/导出重新按对象与用途授权，转派或Comparison不扩大权限。

业务完成和交付分离，各服务自身schema的outbox/inbox有界重试，未知发送先查状态。撤回/保留/删除按策略及实际渠道能力，不承诺远程收回邮件。Mock不含真实个人信息且无外部副作用。当前材料只是历史汇总时不得宣称原附件已核验。

## Section 16 — Prototype Scope & Acceptance

完整页面、双角色门户、关键组件、状态矩阵、虚构一致数据和演示路径见Design Brief。外部邮件、OTP、模型、文件夹、代码执行及下游采用显式Demo adapter，不能用无意义toast代替本地状态转换；服务模拟不等于删功能。

| 验收组 | 必须覆盖 |
|---|---|
| A 题库/计划 | 多岗位/多能力、发布版本、概念题不可发、批量部分失败、公共基础层+单模块，准备阶段无Application |
| B 候选人闭环 | 验证/接受≠开始、timed/deadline-only、上传草稿、邮件自动提交/模糊匹配 |
| C 评分/迭代 | Unknown不归零、人工覆盖、候选人Release、反馈新轮、补测新项、旧路由保护 |
| D Compare | 同阶段/跨轮/不同比较条件、证据、stale、导出、逐人动作但不自动发送 |
| E 公共 | Task领取转派/等待、正确统计、Files全状态、Model预算/区域/回退/回滚 |
| F 设计 | 全主题/字号、桌面及Candidate手机、键盘/缩放、返回/深链接/错误恢复 |
| G 可靠性 | 重复/竞态、邮箱断连、迟到解析、无下游、无ACK、权限隔离、纠正版本 |

v1.2 AUTO-01–16、Spec MAIL-01–20继续有效，由本版Design Brief具体场景映射执行。当前仅检查文档与样例，不声称真实集成和可访问性已通过。

## Section 17 — Change Log & Traceability

| 来源 | 本版采用 | 未机械移植 |
|---|---|---|
| Interview v1.6 §8 | 公共外观、字号、文件、模型、统计框架 | 面试场次、会议、双签及全员汇总权限 |
| Screening PRD v1.3 §5/8/13 | Compare、Task、全功能公共能力、阶段状态分离 | Resume-only简历库主流程、筛选缺项归一化；岗位关联现按公共基线统一 |
| Screening Brief v1.0 §4/10–15 | 导航表达、页面交互、虚构数据、场景验收 | Screening专用路由/人物和业务流程 |
| Assessment v1.2 | 题库、邮件身份/接受、提交与结果闭环 | 旧章节互相覆盖的阅读方式 |

v1.3：整合当前PRD；补齐公共Task/统计、Compare和校准、Files/Models、设计规则；Spec保留详细既有契约并补公共UI/运行类型；新增Design Brief。原v1.0–v1.2及三份来源文档未修改。


## Section 18 — Foundation Integration & Prototype Additions

### 18.1 统一工作台与模块装配

新增Shell模式与Standalone模式：前者使用My Focus、Task Feed、Jobs、Overview、Settings、Copilot统一导航，Assessment bundle隐藏重复全局导航；后者由同bundle展示Assessment本域导航/Tasks，仍使用同一Identity/Core。模块registry声明identity/ui/api/events/data/tasks/level、entitlement和契约兼容范围，稳定深链，不开通不显示可执行入口。新增模块无需复制账号/候选人。

Jobs/Candidate详情显示同一公共记录及当前版本；结果页另显示Used for this assessment的固定版本。公共Profile更新只使结果待复核，不静默改分。角色/身份切换为统一账户授权，不通过“切模块”注册新用户。全局Task Feed聚合获授权任务，动作由浏览器/BFF路由所属L2；L2自身不能借此调用另一L2。

### 18.2 可靠主档调用与结果交付

本地保存稳定request_id和意图→Core幂等命令→本地补记公共ref。Core已成功但响应丢失/本地保存失败进入Reconciling，通过同键查询恢复，不重新建Candidate/Application/File，不自动删除成功主档。结果文件状态uploading→ready/failed，ready前不得发布交接事件；详细JSON有schema/version/主档引用/证据文件引用/授权范围，PDF只作人读补充。

总线S0采用Redis Streams，不是普通Pub/Sub。不同模块consumer group独立，同模块副本共用group；本地事务写Inbox+业务结果+回执Outbox后ACK，处理pending、死信、重放和trim策略。机器作业Queue和业务事件流分开。具体版本/容量/RPO/RTO仍由工程确定，本文不作性能承诺。

### 18.3 不变与新增验收

题库、双通道提交、提示修订、AI/人工评分、候选人结果披露及统一视觉继续有效。新增：同user_id跨模块；共用四类主档；无跨schema访问；总线唯一L2通道；hr统一邮箱的并行任务/旧轮关联；Core/Identity/总线中断；ready前不交付；Shell与独立模式同实体同任务；平台通知/AI/审计不在Assessment复制数据库。

v1.4：按最新架构v2.2/数据v1.2替代旧独立主档模式，新增上述验收；设计原型直接seed公共身份/主档，不先制造以后要归并的数据。仅更新文档，未建立数据库、服务、账号、邮箱连接或执行任何真实通信。
