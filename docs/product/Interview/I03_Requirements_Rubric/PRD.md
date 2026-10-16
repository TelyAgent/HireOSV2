# I03 产品文档：要求与评分标准

| 项 | 内容 |
|---|---|
| 模块 | I03 / 主闭环第 3 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter、Hiring Manager |
| 原型页面 | 项目页 `Requirements & Rubric` 标签（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 后端 `rubric` 模块：`POST jobs/:id/capability-cards` 由 AI 从 JD 生成能力卡；`GET / PATCH jobs/:id/rubric` 读取和编辑草稿；`POST jobs/:id/rubric/confirm` 确认；`POST jobs/:id/rubric/new-version` 新版本；已有评分时锁定。标准按 **Job** 保存，同岗位的多个候选人项目共用。前端 `RubricPage` 已接接口。未逐项验证 AC |
| 依据 | [PRD v1.5 §4 原则 1–2、§7、§6 INT-03](../HireOS_Command_Interview_PRD_v1.5.md) |

## 1. 背景与目标

不同面试官按各自理解评分，结论无法比较。评分前需要一份与岗位绑定、每个等级都有具体行为描述的标准。

**目标**：从 JD 起草能力要求和 1–5 行为锚点，由人编辑和确认后形成版本；确认前不能评分，已有评分的版本不能被悄悄修改。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 从 JD 抽取能力（Extract requirements from JD） | 修改 JD Management 中的权威 JD |
| 每项能力：名称、JD 原文、Must-have、要求等级（L1–L5）、权重 | 面试轮次分配（I04） |
| 权重合计 100% 校验 | 实际评分（I08） |
| 每项能力 1–5 级行为锚点，可展开 / 收起 | |
| 能力验证卡：JD 职责 → 所需证据 → 简历中对应经历（Claim）→ STAR 追问 | |
| 编辑、确认、查看版本、新建版本 | |
| 导出 Rubric（记录到 I13 Activity） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 未抽取时显示「Requirements have not been extracted from the JD yet」和 `Extract requirements from JD` 按钮 |
| FR-2 | 抽取后显示能力列表（原型 6 项）和草稿说明「AI extracted this draft from the JD. No score can be recorded until a human confirms it.」 |
| FR-3 | 每项能力显示名称、Must-have 标记、Required L、Weight、对应 JD 原文 |
| FR-4 | 显示权重合计；不等于 100% 时不能确认，并指出差多少 |
| FR-5 | `View 1–5 behavioral anchors` 展开每级的行为描述；每级描述针对该能力，不是通用标签 |
| FR-6 | 能力验证卡：每项能力显示需要的证据、简历中匹配的经历（无匹配时显示「No matching experience found」）、建议的 STAR 追问；说明「The JD baseline is reused across candidates; resume experience remains a claim to verify.」 |
| FR-7 | 编辑：可改名称、JD 描述、Must-have、要求等级、权重、锚点、增删能力 |
| FR-8 | 确认后生成 Rubric v1，并记录确认人和时间；项目状态从 `Requirements ready` 前进到 `Planning` |
| FR-9 | 已确认的版本有评分后锁定；需要调整时 `New version` 复制出草稿 v2，已有评分仍绑定 v1 |
| FR-10 | 未确认标准时，进入计划、排期、开始面试都提示「Confirm the rubric before …」 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | AI 对岗位要求的补充只是建议；独立模式经项目内人工确认后形成新版本，集成模式需经 JD 模块确认 |
| BR-2 | 采用 1–5 量尺：1 明显低于要求、2 低于要求、3 达到要求、4 超过要求、5 显著超过要求 |
| BR-3 | Must-have 不满足或未验证必须单独突出，不能被其他高分抵消（I09、I10 使用） |
| BR-4 | 只采用岗位相关标准，不从声音、面容或行为推断敏感属性或人格 |
| BR-5 | 简历经历只是 Claim，不是已验证事实 |
| BR-6 | 每个分数绑定确认时的 Rubric 版本；新版本不改写旧分数 |
| BR-7 | JD 更新后，已确认的 Rubric 和基于它的产物标记为需复核，不自动改写 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Job（JD 文本、JD 版本） | |
| 输出 | RubricVersion | 版本号、状态（draft / confirmed / locked）、确认人、确认时间、来源 JD 版本 |
| 输出 | CapabilityCard | 名称、JD 原文、must、要求等级、权重、1–5 锚点、所需证据、简历 Claim、STAR 追问 |
| 输出 | AI 运行记录 | 输入 JD 版本、模型 / 模板版本、生成时间 |

## 6. 权限

- HR / Recruiter、Hiring Manager：编辑、确认、建新版本（是否两者都需要确认待定）。
- Interviewer：只读，可以展开锚点。

## 7. 非功能要求

- AI 抽取失败时显示失败和重试，不显示空的「已抽取」。
- 同一 JD 抽取两次，能力数量和名称应基本一致（判定条件待定）。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | JD 抽取后得到能力草稿；确认前任何评分接口都拒绝 | §4 原则 1 |
| AC-2 | 权重合计 95% 时不能确认，并提示差额 | 原型 Weights total 100% |
| AC-3 | 每项能力的 1–5 级锚点都有针对该能力的行为描述 | §7 |
| AC-4 | 有评分后编辑 v1 被拒绝；New version 生成 v2，旧分数仍显示绑定 v1 | §7、BR-6 |
| AC-5 | 未确认时进入 Interview Plan，提示先确认标准 | 原型门槛 |
| AC-6 | Interviewer 看不到编辑和确认按钮，接口返回 403 | §10 |
| AC-7 | AI 抽取失败时显示原因和重试，没有假成功 | §10 |

## 9. 依赖与实现

- 后端：`rubric/rubric.service.ts`、`rubric/contracts.ts`；数据模型 `RubricVersion`、`CapabilityCard`、`InterviewQuestion`。
- 前端：`pages/project/RubricPage.tsx`、`data/comps.ts`。
- 依赖：I01（JD）、I15（角色）。下游 I04、I06、I08。

## 10. 待确认

1. 标准按 Job 共享（现有实现、原型「JD baseline is reused across candidates」）还是按项目各自版本（PRD §3.4「独立模式可保存项目版本」）？
2. 确认人是 HR、HM 任一方即可，还是需要 HM 确认（原型显示「Rubric confirmed by David Kim」，即 HM）。
3. 集成模式下 AI 补充的要求如何回写 JD Management 确认。
4. 能力验证卡和 Rubric 是同一页的两种视图，还是两份独立对象。
