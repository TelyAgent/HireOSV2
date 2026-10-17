# I08 产品文档：面后评审与 Scorecard

| 项 | 内容 |
|---|---|
| 模块 | I08 / 主闭环第 8 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Interviewer；HR / Recruiter、Hiring Manager 查看 |
| 原型页面 | 项目页 `Review` 标签；证据追溯抽屉（Evidence trace）；原始回答展开（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 后端：`POST rounds/:id/ai-scores` 由 AI 基于本轮转写逐项起草分数（要求引用真实转写片段原文，证据不足时为 null）；`GET rounds/:id/scores`、`PATCH rounds/:id/scores/:cardId`（人工分，null 表示明确标为 Unknown，带备注）；`GET / POST rounds/:id/summary`；`PATCH rounds/:id/recommendation`（strong_advance / advance / hold / do_not_advance / request_info）。前端 `ReviewPage` 已接接口。提交后修订的版本与理由、证据人工修正未实现。未逐项验证 AC |
| 依据 | [PRD v1.5 §4 原则 2–5、§7、§6 INT-07、INT-08](../HireOS_Command_Interview_PRD_v1.5.md) |

## 1. 背景与目标

凭印象评分无法解释、无法比较。AI 能帮忙起草，但如果 AI 分数直接覆盖人工判断，或分数找不到对应的回答，结论就不可信。

**目标**：每个分数都关联可访问的证据和理由；AI 草稿和人工评分分开保存；没有证据的维度保持 Unknown；面试官提交后修订留版本和理由。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| AI 起草的本轮摘要 | 跨轮汇总（I09） |
| 逐项能力：AI 草稿分、人工分、理由、证据 | 最终决定（I10） |
| 证据：引用位置、时间码、来源类型（transcript / manual notes / résumé）、原始回答 | |
| AI 与人工差异标记（AI / human differ） | |
| Unknown 标记 | |
| 面试官对本轮的整体推荐（与逐项分数分开） | |
| 提交 Scorecard；提交后修订 | |
| 证据追溯链：Rubric → AI 草稿 → 人工分 → 理由 → 原始证据 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 未完成任何轮次时进入 Review，提示「Complete at least one interview round before reviewing evidence.」 |
| FR-2 | 顶部显示 AI 摘要和 AI 建议，说明草稿来自本轮录制和转写，「the AI draft never overwrites a human score」，并显示 `agent_run` 标识 |
| FR-3 | 每项能力显示：AI 草稿分（标「AI draft」）、人工分（1–5 或 Unknown）、人工理由、证据列表 |
| FR-4 | 证据条目显示引用位置（如 Round 1 answer to Q2）、时间码、来源类型、摘要；可展开原始回答，可打开转写上下文，可复制证据引用 |
| FR-5 | 人工分与 AI 草稿不同时显示「AI / human differ」，并要求填写理由（原型示例：「Raising from AI draft's 2 to 4: …」） |
| FR-6 | 标为 Unknown 时说明「Unknown is not a zero」，分数为空，理由说明缺什么证据 |
| FR-7 | 证据强度（Strong / Medium / Weak / Unverified）与置信度（High / Medium / Low / Unknown）分别显示 |
| FR-8 | `Interviewer recommendation` 是本轮整体判断，与逐项分数分开，填写理由 |
| FR-9 | 证据追溯抽屉显示完整链：要求与 Rubric → AI 草稿 → 人工分 → 人工理由 → 原始证据，并标明证据来源（如「Source: interviewer manual notes · Round 2」） |
| FR-10 | 提交 Scorecard 后，首页「Scorecards to submit」计数减少；提交后修改生成新版本并要求填写修改原因，旧版本保留 |
| FR-11 | 人工可以修正 AI 抽取的证据与能力的映射，修正保留原始映射 |
| FR-12 | `Continue to debrief` 在全部计划轮次完成后可用 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 证据先于分数：每个已评分维度必须关联至少一条可访问的证据和理由 |
| BR-2 | Unknown / Not Evaluated 是空分数，不用 0 或 1 代替 |
| BR-3 | AI 与人工意见独立留存；不能用覆盖 AI 原始版本的方式伪装一致 |
| BR-4 | AI 引用的原文必须能在转写中逐字找到；找不到来源的陈述不能作为已验证事实 |
| BR-5 | 覆盖率 ≠ 能力分数：已问比例、有效证据覆盖、能力达标和置信度分别展示 |
| BR-6 | 置信度不作为录用概率 |
| BR-7 | 提交前看不到其他面试官的评分和推荐 |
| BR-8 | 候选人缺席或网络失败不产生低分 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | TranscriptLine、RecordNote、Question / Answer、RubricVersion | |
| 输出 | CardScore（AI） | 能力、分数或 null、理由、引用片段、原文、agent_run |
| 输出 | CardScore（人工） | 能力、分数或 Unknown、理由、证据引用、评估人、版本、修改原因 |
| 输出 | EvidenceItem / EvidenceLink | 来源类型、位置、时间码、原文、映射的能力、支持 / 反驳、强度 |
| 输出 | Round summary、Round recommendation | |

## 6. 权限

- Interviewer：只评自己负责的轮次；提交前看不到他人评分。
- HR / Recruiter、Hiring Manager：查看全部轮次的评分和证据。
- 证据链接访问按 Workspace、角色和用途校验。

## 7. 非功能要求

- AI 起草失败时显示失败和重试，人工评分不受影响。
- 同一转写多次起草，引用都必须是真实原文。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 人工分与 AI 分不同时两者都可见，AI 原始分未被改写；不填理由不能保存 | §12 AI 与人工差异 |
| AC-2 | 标为 Unknown 的维度分数为空，不显示 0，不参与加权总分 | §4 原则 2 |
| AC-3 | 每个已评分维度至少有一条证据，点开能看到原始回答和时间码 | INT-07 |
| AC-4 | AI 引用的每段原文都能在该轮转写中逐字找到 | BR-4 |
| AC-5 | 手工记录作为证据时，来源显示为 manual notes 而非时间码 | 原型 Round 2 |
| AC-6 | 提交后修改分数生成新版本，旧版本和修改原因可审计 | INT-08 |
| AC-7 | 面试官 A 未提交时，面试官 B 看不到 A 的分数 | §4 原则 6 |
| AC-8 | 提交后首页 Scorecards to submit 计数减 1 | HOME-AC13 |

## 9. 依赖与实现

- 后端：`intake/rounds.service.ts`（scores、ai-scores、summary、recommendation）、`rubric/score-contracts.ts`、`rubric/summary-contracts.ts`、`intake/ai.service.ts`。
- 前端：`pages/project/ReviewPage.tsx`、`components/Drawers.tsx`、`components/SummaryPoints.tsx`。
- 依赖：I07。下游 I09、I12（计数）。

## 10. 待确认

### #287 已确认的推荐理由契约（2026-10-17）

- 先填写必需的推荐理由（去空白后非空，最多 4000 字符），点击推荐选项时与推荐一起立即保存；允许单独保存理由修改。
- `PATCH rounds/:id/recommendation` 接收 recommendation 与 reason，读取轮次返回 recommendationReason；取消推荐同时清空理由。
- 保存失败保留当前输入，不显示虚假的保存成功；刷新后读取已保存值，历史缺失理由显示未记录。
- 本项不新增整体 Scorecard 提交/修订流程，不修改逐项评分或最终录用决定，原推荐枚举不变。

1. 面试官推荐枚举：现有实现为 strong_advance / advance / hold / do_not_advance / request_info，PRD §7 的 AI 建议为 Strong Hire … Insufficient Evidence。两者是否统一？
2. 「提交」是否是独立动作（现有实现逐项保存，没有整体提交状态）。
3. 提交后谁可以修改分数：仅本人，还是 HR / HM 也可以。
4. AI 草稿与人工分差几级时必须填理由（原型 Debrief 用 ≥ 2 级标记分歧）。
