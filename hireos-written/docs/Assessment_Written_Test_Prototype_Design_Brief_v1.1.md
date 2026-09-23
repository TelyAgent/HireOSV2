# HireOS Command — Assessment / Written Test Prototype Design Brief

| 属性 | 内容 |
|---|---|
| 编号 / 版本 / 日期 | CMD-ASM-003 / v1.1 / 2026-09-11 |
| 用途 | 独立指导完整、高保真、可点击原型；本文件是设计交接，不是已制作的原型 |
| 产品基线 | [Assessment PRD v1.4](Assessment_Written_Test_PRD_v1.4.md) |
| 数据基线 | [Assessment Interface Spec v1.4](Assessment_Written_Test_Interface_Spec_v1.4.md)，Assessment契约4.0.0；公共API版本由平台声明 |
| 风格参考 | [Interview PRD v1.6](HireOS_Command_Interview_PRD_v1.6.md)、[Screening Brief v1.0](Resume_Screening_Prototype_Design_Brief_v1.0.md)、[Screening PRD v1.3](Resume_Screening_PRD_v1.3.md) |
| 界面语言 / 设备 | 英文；雇主端桌面Web、笔记本优先；候选人端桌面及手机 |

## 1. 使用方式、范围与权威

设计者可凭本文件组织页面、数据和演示路径，详细业务和字段同时依据配套PRD/Spec。优先级为最新用户要求→公共架构v2.2/数据v1.2→当前PRD/Spec→本Brief布局默认→历史参考。三件套存在业务冲突时明确修订，不能依靠视觉简化悄然改变状态。

全部已确认功能要有完整界面和合理交互；外部认证、邮件、模型、文件夹、代码环境和下游可以模拟并标Demo，不是真实接入。模拟控件必须修改一致数据/任务/历史，不能只toast“Success”。本次不要求生产后端、真实发送或接入供应商。

尺寸、色值、虚构人物、文案和组件组合为本Brief的设计默认，沿用公共风格语义，可为可读性微调；不是声称已存在一套精确色值设计稿。实际Finance/SIA案例仅作为流程参考，演示不复用真实姓名、工资、邮箱或原文件。


### v1.1 公共底座对齐（当前）

参考 [统一架构v2.2](references/command-foundation-2026-09-11/HireOS_Command_Shared_Foundation_Data_Integration_and_Build_Plan_v2.2.md) 与 [公共数据v1.2](references/command-foundation-2026-09-11/HireOS_Command_Common_Data_Foundation_and_Database_Plan_v1.2.md)。保留视觉、题库、邮件提交和修订交互，更新身份/主档/内部交接与Shell装配，新增F01–F12演示路径。不得照旧原型建立每模块账号/候选人/文件仓库后再映射。

原型模式：**Shell组合**与**Assessment独立入口**引用同一合成Identity/Core实例。独立是无其他业务L2或Shell依赖，不是无公共平台。原型可模拟平台服务，但只建设一个共享适配器与主档store；UI不会真的部署Redis或数据库。

## 2. 产品决策必须保持

| 主题 | 原型规则 |
|---|---|
| 独立工作 | 公共Identity/Core/运行能力+Assessment；草稿可无Application，正式岗位邀请前确认公共关系 |
| 一题多用 | 同QuestionVersion用于多个岗位；criterion多能力分配，不重复加分 |
| 模板与候选人 | Question/Assessment/Plan/Attempt分别显示，不把题目编号当结果ID |
| 邮箱入口 | 统一Identity受限参与者，无员工Membership；同一user_id，不另建Assessment账号 |
| 接受与开始 | 打开链接≠接受；接受≠timed开始；deadline-only不强制倒计时 |
| 上传与提交 | 上传为草稿；明确提交或合规邮件auto-submit才锁定答案 |
| 收件与结果 | Received / Submitted / Evaluated / Published / Delivered分开 |
| 提示后修订 | 新轮、提示版本、原稿保留；后续题不自动被接受 |
| Unknown | 空分数与Coverage/Confidence并列，不填0或改用Screening重归一化 |
| 人工与自动化 | 人工批准具体范围，系统执行邮件/收件/排队；AI不直接招聘推进 |
| 候选人结果 | 单独Release白名单，不直接显示内部评估页 |
| 公共能力 | Task、Files、Models、Appearance、Compare复用外壳与机制，业务权威在Assessment |

## 3. 统一视觉系统

Google Workspace风格：亮、清楚、舒适；蓝色主操作，少量功能性色块和细边界。Gmail式任务列表，Docs式报告/评论，Drive式文件操作。不使用Attio/Linear式高密度小字工作台，不做夸张营销渐变、霓虹或大面积玻璃效果。

### 3.1 建议tokens（原型默认）

| Token | Light | Dark | Deep |
|---|---|---|---|
| Canvas | #F8FAFD | #171A1F | #0D1726 |
| Surface | #FFFFFF | #22262D | #152238 |
| Primary text | #1F1F1F | #E8EAED | #EAF0FA |
| Secondary text | #526071 | #B2BCCB | #B4C2D6 |
| Border | #DCE3ED | #414A58 | #374B65 |
| Blue accent | #0B57D0 | #A8C7FA | #A8C7FA |
| Selected surface | #E8F0FE | #263C60 | #203B61 |

Teal/Violet为独立Accent选项，建议Light #006A6A / #6741C0，暗色使用较亮配套；成功、警告、错误颜色不受Accent覆盖。状态必须同时有icon/text。设计后验证实际前景/背景对比，目标正文4.5:1、UI边界/焦点3:1，不声称仅有token表就已通过。

字体优先系统sans，避免依赖未授权字体；正文Small/Medium/Large=14/16/18px，默认16px；标题24/28px、次级标题20px随比例变化。不得用全局12px容纳内容，辅助短标签也应可读。间距4/8/12/16/24/32px；输入/主按钮高度44px，桌面表格行默认56px并按Large增高；卡片12px圆角、模态框16px，细分隔线优先于重阴影。

Light默认；Dark中性灰；Deep蓝灰；System跟系统。Appearance常驻头像菜单和Settings，切换作用所有自有表格、菜单、证据高亮、弹层和错误状态。跨页保留输入与筛选；账号偏好可用本地模拟但注明未实现云同步。同一user_id账号偏好跨模块共用，Candidate/Employer的授权scope与不同用户设置隔离；不能另建模块身份来保存主题。

### 3.2 布局与设备

雇主以1440×900设计，1366×768核验。App bar 64px、sidebar 232px可收窄，内容间距24px；宽度不足先隐藏次要列到详情，不缩正文。详情默认列表+主面板两栏；证据drawer覆盖次要区域，不叠出四个窄列。Compare与spreadsheet viewer可在明确容器横向滚动，页面自身不横向溢出。

Candidate端390×844及1440×900：无雇主sidebar，使用统一Identity参与者入口，品牌/任务头+单列正文，最大内容宽880px，底部主操作安全区可见。长文件名换行；移动端上传/邮件说明/接受/查看结果/拒绝可用。代码/Excel复杂编辑提示Open on desktop但仍可查看任务、上传已做文件。200%缩放主要操作和Close始终可达。

## 4. 信息架构与路由

Standalone本域导航：**My Tasks / Assessments / Question Bank / Comparisons**。公共：**Files & Integrations / Activity / Settings**。Shell组合时采用**My Focus / Task Feed / Jobs / Overview / Settings / Copilot**全局导航，嵌入Assessment隐藏重复全局导航，本域tabs和深链保留。Jobs/Candidates作为Assessments工作区内视图，不额外复制一个Screening Resume Library。Submission Inbox从Assessments子导航和My Tasks异常卡进入。Candidate Portal独立参与者外壳，但认证权威仍为同一Identity。公共Files/Settings/AI Models使用共享组件和平台适配器；不能每模块重复创建配置记录。

| 页面 / 建议路由 | 核心内容 | 必须可点击动作 |
|---|---|---|
| My Tasks /tasks | 个人、队列、统计、当前任务 | Claim、Start、Assign、Wait、业务深链接、History |
| Assessments /assessments | 项目、岗位、计划/状态 | Create project、Import、过滤、批量邀请 |
| Project /projects/:id | 目标、标准、候选人计划 | 编辑草稿、选择题库、添加候选人、Compare |
| Question Bank /question-bank | 可复用题目和filters | Search、Role/Competency filter、Import ZIP、Create、收藏 |
| Question /questions/:id | Prompt/Materials/Rubric/Usage/Versions | 编辑派生版、预览候选人视图、审阅、发布、停用 |
| Builder /assessments/:id/builder | Blueprint、Sections、题目绑定、覆盖/权重 | Add from bank、AI generate、改序、质量审阅、Publish |
| Plan /cases/:id/plan | 多项必评/选评/修订、版本、下一步 | Add test、Approve plan、Invite、History |
| Invitation /invitations/new | 收件人、材料、截止、提交/结果策略 | Preview、Send demo、逐项结果、Retry failed |
| Inbox /submissions | 邮件/上传输入、绑定/缺件/身份 | Open、Confirm mapping、Resolve conflict、Request files demo |
| Submission /attempts/:id/submission | 原ZIP树、交付清单、时间/轮次 | Preview、定位题目、查看received/commit、版本选择 |
| Evaluation /attempts/:id/review | Score、rubric、证据、人工评估 | AI demo run、Human score、Override reason、Finalize |
| Release /results/:id/release | 内部与候选人内容分栏 | Disclosure选择、预览、Approve & publish、Delivery |
| Revision /cases/:id/revisions/:round | 原稿/提示/修订、差异 | Draft feedback、Approve、Send new round、Compare evidence |
| Compare /comparisons/:id | 2–4人、Key Differences、证据 | 模式、仅差异、批注、刷新、导出、逐人下一步 |
| Handoff /deliveries/:id | 包、目标、版本、交付/回执 | Preview、Export、Send demo、Retry、Inspect receipt |
| Files /files | Files/Connections/Activity | 拖放、多选、preview、download、read now、pause、reauthorize |
| Settings /settings | Appearance、Policies、Preferences | 主题/字号、策略、校准提案审核/回滚 |
| AI Models /settings/ai-models | Catalog/Task policies/Evaluate/Usage/Activity | 选模型、约束、预算、测试、发布、回退、回滚 |
| Candidate /candidate | 本人待接受/进行中/结果 | 选择任务、邮箱验证，不能切至雇主界面 |
| Accept /candidate/invitations/:id | 邀请、验证、条款与时间 | Verify demo、Accept、Decline；GET无状态副作用 |
| Work /candidate/attempts/:id | 材料、要求、草稿/邮件说明 | Download、Start timed、Upload、Submit answers |
| Result /candidate/results/:id | 已发布Release、下一步 | View feedback、Accept revision/supplement、History |

允许合并tabs/drawers，但操作、深链接、返回原过滤列表必须完整。不要把路由/ID/JSON打印给普通HR。需要技术详情放Details/Activity。

## 5. 核心页面设计说明

### 5.1 Home与My Tasks

首屏先My Work（不超过4张行动卡），再Accessible workspace紧凑汇总，再Projects/Tasks。More statistics默认折叠但可展开，保留数字摘要。不要一排塞7张卡。任务行显示角色/岗位、类型、priority、截止、状态、明确动词按钮，右侧详情展示Required action和来源版本。

Tabs为Assigned to me / Available to claim / Created or followed / Completed。Start改变Task状态，完成只能通过业务按钮。Waiting要求理由与恢复时间/事件；Cancel/Wait不算完成。领取冲突显示`This task was claimed by another reviewer`并Refresh。转派不暗示新负责人有文件权限。

所有指标口径PRD§12，卡片进入同过滤列表。My Work随角色变；accessible范围如不同，workspace数字也可不同，不复制Interview全部雇主相同总数。0 / Unavailable / Loading / Last updated四种状态独立。Filter范围与as-of明确。

### 5.2 题库与Builder

题库默认list（编号/题目/岗位标签/能力/方式/难度/版本），可切卡片；选题后右侧预览，不直接给候选人发题。详情tabs Prompt、Materials、Rubric、Usage、Versions；内部答案旁标`Reviewer only`。Candidate preview独立只渲染白名单。

Builder左侧Sections/Questions，主区编辑，右侧可折叠Coverage/Difficulty/Estimated effort；1366宽下Coverage用drawer。能力分配显示criterion→能力chips及百分比，总和错误显示精确行，不只toast。题库引用更新提示`A newer version is available`，需显式选择新版本，不静默替换。

发布预览包含题包、交付清单、权重、可见材料和质量问题。Concept案例显示`Draft the assessment before inviting candidates`，按钮禁用有说明。AI生成展示loading/失败/重试及草稿标识；可人工编辑，保存不等于publish。

### 5.3 Invitation Composer

步骤：Recipients → Tests & materials → Timing & submission → Result disclosure → Review & send。候选人列表与批量选择数量固定；Preview逐人模板、题包版本、预计工作量、时区及Reply-To。`Send invitations (demo)`明确动作，成功进入逐项Delivery而非只toast。

timed显示duration+deadline；deadline-only仅deadline。邮件auto-submit说明`Complete answers sent from your verified email can be submitted automatically`；confirm模式说明需再确认。对关键条件改变标旧批准失效，保存草稿可退出再回。

### 5.4 Candidate Portal

邀请页：公司/岗位、题目名称、预计工作量、期限、AI规则、邮箱验证、Accept / Decline。验证演示调用共享Identity adapter，不用真实发送，显示Demo code；页面明确统一HireOS身份入口，不模拟独立Assessment密码库。接受成功文案`Invitation accepted`；timed仍提供`Start test`并提示开始计时，deadline-only为`Open assignment`。

作答页顶部显示当前轮次和期限；Materials/Required deliverables/Your answers，文件行显示Uploaded draft/Scanning/Ready/Missing。Bottom CTA `Submit answers`打开最终清单确认，提交成功展示receipt/time和`Your answers are submitted`。后续不能继续编辑旧轮。Email option显示统一hr邮箱预览、明确轮次/回复线程、附件要求及何时算正式提交。

结果页只读CandidateResultRelease，清楚Outcome、Feedback、Next step；内部评审评分、排名和notes完全不进入DOM/fixture投影。修订入口标`Revision round 1`、提示和新期限；补题标`Additional assessment`，均明确接受新安排。

### 5.5 Submission Inbox与审阅

仿邮件列表，但任务匹配与状态为第一层：Received、Needs confirmation、Incomplete、Submitted、Duplicate、Quarantined。详情展示邮件/附件、候选人/轮次匹配、Required deliverables、可信接收时间和处理时间；普通HR默认看可读说明，认证/Message-ID/hash放技术Details。

不能因打开附件自动提交。确定性完整邮件模拟自动提交后列表、Task、Candidate receipt、评分Job同步；缺件演示Request missing files；不同版本显示左右文件差异及选择，不允许正式提交后覆盖。

Evaluation以结论/下一步为首层，维度/Rubric第二层，Evidence第三层。点score→criterion→reason→source excerpt/page/sheet cell。AI score和Human score并列，Override需理由，旧值可查。Confidence与Coverage单独，不把90% score解释成录用概率。Excel preview展示formula与`Calculation not verified`，不编造重算结果。

### 5.6 Release、Revision、Compare与Handoff

Release左为内部参考、右为候选人预览；一键`Finalize & publish result`需同时满足复核和披露批准，系统自动创建portal版本和demo邮件。Delivery失败留结果可见，提供Retry notification。非final显示`Under review`进度，不能发布假最终分。

Revision三块按空间tab切换Original / Feedback / Revised，Compare changes显示已修正/部分/未解决和提示披露。缺初稿不可用分差，显示`Not comparable`。追加题用同题库drawer选题，创建新PlanItem而非改原题。

Compare顶部Role/Snapshot/Mode/名单，下面Key Differences和矩阵。首列固定维度，2–4人默认；Unknown/Not provided/Restricted/Not comparable文案不同。每列底部Next action，先提案再批准，不因排序就发送。单页导出超人数提示选择子集或分页；默认浅色文件，真实生成demo下载或明确说明被模拟，不虚称已生成产物。

内部Handoff时间线：Result finalized / Preparing shared artifact / File ready / Event queued / Published / Intake received / Imported，各有来源和时间；没ACK显示Awaiting confirmation。Email Delivery时间线仅用于人员通知/外部交付，不是内部主档传输。Report-only也可交付，Interview未启用仍可下载外部包，不制造强制全局流程；Core不可用不能声称仍可生成ready共享文件。

## 6. 公共模块完整体验

Files遵循Drive操作：拖放→进度面板→部分失败→单项重试→preview→多选download→Activity。关闭进度面板不取消任务；Unassigned文件仍Available。Connections模拟Email/Folder范围、Read now、Pause/Resume、Auth required和checkpoint；不编辑源邮件/目录。页面级Submission Inbox是业务消费视图，不再实现第二套文件存储。

AI Models覆盖完整Catalog / Task policies / Compare & evaluate / Usage & cost / Activity & versions；自动价格同步、回归、灰度和告警有配置和运行例子，供应商unsupported时有原因。列表全部价格、延迟、质量标`Sample data`。演示No eligible model原因、预算预占/结算、primary timeout→approved fallback、回滚新版本，不改历史Result。

Settings → Preferences分Appearance/View与Calibration proposals；个人列/主题无审批，团队Rubric变化要审核发布。反馈事实、信号、提案、生效政策四层可追溯，不让系统自学后偷偷改分。

## 7. 数据fixture与演示角色

使用一个共享状态store和可重置seed；每页读取同一对象，不随机生成数字。store分iam/core/assessment/platform/ai/audit/L3 projections，Core仅共享adapter可写，业务页面不得直接改core对象。日期用固定demo clock `2026-09-11T08:00:00Z`、时区Asia/Shanghai；可提供`Advance demo time`按钮，明确不是当前实时业务。候选人收件地址用example.com；From/Reply-To预览按配置显示hr@sendinglabs.com，但发送adapter强制simulation_only，不连接SMTP或发送真实邮件。内部模块邮箱未确认时显示Configured module sender，不造真实别名。邮件/身份/模型均模拟。

| 实体 | 基线定义 |
|---|---|
| Workspace | 统一Identity中的ws_demo / Aurora Studio（虚构） |
| HR / HM / Admin | Emma Wilson / Daniel Park / Morgan Reed；Demo role工具在独立演示栏，不混入真实账号菜单 |
| Project | prj_fin / Finance Operations Hiring，active，FIN-001为当前必评，FIN-002为候选补测；演示组合不代表所有岗位永久只需001 |
| Secondary role | Strategic Investment Associate，仅用于题库004/008和跨岗位映射演示 |
| Candidate A | Alex Morgan / case_a；FIN-001初稿final=70，release未发布；可给提示修订 |
| Candidate B | Jordan Lee / case_b；inv_b=accepted，deadline-only，尚未提交，score=null |
| Candidate C | Casey Chen / case_c；inv_c=started，邮件缺一份必交物，score=null，issue_group_c=open |
| Candidate D | Taylor Brooks / case_d；inv_d=submitted，human review pending，AI draft=80，非final |
| New candidate | Riley Stone仅在P03流程添加，不计基线任何数量；新邀请从draft开始 |

Alex的合成Rubric：同一题100分，Accounting criterion满分40得30、Analysis满分40得20、Communication满分20得20，overall=70；每criterion有合成文件片段。后续修订分数只在模拟新答案/复核后生成，不自动改基线。Taylor的AI draft=80必须明显标Draft、人工未确认，不与Alex final直接作同阶段排名；Compare默认Current summary。B/C未测是Unknown不是0。

预置6个action Task：t1 Alex release→Emma open；t2 Taylor review→Daniel open；t3 Casey缺件→Emma waiting；t4 题库发布→reviewer queue open（Daniel可领）；t5计划草稿review→Emma in_progress；t6旧交付恢复→Morgan completed。无父container。Emma My open=3，Daniel=1，Admin=0；Daniel Available to claim=1。Due today按真实due_at生成，不手写卡片。workspace基线1 active project、0 awaiting acceptance、2 awaiting submission、1 submission issue、1 result to release；所有三位demo雇主在此seed有同scope权限，故共享这些数字，另P21演示受限scope变化。

fixture必须含稳定ID、精确ref/version、业务与Delivery独立状态、Question→材料→Response→Evidence→Evaluation的来源链、Tasks、metrics计算和操作历史。原始案例的未核验分数不混进这些合成可评分数据；原v1.1历史mock仅用于Import historical summary分支。

## 8. 主演示路径

```text
Employer: Question Bank → Publish a case → Create plan → Invite Riley (demo)
Candidate: Verify email → Accept → Download ZIP → Upload draft → Submit
Employer: Review evidence → Finalize & publish result → Inspect delivery
Candidate: View result → Accept revision → Email revised answers (demo)
Employer: Review changes → Add supplemental test → Prepare Interview handoff
```

另走“直接邮件完整答案自动提交”与“邮件缺件/身份不明”分支。外部事件通过独立`Demo events`工具触发，标明服务模拟；候选人正常UI不出现让自己选择评分或认证通过的按钮。

## 9. 全部可点击场景与映射

每个场景可从Reset seed启动或继续前置，记录最后状态。成功路径与至少一种失败恢复均有可达控件。

| ID | 场景 / 核验 |
|---|---|
| P01 | 题库过滤→同题映射两个公共岗位和三能力→fraction错误被阻止→修正发布；总分例保持70 |
| P02 | ZIP导入区分材料/内部答案→Candidate preview不泄露→概念题邀请禁用；无岗位目标可建项目 |
| P03 | 创建Riley、批量预览→一封发送成功一封模拟退信→仅重试失败项，不重复建候选人 |
| P04 | 模拟GET无副作用→OTP验证→Accept；分别演示timed Start与deadline-only、拒绝新任务 |
| P05 | 上传草稿→离开警告/回来→正式Submit→receipt/Job/Task更新；旧答案锁定 |
| P06 | 已验证邮箱完整附件→自动commit→candidate确认；展示received与processed不同时间 |
| P07 | 同附件邮件+上传重复→单commit；不同附件已提交后到→冲突/新轮，无覆盖 |
| P08 | 错邮箱/模糊轮次/缺件/恶意文件→needs confirmation/incomplete/quarantine；补件恢复 |
| P09 | AI timeout→人工评估；Unknown显示；Human override留理由、证据可定位 |
| P10 | Finalize & publish→候选人白名单结果→退信重试；内部notes不进入Candidate页面 |
| P11 | 给提示→新Invitation接受→修订提交→Original/Feedback/Revised对照；旧线程不入新轮 |
| P12 | 按未测能力选FIN-002/008补测→新PlanItem→新接受；不改变旧分数 |
| P13 | Compare current summary / same stage / round changes，未知与不可比不同；新结果使snapshot stale |
| P14 | Compare评论/仅差异/保存视图→导出子集或分页；生成文件/图不发邀请 |
| P15 | Review-only/Interview请求包→demo发送→无ACK/Imported→更正复核；目标L2未启用仍可导出，Core故障另处理 |
| P16 | Claim并发、Assign、Wait/Resume、stale任务、业务完成；卡片/列表/提醒一致 |
| P17 | 指标Loading/0/Unavailable/Stale、刷新、角色切换和as-of过滤；父子/重复事件不虚增 |
| P18 | Files拖放/预览/下载/Activity；Email/Folder read now、pause、失权恢复、部分失败重试 |
| P19 | Models硬约束/未评测/预算不足→安全回退→发布/回滚；自动同步unsupported与回归告警 |
| P20 | Light Medium / Dark Large / Deep Large / System、Accent、Reset、保存失败、200%缩放与键盘 |
| P21 | Candidate越权/雇主受限证据/跨workspace切换→正确拒绝且无短暂数据泄露；session过期恢复 |
| P22 | 技术题合成执行超时/成功证据；adaptive固定分支与轨迹、未校准不可排名；反馈校准提案审核后新政策 |

## 10. 组件与状态交付清单

复用组件：AppShell、CandidateShell、TaskList、MetricCard、FilterBar、StatusBadge、VersionPill、QuestionPicker、RubricEditor、MaterialPreview、UploadQueue、EmailPreview、SubmissionChecklist、EvidenceDrawer、ScoreBreakdown、ComparisonMatrix、FeedbackEditor、CandidateReleasePreview、DeliveryTimeline、ApprovalPanel、AppearancePopover、ActivityDrawer。

每组件至少列default/loading/empty/error/disabled/permission-denied适用状态；异步保存支持pending/saved/failed，批量支持partial。危险操作解释实际影响，普通可逆设置不加繁琐审批。 disabled必须有可读原因和恢复入口。长文、长文件名、Unknown、空集合、日期/时区与人名显示在所有主题可读。

审批面板展示对象版本/精确候选人/动作/收件人/资料范围；结果成功后焦点移至确认消息或下一步，取消返回触发点。抽屉/模态Escape关闭，Tab焦点不逃逸，提示不限hover。细表格横向容器需键盘可滚；重要状态不只icon。

## 11. 原型交付和验证

交付可打开的高保真原型、路由清单、共享fixture、组件/tokens、P01–22演示路径、状态/字段映射、检查记录和模拟边界说明。Web原型关键业务改变共享状态；设计工具原型分支必须完整可达且无死按钮。需要真正产生的demo附件使用合成内容，原型不能读取真实候选人材料。

验证1440×900、1366×768、Candidate390×844；至少首页、Builder、Review、Compare、Release、Candidate作答在Light Medium、Dark Large、Deep Large可用。验证200%缩放、键盘、长文本、模型/邮箱错误及跨页恢复。记录实际通过/失败，不把未测试写通过；第三方模拟认证不是安全测试。

不要为了视觉统一改掉Assessment状态/算法。应能将同一公共组件换到Screening/Interview而保持导航、字体、Appearance、文件动作、任务样式和反馈节奏一致，同时保留独立业务逻辑。

## 12. 可直接用于原型任务的请求

> 请根据Assessment Prototype Design Brief v1.1、PRD v1.4及Interface Spec v1.4，制作完整英文高保真可点击原型。沿用Interview/Screening的Google Workspace风格、Light/Dark/Deep/System主题、舒适字号、My Tasks、Files & Integrations、Compare和AI Models公共体验。覆盖雇主题库多岗位/多能力、组卷与批量邮件邀请、候选人邮箱统一身份验证/接受、ZIP下载、上传或邮件提交、AI/人工评估、结果发布、提示修订、补测及Interview交接。使用一致的虚构数据与统一Identity/Core/平台服务Demo adapters，不发送真实邮件或调用真实付费模型。按P01–22、F01–F12及设备/主题/键盘验证交付可打开原型、演示路径和模拟边界。所有已确认功能均有合理可操作界面，不把功能削减为静态展示。

## 13. 版本与参考说明

v1.0首次建立Assessment原型设计交接，采用上述三份用户指定参考文档，原业务依据PRD v1.3；当前v1.1依据PRD v1.4。原案例汇总仅提供领域方向；当前演示人物与可评分材料均需合成。此Brief和PRD/Spec是设计输入，尚未构建或运行原型。


## 14. v1.1 统一数据与Shell原型补充

### 14.1 共享seed，不复制候选人

在§7基线之上增加公共ID关系：Emma=user_emma，Daniel=user_daniel，Morgan=user_morgan，均属于ws_demo的员工Membership；Candidate Alex=core_candidate_a，与Identity参与者user_candidate_a通过受限授权关联，不给员工Membership；其他候选人同样区分User与Candidate。

Finance岗位=core_job_fin、role版本=core_role_fin_v1；正式岗位案例A–D各引用一个Core Application/Cycle，不在assessment重复建关系；case_a–d仍为本域案件。Riley创建流程先公共Candidate→待确认招聘关系→Confirm link→Core Application→邀请。演示未确认时邀请按钮说明`Confirm the candidate’s role link first`，不能发邮件自动建关系。

文件seed为core_file_001/core_file_001_v1等，业务只引用FileVersion；上传显示Uploading→Ready/Failed，不能先把File写进每模块私有列表再同步。Profile v2到达时公共详情显示v2，既有评分`Assessed using profile v1`且可点来源；重新评估是显式动作。文件去重不自动归并候选人。

可以用只读Screening/Interview context panel演示同user_id/core_candidate_id/job_id/application_id/file_version_id，不必重建整个其他模块原型。打开context不注册新账号、不复制主档、不同步读取另一L2私有表。技术ID仅Demo inspector/Details可见，普通用户看到相同人/岗位/材料。

### 14.2 Shell/Standalone与共享服务UI

Demo tools提供`Workspace shell / Standalone assessment`切换，同一已登录用户、同一数据和待办；切换不清空业务状态。Shell中顶部只一套导航/Settings/Copilot；本域tabs保持当前Case深链。无Shell时本域My Tasks仍可用，Task Feed跨模块聚合暂不可见。

Settings/Files/AI Models统一平台组件，在Assessment中打开的是同一记录。Task action进入所属业务页面；按钮完成由本域规则决定，总览不能任意勾选完成。统一Timeline展示源业务动作及audit同步时间，延迟明确标`Timeline sync pending`。

题库当前仍由Assessment管理；Interview欲复用先总线请求/ready产物引用，不创建互相同步调用的题目API捷径。公共Copilot按当前权限与业务scope提供解释/草稿，不跨域任意执行动作。

### 14.3 邮件与提交界面变化

邀请/修订/补测/结果预览的From和Reply-To统一显示hr@sendinglabs.com。每轮以清楚的任务名/轮次号、线程和内部安全关联区分，不展示每轮独立邮箱。Subject可以含人可读任务编号，但仅编号不能证明身份。

Inbox展示`Matched by reply thread`、`Round 1 — closed`、`More than one assignment found`等原因；新写邮件或转发可点`Confirm assignment`由候选人在统一身份会话选本人的待办，或由HR复核。不得把AI猜测自动确认。模拟同人两个岗位、同hr邮箱多个workspace及旧线程迟到，确保不能落错Case。

所有demo发信只是平台adapter记录，不调用真实hr邮箱；候选人邮箱仍为虚构example.com。登录/OTP在同Identity服务模拟，邮箱验证不是给Candidate创建雇主权限。

### 14.4 新状态与组件

增加CoreReferenceBadge（普通文案Shared record）、InputVersionPanel、CoreReconciliationPanel、FileReadinessBadge、EventHandoffTimeline、FoundationUnavailableBanner、UnifiedIdentityEntry、ModuleEntitlementState、ThreadMatchPanel。沿用现有颜色/字号，不把后台架构画成普通HR必须操作的拓扑。

Core失败显示`Shared records are temporarily unavailable`和Retry，未完成创建保留草稿；响应不确定显示`Confirming the saved record`，不提供“重新创建另一人”默认动作。总线停机显示`Handoff queued`，评分已完成不回退。Identity过期要求统一重新认证，不能切成本地登录。File failed提供重试上传，不显示已交接。

## 15. Foundation演示验收 F01–F12

| ID | 可点击场景与预期 |
|---|---|
| F01 | 同一Emma切Screening context/Assessment/Interview context，user_id相同；未开通模块显示entitlement提示 |
| F02 | 公共Candidate/Job/Application/File同ID，主档更新后历史评分仍引用v1，出现stale复核 |
| F03 | 目标准备不需Application；正式岗位邀请前Confirm link，经Core模拟唯一关系 |
| F04 | Core创建成功但响应丢失→Reconciling→同request恢复，候选人/Application数量不增加 |
| F05 | 公共产物Uploading禁止交接→Ready→Event queued→Published→Imported；事件不带完整报告 |
| F06 | 总线宕机/重投/乱序，Outbox pending且结果保留，Inbox去重不重复建Interview intake |
| F07 | 同hr邮箱两任务、旧轮回复和无线程新信，正确确认/拒绝模糊匹配，不自动转最近轮 |
| F08 | 统一Candidate参与者登录，只访问本人任务，无员工菜单/会员权限；转发无授权拒绝 |
| F09 | Shell embedded与Standalone同数据同任务，无重复导航，Shell离线不阻塞单模块 |
| F10 | Core/Identity不可用如实阻塞依赖动作；仍允许合法本地草稿，不伪造公共写入成功 |
| F11 | 平台Files/Models/Notification是一份共享记录；Assessment保留业务Task/Decision，Timeline延迟可见 |
| F12 | 外部导出包与内部event交接分开；Interview未启用允许导出，hr邮件均Simulation only |

这些模拟验证UI与状态，不代表真实Postgres ACL、Redis恢复、SSO或平台集成已通过。实现后的F03/F06网络与数据库隔离须工程测试，不能靠浏览器原型证明。

## 16. 更新后的原型任务说明

> 使用Assessment PRD v1.4、Spec v1.4、Design Brief v1.1及所附公共架构v2.2/数据v1.2制作高保真英文交互原型。保持Google Workspace风格及P01–22业务路径，增加F01–F12。共享一个Identity/Core/平台服务fixture，统一user_id及Candidate/Job/Application/File版本；Assessment只拥有本域业务。支持Shell嵌入/独立入口、统一hr邮件预览和线程匹配、ready文件后的内部总线交接、公共基础故障及对账。不复制各模块主档、不自建登录、不真实发送邮件。交付可打开原型、共享seed、演示路径与模拟边界。

v1.1更新：根据最新两份公共文档修订身份、主档、传输、数据owner、Shell和候选人邮箱方案。原v1.0保留，全部现有业务/视觉要求在不冲突处继续有效。
