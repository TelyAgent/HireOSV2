# W02 产品文档：组卷 Builder 与 AI 出题

| 项 | 内容 |
|---|---|
| 模块 | W02 / 准备阶段第 2 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Hiring Manager / Reviewer（设计标准）、HR / Recruiter |
| 原型路由 | `#/builder/:id`；Brief 建议 `#/assessments/:id/builder`（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🟡 后端 `ai` 有 `POST ai/generate-question`、`POST ai/extract-competencies`；前端 `BuilderPage` 使用 fixture 数据，未接真实接口。质量审阅、能力分配校验、技术题执行、适应性测评未实现。未逐项验证 AC |
| 依据 | [PRD v1.4 §4、§13](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §5](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §5.2、P01、P02、P22](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md) |

## 1. 背景与目标

题目和评分标准如果在邀请之后才补，或者一道题考多种能力却重复计分，结果就无法解释。AI 能加快出题，但生成的内容必须可审阅、可修改，不能直接发出去。

**目标**：按「要求 → 能力 → 所需证据 → Blueprint → 题目 → Rubric」生成和编辑试卷；能力分配可校验；质量问题逐条显示并由人处置；保存草稿与发布分开。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| Builder：Sections、Prompt & materials、Deliverables、Competency allocation、Quality review | 题库列表与详情（W01） |
| AI 生成 Blueprint、题目、Rubric | 候选人级别的题目调整（W04） |
| 能力分配（criterion fraction）与校验 | 模型选择与预算配置（W16） |
| 质量审阅：覆盖率、难度、时间、歧义、重复、评分合理性、无关偏差 | |
| 题库版本更新提示 | |
| 发布预览、Save draft、Save & publish new version | |
| 技术题：代码 / SQL / 模型文件、隔离执行结果、版本化测试证据 | |
| 适应性测评：固定分支策略、选题理由、曝光、轨迹 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 左侧 Sections / Questions，主区编辑，右侧可折叠 Coverage / Difficulty / Estimated effort；1366 宽时 Coverage 改为抽屉 |
| FR-2 | 页面说明「编辑生成新的派生版本，已发送的邀请保留发送时的版本」 |
| FR-3 | **AI generate** 按「要求 → 能力 → 所需证据 → Blueprint → 题目 → Rubric」顺序生成；显示 loading、失败（含超时）和 Retry；生成结果标为草稿，可人工编辑 |
| FR-4 | 能力分配显示 criterion → 能力 chips 及百分比；每个 criterion 的分配和必须正好 100%；不等于 100% 时指出具体是哪一行，并阻止发布 |
| FR-5 | 可增加 / 删除能力；能力标签本身不额外计分 |
| FR-6 | Quality review 列出每个问题（类型、位置、建议）及人工处置（接受 / 忽略并说明），不只给一个质量总分 |
| FR-7 | 引用的题库题目有新版本时提示「A newer version is available」，需要显式选择新版本，不静默替换 |
| FR-8 | 发布预览包含题包、交付清单、权重、候选人可见材料和未处置的质量问题 |
| FR-9 | **Save draft (not published)** 与 **Save & publish new version** 分开；保存不等于发布 |
| FR-10 | 概念题打开 Builder 时显示「Draft the assessment before inviting candidates」 |
| FR-11 | 技术题可上传代码 / SQL / 模型文件，在隔离执行适配器中运行，记录执行结果、超时和版本化测试证据 |
| FR-12 | 适应性测评配置固定分支策略；每次选题记录理由、曝光和轨迹 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 一道题的多能力按 criterion fraction 分配，和 = 1；同一能力不重复加分 |
| BR-2 | 主观题必须有 criterion 和 anchors 才能发布 |
| BR-3 | AI 生成内容在人工保存前是草稿，不能进入任何邀请 |
| BR-4 | 不能在雇主设备或收件服务上直接运行候选人代码或宏 |
| BR-5 | 适应性测评的不同路径在没有校准前不可混排 |
| BR-6 | 质量审阅中「无关偏差」检查覆盖受保护属性，涉及的题目不能发布 |
| BR-7 | AI 失败显示具体原因并保留人工编辑路径 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Core RoleDefinitionVersion / 目标描述 | 要求、能力 |
| 输入 | QuestionVersion（W01） | 题库引用 |
| 输出 | Assessment / Blueprint / Section | 目标、Section、题目绑定、权重、core_input_manifest_ref |
| 输出 | QualityReview | 问题列表、处置人、处置结果 |
| 输出 | ExecutionProfile / AdaptivePolicy | 执行环境、分支策略、版本 |
| 输出 | AI run ref | 模型、prompt、策略版本（存于公共 AI Service） |

## 6. 权限

- 能编辑题库的员工可使用 Builder；发布权限同 W01「待确认」第 1 条。
- AI 生成使用已发布的任务策略（question_generate、blueprint_generate、quality_review），普通 HR 不能改模型。

## 7. 非功能要求

- 生成中可停止；停止后半截结果不能被保存为可发布内容。
- 离开有未保存修改的 Builder 时有提示。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | criterion fraction 不等于 100% 时无法发布，并指出出错的行；修正后可发布；示例总分保持 70 | A、Brief P01 |
| AC-2 | AI 生成超时显示失败和 Retry，重试成功后内容标为草稿 | Brief §5.2 |
| AC-3 | 保存草稿后题库中仍是原发布版本；发布后生成新版本 | A |
| AC-4 | 题库引用有新版本时出现提示，不选择则仍用旧版本 | Brief §5.2 |
| AC-5 | 质量审阅显示逐条问题和处置记录 | PRD §4 |
| AC-6 | 技术题执行超时和成功都留下证据；适应性路径未校准时不可排名 | Brief P22 |

## 9. 依赖与实现

- 后端：`src/ai`（`ai-question-generator.service.ts`、`ai.controller.ts`）。
- 前端：`BuilderPage`、`AssessmentQuestionDrawer`（AI 出题）。
- 依赖：W01、W16。下游 W04。

## 10. 待确认

1. 原型 Builder 是按单题（`#/builder/:questionId`）编辑，Brief 是按测评（`#/assessments/:id/builder`）组卷。两者是否都需要？
2. 技术题隔离执行适配器和适应性测评在原型中只是模拟，是否需要在本轮实现中提供真实执行环境。
3. 质量审阅的「人工处置」是否需要另一人复核（同 W01 待确认第 1 条）。
