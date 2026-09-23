# HireOS Command — Resume Screening Prototype Design Brief

| 属性 | 内容 |
|---|---|
| 版本 / 日期 | v1.0 / 2026-09-08 |
| 用途 | 独立指导完整、高保真、可点击的雇主端原型；本文交付设计要求，不表示原型已制作 |
| 产品 / 模块 | HireOS Command / Resume Screening |
| 产品范围 | 全功能独立模块；同时支持集成运行 |
| 视觉与设备 | 英文界面、Google Workspace风格、桌面Web、笔记本优先 |
| 产品基线 | [Resume Screening PRD v1.3](Resume_Screening_PRD_v1.3.md) |
| 数据基线 | [Resume Screening Interface Spec v1.1](Resume_Screening_Interface_Spec_v1.1.md)，Schema 2.0.0 |
| 结构参考 | [Interview Prototype Design Brief v1.0](HireOS_Command_Interview_Prototype_Design_Brief_v1.0.md) |

## 1. 使用方式与权威关系

本文件可单独用于启动原型设计。设计者应同时核对PRD和Interface Spec，以本文组织页面、交互、演示数据及验收，不需要用户重新整理需求。

优先级：用户最新明确指示 → 当前PRD的产品规则与当前Interface Spec的数据语义 → 本文建议布局 → 历史参考。PRD v1.3中“接口尚未同步”是历史状态，现已有Interface Spec v1.1；使用新版。本文不覆盖接口字段规则，也不把Interview专属审批、JD-only启动和面试流程移植成筛选规则。

**已确认需求**包括全功能开发、去重、先推荐后人工关联、简历库、对比、任务管理、公共模块复用及输入输出通道。本文的具体页面组合、尺寸、样例人物、文案和布局为可执行设计默认值，可在不改变业务语义时调整。外部服务、供应商连接、模型调用和发送能力属于真实实现需验证内容；原型可模拟并清楚标明。

## 2. 必须保持的产品决策

| 主题 | 设计要求 |
|---|---|
| 独立入口 | 无其他业务模块也能上传、入库、匹配、复核、交付；不强制中央Candidate或Workflow服务 |
| 最低输入 | Resume-only能入库；无岗位也保留资料。JD-only能创建岗位项目，但不能凭空生成候选人评价 |
| 上传去重 | 分开识别完全相同文件、相同内容、疑似同人和新简历版本；身份不按姓名自动合并 |
| AI岗位推荐 | 生成候选人×岗位提案与证据，无Application也能匹配 |
| 正式关联 | HR/HM明确确认后才建立或复用Application；AI推荐和来源申请意向不代替确认 |
| 下一步 | 关联后人工选择笔试、直接面试、补资料、暂缓或不推进；关联不自动发通知 |
| 人工负责人 | HR或HM均可处理；按权限/岗位配置路由，可领取和转派 |
| 候选人对比 | Ranking、Comparison、Next-step Decision分开；贯穿筛选及每轮笔试/面试 |
| 评分 | 0–100量尺，Unknown=null；分数、覆盖率、置信度分开；总分不是概率 |
| 人工权限 | 普通操作按岗位授权；明确底线例外按既定HR/HM批准规则，不能所有动作强制双签 |
| 公共能力 | Files、Appearance、Task、AI Models、Audit复用统一机制；业务含义归来源模块 |
| 全功能范围 | 包含批量、对比、偏好学习、完整任务、输入输出和模型配置，不将已确认能力延后 |

## 3. 核心关系与状态

```text
来源材料 → 重复识别 → 简历库 / Candidate Profile
                         ↓
                AI检索岗位并逐岗匹配
                  ├─ 无合适岗位：留库
                  └─ 岗位推荐提案 → 人工关联任务
                                      ↓ Confirm link
                                  Application
                                      ↓
                        正式筛选 / 排序 / 候选人对比
                                      ↓
                         人工决定与下一步处理任务
                          ├─ Assessment
                          ├─ Interview
                          ├─ 补资料 / Hold
                          └─ 不推进
                                      ↓
                           包生成 → 交付 → 接收回执
```

Candidate是人，ResumeVersion是材料，Application是经确认的岗位关系，Task是待人工完成的动作。一个人可关联多个岗位并仍在简历库中；每个岗位的分数、权限、流程分别管理。

UI必须区分：上传成功、解析成功、入库成功、推荐就绪、岗位已关联、筛选已决定、报告已生成、邮件已送达、目标已接收。任何一个状态都不能暗示后续动作已经完成。

## 4. 信息架构与页面清单

主导航：**My Tasks / Resume Library / Jobs / Comparisons**。公共入口：**Files & Integrations / Settings / Activity**。AI Models位于Settings，由授权管理员管理；业务页面显示当前策略和运行状态。

| 页面 / 路由建议 | 核心内容 | 必须可点击的行为 |
|---|---|---|
| My Tasks /tasks | 本人任务、待领取、今日到期、逾期、统计 | 领取、开始、转派、暂缓、跳转业务、提交、查看历史 |
| Resume Library /library | 候选人、简历版本、来源、匹配与关联概况 | 上传、查重、搜索/过滤、打开资料、重新匹配 |
| Import /imports/new | 手动、邮件、文件夹、API演示入口 | 上传/粘贴、选择范围、预览、逐项处理结果 |
| Duplicate Review /duplicates/:id | 已有与新材料、依据、差异 | 复用、保留新版本、不同人、暂缓 |
| Candidate Profile /candidates/:id | 履历、来源、材料版本、岗位推荐/关系 | 查看原文、纠正资料、匹配岗位、历史 |
| Job Recommendations /candidates/:id/jobs | 推荐岗位、解释、缺口、状态 | 确认关联、拒绝提案、暂缓、手动选岗 |
| Jobs /jobs | 开放/暂停/关闭、标准状态、人数 | 导入/创建岗位、确认标准、打开工作区 |
| Requirements & Rubric /jobs/:id/criteria | 要求、维度、权重、硬条件、量尺 | 编辑草稿、确认版本、查看变更影响 |
| Screening Workspace /jobs/:id/screening | 待确认推荐与正式候选人分栏、排名/过滤 | 打开评估、多选比较、分配、批量动作 |
| Screening Detail /applications/:id | 推荐、资格、维度、证据、人工意见 | Evidence下钻、改分留理由、下一步处理 |
| Compare /comparisons/:id | 差异摘要、矩阵、轮次、批注、快照 | 只看差异、展开证据、刷新版本、导出、逐人下一步 |
| Decision & Next Steps /applications/:id/decision | 动作、理由、门槛、批准和任务 | 提交决定、补证、例外、选择路由、确认发送 |
| Packages & Delivery /deliveries/:id | 包版本、预览、收件路由、尝试及回执 | 下载、导出、发送演示、失败重试、更正 |
| Preferences /settings/preferences | 个人/团队/岗位/组织规则、信号、提案 | 审阅、批准、激活、回滚、比较版本 |
| Files & Integrations /files | Files / Connections / Activity | 上传预览下载、连接读取、监控、重试和历史 |
| AI Models /settings/ai-models | Catalog / Task policies / Evaluate / Usage / Activity | 配置、评测、预算、发布、回退、回滚 |

页面可以合并为标签或抽屉，但对应动作、返回路径和状态必须完整。深链接可直接进入具体任务，登录/权限不足有明确状态。界面不显示原型内部路由作为用户文案。

## 5. 输入、去重与简历库体验

### 5.1 输入入口

`Upload resumes`默认不要求选择岗位。拖放/选择多文件显示支持格式、大小限制、逐项进度。`Paste profile`支持结构化人工录入；岗位单独支持`Paste job description`。

`Import from email`展示授权连接、范围/规则、正文与附件预览。`Import from folder`展示起始范围、子目录规则、Read now、监控开关和检查点。API入口展示Demo ingestion记录与结果，不要求普通HR填写技术JSON。

所有通道汇入统一Intake，显示原始来源、检查、提取与业务消费状态。关闭上传进度面板不取消任务；失败可重试单项，成功项不重跑。文件仍写入、加密/损坏、安全隔离等状态有明确反馈。

### 5.2 重复复核

左右并排“Uploaded version / Existing record”，展示文件名、来源、上传时间、版本差异和识别依据。默认文案：

- `This file already exists`：可使用已有文件，仍保留新来源历史。
- `Possible duplicate candidate`：需要人确认身份。
- `A newer resume may be available`：显示具体更新内容。
- `Duplicate check incomplete`：解析失败不能伪装未发现重复。

同名不同人演示必须保留两个Candidate。完全相同文件可确定性复用存储，但不得自动确认岗位关系。错误归并有纠正/拆分入口及影响说明。

### 5.3 无岗位留库

无推荐页面不是死路：显示`No matching roles right now`、当前搜索范围与最近匹配时间，提供`Keep in library`、`Search roles`、`Update profile`、`Match again`。无开放岗位、证据不足和模型失败分别显示，不能都写成No match。

新岗位/资料更新后显示新推荐提示与待办，不自动link。资料保留/受限状态可见；被撤回资料不继续发送给模型。

## 6. AI推荐与人工关联

推荐页以岗位卡片/列表展示title、team、地点、岗位状态、匹配理由、关键缺口和证据入口。每个岗位的分数带本岗位标准说明，不将跨岗位分数直接排序解释为优劣。

确认操作明确命名`Confirm job link`，不可使用含糊的`Approve`。复核面板展示Candidate、Job、资料/标准版本、是否已关联及确认后结果。完成后显示`Linked to role`和新待办`Review screening & choose next step`，不得出现“Interview invitation sent”。

支持`Dismiss recommendation`、`Defer`、`Choose another role`。拒绝提案不拒绝候选人，不删除简历。多人/多岗位批量确认预览精确清单及每项结果，部分失败不重复处理成功项。岗位关闭或输入过期时阻止旧确认并提供刷新路径。

## 7. 筛选工作台与证据下钻

笔记本默认左侧列表、右侧详情；长文证据用抽屉，避免同时堆放多列。职位页分开`Suggested candidates`和`Linked candidates`，计数不混用；正式排名和Comparison只取已确认Application。

信息层级：

1. **Decision**：候选人、Eligibility、AI recommendation、Overall/Coverage、关键优势/concerns、人工状态及Next action。
2. **Explanation**：逐维分数、岗位要求、缺失项、待验证项和协作意见。
3. **Evidence**：原文、页码/段落、来源版本、支持/反证、置信度和修改历史。

点击分数完整路径：`Dimension → Requirement & rubric → Rationale → Supporting / Counter evidence → Source excerpt`。无证据显示Unknown，不生成假引用。AI分数与Human assessment分开，改分记录理由，不擦除旧分数。

默认聚合演示可采用weights 0.5/0.3/0.2，scores 80/60/Unknown：coverage=80%，overall=72.5，界面显示73；硬条件unknown仍显示Needs verification。只有第一维有证据时coverage=50%，overall为空。说明这是样例策略而非实测模型质量。

## 8. Candidate Comparison

矩阵以人作列、维度作行，默认2–4人舒适并排；更多人允许横向滚动，固定维度列。顶部依次为岗位/快照、Key Differences、比较模式，下面是矩阵，证据和批注按需展开。

三组维度：能力与资历；薪资/地点/到岗等可行性；有行为证据的工作方式。语言区分验证方式，薪资统一币种/周期/gross-net后比较。无资料显示Not provided，未参加测试显示Not evaluated。

必须提供`Same stage`、`Current summary`、`Changes since last round`。各人进度不同仍可并列，但显示阶段与coverage；不能让完成轮次更多的人自动高分。关键差异可得出“No clear overall leader”，每个重要论断可查看证据。

`Show differences only`折叠共同点；保存个人维度视图不改团队评分。刷新生成新Snapshot，旧版可查看，源变化显示Stale。协同批注保留作者和时间，不改AI原文。

`Export comparison`支持单页PNG/PDF及完整报告；过多成员明确选择子集或分页，不能把字缩到不可读或无提示漏人。导出前校验权限，默认浅色可读样式。

每列底部选择不同Next step，可为所有选定人发笔试，也可逐人面试/补资料/Hold。生成图表、改变排序或勾选人不发通知。确认动作使用独立预览清单及权限校验。

## 9. Decision、交付与回执

`Decision & Next Steps`区分AI建议、人工拟议、已批准决定与交付状态。可选`Send assessment`、`Move to interview`、`Request information`、`Hold`、`Do not advance`。

普通授权人可提交岗位配置允许的决定；需要批准时展示真实待批准人。跳过optional/not_required笔试可直接路由；明确required条件未满足时显示阻塞/例外审批，不制造通过成绩。例外展示原事实、接受理由和各批准人。

报告可在Hold/Reject时生成并交付`Review only`。候选人拒绝通知是独立通信动作。人工link、决定、发送三者可连续操作但需分别留状态。

交付面板包含：目标Assessment/Interview/人员、requested action、报告预览、版本、必要证据、待验证项、授权收件路由、附件/受控链接。支持下载、文件包、邮件及API演示。外部未连接仍可独立查看/导出。

时间线区分`Package ready → Queued → Submitted → Delivered → Received / Imported`；不保证每种通道都有全部状态。无ACK为`Awaiting confirmation`，不是已接收；下载只显示可观测传输。失败仅重试交付，不重复评价、link或邀请。下游完成与接收是不同事件。收到更正包标版本变化并建复核任务。

## 10. My Tasks 与团队任务

任务主页分`Assigned to me / Available to claim / Created or followed / Completed`。每行显示类型、候选人/岗位（可空）、来源模块、优先级、状态、截止、等待原因和明确动作按钮。

支持重复复核、关联确认、筛选复核、下一步处理、job search结果筛选、补证、对比评审及交付异常。所有任务都能到达对应业务操作页。无岗位任务路由到简历库负责人/角色队列；缺负责人明确进入待分配。

状态open/in_progress/waiting/completed/cancelled；逾期是附加标记。`Defer`要求原因与复查时间或恢复事件；不计完成。领取/转派并发冲突可刷新，不让两个主负责人同时成立。转派不授予文件权限。

业务动作提交成功才完成Task，不提供绕过关联确认/审批的任意勾选完成。打开邮件、读完摘要、AI完成都不算人已处理。来源变更显示Needs refresh，旧动作不可提交。

统计：我的未完成、等待、今日到期、逾期、本周完成；队列待领取单列。团队按权限展示工作量、未分配及逾期，不把任务数视作候选人数或人事绩效排名。父子任务和后台运行批次不能相加。显示范围、时区和as-of。

提醒演示包括分配、临期、逾期、等待恢复；支持策略频率/工作时间/升级。完成、取消、转派撤销旧提醒。角色切换为演示工具，明显标`Demo role`，不能冒充真实登录身份。

## 11. 公共模块设计

### 11.1 Files & Integrations

依PRD Section 13原文要求实现Files / Connections / Activity。参考Drive的拖放、多选、预览、逐项进度和返回位置；输入规则与材料消费分开。每次上传、扫描、空结果、跳过、失败、下载、预览和重试都有历史。

材料可Unassigned且Available；业务关联不完整不能倒改为文件失败。原文更新形成新版本。邮箱读取不自动发邮件，文件夹监控不改写源文件。连接失权显示Authorization required，恢复从检查点继续。

### 11.2 Appearance与统计框架

Light（默认）/Dark/Deep/System；Accent Blue（默认）/Teal/Violet；Text size Small/Medium/Large，默认Medium。建议正文14/16/18px，组件按比例适配。设置即时生效、保留输入、按账号同步；模拟持久化需说明。局部视图偏好按user+workspace+module隔离。

T1/T2/T3仅指展示层级：关键行动默认可见，额外统计折叠但功能完整。统计采用Screening/Task口径，不复制Interview场次数。真实0、加载、失败与stale分别呈现。

### 11.3 AI Models

完整提供模型目录、多供应商配置、任务策略、质量评测、价格/预算、时延、数据约束、受控回退、版本/调用历史、自动同步/回归与告警配置。供应商未支持的自动信息获取显示限制，不能造数据。

任务覆盖解析、规范化、重复辅助、岗位发现、关联前匹配、筛选评价、Evidence、Comparison、Preference signals。管理员可编辑连接与预算，业务负责人参与质量门槛审核；普通HR/HM使用已发布策略。

演示`Hard constraints → Quality gates → Cost / latency → Preference`，不以四项任意平均。至少覆盖预算不足、未评测、区域不允许、主模型超时回退及回滚。模型变化影响ranking基线，旧评价不被改写。界面费用/质量/延迟均标Sample data。

### 11.4 Preference learning

显示反馈事实、可用信号、提案和已激活配置四层。个人显示偏好不改正式团队标准；共享偏好需审核，禁止特征显示排除理由。支持版本比较与回滚，结果改变后新生成评估而非修改历史。

## 12. 视觉、设备与可访问性

沿用Interview公共视觉方向：Google Workspace风格、英文、舒适间距、克制边界、蓝色主操作。Gmail式列表用于任务/候选人，Docs式阅读和评论用于报告，Drive式操作用于文件；不是复制Google商标或完整产品。

默认1440×900设计，1366×768验证。候选人对比矩阵允许明确容器内横向滚动，其余页面不能因拥挤无意溢出。小屏使用单列/详情切换和可达操作，不削减业务能力；复杂矩阵提供聚焦单人或分页。

键盘可完成筛选、打开详情、设置、确认和取消；焦点可见，模态框支持Escape并返回触发点。200%缩放关键操作可达，读屏标签完整。状态用文字/图标，不只红绿；分数不使用无解释百分号。长姓名、职位与英文文案可换行。

加载/保存中显示反馈，成功后相关计数刷新；取消不隐式保存业务动作。未保存离开有确认；防重复提交不妨碍查看已有结果。空页面始终提供适用下一步。

## 13. 一致的演示数据

全部使用虚构英文资料，不使用真实候选人个人信息；所有外部行为默认Demo。设计者维护一个数据fixture，页面共享同一对象和版本。

| 样例 | 用途 |
|---|---|
| Job A: Senior Backend Engineer，open | 已确认标准；主要筛选与Comparison岗位 |
| Job B: Engineering Lead，open | 第二个推荐岗位，演示人工只选一个/多个 |
| Job C: Data Platform Engineer，closed | 过期推荐确认被阻止 |
| Alex Morgan | 有原简历和更新版，关联Job A，技术强但薪资需确认 |
| Jordan Lee | 匹配Job A，0→1证据明确，技术尚未测评 |
| Casey Chen | 匹配Job A，语言沟通证据较充分，hands-on待核验 |
| Taylor Brooks | 当前无合适岗位，留库；新增岗位后重新匹配 |
| 另一位Alex Morgan | 同名不同人，重复提示后保留独立身份 |
| HR: Emma Wilson / HM: Daniel Park / Admin: Morgan Reed | 任务分配、例外批准、模型设置权限演示 |

岗位、Profile、Resume、Evaluation、LinkDecision、Task、Comparison、Package各有稳定演示ID和版本。对比轮次前后数据只因明确新证据变化，不能同一页面刷新随机改分。样例薪资注明币种/周期/gross-net；未知不补数字。

## 14. 完整可点击场景

### 14.1 主流程

```text
My Tasks → Upload resumes → Review duplicate / import results
→ Resume Library → AI job recommendations → Open link task
→ Confirm job link → Linked candidates → Review evaluation / evidence
→ Select candidates → Compare / Key Differences
→ Choose individual next steps → Submit human decision
→ Preview package → Deliver (demo) → Inspect receipt / task completion
```

### 14.2 必须覆盖的分支

| 编号 | 场景 | 验收结果 |
|---|---|---|
| DB-01 | Resume-only，无开放岗位 | 可入库，不创建虚拟Job/Application |
| DB-02 | 同文件换名、同人新版本、同名不同人 | 三种结果清楚；无误合并与重复关联 |
| DB-03 | 邮件/文件夹/API样例输入 | 进入同一Intake，来源可追溯，真实连接未开启 |
| DB-04 | AI推荐两个岗位，仅确认一个 | 正式人数只增一；另一个仍待处理 |
| DB-05 | 拒绝/暂缓推荐 | 人仍在库，暂缓Task不完成 |
| DB-06 | AI失败与无匹配 | 错误可恢复；不将失败写成不合适 |
| DB-07 | 确认后未做下一步 | 已link但无邀请，有待办 |
| DB-08 | 未知硬条件与低coverage | Unknown不为0；证据不足有补资料动作 |
| DB-09 | 同阶段和不同阶段对比 | 未参加笔试不判弱；解释比较限制 |
| DB-10 | 向全部选定人发笔试、单人直接面试 | 各路径有明确人工授权及门槛；无批量隐藏成员 |
| DB-11 | required笔试例外 | HR/HM批准与原事实保留，不改成绩 |
| DB-12 | Hold/Reject报告 | 可预览/导出，不默认外发拒绝通知 |
| DB-13 | 资料更正/新轮次证据 | 新快照、stale和变化原因可见 |
| DB-14 | 领取/转派/等待/恢复及无负责人 | 任务状态、统计、提醒相互一致 |
| DB-15 | 交付失败/无ACK/重复回执 | 不回滚决定或重复邀请，状态准确 |
| DB-16 | 邮箱失权/文件部分失败 | 单项重试、检查点和历史可用 |
| DB-17 | 模型预算/质量/区域/回退 | 无越权调用，实际模型及费用历史完整 |
| DB-18 | 个人偏好/共享提案审核 | 个人不改团队；激活新版本可追溯 |
| DB-19 | 主题字号跨页、角色/租户切换 | 不丢输入、不串数据，统计不短暂泄露旧范围 |
| DB-20 | 对比导出与无权限证据 | 可读文件、范围明确，受限资料不导出 |

## 15. 原型交付与验收要求

交付必须包括可打开的完整高保真原型、页面/路由清单、一致的演示数据、场景演示路径、公共组件和状态清单、与PRD/Spec的映射及模拟集成说明。若使用设计工具，关键控件须可点击；若使用Web，关键动作应改变共享状态而不是只弹无意义提示。

每页按钮都应有业务结果、明确禁用理由或合理取消/返回路径。支持从任务深链接进入并回到原过滤列表；阶段变更、人数、待办和交付历史保持一致。主体流程和DB-01–20均验证。

原型需要演示全部确认功能，但真实供应商、认证、邮件、文件监控和下游系统可以使用适配器模拟。模拟不是产品删减，也不能描述为生产接入已完成。未经另行授权不发送真实邮件、不联系候选人、不调用真实付费模型、不录入真实敏感资料。

设计交付须记录验证结果与未实现的模拟边界，不声称未经验证的可访问性或真实集成已经通过。本Brief本身不包含这些验证结果。

## 16. 可直接用于新任务的设计请求

> 请依据这份Resume Screening Prototype Design Brief及配套PRD v1.3、Interface Spec v1.1，制作英文、笔记本优先、Google Workspace风格的完整可点击高保真原型。按全功能范围实现界面与交互，覆盖上传去重、无岗位简历库、AI岗位推荐、人工确认关联、筛选证据、多人及跨轮对比、人工下一步决定、任务管理/统计/提醒、公共文件和模型设置、偏好学习以及多通道交付回执。自行补齐一致的虚构英文数据和组件，不改变未知值、权限、人工确认及独立运行原则。外部接入与发送可模拟并明确标示，不执行真实外部通信。按本文场景验收并交付可打开的原型与演示路径。

## 17. 版本记录与参考

| 版本 | 变更 |
|---|---|
| v1.0 | 2026-09-08：参考Interview Brief结构首次建立Screening设计交接；对齐PRD v1.3和Spec v1.1，覆盖全功能流程、公共组件、完整页面、英文演示数据、状态及验收。 |

- [Resume Screening PRD v1.3](Resume_Screening_PRD_v1.3.md)：业务规则、公共模块原文及产品范围。
- [Resume Screening Interface Spec v1.1](Resume_Screening_Interface_Spec_v1.1.md)：输入输出、数据与状态、Schema 2.0.0及交接契约。
- [Interview Prototype Design Brief v1.0](HireOS_Command_Interview_Prototype_Design_Brief_v1.0.md)：文档结构与既有设计表达参考，旧范围和面试专属逻辑不直接迁移。
- [Interview PRD v1.6](HireOS_Command_Interview_PRD_v1.6.md)：公共视觉、文件及模型服务来源；Screening适用规则见本模块PRD。
