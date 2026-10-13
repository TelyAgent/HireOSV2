# HireOS Command Interview 面试任务列表状态、点击流程与排序规则 PRD

## 1. 背景

HireOS Command Interview 首页需要同时支持招聘团队的日常任务处理和按岗位查看候选人进展。当前首页包含两种浏览模式：

- `Task list`：按候选人任务平铺展示，适合处理每日待办。
- `Cluster by JD`：按岗位 JD 聚类展示，适合查看某个岗位下所有候选人的进展。

为了避免用户混淆，面试任务列表的状态标签必须表达“候选人在某个 JD 下的面试流程状态”，而不是单纯的 JD 状态。

## 2. 目标

定义 `Task list` 的状态标签、点击跳转逻辑和默认排序规则，使用户可以快速判断每个候选人当前卡在哪一步，并直接进入对应流程页面处理。

## 3. 适用范围

本 PRD 适用于 HireOS Command Interview 首页中的：

- `Task list` 面试任务列表
- `Cluster by JD` 岗位聚类视图
- 首页快捷筛选项
- 候选人任务点击跳转逻辑
- 简历预览入口

不包含完整招聘 ATS、Offer 审批系统、邮件管理后台或候选人门户。

## 4. 核心原则

1. `Task list` 以候选人为主线。每一行代表一个候选人在一个 JD 下的面试任务。
2. `Cluster by JD` 与 `Task list` 使用同一批数据。两种模式只是浏览方式不同，不应出现候选人数量、状态或简历信息不一致。
3. 状态标签表达当前流程位置。状态不用于评价候选人强弱，只表示当前任务处于哪一步。
4. 点击候选人进入对应流程页面。用户点击候选人主标题后，应进入当前状态最相关的页面。
5. 简历入口独立展示。简历作为候选人资料入口，放在列表最右侧；点击后从右侧打开简历预览。

## 5. 列表字段定义

| 字段 | 说明 |
|---|---|
| Candidate & JD | 主标题为候选人名称，副标题为 JD / 岗位名称 |
| Status | 当前面试任务状态 |
| Progress | 面试轮次或当前处理进度 |
| Created | 任务创建时间 |
| Resume | 简历预览入口 |

## 6. 状态标签定义

### 6.1 主流程状态

| 状态 | 中文 | 含义 | 点击后进入页面 |
|---|---|---|---|
| `No candidate linked` | 未关联候选人 | JD 已创建，但还没有关联候选人 | Overview |
| `Draft` | 草稿 | 候选人已存在，但 JD 要求尚未提取或项目尚未正式配置 | Overview |
| `Requirements ready` | 要求待确认 | 系统已从 JD 提取 Requirements / Rubric，等待人工确认 | Requirements & Rubric |
| `Planning` | 规划中 | Rubric 已确认，但面试计划尚未确认 | Interview Plan |
| `Ready to schedule` | 待排期 | 面试计划已确认，但尚未安排面试时间 | Schedule |
| `Interview in progress` | 面试进行中 | 至少一轮面试已开始或部分完成 | Live Interview |
| `Review pending` | 待评审 | 面试轮次已完成，等待交叉轮次评估 / Debrief | Cross-round Evaluation / Debrief |
| `Awaiting confirmation` | 待确认 | 已形成结论，但 HR 或 Hiring Manager 尚未全部确认 | Decision |
| `Package published` | 评估包已发布 | 最终结论已确认，评估包已生成并发布 | Evaluation Package |

### 6.2 异常与分支状态

| 状态 | 中文 | 含义 | 点击后进入页面 |
|---|---|---|---|
| `Evidence requested` | 待补充证据 | 当前证据不足，需要补充面试或材料 | Debrief |
| `On hold` | 暂停中 | 面试流程被暂停，等待后续业务决策 | Overview |
| `Not proceeding` | 不再继续 | 已决定不推进该候选人 | Evaluation Package / Decision Summary |
| `Withdrawn` | 已退出 | 候选人主动退出或流程终止 | Overview / Candidate Record |

## 7. 状态生成逻辑

| 条件 | 状态 |
|---|---|
| `candidateLinked = false` | `No candidate linked` |
| `candidateLinked = true` 且 `rubricExtracted = false` | `Draft` |
| `rubricExtracted = true` 且 `rubricConfirmed = false` | `Requirements ready` |
| `rubricConfirmed = true` 且 `planApproved = false` | `Planning` |
| `planApproved = true` 且 `r1Scheduled = false` | `Ready to schedule` |
| 已排期或部分轮次完成，但计划轮次未全部完成 | `Interview in progress` |
| 所有计划轮次完成，但尚未形成最终结论 | `Review pending` |
| Debrief 标记证据不足 | `Evidence requested` |
| 已形成结论，但 HR / Hiring Manager 未全部确认 | `Awaiting confirmation` |
| HR 与 Hiring Manager 均确认，且评估包发布 | `Package published` |
| 流程被暂停 | `On hold` |
| 最终结论为不推进 | `Not proceeding` |
| 候选人退出 | `Withdrawn` |

## 8. 点击跳转逻辑

| 状态 | 跳转目标 |
|---|---|
| `No candidate linked` | Overview，提示用户关联候选人并上传简历 |
| `Draft` | Overview，提示用户提取 Requirements |
| `Requirements ready` | Requirements & Rubric |
| `Planning` | Interview Plan |
| `Ready to schedule` | Schedule |
| `Interview in progress` | Live Interview |
| `Review pending` | Cross-round Evaluation / Debrief |
| `Evidence requested` | Debrief，展示证据缺口和补充建议 |
| `Awaiting confirmation` | Decision |
| `Package published` | Evaluation Package |
| `On hold` | Overview |
| `Not proceeding` | Evaluation Package / Decision Summary |
| `Withdrawn` | Overview / Candidate Record |

## 9. 简历入口逻辑

| 条件 | 展示 | 点击行为 |
|---|---|---|
| 已上传简历 | `View résumé` / `查看简历` | 从右侧打开简历预览 |
| 未上传简历 | `No resume` / `未上传` | 按钮弱态，不打开预览 |
| 候选人未关联 | `No resume` / `未上传` | 按钮弱态，用户需先关联候选人 |

简历预览为右侧 Drawer，不应跳转离开当前列表。

## 10. 浏览模式一致性

`Task list` 和 `Cluster by JD` 必须使用同一份候选人任务数据。

`Task list` 展示方式：

- 一行一个候选人任务
- 主标题是候选人
- 副标题是 JD
- 适合处理待办

`Cluster by JD` 展示方式：

- 一组一个 JD
- JD 下展开候选人列表
- 候选人状态、进度、简历入口必须与 `Task list` 保持一致

## 11. 默认排序规则

默认排序采用：

`Action required first`

中文：`待处理优先`

排序目标是让最需要用户动作的候选人排在前面。

## 12. 排序优先级

| 优先级 | 状态 | 说明 |
|---|---|---|
| 1 | `Needs my confirmation` | 当前用户必须确认 |
| 2 | `Evidence requested` | 证据不足，需要补充 |
| 3 | `Awaiting confirmation` | 等待 HR / Hiring Manager 确认 |
| 4 | `Ready to schedule` | 计划完成，待排期 |
| 5 | `Review pending` | 面试完成，待评审 |
| 6 | `Interview in progress` | 面试进行中 |
| 7 | `Planning` | 待确认面试计划 |
| 8 | `Requirements ready` | 待确认 Rubric |
| 9 | `Draft` | 草稿 |
| 10 | `No candidate linked` | JD 已有，但未关联候选人 |
| 11 | `On hold` | 暂停 |
| 12 | `Not proceeding` | 不推进 |
| 13 | `Withdrawn` | 候选人退出 |
| 14 | `Package published` | 已完成归档 |

同一状态下，按最近更新时间或创建时间倒序排列。

## 13. 筛选规则

首页快捷筛选项不改变排序规则，只缩小列表范围。

| 筛选项 | 展示范围 |
|---|---|
| `All projects` / `全部项目` | 所有候选人任务 |
| `Needs my confirmation` / `待我确认` | 当前用户需要确认的候选人任务 |
| `Draft` / `草稿` | `No candidate linked`、`Draft`、`Requirements ready`、`Planning` |
| `Published` / `已发布` | `Package published` |

## 14. 权限与可见性要求

1. 候选人不能看到内部 Brief、Scorecard、Debrief 或评估报告。
2. HR 与 Hiring Manager 必须分别确认最终结论。
3. `Continue to next round` 与 `Recommend for offer` 必须是不同操作。
4. `Unknown` 不得显示为 0 分或能力不足。
5. 所有分数必须能追溯到 Rubric、理由、证据和原始回答。

## 15. 验收标准

1. `Task list` 至少覆盖所有定义状态，每个状态都有对应 list item。
2. 点击每个 list item 后，跳转到与状态匹配的流程页面。
3. `Task list` 与 `Cluster by JD` 使用同一批候选人 mock 数据。
4. 同一候选人在两种模式下的状态、进度、简历信息一致。
5. 简历链接位于列表最右侧，点击后从右侧打开预览。
6. 未上传简历时，简历入口显示弱态且不会打开预览。
7. 默认排序为待处理优先。
8. 筛选项只改变展示范围，不改变状态优先级逻辑。
