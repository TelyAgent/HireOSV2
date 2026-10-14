# F06 产品文档：AI 岗位发现与推荐

| 项 | 内容 |
|---|---|
| 模块 | F06 / 主流程第 6 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | 系统自动运行；Recruiter / HR、Hiring Manager 查看结果 |
| 原型路由 | `#/candidates/:id/jobs`、岗位详情中的 AI Suggested candidates（[原型 v2](../../../design/Resume_Screening/HireOS-Resume-Screening-Prototype-v2.html)） |
| 实现现状 | 🟡 后端 `discovery`（AI 匹配 + 规则兜底；代码中出现的运行状态有 running / completed / failed / insufficient_data / no_match，**未见 `recommendations_ready`、`no_open_jobs`**）；前端 `JobRecommendationsPage`。未逐项验证 AC |
| 依据 | [PRD v1.3 §4.2、§4.4、§5.1](../../../../hireos-screening/docs/Resume_Screening_PRD_v1.3.md)、[用户旅程 v0.2 J2、J5、§8](../../user-journeys/Resume_Screening_User_Journeys_v0.2.md) |

## 1. 背景与目标

简历入库后，HR 不想逐个岗位去比对。系统应该主动找出可能合适的岗位，但只作为提案，由人来决定是否关联。

**目标**：入库后自动在开放岗位中逐岗匹配，给出带理由和证据的推荐；推荐不等于关联；没有推荐时说清原因。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 简历 → 岗位：为候选人找岗位 | 人工确认关联（F07） |
| 岗位 → 简历库：为新岗位找候选人 | 正式岗位筛选评估（F08） |
| 关联前匹配评估（PreLinkMatchEvaluation） | 跨岗位分数直接比较 |
| 置信度档位、匹配状态 | 自动关联、自动推进 |
| 重新匹配的触发与去重 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 候选人入库后，自动在用户可访问、开放且标准已确认的岗位中逐岗匹配 |
| FR-2 | 岗位标准首次确认后，自动从简历库中找出方向相符的候选人 |
| FR-3 | 每条推荐给出：匹配理由（引用简历中真实存在的内容）、关键缺口、证据、置信度、输入版本 |
| FR-4 | 置信度显示为文字档位（Strong / Some / Limited match signal），不显示百分比；证据不足时显示「证据不足，无法估算置信度」 |
| FR-5 | 不符合资格（硬性条件明确不满足）的推荐**仍然显示**，标注「不符合资格 — 不显示置信度」 |
| FR-6 | 匹配状态分开显示：not_started、running、recommendations_ready、no_match、no_open_jobs、insufficient_data、failed |
| FR-7 | 没有推荐时说明原因，并提供 **Match again**、人工搜索岗位、补资料 |
| FR-8 | 以下情况触发重新匹配：新增或重开岗位、岗位标准更新、候选人资料更新、用户手动操作 |
| FR-9 | 岗位页的「待确认推荐」与「已关联候选人」分开显示、分开计数 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 推荐只是提案，不建立正式关联，不产生 Application |
| BR-2 | 每个岗位用自己的标准评估；不同岗位的分数不能按大小混排，不编造跨岗位的统一录用概率 |
| BR-3 | AI 失败记为 failed，不能记为 no_match |
| BR-4 | no_match 只表示当前岗位集合和资料版本下暂无合适岗位，不表示候选人不合格 |
| BR-5 | 每次匹配保留 run 版本；同一候选人对同一岗位只保留一条有效的待确认推荐，不重复 |
| BR-6 | 置信度门槛按 Patch 1 P2：覆盖率 < 0.30 不生成推荐；0.30～0.69 显示证据不足；≥ 0.70 显示档位；< 0.15 为 insufficient_data（待确认以哪个版本为准） |
| BR-7 | 已删除、受保留策略限制或不可联系的资料不再自动匹配 |
| BR-8 | 已关闭的岗位不参与匹配；已有推荐可查看，但不能确认 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | CandidateProfile、JobCriteriaVersion | 资料版本、岗位标准版本 |
| 输出 | JobDiscoveryRun | 资料版本、可访问岗位集合快照、规则 / 模型版本、状态、推荐引用、无推荐原因、生成时间 |
| 输出 | PreLinkMatchEvaluation | candidate、job、标准 / 资料 / 策略版本、证据、逐维结果、缺口；不需要 application_id |
| 输出 | CandidateJobRecommendation | 评估引用、推荐理由、状态、任务引用 |

## 6. 权限

- 只在用户有权访问的岗位中匹配；推荐只对有该岗位权限的人可见。

## 7. 非功能要求

- 同一输入重复运行，结果都要满足判定条件（理由引用真实内容、没有编造）。
- 匹配耗时阈值待确认。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 只有简历、没有岗位时状态为 no_open_jobs；有岗位但不合适为 no_match；资料不足为 insufficient_data；AI 失败为 failed，四者区分 | SCR-25 |
| AC-2 | AI 推荐多个岗位，确认前 Application 数量不变 | SCR-26 |
| AC-3 | 新岗位或新简历触发重新匹配，推荐去重，不自动关联 | SCR-29、E8 |
| AC-4 | 置信度只显示档位不显示百分比；不符合资格的推荐不隐藏但不显示置信度 | J5-1～2 |
| AC-5 | 推荐理由引用简历中真实存在的内容 | PRD §4.2 |
| AC-6 | 不同岗位的推荐不按分数混排 | PRD §4.2 |
| AC-7 | 已关闭岗位的推荐不能确认，并说明原因 | E9 |

## 9. 依赖与实现

- 后端：`src/discovery`（`discovery.service.ts`、`ai-matcher.service.ts`）。
- 前端：`JobRecommendationsPage`、`ScreeningWorkspacePage` 中的推荐区。
- 依赖：F02、F05；模型调用依赖模型配置（功能拆分 F18）。下游 F07。

## 10. 待确认

1. 置信度门槛以 Patch 1 为准还是以当前实现为准。
2. 推荐顺序规则（同一候选人的多个岗位按什么排序）。
3. 重新匹配的频率上限，避免反复生成推荐任务。
