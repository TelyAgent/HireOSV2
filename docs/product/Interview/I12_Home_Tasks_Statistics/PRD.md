# I12 产品文档：首页、任务列表与统计

| 项 | 内容 |
|---|---|
| 模块 | I12 / 读取主闭环状态 · SHARED-08 公共框架 + Interview 业务规则 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | 全部雇主端用户（HR / Recruiter、Hiring Manager、Interviewer） |
| 原型页面 | `Interview Home`（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 前端 `Home` 读取 `GET /jobs`、`GET /tasks`，在前端计算统计卡片、Task list / Cluster by JD 两种视图和筛选。后端没有统计读模型（HomepageStatsSnapshot）；全局数字受当前用户可访问记录限制；没有按角色区分 My Work；折叠偏好存在浏览器 localStorage。后端任务状态有 draft … package_published 八个主流程状态，没有 `No candidate linked`、`Withdrawn`。未逐项验证 AC |
| 依据 | [PRD v1.5 §8.2、§8.6、§9、§6 INT-17–19、§12.1](../HireOS_Command_Interview_PRD_v1.5.md)、[任务列表状态、点击流程与排序规则 PRD v1.0](../HireOS_Command_Interview_Task_List_Status_and_Sorting_PRD_v1.0.md) |

## 1. 背景与目标

用户每天打开 Interview，首先要知道「我接下来要处理什么」，其次想知道「团队面试规模如何」。数字口径不清（项目、岗位、场次混算）或只给管理员看全局数，都会让首页失去作用。

**目标**：首页把个人待办和全局汇总分开，按优先级展示和折叠；任务列表以候选人为主线，状态表达流程位置，点击直接进入要处理的页面，默认待处理优先。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| My Work（个人，T1 / T2）与 Workspace Overview（全局，T1 / T2 / T3） | 内部产品效果指标（PRD §11） |
| T1 默认展开，可压缩为摘要行；T2 More statistics、T3 Trends 默认折叠 | 独立分析后台 |
| 统计卡片点击进入与口径一致的过滤列表 | 主题与字号（I14） |
| 加载、真实零、单项失败、缓存过期四种状态 | |
| 任务列表：Task list / Cluster by JD 两种视图，同一份数据 | |
| 13 个任务状态、点击跳转、默认「Action required first」排序、快捷筛选 | |
| 简历预览抽屉 | |
| 搜索项目和候选人 | |
| 角色差异：HR 与 Interviewer 的 My Work 和筛选项不同 | |

## 3. 功能需求

### 3.1 统计

| ID | 需求 |
|---|---|
| FR-1 | My Work T1：My remaining interviews（M01）、Awaiting my schedule confirmation（M02）、Scorecards to submit（M03）、Decisions awaiting my confirmation（M04；对 Interviewer 显示「not applicable to interviewers」） |
| FR-2 | Workspace Overview T1：Total interview projects（G01）、Roles actively recruiting（G02）、Roles in interview（G03） |
| FR-3 | More statistics（T2）：My interviews today（M05）、My interviews in the next 7 days（M06）、Active interview projects（G04）、Projects awaiting joint confirmation（G05）、Interviews awaiting scheduling（G06）、Roles with unknown recruiting status（G07） |
| FR-4 | Trends & additional stats（T3）：Interviews completed — last 30 days（G08）、Evaluation packages completed — last 30 days（G09）、Projects on hold（G10） |
| FR-5 | 每张卡显示单位和口径副标题（如「unique projects」「recruiting_status = open」）；口径说明可通过键盘访问，不只靠鼠标悬停 |
| FR-6 | 各指标按 PRD §8.2.2 的精确口径计算和去重（项目按 project_id、岗位按 role_id、场次按 session_id、反馈按 feedback_task_id） |
| FR-7 | T2 / T3 用 Show more / Show less 展开，显示额外指标数量；折叠状态按用户 + Workspace + 模块保存 |
| FR-8 | 首次加载显示占位；真实 0 显示 0 和空状态；单项失败显示 `Unavailable` 和 Retry，不显示 0；缓存数据标 `Last updated …` |
| FR-9 | 进入首页或重新聚焦时刷新，显示 `Updated …`；新建项目、排期、提交评分、确认、归档成功后刷新相关计数 |
| FR-10 | 全局卡片对全部 Workspace 雇主用户显示同一数字；点进明细只显示有权访问的记录，并标 `Showing records you can access`；无明细权限时卡片数字照常显示 |
| FR-11 | 切换身份或 Workspace 后重新取数，不短暂显示上一身份的数字 |

### 3.2 任务列表

| ID | 需求 |
|---|---|
| FR-12 | Task list：一行一个候选人在一个 JD 下的任务；列：Candidate & JD、Status、Progress、Created、Resume（最右侧） |
| FR-13 | Cluster by JD：按岗位分组，组内列出候选人；组内无候选人时显示「No candidates linked to this JD yet」和 Link candidate |
| FR-14 | 两种视图使用同一份数据，同一候选人的状态、进度、简历信息一致 |
| FR-15 | 状态（按任务列表 PRD §6–§7）：No candidate linked、Draft、Requirements ready、Planning、Ready to schedule、Interview in progress、Review pending、Evidence requested、Awaiting confirmation、Package published、On hold、Not proceeding、Withdrawn |
| FR-16 | 点击候选人进入与状态对应的页面（任务列表 PRD §8），例如 Planning → Interview Plan、Awaiting confirmation → Decision |
| FR-17 | 默认排序 Action required first：Needs my confirmation → Evidence requested → Awaiting confirmation → Ready to schedule → Review pending → Interview in progress → Planning → Requirements ready → Draft → No candidate linked → On hold → Not proceeding → Withdrawn → Package published；同状态按更新时间倒序 |
| FR-18 | HR 筛选项：All projects、Needs my confirmation、Draft（含 No candidate linked、Draft、Requirements ready、Planning）、Published；Interviewer 筛选项：All、Ready to interview、Scorecard pending、Scorecard submitted；筛选只缩小范围，不改变排序 |
| FR-19 | 简历入口：已上传显示 View résumé，右侧抽屉预览，不离开列表；未上传或未关联显示弱态 No resume，不打开 |
| FR-20 | Interviewer 只看到分配给自己的面试、评分和提交任务，说明「Project setup and final decisions stay with editors」 |
| FR-21 | 首页可以有一个小的「失败 / 需授权」提示，点击进入 I13 Activity；文件运行日志不做成 T1 卡片 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 项目 ≠ 岗位 ≠ 场次 ≠ 反馈任务；M01–M04 是不同队列，不相加称为「全部待办」 |
| BR-2 | 同一项目一方已确认时，只计入另一方的 M04；G05 仍计 1 |
| BR-3 | 岗位招聘状态与面试活动是独立维度；G02、G03 不相加 |
| BR-4 | JD-only 项目计入 G01；招聘状态 unknown 的岗位计入 G07，不假定 open，不阻止启动 |
| BR-5 | 归档、软删除的项目及其场次 / 任务从计数中排除；恢复后重新计入；重复导入、改期版本、重复事件不产生额外计数 |
| BR-6 | 全局数字不能用当前用户可访问的明细求和得到，需要专门的聚合能力；该能力不开放明细 |
| BR-7 | Workspace Overview 不受个人列表临时筛选影响 |
| BR-8 | 状态只表示流程位置，不评价候选人强弱 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | InterviewTask、InterviewRound / Session、反馈任务、确认记录、Job / RoleIdentity | |
| 输出 | HomepageStatsSnapshot | workspace_id、user_id（个人项）、metric_id、value、unit、scope、time_window、timezone、as_of、availability |
| 输出 | HomepagePreference | user_id、workspace_id、module_id、expanded_sections |
| 输出 | RoleIdentity | role_id、source_job_id、recruiting_status、status_source |

## 6. 权限

- 全局汇总对 Workspace 内全部雇主端用户可见；不跨 Workspace，不对候选人开放。
- 明细列表按记录权限过滤。
- Interviewer 看不到新建项目入口和 Files 入口。

## 7. 非功能要求

- 刷新时布局稳定；1366 × 768、Large 字号下卡片换行，不需要横向滚动即可看到 T1 数字。
- 统计刷新 SLA 待定；实时推送不是前置要求。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 同岗位多个项目、多轮、多面试官时，项目 / 岗位 / 场次 / 反馈各自按主键正确去重；取消、归档被排除 | HOME-AC01 |
| AC-2 | HR 已确认、HM 未确认：HR 的 M04 不计该项目，HM 计 1；G05 计 1；切换角色后全局数字一致 | HOME-AC02 |
| AC-3 | 同项目多个确认请求，M04 / G05 各计 1，详情可见全部事项 | HOME-AC03 |
| AC-4 | 只有部分记录权限的用户能看到同样的全局数字；明细只显示有权部分并说明范围 | HOME-AC04 |
| AC-5 | JD-only 项目计入总数；unknown 岗位单列 | HOME-AC05 |
| AC-6 | 加载、真实零、失败、缓存四种状态视觉和语义不同；单项失败不影响其他卡片 | HOME-AC06 |
| AC-7 | 展开 T2 / T3 后刷新或返回首页，展开状态保留 | HOME-AC07 |
| AC-8 | 新建、评分、确认后对应数字更新；重复事件不重复计数 | HOME-AC13 |
| AC-9 | Task list 覆盖全部 13 个状态，点击每一行进入对应页面 | 任务列表 PRD §15 |
| AC-10 | Task list 与 Cluster by JD 中同一候选人的状态、进度、简历一致 | 任务列表 PRD §15 |
| AC-11 | 默认待处理优先排序；切换筛选不改变相对顺序 | 任务列表 PRD §15 |
| AC-12 | 未上传简历的行，简历入口为弱态，点击不打开 | 任务列表 PRD §15 |

## 9. 依赖与实现

- 后端：`intake/tasks.service.ts`（`list`）、`intake/jobs.service.ts`；统计读模型缺失。
- 前端：`pages/Home.tsx`、`store/StoreContext.tsx`、`data/domain.ts`。
- 依赖：I01–I11 的状态；I14（偏好）；I15（角色）。

## 10. 待确认

1. 全局统计读模型由 Interview 后端提供，还是将来统一到公共统计服务（SHARED-08）。
2. 后端状态枚举缺少 `No candidate linked`、`Withdrawn`，是否补齐；`Needs my confirmation` 是筛选还是状态（任务列表 PRD §12 把它列为排序第 1 位）。
3. 「Review pending」点击进入 Debrief（任务列表 PRD）还是 Review。
4. Hiring Manager 的 My Work 和筛选项是否与 HR 相同。
