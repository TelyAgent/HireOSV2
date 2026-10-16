# I12 首页、任务列表与统计：线上测试报告

测试日期：2026-10-15（Asia/Shanghai）  
结论：**不通过完整验收**。本轮以现有线上账号执行只读 UI 测试，发现统计卡片不可进入明细、加载时用 0 冒充未完成取数、任务排序与按状态跳转错误、简历入口与材料状态不符。13 条用例没有一条取得所需的 UI、API、数据库及多角色完整证据；以下“局部验证”不计为整条用例通过。

## 1. 范围、环境与证据边界

| 项 | 本轮事实 |
|---|---|
| 规格 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop IO](Loop_IO.md)，以及[任务列表状态与排序规则](../HireOS_Command_Interview_Task_List_Status_and_Sorting_PRD_v1.0.md)。UX/UI 方法采用 [JD Management 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的 U1–U10、逐步证据、严重级别与通过门槛；JD 专属审批和发布要求不直接套用到 I12。 |
| 线上环境 | [HireOS Interview](https://hireos.aipollo.me/hireos/interview/)；Chrome 桌面端，现有登录会话。页面右上角为当前账号，My Work 标注 `Sarah Chen`；账号与产品角色的映射未核实。未取得线上构建号。 |
| 测试方式 | 打开首页、展开 More statistics、切换 Task list / Cluster by JD、展开 JD 组、使用 Draft 筛选、点击统计卡、刷新、点击任务行及 View résumé；检查浏览器可访问性树、可见文案和 URL。没有创建、修改、删除项目或候选人数据。 |
| 测试数据 | 线上显示 13 个项目、11 条候选人任务、2 个零候选人 JD 组；列表当前只出现 Draft、Interview in progress、Package published 三种状态。缺 `S_home_mixed`、`S_home_13_statuses`、`confirm_split`、`partial_access`、`stats_fail` 的受控 seed，缺 HR/HM/Interviewer 独立测试身份。 |
| 证据限制 | 页面观察不能证明服务端权限、统计去重、持久化或故障注入。未读取线上 API 原始响应、数据库、审计记录，也未保存含候选人信息的截图。第 6 节本地代码只作实现线索，不当作线上部署版本证明。 |

## 2. 逐步线上证据

| ID | 旅程步骤 / 操作与预期 | 实际观察 | 结论 |
|---|---|---|---|
| E-01 | 步骤 1，打开首页；个人待办与全局汇总口径清楚 | My Work 显示 M01–M04 均为 0；Workspace Overview 显示 G01=13、G02=2、G03=4，卡片有口径副标题。页面账号姓名与 My Work 的 `Sarah Chen` 标注不一致；未显示指标单位、`Updated …` 或明确的当前角色。 | 结构局部可见；数字正确性和身份口径未验证。 |
| E-02 | 步骤 4，展开 T2/T3 | 一个 `MORE STATISTICS Show more` 控件展开 M05/M06、G04–G10 共 9 项；其中 G07=9，其余 8 项显示 0。未看到独立的 T3 Trends 标题、额外指标数量或每张卡的单位。 | 展开可用；T2/T3 信息层级和说明不符合 PRD。 |
| E-03 | 步骤 4，刷新后保持展开 | 展开 More statistics 后刷新，仍显示 `Show less` 和 9 项指标。 | 当前浏览器内的展开状态局部通过；用户 + Workspace 隔离未验证。 |
| E-04 | 步骤 3，点击 G01 统计卡进入同口径明细 | 点击 `Total interview projects` 卡片，页面与 URL 均未变化；卡片在可访问性树中为普通文本容器，没有按钮/链接语义。 | **失败**：统计卡不能进入过滤明细，AC-4 的明细路径无法执行。 |
| E-05 | 步骤 5，查看默认排序 | All projects 中首行是较新的 Draft，后面才是 Interview in progress；状态在列表里交错出现。按规格，Interview in progress 应排在 Draft 前。 | **失败**：未按 Action required first 排序。 |
| E-06 | 步骤 6，切换 Cluster by JD | 分组视图列出 11 个 JD 组，其中 2 组显示 `0 candidates`；展开其中一组显示 `No candidates linked to this JD yet.`，旁边有 `Link candidate`。展开一个有候选人的组，状态 Draft、进度 `0 / 2 rounds completed`、`View résumé` 与 Task list 中该条相同。 | 零候选人空状态及一个候选人的跨视图字段局部通过；全部 13 状态和全部记录一致性未验证。 |
| E-07 | 步骤 6，点击 Draft 筛选 | 按钮显示 `Draft (8)`；Task list 可见 6 条 Draft 候选人行，Cluster by JD 另含 2 个零候选人 JD。筛选后可见候选人行保持原有创建时间顺序。 | 筛选数量与当前可见样本相符；默认排序本身错误，AC-11 不通过。 |
| E-08 | 步骤 8，在列表点击 View résumé | 点击一条候选人行的 `View résumé` 后只出现 `Résumé preview is coming soon.`，页面未离开，但也没有右侧简历抽屉。 | **失败**：当前入口没有提供预览；这条样本的实际附件状态未单独核实，已上传路径仍需专用样本复测。 |
| E-09 | 步骤 7/8，检查无简历项目 | [样本项目 Overview](https://hireos.aipollo.me/hireos/interview/project/5f57f693-470d-4d27-96dd-592aafdd8db6/overview)明确显示 `Résumé Not provided`。返回首页，该项目对应候选人行仍有可点击的 `View résumé`，点击后同样提示 preview coming soon。 | **失败**：无简历未显示 `No resume` 弱态，AC-12 不通过。 |
| E-10 | 步骤 7，点击 Interview in progress 行 | 对应行打开上述项目的 `/overview`；稳定加载后页面显示项目状态 Interview in progress、下一步 Review。任务列表规格 §8 要求该状态进入 Live Interview。 | **失败**：按状态跳转错误；未逐个测试其他 12 状态。 |
| E-11 | 异常与恢复，回到首页时观察加载 | 首次返回时列表出现 `Loading…`，同时所有统计卡显示 0，筛选显示 All projects (0)，还出现 `No projects yet.`；加载结束才变为 G01=13、G02=2、G03=4。 | **失败**：加载和真实 0 未区分；尚未测试单项失败、缓存过期。 |

## 3. 13 条用例执行结果

“局部验证”仅指已列出的子断言；“已知缺口”来自规格标注或本轮可见行为，不代替服务端验证。

| 用例 | 结果 | 证据与尚缺内容 |
|---|---|---|
| UC-I12-01 计数按主键去重 | **未验证** | E-01 只有显示值；无多轮、多面试官、取消/归档受控数据和 DB 对照。 |
| UC-I12-02 一方确认后的计数 | **已知缺口，未验证** | 无 HR/HM 双身份及 `confirm_split`；My Work 四项均显示 0。 |
| UC-I12-03 同项目多个确认请求 | **已知缺口，未验证** | 无多请求 seed 或 M04/G05 明细；E-04 说明卡片无法进入明细。 |
| UC-I12-04 部分权限用户的全局数字 | **已知缺口，未验证安全断言** | 无部分权限身份、聚合 API 与明细 API 证据；E-04 仅确认明细入口缺失。 |
| UC-I12-05 JD-only 与 unknown 岗位 | **局部验证** | E-01/E-02 显示 G01=13、G07=9；E-06 显示 2 个零候选人 JD 组。无主键级对照，不能证明 JD-only/G07 精确口径。 |
| UC-I12-06 四种数据状态 | **失败，部分未验证** | E-11 加载时显示 0 和空状态；未取得真实零、单项失败、缓存过期的可控样本。 |
| UC-I12-07 折叠偏好保留 | **局部验证** | E-03 同浏览器刷新保留；用户/Workspace 维度未验证。 |
| UC-I12-08 业务变更后计数刷新 | **未验证** | 未在生产数据上创建项目、提交评分或确认，也未重放事件。 |
| UC-I12-09 13 个状态与跳转 | **失败，覆盖不足** | E-10 的 Interview in progress 跳到 Overview；线上列表仅出现 3 种状态，另 12 种跳转未执行。 |
| UC-I12-10 两种视图数据一致 | **局部验证** | E-06 对照 1 条候选人状态、进度、简历标签一致；其余记录未逐条核对。 |
| UC-I12-11 默认排序与筛选 | **失败** | E-05 默认次序违反优先级；E-07 仅验证 Draft 筛选的当前样本。 |
| UC-I12-12 未上传简历入口弱态 | **失败** | E-09：项目页 `Résumé Not provided`，首页仍提供可点击的 `View résumé`。 |
| UC-I12-13 Interviewer 的首页 | **未验证** | 无独立 Interviewer 账号及对应 API 权限证据；本轮不能从前端外观推断权限。 |

## 4. 验收标准结论

| AC | 结论 | 依据 |
|---|---|---|
| AC-1 | 未验证 | 缺受控混合数据与 DB 去重对照。 |
| AC-2 | 未验证，已知缺口 | 缺 HR/HM 双身份及确认拆分数据。 |
| AC-3 | 未验证，已知缺口 | 缺同项目多确认请求；卡片明细不可点击。 |
| AC-4 | 未验证，已知缺口 | 无部分权限测试身份及聚合/明细 API；卡片明细入口缺失。 |
| AC-5 | 部分验证 | E-01/E-02/E-06；无法核对总数与 unknown 去重。 |
| AC-6 | **失败** | E-11；失败/缓存状态尚未注入。 |
| AC-7 | 部分验证 | E-03；用户/Workspace 隔离未测。 |
| AC-8 | 未验证 | 未执行写入和重复事件。 |
| AC-9 | **失败** | E-10；13 状态覆盖不足。 |
| AC-10 | 部分验证 | E-06 仅对照 1 条。 |
| AC-11 | **失败** | E-05；筛选子断言仅局部观察。 |
| AC-12 | **失败** | E-09。 |

## 5. UX/UI 应用性审查与发现

**角色与旅程**：以 HR / Recruiter 每日登录后“先识别本人待办，再查看团队规模，进入需要处理的任务”为目标。当前会话的账号与 My Work 显示的角色姓名不一致，不能认定已经以规格中的 `hr_a` 登录。步骤 1、4–8 获得只读 UI 证据；步骤 2–3 的双角色确认与授权明细缺前置条件。

| 应用性标准 | 结论 | 依据 |
|---|---|---|
| U1 容易理解 | 失败 | E-01 的身份标签不一致；E-11 未加载时显示真实零的外观。 |
| U2 容易上手 | 部分通过 | T1、筛选和两种视图入口可见；E-02 未标额外项数量及 T3 层级。 |
| U3 快速完成任务 | 失败 | E-04 统计卡不可进入列表；E-10 行跳错目标。 |
| U4 下一步明确 | 失败 | E-10 任务点击后到 Overview，用户需再判断去哪里。 |
| U5 提示和按钮清楚 | 失败 | E-09 无简历仍写 `View résumé`；E-08 点击后只告知功能未上线。 |
| U6 符合真实工作方式 | 未验证 | 缺完整待办、角色、保存与交接数据。 |
| U7 信息结构符合角色目标 | 失败 | E-01 当前账号和 My Work 身份标注不一致；缺按角色任务对照。 |
| U8 减少跳转与重复操作 | 失败 | E-10 错误落到 Overview，需要重新导航。 |
| U9 可恢复和可预期 | 失败 | E-11 加载与真实零混淆；故障、缓存及重试未测。 |
| U10 可访问、可读和可操作 | 部分检查，未完整验证 | E-04 统计卡没有按钮/链接语义；未完成键盘全路径、200% 缩放、焦点和读屏测试。 |

| ID / 级别 | 角色、步骤、证据与用户影响 | 最小修复方向及验收检查 |
|---|---|---|
| I12-UX-01 / **P1** | HR，步骤 1；E-11 加载期间所有卡和筛选显示 0，列表同时显示 `Loading…` 与 `No projects yet.`，会误导用户以为没有工作。 | 取数未完成时用占位；真实零、单项失败与旧缓存分别呈现。注入慢请求、空结果、单项失败、过期快照，核对卡片和筛选。 |
| I12-UX-02 / **P1** | HR，步骤 3；E-04 G01 卡片无点击效果和交互语义，无法从汇总查明细。 | 给卡片可键盘操作的同口径明细入口，明细按记录权限过滤并解释范围；用部分权限双账号和 API 验证。 |
| I12-UX-03 / **P1** | HR，步骤 5；E-05 Draft 排在 Interview in progress 之前，不符合任务优先级，容易遗漏待处理项目。 | 按规格状态优先级、同状态更新时间倒序排序；用 13 状态 seed 和筛选前后 ID 顺序验收。 |
| I12-UX-04 / **P1** | HR，步骤 7；E-10 进行中行落到 Overview，而非规定的 Live Interview，增加查找与误操作风险。 | 建立状态到目标页映射；逐个点击 13 状态并核对路由及进入门槛。 |
| I12-UX-05 / **P1** | HR，步骤 8；E-09 无简历项目仍显示可点 `View résumé`，E-08 只出现 coming soon，不提供预览。 | 有简历时打开右侧抽屉；无简历时显示 `No resume` 弱态且不可打开。以有/无附件两条合成数据检查。 |
| I12-UX-06 / **P1** | HR/Interviewer，步骤 1；E-01 账号显示与 My Work 姓名不一致，本地代码显示个人指标为常量 0，当前数字不能作为可靠的待办依据。 | 使用真实用户与 Workspace 作用域生成 M01–M04；切换角色/Workspace 后重取，准备非零数据及双身份核对。 |
| I12-UX-07 / **P2** | HR，步骤 4；E-02 将 T2/T3 混在一个 More statistics 展开区，未写新增指标数。 | 单独标明 More statistics 与 Trends，展开控件说明项数；检查展开、收起及返回后状态。 |
| I12-SEC-01 / **P0 验收阻塞，非已复现越权** | HR/HM/Interviewer，步骤 2–3；无部分权限账号及 API 证据，无法证明全局数字同口径、明细隔离、Interviewer 只见本人任务。 | 以多账号和分工作区合成数据核对聚合、明细、任务及 403；权限类 AC 未完成前不得宣称通过。 |

按审查标准，存在多个未豁免 P1，且核心权限断言未验证；本轮结论为**不通过完整验收**。I12-SEC-01 是验收证据阻塞，并非已复现的安全漏洞。

## 6. 本地代码观察（不作为线上复现）

- 当前仓库 `hireos-interview/job-Interview-front/src/pages/Home.tsx` 用 `GET /jobs`、`GET /tasks` 在浏览器端计算统计；My Work 四项及 More statistics 中除 G07 外的八项写死为 0。统计卡使用普通 `div`，没有明细跳转；加载期间按空数组计算为 0。
- 同文件将所有任务行的 `open` 固定到 `overview`；`filteredProjects = taskRows.filter(...)` 未应用状态优先级或更新时间排序。`View résumé` 仅显示 coming soon；其禁用条件是候选人是否关联，而非简历是否上传。
- `data/domain.ts` 仅定义 10 种任务状态，缺 `No candidate linked`、`Review pending`、`Withdrawn`；后端 `intake/tasks.service.ts` 的 `list()` 按 `createdAt desc` 返回，无法满足默认 Action required first。
- `store/StoreContext.tsx` 将 `moreOpen` 等偏好写入单一 `hireos_prefs` localStorage 键；未按用户 + Workspace + 模块分隔。该事实解释 E-03 的刷新保留，但不能证明跨账号/Workspace 正确。
- 本轮未改业务代码，未运行 build、lint、typecheck 或 test；这些命令不能替代线上角色、权限和 UI 验收。

## 7. 复测前置与顺序

1. 提供可识别的线上构建号、隔离 `[UJ-TEST]` 数据与清理方式：`S_home_mixed`、13 状态各一条、`confirm_split`、JD-only、unknown recruiting status、已上传/未上传简历；并提供 HR、HM、Interviewer、部分权限用户的独立测试账号。候选人只用合成资料和 `example.com` 邮箱。
2. 先核对服务端聚合去重和角色权限：M01–M04、G01–G10 对照数据库主键计算；用两账号核对全局数字、明细过滤、跨 Workspace 隔离及 Interviewer API 限制。
3. 逐条执行 UC-I12-01～13，特别是 13 状态跳转、Action required first、两种视图完整 ID/状态/进度/简历对照、真实简历抽屉、无简历弱态、刷新偏好隔离。
4. 注入慢请求、单指标失败、缓存过期和重复事件，验证占位/0/Unavailable/Last updated 的语义、重试与幂等；最后补键盘、200% 缩放、焦点与非颜色状态检查。每项记录 UI、API、DB/审计的实际证据，再更新 AC 结论。
