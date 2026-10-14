# F08 产品文档：AI 岗位筛选评估

| 项 | 内容 |
|---|---|
| 模块 | F08 / 主流程第 8 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Recruiter / HR、Hiring Manager |
| 原型路由 | `#/applications/:id`（[原型 v2](../../../design/Resume_Screening/HireOS-Resume-Screening-Prototype-v2.html)） |
| 实现现状 | 🟡 后端 `screening`：AI 评估 + 本地规则兜底，覆盖率 < 0.7 时总分为空；支持改分（`PATCH evaluations/:id`）、处理 concern 和待核实项。#19 反馈「运行初筛不调用 AI、分数随机」；本地规则中仍出现 work-authorization 文案。前端 `ScreeningDetailPage`。未逐项验证 AC |
| 依据 | [PRD v1.3 §5.1～5.5、§8.2](../../../../hireos-screening/docs/Resume_Screening_PRD_v1.3.md)、[用户旅程 v0.2 J6、§8](../../user-journeys/Resume_Screening_User_Journeys_v0.2.md) |

## 1. 背景与目标

HR / HM 需要快速知道一个候选人是否满足岗位底线、哪里强、哪里需要核实，而且每个结论都要有出处。一个孤立的分数没有帮助，编造的分数更危险。

**目标**：对已关联的 Application 给出「资格 → 多维匹配 → 优势 / 顾虑 / 待核实 → 建议」的完整评估；每项结论都能追到原文；证据不足时不编造分数；AI 只给建议。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 资格判断（eligibility） | 关联前匹配（F06） |
| 多维评分、总分、覆盖率 | 排序和批量操作（F09） |
| Strengths / Concerns / Items to verify | 人工决定（F11） |
| AI 建议五档 | 偏好学习（功能拆分 F16） |
| 证据定位、AI 运行记录 | |
| AI 不可用时的人工评估、人工改分 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 评估页按「结论 → 解释 → 证据」三层展示：第一层是 Eligibility、总分 / 覆盖率、AI 建议、人工状态、前三项优势和顾虑、下一步；第二层是多维分数、评分标准、缺失信息、待核实项；第三层是原文定位、履历时间线、材料版本、支持 / 反证 |
| FR-2 | Eligibility 四态：eligible、likely_eligible、needs_verification、not_eligible；每条硬性要求显示满足 / 不满足 / 未知及理由 |
| FR-3 | 每个维度显示分数（0～100）、评估状态、理由、支持 / 反证、置信度；unknown / not_evaluated / not_applicable 的分数为空 |
| FR-4 | 总分与覆盖率同时显示；覆盖率 < 0.70 时总分为空，标「证据不足」 |
| FR-5 | Strength 是有来源的正向结论；Concern 带类型、严重程度、置信度、关联要求、证据、验证状态；Item to verify 可分派、可关闭 |
| FR-6 | AI 建议五档：strong_advance、advance、review、hold、do_not_advance，每档带理由、关键因素、缺口和建议的下一步 |
| FR-7 | 点击分数或 concern 跳到原文页码 / 段落；原文不可用时显示 unavailable，不能显示「已验证」 |
| FR-8 | 解决 concern 需要填写说明和结果证据；原 concern 保留 |
| FR-9 | 人工改分生成 HumanAssessment，与 AI 分数并列显示，不覆盖 |
| FR-10 | AI 不可用时，状态显示为 unavailable，允许人工基于证据评估 |
| FR-11 | 岗位标准或资料更新后，评估显示「过期，可刷新」，用户手动重评 |
| FR-12 | 不符合资格的候选人，AI 建议为「不予推进」，但页面任何地方都不显示「已拒绝」 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 只评估人工确认的 Application；使用已确认的岗位标准；锁定输入清单 |
| BR-2 | 未知不等于不满足；未提供工作年限、所在地等信息时为 needs_verification，不自动淘汰 |
| BR-3 | AI 不能自行把 Preferred 升级为硬性；筛选中不使用工作授权字段（产品决定） |
| BR-4 | 总分按权重对已评价的适用维度归一化计算；覆盖率 = 已评价权重 / 全部适用权重；0.70 门槛保存在策略版本中，试点后校准 |
| BR-5 | 总分不是录用概率，不显示百分号，不使用假精度 |
| BR-6 | 推荐五档阈值按 Patch 1 P4：≥ 85 强烈推进、70～84 推进、50～69 待复核、30～49 暂缓、< 30 不予推进；前置门槛：不符合资格 → 不予推进，覆盖不足 → 待复核，存在未解决的高严重度 concern → 最高到待复核（待确认以哪个版本为准） |
| BR-7 | 缺关键证据时默认 review，即使已有维度分数较高 |
| BR-8 | 公司规模、大厂背景不是能力或适应性的直接证据；不能据此扣分或作为拒绝理由 |
| BR-9 | 简历中的自述是 candidate_claim，不等于已验证；面试时重复简历自述不增加独立来源数 |
| BR-10 | Concern 的严重程度和置信度分开 |
| BR-11 | 每次 AI 运行记录模型供应方 / 版本、prompt 模板、参数、解析器、策略、rubric、偏好版本、输入摘要、起止时间和错误 |
| BR-12 | AI 失败不伪造模型结果 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Application、JobCriteriaVersion、CandidateProfile | 版本引用、输入清单 |
| 输出 | ScreeningSession / ScreeningEvaluation | 状态、总分、覆盖率、eligibility、建议、模型版本、输入清单、过期标记 |
| 输出 | DimensionScore | 维度、分数、状态、理由、置信度 |
| 输出 | EvidenceItem | 来源材料版本、定位、原文、支持 / 反证 |
| 输出 | ScreeningConcern | 类型、严重程度、置信度、关联要求、验证状态、处理记录 |
| 输出 | VerificationItem | 问题、来源、负责人、状态 |
| 输出 | HumanAssessment | 人工分数、理由、评估人、时间 |

## 6. 权限

- 薪资、联系方式、个人搬迁情况等敏感证据带「受限」标记，无权限的角色只看到结论。
- 改分、处理 concern 需要该岗位的筛选权限。

## 7. 非功能要求

- 同一输入重复评估 3 次，每次都满足判定条件（理由引用真实证据、无编造）。
- 评估耗时阈值待确认。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 未提供关键条件时为 needs_verification，不自动拒绝 | SCR-02 |
| AC-2 | 每个维度、strength、实质性 concern 都能定位到输入来源；不支持的推断转为待核实 | SCR-03、J6-4 |
| AC-3 | AI 不可用时可以人工评估，没有伪造的模型结果 | SCR-10 |
| AC-4 | 公司背景不直接变成「创业适应性」扣分或拒绝理由 | SCR-13 |
| AC-5 | 覆盖率不足 70% 时总分为空并标证据不足；缺失的薪资、语言不写成 0 | SCR-20、J6-3 |
| AC-6 | 不符合资格的候选人 AI 建议为不予推进，但不显示「已拒绝」 | J6-6 |
| AC-7 | 改分不覆盖 AI 分数 | PRD §6.1 |
| AC-8 | 评估中不出现工作授权要求 | J6-2 |
| AC-9 | 运行评估真实调用模型，同一输入的结果可复现地满足判定条件 | #19 |

## 9. 依赖与实现

- 后端：`src/screening`（`screening.service.ts`、`ai-screening-evaluator.service.ts`）。
- 前端：`ScreeningDetailPage`。
- 依赖：F05、F07；模型调用依赖模型配置（功能拆分 F18）。下游 F09、F10、F11。
- 相关 Issue：#19。

## 10. 待确认

1. 推荐五档阈值和前置门槛以 Patch 1 为准还是以当前实现为准（原型没有「暂缓」档）。
2. 14 个维度中默认启用哪些，与 F05 的维度配置如何对应。
3. 待核实项的分派对象和关闭条件。
