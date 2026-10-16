# I06 产品文档：面试 Brief

| 项 | 内容 |
|---|---|
| 模块 | I06 / 主闭环第 6 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Interviewer；HR / Recruiter、Hiring Manager |
| 原型页面 | 项目页 `Interview Brief` 标签（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 后端 `POST / GET jobs/:id/brief-questions`：基于已确认 Rubric 由 AI 生成每项能力的问题（按 Job，不含候选人信息）。前端 `BriefPage` 经 store 读取。背景摘要（Known / Unknown / Claims）、按轮快照、HR 与业务面试官分工未实现。未逐项验证 AC |
| 依据 | [PRD v1.5 §5 阶段 2、§6 INT-02、§4 原则 3、6](../HireOS_Command_Interview_PRD_v1.5.md) |

## 1. 背景与目标

面试官准备时间有限，常常临场才看简历，导致重复提问、漏问关键要求，或把简历描述当成已验证事实。

**目标**：开面前用一页看清岗位要求、候选人背景中哪些已有证据、哪些未知、哪些说法需要核实，以及本轮该重点验证什么；每条结论都能打开来源。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| Background summary：Known / supported、Unknown / needs verification、Claims to verify / weak evidence | 生成计划（I04） |
| Recommended focus by round：每轮目标能力和推荐问题 | 面试中的实时建议（I07） |
| HR 与业务面试官的分工：HR 核实背景、动机和风险信号；业务面试官验证 JD 职责与能力证据 | 修改上游筛选 / 测评证据 |
| 每条结论的来源（简历、筛选、测评、前序轮次） | |
| 按轮生成的快照：第 2 轮的 Brief 不包含之后产生的证据 | |
| 未关联候选人时只显示岗位要求 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 未排期时打开 Brief，提示「Schedule a round before opening the live brief.」；未关联候选人时提示先关联 |
| FR-2 | 背景摘要分三栏：已知且有证据支持、未知需验证、需要核实的说法 / 弱证据；每条可打开原证据 |
| FR-3 | 简历中模糊的说法单独列出，例如「led migration to microservices」没有范围和个人贡献，提示面试中先问清楚再作为证据 |
| FR-4 | 按轮显示推荐重点：本轮能力、推荐问题、STAR 追问顺序；可跳到计划 `View plan →` |
| FR-5 | 分工说明：HR 核实教育、证书、时间线、空档、动机、到岗时间、地点、薪资期望；业务面试官用能力验证卡和 STAR 追问验证 JD 职责 |
| FR-6 | 快照说明创建时间和范围，例如「Snapshot created before Round 2 on Aug 26, 2026; later evidence is excluded」 |
| FR-7 | 已完成轮次的证据只有在该轮提交后才出现在后续 Brief 中 |
| FR-8 | 无证据缺口时显示「No open evidence gaps in the current snapshot.」 |
| FR-9 | 筛选 / 测评资料缺失时标明「未提供」，不写成通过或低能力 |
| FR-10 | 底部提供 `Start live interview`，前提是该轮已排期且计划已批准 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | Claim ≠ 已验证事实；候选人口述、现场展示、测评产物、外部核验分别标记 |
| BR-2 | 缺数据不能写成低能力 |
| BR-3 | 提交独立反馈前，默认隐藏其他面试官的评分和最终推荐；可以看到获授权的前序事实和已覆盖主题 |
| BR-4 | 职业空档、短任期只是需要澄清的背景，不自动成为负面证据 |
| BR-5 | Brief 只引用当前用户有权访问的证据 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | RubricVersion、CapabilityCard、InterviewRound | |
| 输入 | 候选人资料、筛选 / 测评证据、前序轮次已提交证据 | |
| 输出 | Brief 快照 | 轮次、生成时间、引用的证据版本、Known / Unknown / Claim 列表、推荐问题 |
| 输出 | AI 运行记录 | 输入版本、模型 / 模板版本 |

## 6. 权限

- Interviewer：只看自己负责轮次的 Brief；看不到其他面试官尚未公开的评分和推荐。
- HR / Recruiter、Hiring Manager：查看全部轮次的 Brief。
- 候选人不能访问 Brief。

## 7. 非功能要求

- Brief 生成失败时显示失败和重试，仍可查看岗位要求部分。
- 打开来源时在抽屉中显示，不离开 Brief。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 没有筛选和测评资料时，Brief 正常生成，对应项标为未提供而不是通过 | §12 缺可选资料 |
| AC-2 | 每条 Known 结论都能打开来源 | INT-02 |
| AC-3 | 第 2 轮 Brief 快照不包含第 2 轮开始后产生的证据 | 原型快照 |
| AC-4 | 第 1 轮面试官尚未提交时，第 2 轮面试官的 Brief 看不到第 1 轮分数 | §4 原则 6 |
| AC-5 | 未关联候选人时 Brief 只显示岗位要求，并说明没有候选人信息 | 原型 |
| AC-6 | 简历中的经历显示为待核实的 Claim | §4 原则 3 |

## 9. 依赖与实现

- 后端：`brief/brief.service.ts`、`brief/contracts.ts`。
- 前端：`pages/project/BriefPage.tsx`。
- 依赖：I02、I03、I04。下游 I07。

## 10. 待确认

1. Brief 是按轮生成快照（原型），还是始终显示最新状态。
2. HR 面与业务面是否是两份 Brief，还是同一份按角色显示不同部分。
3. 面试官提交后能看到其他人评分的时机（PRD「反馈披露策略」待评审）。
