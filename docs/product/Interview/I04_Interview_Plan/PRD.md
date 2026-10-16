# I04 产品文档：面试计划

| 项 | 内容 |
|---|---|
| 模块 | I04 / 主闭环第 4 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter；Hiring Manager 参与审阅 |
| 原型页面 | 项目页 `Interview Plan` 标签；右侧「Interview plan / Round settings」抽屉（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 后端 `GET / POST tasks/:id/rounds`、`PATCH rounds/:id`（名称、形式、时长、能力、题目数、必问题数、备注、面试官，带乐观锁 version）、`PATCH tasks/:id/plan/confirm`（确认计划；未确认 Rubric 时拒绝；已有轮次排期后不能撤销）、`GET interviewers`。前端 `PlanPage` 已接接口。两种规划方式的切换、能力覆盖检查、未来轮次的计划新版本未实现。未逐项验证 AC |
| 依据 | [PRD v1.5 §5 阶段 3、§6 INT-03](../HireOS_Command_Interview_PRD_v1.5.md) |

## 1. 背景与目标

确认的标准需要落到具体轮次上：哪一轮考哪些能力、谁来面、问几道题、哪些必问。计划不清楚会导致重复提问或漏考。

**目标**：基于已确认的 Rubric 生成并编辑轮次计划，检查能力覆盖，由人批准后才能排期；已完成的轮次不能被改写。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 两种规划方式：Plan all rounds / Plan one round at a time | 排期和会议（I05） |
| AI 起草轮次和问题；人可编辑 | 评分标准本身（I03） |
| 轮次设置：名称、形式、时长、负责人、目标能力、题目数、必问题数、备注 | |
| 新增轮次、编辑轮次、能力覆盖检查 | |
| 批准计划（Approve）；编辑后需要重新批准 | |
| 已完成轮次锁定；修改未来轮次生成计划新版本 | |
| 从 Debrief 追加的补证轮（I09 发起） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 页面顶部提供两种方式：Plan all rounds（现在设定每轮目标、能力、面试官和顺序，再逐轮排期）、Plan one round at a time（先规划并执行下一轮，根据结果决定再下一轮） |
| FR-2 | 每轮卡片显示：名称、形式、时长、负责人、目标能力、题目数 / 必问题数、目标说明；可从卡片 `view in Brief` |
| FR-3 | 点击任一轮打开右侧抽屉查看或编辑；必填名称和负责人，缺失时提示「Enter a round name and owner.」 |
| FR-4 | 能力用逗号分隔录入，保存后变为标签 |
| FR-5 | 显示能力覆盖：每项 Rubric 能力被哪一轮覆盖；未被任何轮覆盖的 Must-have 能力高亮提示 |
| FR-6 | 新建或编辑轮次后，计划回到待批准，提示「The interview plan now requires approval.」 |
| FR-7 | 批准计划后提示「Plan approved. Schedule each planned round…」，排期解锁；重复批准提示已批准 |
| FR-8 | 未确认 Rubric 时编辑或批准计划，提示先确认标准 |
| FR-9 | 已完成的轮次只读，说明「Completed interview scope is locked」；修改未来轮次生成新的计划版本，已完成轮次仍挂在原批准版本上 |
| FR-10 | 全部轮次完成后，计划变为只读记录 |
| FR-11 | Debrief 发起补证后，计划中出现补证轮，带明确的证据目标、负责人和截止日期，并提示先排期完成再回到决定 |
| FR-12 | Interviewer 打开抽屉时只读，说明「Business interviewer view: round details are view-only」 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 必须先确认 Rubric 才能规划 |
| BR-2 | 计划批准后才能排期和开始面试 |
| BR-3 | 已完成轮次的范围不可修改；未执行的轮次可以调整，但形成新的计划版本 |
| BR-4 | 补面 / 补证轮继承当前 Rubric 版本，只考它被分配的能力 |
| BR-5 | AI 起草的问题只是建议；必问题由人确定 |
| BR-6 | 并发编辑同一轮时以 version 检测冲突，后提交的一方看到冲突提示，不覆盖 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | RubricVersion（已确认） | 能力、Must-have、权重 |
| 输出 | InterviewPlan（现存于 InterviewTask） | 规划方式、批准人、批准时间、计划版本 |
| 输出 | InterviewRound | 名称、形式、时长、能力、题目数、必问题数、备注、面试官、状态（Planned / completed）、version |
| 输出 | InterviewQuestion | 题目、目标能力、是否必问 |

## 6. 权限

- HR / Recruiter：建轮次、编辑、批准计划。
- Hiring Manager：审阅和编辑（是否可批准待确认）。
- Interviewer：只读自己负责的轮次。

## 7. 非功能要求

- 批准按钮防重复提交。
- 1366 × 768 下抽屉不遮挡关闭和保存按钮。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 未确认 Rubric 时无法编辑或批准计划 | 原型门槛 |
| AC-2 | 新增一轮后计划回到待批准，排期被锁定，直到再次批准 | 原型 |
| AC-3 | 有 Must-have 能力没有分配到任何轮次时，页面给出提示 | INT-03 |
| AC-4 | 第 1 轮完成后，第 1 轮不能编辑；修改第 2 轮生成新计划版本，第 1 轮仍挂在旧版本 | §5 阶段 3 |
| AC-5 | 两个会话同时编辑同一轮，后保存的一方收到冲突提示 | BR-6 |
| AC-6 | Interviewer 打开轮次抽屉为只读，调用编辑接口返回 403 | 原型 assignee |
| AC-7 | 选择「逐轮规划」时只需规划下一轮即可批准并排期 | §5 阶段 3 |

## 9. 依赖与实现

- 后端：`intake/rounds.service.ts`、`intake/tasks.service.ts`（`confirmPlan`）、`interviewers/interviewers.service.ts`。
- 前端：`pages/project/PlanPage.tsx`。
- 依赖：I03。下游 I05、I06、I07。

## 10. 待确认

1. 计划批准人：HR 单人即可，还是需要 HM 一起确认。
2. 现有实现计划没有版本号，「未来轮次计划新版本」是否需要单独的 PlanVersion 对象。
3. AI 起草轮次和题目的触发时机：确认 Rubric 后自动生成，还是手动点击。
4. 每轮是否支持多名面试官（Panel）；现有模型每轮只有一个 `interviewerId`。
