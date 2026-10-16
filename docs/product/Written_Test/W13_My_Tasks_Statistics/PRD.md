# W13 产品文档：我的任务与首页统计

| 项 | 内容 |
|---|---|
| 模块 | W13 / 贯穿主流程（默认首页） |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | 所有员工角色（HR / Recruiter、Hiring Manager / Reviewer、Operations、Admin） |
| 原型路由 | `#/tasks`（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🟡 后端 `tasks` 提供任务列表，`Task` 与 `Case` 1:1（由 Screening 交接创建，Case 进入终态时完成）；前端 `TasksPage` 已接真实接口，按候选人状态过滤，支持 Cluster by JD。领取、转派、等待、多任务类型、§12 指标口径未实现。未逐项验证 AC |
| 依据 | [PRD v1.4 §12、§11（SHARED-08/09）](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §8](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §5.1、§7、P16、P17](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md) |

## 1. 背景与目标

测评流程中大量工作需要人推进：发布复核、评分复核、结果发布、缺件处理、交付异常等。如果任务可以随手勾选完成、统计数字把父子任务或重复通知重复计数，或者切换身份后短暂显示上一个人的数字，负责人就无法信任首页。

**目标**：每个人在首页先看到自己要做的事；任务只能通过业务动作完成；每个指标有唯一口径、可下钻到同过滤列表；不同权限范围看到各自的数字。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 首页结构：My Work → Workspace Overview → More statistics → Projects / Tasks | 跨模块 Task Feed（L3 Shell） |
| 任务列表：过滤、Task list / Cluster by JD 两种视图 | 通知发送（W14） |
| 任务动作：Claim、Start、Assign、Wait / Resume、评论、History、业务深链接 | 员工绩效统计 |
| 任务类型与完成规则 | |
| §12 指标及四种状态（0 / Loading / Unavailable / Stale） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 页面顶部显示当前登录人、角色、工作区 |
| FR-2 | My Work 不超过 4 张行动卡：My open tasks、Reviews awaiting me、Due today、In progress（或 Overdue） |
| FR-3 | More statistics 默认折叠，展开后显示 Active projects、Awaiting acceptance、Awaiting submission、Submission issues、Results to release、Delivery issues |
| FR-4 | 每张指标卡点击进入相同过滤条件的列表 |
| FR-5 | 指标 0、Loading、Unavailable、Stale 四种状态显示不同；局部失败不清空其他卡；显示 as-of 时间 |
| FR-6 | 任务列表按状态过滤（原型：All tasks、Written completed、Pending test、Pending submission、Pending result review，每项显示数量） |
| FR-7 | **Cluster by JD** 按岗位分组显示候选人，组内可 **Compare candidates**（进入 W12） |
| FR-8 | 任务行显示候选人 / 岗位、类型、优先级、截止、状态、明确动词按钮；可 **View resume** 打开简历预览抽屉 |
| FR-9 | 任务类型：题目发布复核、计划批准、身份 / 附件绑定、评分复核、结果发布、反馈修订批准、补测批准、对比评审、交付异常 |
| FR-10 | 任务动作：Claim、Start、Assign、Wait（必填原因和恢复时间或事件）、Resume、评论、History；点击进入所属业务页面 |
| FR-11 | 并发领取冲突时提示「This task was claimed by another reviewer」并刷新 |
| FR-12 | 角色 / 范围切换时清除旧缓存，不闪现上一身份的数字 |
| FR-13 | 业务成功、回到前台、手动刷新后更新数字 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 每个活动任务恰有一个引用统一 user_id 的 assignee，或一个授权 queue |
| BR-2 | 状态：open / in_progress / waiting / completed / cancelled；waiting 需原因和恢复时间 / 事件；overdue 是派生标记，默认不暂停期限 |
| BR-3 | 业务动作成功后才完成任务；不提供绕过业务的勾选完成；Cancel / Wait 不算完成 |
| BR-4 | 转派不授予数据权限；版本过期的任务禁用旧动作 |
| BR-5 | Workspace Overview 统计当前用户获授权的记录范围（Accessible workspace）；Admin 看完整授权 workspace |
| BR-6 | 任务数不当作候选人人数或员工绩效 |
| BR-7 | 指标口径以 PRD §12 表为准，摘要见下表 |

| 指标 | 口径 |
|---|---|
| My open tasks | 唯一 task_id；本人 open / in_progress / waiting；父容器不重复加子任务 |
| Reviews awaiting me | 上项中 evaluation_review / result_release / feedback_review 子集，不与总数相加 |
| Due today / Overdue | 有效时区的今天 / due_at < now 且未结束；waiting 默认仍计 |
| Available to claim | 当前有资格的 queue 任务，独立于 My open |
| Active projects | 授权范围内 status = active 的唯一 project_id |
| Awaiting acceptance | sent / opened 的有效 Invitation；退信仍计入但显示交付问题 |
| Awaiting submission | accepted / started 未终态的 Invitation；修订轮单独标签 |
| Submission issues | 未关闭的收件 / 草稿问题，按 issue_group_id 去重 |
| Results to release | final 结果尚无当前 published Release 的唯一 Case |
| Delivery issues | 需人工处理的唯一逻辑 Delivery，不累加重试 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | W03–W11 的业务事件 | |
| 输出 | HumanTask | 类型、source_ref、assignee / queue、状态、priority、due_at、waiting 原因、恢复条件、版本 |
| 输出 | TaskHistory | 动作、操作人、时间 |
| 输出 | MetricSnapshot | 指标、值、as_of、scope |

## 6. 权限

- 任务列表和指标只包含当前用户有权限的记录。
- 原型 Settings 说明任何在职员工可以直接处理同事的未完成工作（Team Tasks），见「待确认」第 2 条。

## 7. 非功能要求

- 两人同时 Claim 只有一人成功。
- Shell 离线时仍可打开 Assessment 独立入口的 My Tasks。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 基线 seed：Emma My open = 3，Daniel = 1，Admin = 0；Daniel Available to claim = 1 | E、Brief §7 |
| AC-2 | 基线 workspace：1 active project、0 awaiting acceptance、2 awaiting submission、1 submission issue、1 result to release | E、Brief §7 |
| AC-3 | 两人并发 Claim 同一任务，后者看到冲突提示 | Brief P16 |
| AC-4 | Wait 不填原因无法保存；Wait / Cancel 后任务不算完成 | Brief P16 |
| AC-5 | 任务只能通过业务动作完成，完成后卡片、列表、提醒一致 | Brief P16 |
| AC-6 | 指标 Loading / 0 / Unavailable / Stale 显示不同；切换角色时不闪现旧数字 | Brief P17 |
| AC-7 | 父子任务或重复事件不虚增数字 | Brief P17 |
| AC-8 | Cluster by JD 中只有已评分的候选人可被选入对比 | 原型 |

## 9. 依赖与实现

- 后端：`src/tasks`（`tasks.service.ts`）、`src/cases/case-lifecycle.service.ts`（任务完成）。
- 前端：`TasksPage`、`features/useOpenTaskCount.ts`、`data/realTasksMerge.ts`。
- 依赖：W03–W11；W14 通知；W18 身份与权限。

## 10. 待确认

1. **任务列表结构**：PRD §12 要求 Assigned to me / Available to claim / Created or followed / Completed 四个 tab；原型（和现有实现）改为按候选人状态过滤 + Cluster by JD。以哪个为准，还是两者并存？
2. **审批类任务**：原型 Settings 写明「没有审批队列、没有双签，任何在职员工可以直接处理同事的工作」，这会让计划批准、发布复核、修订批准等任务类型失去意义。是否采纳原型的 Startup Team Access 模式？
3. 现有 `Task` 与 `Case` 1:1，多任务类型需要改模型（涉及 Prisma 迁移）。
4. 原型 My Work 第 4 张卡是 In progress，PRD 是 Due today / Overdue。卡片组合以哪个为准。
