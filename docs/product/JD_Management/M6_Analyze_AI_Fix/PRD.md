# M6 产品文档：Analyze 完整性检查与 AI 修复

| 项 | 内容 |
|---|---|
| 模块 / 优先级 | M6 / P0 |
| 版本 / 日期 | v1.2 / 2026-10-15（Level 规则更新，其他待确认项见 §10） |
| 主角色 | Recruiter / TA；Hiring Manager 确认业务内容；Viewer 只读 |
| 同目录文档 | [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 实现现状 | 后端已有 analyze、section AI、suggestions 接口；[2026-10-14 线上测试](Test_Report_2026-10-14.md)已验证部分 AI fix / Undo，发现门禁与确认状态不一致；本版为目标规则，不代表线上已实现 |
| 依据 | [完整性标准 v0.3](../HireOS_Command_JD_Completeness_Standard_v0.1.md)、[User Journeys v1.0 §B5](../HireOS_Command_JD_Management_User_Journeys_v1.0.md)、[测试脚本 v0.1 J6](../HireOS_Command_JD_Management_User_Journeys_v0.1.md)、[PRD v1.3 §5.3](../HireOS_Command_JD_Management_PRD_v1.3.md) |

## 1. 背景与目标

草稿创建后往往缺必填项或存在质量问题。用户需要清楚知道还差什么，并能自己补或让 AI 修，直到可以提交审批。

**目标**：Analyze 给出明确的检查结果；用户逐项或批量修复后，“可提交审批”的状态与检查结果始终一致。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 10 项必填（Missing）和待修改项（Weak）检查；Level 为选填 | 审批决策本身（M7） |
| 缺失项占位块、AI draft、Fill in | 执行发布（M8） |
| 单项 AI fix、可由 AI 处理项的批量修复、Undo | 审批通过后的发布门禁与渠道交付（M8） |
| 跨项一致性 X1–X8、分级 V1–V5、合规 R1–R3 检查及门禁 | |
| 整体结论与提交门禁 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 工具栏 Analyze 按钮带圆标，数字为待处理项数；全部合格时变为绿色对勾 |
| FR-2 | 缺失的必填项在文档中以红色虚线占位块出现在默认章节顺序的位置，提供 AI draft / Fill in |
| FR-3 | 点击 Analyze 显示处理中，完成后右侧自动切到 Analysis 标签，显示分析时间 |
| FR-4 | Analysis 顶部显示结论和按“合格”计算的进度；分组 To complete / To revise / Suggestions / Completed，Completed 默认展开 |
| FR-5 | 批量 AI 修复只处理可依据已有事实起草/修改的项，并明确显示处理数及仍需人工填写的项；薪资等无来源事实不得自动编造，选填 Level 也不得编造。AI 内容带 `AI draft · Keep` 标签，出现 Undo 提示，滚动位置不变 |
| FR-6 | 单项 AI fix 显示修复前后差异 |
| FR-7 | Undo 将内容精确恢复到处理前 |
| FR-8 | 已填写但命中常见缺陷的内容在文档中显示黄色提示条；职位概述不显示句数提示，也不因句数判为 Weak；缺失时仍显示必填占位 |
| FR-9 | 未 Ready 时“提交审批”不可用并说明原因；Ready 且当前 revision 已保存、AI 提案已确认时可提交审批。Publish 在 M7 审批通过且满足 M8 条件前始终不可用 |
| FR-10 | Keep 后对当前 revision 自动重新运行规则与 AI 检查；检查未完成、失败或结果过期时不显示 Ready，也不开放提交审批 |
| FR-11 | X1–X8、V1–V5、R1–R3 按[完整性标准](../HireOS_Command_JD_Completeness_Standard_v0.1.md)的阻断/待修改/建议级别进入同一分析结果和提交门禁；建议级别不阻断 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 单项状态：Pass / Weak / Missing（完整性标准 §1.2） |
| BR-2 | 整体结论：Ready（10 项必填全 Pass，X/V/R 无阻断或待修改，当前 revision 已保存、无待确认 AI 提案且分析结果有效）/ Needs work（无 Missing/阻断但有 Weak 或待修改）/ Blocked（有必填 Missing 或阻断级规则）。Level 为 Not set 不计 Missing，X1/X6/X7 仅比较已设置的级别 |
| BR-3 | 只有 Ready 才能提交审批；服务端对同一 revision 和规则结果校验。Ready 只交给 M7 审批，不直接允许发布 |
| BR-4 | 选填项缺失只给 Suggestions，不阻断 |
| BR-5 | Weak 规则示例：职责少于 3 条或以 “Responsible for” 开头；要求少于 3 条或含无法验证的词（如 strong communication）；Junior 要求 5 年以上；Remote 未写地区；职位名含营销词或内部编号。职位概述只检查是否缺失和 V/R 合规风险，不按句数提示或判 Weak |
| BR-6 | AI 生成内容不得编造数字或事实；接受前不成为正式内容 |
| BR-7 | Confidential 块不交给 AI 改写 |
| BR-8 | 文档在分析后被修改时，分析结果标记为过期 |
| BR-9 | AI fix 重复点击不重复写入 |
| BR-10 | Keep 后自动重查；Undo、手动编辑或保存导致 revision 变化时，旧分析结果失效。服务端不得依据旧结果放行提交 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | 文档块 | 每块的内容、类型、可见范围 |
| 输出 | 分析结果 | 结论、进度、每项状态（Pass / Weak / Missing）、分组、分析时间 |
| 输出 | AI 建议 | 目标块、修改前后内容、状态（proposed / accepted / rejected / reverted） |
| 输出 | 文档 revision | 接受建议后递增 |

## 6. 权限

| 角色 | 能做 |
|---|---|
| Recruiter / TA | 运行 Analyze、Fill in、AI fix、Undo |
| Hiring Manager | 同上，但只能修改授权字段；预算 / 敏感字段只读 |
| HR Approver | 查看分析结果（审批时参考） |
| Viewer | 只读 Analysis；AI fix、Fill in、提交、Publish 不可用 |

## 7. 非功能要求

- Analyze 耗时阈值待确认。
- AI 失败时保留上一次结果并标注时间，不显示为“全部通过”。

## 8. 验收标准

| ID | 验收 | 对应闭环路径 |
|---|---|---|
| AC-1 | 10 项必填的圆标数字等于缺失、待修改及阻断项数；Level 为 Not set 不计缺失；占位块位置正确；概述仅缺失时提示，不显示句数提示 | P1 |
| AC-2 | 四个分组正确；五组 Weak 示例及 X/V/R 规则按标准分级；建议级别不阻断 | P2–P7 |
| AC-3 | 批量 AI 修复只处理有来源的可修复项，明确列出剩余人工项；生成内容不编造事实，Undo 精确恢复 | P8、P9 |
| AC-4 | 单项 AI fix 后该项移到 Completed | P10 |
| AC-5 | Keep 后自动重查，Ready 才能提交审批；未保存、提案未确认、分析失败/过期或有 Missing/Weak/阻断时，UI 和服务端均拒绝提交；审批前 Publish 不可用 | P8、P11、P12 |
| AC-6 | Viewer 不能修复或提交 | P13 |
| AC-7 | X1–X8、V1–V5、R1–R3 的阻断、待修改和建议按完整性标准进入统一结论；Confidential 正文不发送给 AI | P7 |

## 9. 依赖与实现

- 后端：`POST jobs/:jobId/documents/:audience/ai/analyze`、`POST jobs/:jobId/documents/:audience/ai/section`、`GET/POST/PATCH jobs/:jobId/documents/:audience/suggestions`；完整性规则 `copilot/skills/jd-completeness/standard.md`。

## 10. 产品决定与剩余待确认

2026-10-15 较早决定按 **11 项必填**计算；同日后续决定允许 Level 为 Not set，A4 改为选填，当前口径为 **10 项必填**。职位概述不显示句数提示、不按句数判 Weak；Keep 后自动重查；X1–X8、V1–V5、R1–R3 纳入本期检查与门禁；Ready 后下一步为**提交审批**，发布须等 M7 审批通过并满足 M8 条件。

仍待确认：Weak 规则由确定性规则还是 LLM 判定，以及 Analyze 的耗时阈值。规则来源不影响上述门禁结果必须一致的要求。
