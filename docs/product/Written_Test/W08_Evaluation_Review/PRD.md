# W08 产品文档：评分与人工复核

| 项 | 内容 |
|---|---|
| 模块 | W08 / 主闭环第 6 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Hiring Manager / Reviewer、HR / Recruiter |
| 原型路由 | `#/attempts/:id/review`；计划页 **Comprehensive evaluation** tab（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🟡 候选人提交后后端 `ai-evaluator` 自动生成一次 AI 初评（`Submission.evaluation`，JSON）；`POST cases/:caseId/result/finalize` 保存人工最终评分（`finalEvaluation`，含 `overridden`、`overrideReason`）。前端 `EvaluationReviewPage` 已接真实接口。Unknown 规则、Coverage / Confidence、证据定位、Re-run AI、AI 失败转人工未确认。未逐项验证 AC |
| 依据 | [PRD v1.4 §8](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §5](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §5.5、§7、P09](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md)、[Agent 对话流程 §5、§9](../../../../hireos-written/docs/Written_Test_Agent_Conversation_Flow.md) |

## 1. 背景与目标

评分如果把未作答或未评估的项当 0 分，或者像 Screening 那样把缺项后的分数重新归一化，就会给出看似精确却没有依据的总分。AI 分数如果直接成为最终结果、人工改分不留痕，结论也无法复核。

**目标**：每个 criterion 有满分、理由、证据和 Confidence；AI、人工、规则评价独立留存；必评项 Unknown 时总分为空；最终结果由人确认，覆盖记录原值、新值和理由。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 结论 → 维度 / Rubric → Evidence 三层评审页 | 候选人可见的结果（W09） |
| AI 初评、Re-run AI、AI 失败重试或转人工 | 模型选择与预算（W16） |
| 人工评分、Override（必填理由）、Accept all AI scores | 招聘录用 / 拒绝决定 |
| Score、Coverage、Confidence 分开显示 | |
| 严重问题单独显示 | |
| Finalize evaluation | |
| 公共 Profile 更新后的待复核 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 首层显示 Overall（human）、Overall（AI，标 Draft only, not a hiring probability）、Coverage / Confidence |
| FR-2 | 第二层逐 criterion 显示满分、AI 分、人工分、Confidence、Coverage、理由 |
| FR-3 | 点击分数 → criterion → 理由 → 原文片段（页码 / 工作表单元格）；**View evidence** 打开证据抽屉 |
| FR-4 | 修改 AI 分数时 Override reason 必填，原 AI 值保留在历史中可查 |
| FR-5 | **Accept all AI scores** 一次采纳全部 AI 分，记录为人工确认 |
| FR-6 | **Re-run AI** 生成新的 AI 评价版本，不覆盖旧版本 |
| FR-7 | AI 失败或超时时显示原因，可有界重试，或直接人工评分 |
| FR-8 | 提交不完整时显示「This submission is incomplete — resolve the missing deliverable before scoring.」；证据未处理完时显示「Evidence has not finished processing.」 |
| FR-9 | 任何必评 criterion 为 Unknown 时，Overall 显示为空并说明原因，不显示 0 |
| FR-10 | 严重问题（如关键错误、诚信信号）单独显示，不被平均分掩盖 |
| FR-11 | **Finalize evaluation** 二次确认；确认后评分只读，生成 final 结果 |
| FR-12 | 显示「Assessed using profile vN」；公共 Profile 更新后提示待复核，重新评估是显式动作 |
| FR-13 | Excel 证据显示公式和「Calculation not verified」 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 一道题的多能力按 criterion fraction 分配，和 = 1；标签不额外计分 |
| BR-2 | Overall = 按题目权重的 criterion 贡献之和；任一必评项 Unknown 则 Overall = null；不采用 Screening 的缺项重新归一化 |
| BR-3 | Score、Coverage、Confidence 分开；分数不是录用概率 |
| BR-4 | AI、人工、规则评价各自留存，互不覆盖 |
| BR-5 | 最终内部结果须经授权人确认；覆盖记录原值、新值、理由、时间和版本 |
| BR-6 | 不自动拒绝候选人 |
| BR-7 | AI-assisted detection 只是非结论性信号，不能作为作弊证明或自动扣分依据 |
| BR-8 | 解析 / 保存失败不是零分 |
| BR-9 | AI 与人工分差过大时停止自动处理，提示人工复核（Agent 规则 §12） |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Response / Evidence（W07） | |
| 输入 | ScoringProfile（W01） | criterion、满分、能力分配、anchors |
| 输出 | Evaluation | 来源（ai / human / rule）、版本、AI run ref、状态 |
| 输出 | CriterionScore | 分数（可 null）、理由、证据引用、Confidence、Coverage |
| 输出 | Override | 原值、新值、理由、操作人、时间 |
| 输出 | Result | overall（可 null）、状态（draft / final）、finalized_by、profile 版本 |

## 6. 权限

- 有该 Case 权限的员工可评分；Finalize 的权限范围见「待确认」第 1 条。
- 受限 scope 的员工看不到无权限的证据。

## 7. 非功能要求

- 两人同时评分同一 Attempt 时有冲突提示。
- Finalize 双击只生成一个 final 结果。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 示例 Alex：Accounting 30/40、Analysis 20/40、Communication 20/20，Overall = 70 | Brief §7 |
| AC-2 | 必评 criterion 为 Unknown 时 Overall 为空，不显示 0，也不重新归一化 | C、Brief P09 |
| AC-3 | 模拟 AI 超时：显示失败，可人工完成评分 | Brief P09 |
| AC-4 | Override 不填理由无法保存；保存后历史中可见原 AI 值 | C、Brief P09 |
| AC-5 | 每个分数可下钻到证据位置（页码或单元格） | Brief P09 |
| AC-6 | Taylor 的 AI draft = 80 明确标为 Draft，未 Finalize 前不出现在 Results to release | Brief §7 |
| AC-7 | 缺件的提交不能 Finalize | Brief §5.5 |

## 9. 依赖与实现

- 后端：`src/ai/ai-evaluator.service.ts`、`src/invitations/case-result.controller.ts`（finalize）。
- 前端：`EvaluationReviewPage`、`PlanPage`（Comprehensive evaluation tab）。
- 依赖：W07、W16。下游 W09、W12。

## 10. 待确认

1. PRD 写「最终内部结果经授权人确认」，原型写明没有双签。Finalize 是否需要与评分人不同的人确认？
2. 现有 AI 初评和人工评分存在 `Submission` 的 JSON 字段里，Re-run AI 和评价版本历史需要拆出独立表（涉及 Prisma 迁移）。
3. 「AI 与人工分差过大」的阈值。
