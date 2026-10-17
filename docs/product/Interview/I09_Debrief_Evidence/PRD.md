# I09 产品文档：跨轮 Debrief 与补证

## 2026-10-17 确认补充（#325）

逐卡达标比较使用该 Rubric 卡从结构化 JD 冻结的 Required L，不使用统一 L3 门槛。同样评分 L3 对 Required L3 为达标，对 Required L4 为未达标。缺失评分或要求等级为未知；Must-have 卡等级缺失时整体结论为未知，不伪造通过或失败。Overview 和 Debrief 使用同一逐卡等级字段；旧聚合 `bar` 返回 null，消费者不得据此恢复固定默认值。

| 项 | 内容 |
|---|---|
| 模块 | I09 / 主闭环第 9 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Hiring Manager、HR / Recruiter；Hiring Committee 查看 |
| 原型页面 | 项目页 `Debrief` 标签；`Request more evidence` 弹窗（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 后端 `GET tasks/:id/debrief`、`POST tasks/:id/debrief-draft`：AI 读取全部轮次转写，逐项起草跨轮分数（引用真实原文，证据不足为 null）并列出未解决问题。前端 `DebriefPage` 已接接口。补证请求（负责人、形式、截止日期）和自动生成补证轮未实现；PRD §8.1 的 Candidate Evidence Map 没有独立页面。未逐项验证 AC |
| 依据 | [PRD v1.5 §4 原则 5、§7、§6 INT-09、INT-10、§12](../HireOS_Command_Interview_PRD_v1.5.md)、[任务列表 PRD §6.2 Evidence requested](../HireOS_Command_Interview_Task_List_Status_and_Sorting_PRD_v1.0.md) |

## 1. 背景与目标

多轮面试后，Debrief 常常变成比谁声音大。需要把各轮证据、分歧、底线和缺口放在一起，让讨论围绕证据进行；证据不够时，应该去补，而不是凭印象拍板。

**目标**：按要求汇总跨轮评分、证据和反证；突出 Must-have 和分歧；未完成的评估如实显示为部分评估；证据不足时发起补证，生成补证轮。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 逐项能力的跨轮结果：各轮人工分、AI 跨轮草稿、证据和反证 | 单轮评分（I08） |
| 部分评估与加权覆盖率 | 记录最终决定（I10） |
| Must-have 状态单独突出 | |
| AI 与人工差距 ≥ 2 级的维度（`See both traces`） | |
| 重大未解决问题及责任人 | |
| Request more evidence：证据缺口、负责人、形式、截止日期 → 生成补证轮 | |
| 证据图视图：Requirement × Evidence × Round（PRD 的 Candidate Evidence Map） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 每项能力显示：要求等级、Must-have、各轮人工分、AI 跨轮草稿分、支持证据和反证、当前状态（达标 / 未达标 / Unknown） |
| FR-2 | 未全部评分时显示「Partial evaluation」和已评估权重覆盖率；说明「A final weighted score only appears once every rubric item is scored.」 |
| FR-3 | 加权摘要只在全部计分维度完成时显示最终分；缺失维度不能被静默剔除后显示完整总分 |
| FR-4 | Must-have 未满足或未验证单独突出，不能被其他高分抵消；原型示例：Security & Compliance Awareness — Must-have，要求 L3，当前 Unknown |
| FR-5 | 列出 AI 草稿与人工分相差 ≥ 2 级的维度，`See both traces` 同时打开两条追溯链 |
| FR-6 | 列出重大未解决问题，每项有责任人 |
| FR-7 | `Request more evidence` 弹窗：显示要补的缺口（如「Close the Security & Compliance gap」），选择负责人（默认 HM）、形式（默认 panel）、截止日期，`Create follow-up round` |
| FR-8 | 创建后计划中出现补证轮（I04），项目状态变为 `Evidence requested`；提示先排期并完成补证再回到决定 |
| FR-9 | 补证轮完成并提交后，Debrief 刷新，原来的 Unknown 按新证据更新，并需要做新的决定 |
| FR-10 | 证据图可按来源（简历 / 筛选 / 测评 / 各轮面试）和能力筛选 |
| FR-11 | `Continue to decision` 进入 I10 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 不强制人工接受 AI 分数；AI 跨轮草稿是独立意见 |
| BR-2 | 保留各自意见和反证；意见冲突要求人工记录处理结果，不自动完成 |
| BR-3 | 没有证据的 Must-have 保持 Unknown；阻止默认交接，或由 HR 与 HM 双方确认例外（I10） |
| BR-4 | 补证轮未完成前，不能确认最终结论，评估包保持阻塞 |
| BR-5 | 证据过期、矛盾或需进一步验证时，可以重新提问并说明原因 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | 各轮 CardScore（AI / 人工）、EvidenceItem / EvidenceLink | |
| 输出 | Debrief | AI 跨轮草稿（每项分数、理由、引用）、未解决问题、覆盖率、生成时间 |
| 输出 | RequirementEvaluation | 能力、跨轮结论、Must-have 状态、置信度 |
| 输出 | 补证请求 | 缺口能力、负责人、形式、截止日期、生成的轮次 ID、状态 |

## 6. 权限

- Hiring Manager、HR / Recruiter：查看全部、发起补证。
- Hiring Committee：查看，参与讨论（是否可发起补证待确认）。
- Interviewer：原型中不能进入 Debrief。

## 7. 非功能要求

- AI 跨轮草稿失败时显示失败和重试，各轮人工分照常显示。
- 发起补证防重复提交，只生成一个补证轮。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 有一项未评分时显示部分评估和覆盖率，不显示最终加权分 | §7 |
| AC-2 | Must-have 为 Unknown 时单独突出，其他维度高分不改变其状态 | §12 无证据的 Must-have |
| AC-3 | 两轮对同一能力评分相差较大时，两份意见和反证都保留并可见 | §12 多轮分歧 |
| AC-4 | AI 与人工相差 ≥ 2 级的维度被列出，可同时查看两条追溯链 | 原型 |
| AC-5 | 发起补证后计划出现补证轮，状态为 `Evidence requested`，决定页无法确认最终结论 | §12 Hold / Reject / 补证 |
| AC-6 | 补证完成后 Debrief 刷新，Unknown 按新证据更新 | 原型 |
| AC-7 | 双击 Create follow-up round 只生成一个补证轮 | §10 |

## 9. 依赖与实现

- 后端：`intake/tasks.service.ts`（`debrief`、`generateDebriefDraft`）、`rubric/debrief-contracts.ts`。
- 前端：`pages/project/DebriefPage.tsx`、`components/Modals.tsx`（补证弹窗待实现）。
- 依赖：I08；补证轮回到 I04 / I05。下游 I10。

## 10. 待确认

1. 补证是 Debrief 页的动作（原型），还是决定页的「Request More Evidence」决定（PRD §7、现有 decision 枚举 `request_more_evidence`），还是两者都有？
2. Candidate Evidence Map 是否需要独立页面，还是合并在 Debrief 中（原型为合并）。
3. 「重大分歧」的阈值：AI 与人工 ≥ 2 级；人工与人工之间是否也需要阈值。
4. Hiring Committee 在系统中是否是独立角色。
