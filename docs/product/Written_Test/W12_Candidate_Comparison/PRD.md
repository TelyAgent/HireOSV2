# W12 产品文档：候选人对比

| 项 | 内容 |
|---|---|
| 模块 | W12 / 贯穿主流程（读取 W08 结果） |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Hiring Manager、HR / Recruiter |
| 原型路由 | `#/comparisons`、`#/comparisons/:id`；入口在 My Tasks「Cluster by JD」和项目详情 **Compare candidates**（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🔴 后端没有对比模块；前端 `ComparisonsListPage`、`ComparisonDetailPage` 使用 fixture。未逐项验证 AC |
| 依据 | [PRD v1.4 §10、§11（SHARED-12）](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Brief v1.1 §5.6、P13、P14](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md)、[Resume Screening F10 候选人对比](../../Resume_Screening/F10_Candidate_Comparison/PRD.md) |

## 1. 背景与目标

招聘负责人需要并排比较候选人的能力表现。但 AI 草稿分与人工 final 分、初稿与看过答案后的修订、不同试卷版本的成绩，直接放在一起排名会误导决策；对比结果也不应因排序就触发发送。

**目标**：与 Screening 共用 Compare 视觉和交互；2–4 人并排、能力为行；只有同岗位、量尺 / Rubric / 试卷等价且曝光条件一致的成绩才可排序；每个重要论点有证据；保存快照、导出、逐人下一步都不自动发送。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 对比列表、新建对比 | 正式排名以外的招聘决定 |
| 对比详情：Role / Snapshot / Mode / 名单、Key Differences、能力矩阵 | 跨岗位排名 |
| 三种模式：Same stage、Current summary、Changes since last round | 发送邀请 / 结果 |
| 只看差异、显示 Unknown、证据下钻、评论、保存快照 | |
| Stale 提示与刷新 | |
| 导出 PNG / PDF / 完整报告 | |
| 每列 Next action（提案） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 对比列表显示已保存的对比快照；**New comparison** 选岗位和 2–4 名候选人 |
| FR-2 | My Tasks 的 Cluster by JD 视图中，**Compare candidates** 只允许选择已有分数的候选人；无可比候选人时提示「No scored candidates to compare yet.」 |
| FR-3 | 详情顶部显示 Role、Snapshot 时间、Mode、候选人名单；首列固定为维度，2–4 人默认舒适并排 |
| FR-4 | 全部结果为 final 且可直接比较时提示「Both results are final and directly comparable.」；含 AI draft 时提示仅供参考，不能声称整体领先者 |
| FR-5 | Unknown / Not provided / Restricted / Not comparable 使用不同文案 |
| FR-6 | Key differences 列出主要差异，每条可下钻到证据 |
| FR-7 | 支持只看差异、显示 Unknown、评论 |
| FR-8 | **Refresh** 生成新快照，旧快照保留；源结果更新后旧快照显示 Stale |
| FR-9 | **Export** 单页 PNG / PDF 及完整报告，默认浅色；超过单页舒适人数时要求选子集或分页，不缩小字号、不静默漏人 |
| FR-10 | 每列底部 Next action，先生成提案再批准；生成对比或导出不发送任何邀请 |
| FR-11 | AI 摘要的每个重要论点附证据；没有明确领先者时显示「No clear overall leader」 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 只有同岗位、有效量尺 / Rubric / 试卷等价、曝光条件一致的成绩可排序 |
| BR-2 | 初稿与看过答案后的修订不混排；AI draft 与 final 不作同阶段排名 |
| BR-3 | 准备 / 历史复核可比较同岗位 Case，但不做正式排名 |
| BR-4 | 正式岗位测评引用同一 Core 招聘关系；通用能力测评可以没有 Application |
| BR-5 | 跨阶段资料显示来源和覆盖范围 |
| BR-6 | AI 不能强选赢家 |
| BR-7 | 个人对比视图偏好不改变 Rubric 或团队分数 |
| BR-8 | Comparison 不扩大查看权限 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Result / CriterionScore（W08） | 状态（draft / final）、轮次、试卷版本 |
| 输出 | ComparisonSnapshot | 岗位、候选人、模式、生成时间、源结果版本、stale 标记 |
| 输出 | ComparisonComment | 作者、位置、内容 |
| 输出 | Export | 格式、范围、文件 ref |

## 6. 权限

- 只显示当前用户有权限的候选人和证据；无权限的显示 Restricted。

## 7. 非功能要求

- 对比矩阵可在容器内横向滚动（键盘可操作），页面本身不横向溢出。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | Alex（final 70）与 Taylor（AI draft 80）对比时，默认 Current summary，不显示整体领先者 | D、Brief §7、P13 |
| AC-2 | Jordan、Casey 未测的维度显示 Unknown，不显示 0 | D、Brief §7 |
| AC-3 | 新结果 final 后旧快照显示 Stale，Refresh 生成新快照、旧快照保留 | Brief P13 |
| AC-4 | 评论、只看差异、保存视图可用；导出超人数时要求选子集或分页 | Brief P14 |
| AC-5 | 生成对比、导出、排序都不发送邀请或通知 | D、Brief P14 |
| AC-6 | 修订轮与初稿不在同一排名中 | D |

## 9. 依赖与实现

- 后端：需新建对比模块。
- 前端：`ComparisonsListPage`、`ComparisonDetailPage`、`TasksPage`（Cluster by JD）。
- 依赖：W08、W10；公共 Compare 框架（SHARED-12，与 Screening F10 共用）。

## 10. 待确认

1. 公共 Compare 框架由谁建设：是先在 Screening 实现再抽出，还是平台统一建设后两个模块接入。
2. 对比评论是否需要通知被 @ 的同事（W14）。
