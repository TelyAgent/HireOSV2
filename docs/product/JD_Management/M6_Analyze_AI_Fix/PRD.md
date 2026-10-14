# M6 产品文档：Analyze 完整性检查与 AI 修复

| 项 | 内容 |
|---|---|
| 模块 / 优先级 | M6 / P0 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Recruiter / TA；Hiring Manager 确认业务内容；Viewer 只读 |
| 同目录文档 | [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 实现现状 | ✅ 后端已有 analyze、section AI、suggestions 接口；线上 Analyze 可用，AI fix / Undo 未验证（F-010、F-011） |
| 依据 | [完整性标准 v0.1](../HireOS_Command_JD_Completeness_Standard_v0.1.md)、[User Journeys v1.0 §B5](../HireOS_Command_JD_Management_User_Journeys_v1.0.md)、测试脚本 v0.1 J6（已于 #30 删除）、[PRD v1.3 §5.3](../HireOS_Command_JD_Management_PRD_v1.3.md) |

## 1. 背景与目标

草稿创建后往往缺必填项或存在质量问题。用户需要清楚知道还差什么，并能自己补或让 AI 修，直到可以提交审批。

**目标**：Analyze 给出明确的检查结果；用户逐项或批量修复后，“可提交审批”的状态与检查结果始终一致。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 必填项（Missing）和待修改项（Weak）检查 | 审批本身（M7） |
| 缺失项占位块、AI draft、Fill in | 发布（M8） |
| 单项 AI fix、AI fix all、Undo | 跨项一致性 X1–X8、合规 V1–V3/R1–R3（原型未实现，待确认是否纳入） |
| 整体结论与提交门禁 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 工具栏 Analyze 按钮带圆标，数字为待处理项数；全部合格时变为绿色对勾 |
| FR-2 | 缺失的必填项在文档中以红色虚线占位块出现在默认章节顺序的位置，提供 AI draft / Fill in |
| FR-3 | 点击 Analyze 显示处理中，完成后右侧自动切到 Analysis 标签，显示分析时间 |
| FR-4 | Analysis 顶部显示结论和按“合格”计算的进度；分组 To complete / To revise / Suggestions / Completed，Completed 默认展开 |
| FR-5 | AI fix all 处理全部缺失和待修改项；AI 写入的内容带 `AI draft · Keep` 标签，出现 Undo 提示，滚动位置不变 |
| FR-6 | 单项 AI fix 显示修复前后差异 |
| FR-7 | Undo 将内容精确恢复到处理前 |
| FR-8 | 已填写但命中常见缺陷的内容在文档中显示黄色提示条 |
| FR-9 | 存在阻断项时“提交审批”和 Publish 不可用，悬停说明还差 N 项 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 单项状态：Pass / Weak / Missing（完整性标准 §1.2） |
| BR-2 | 整体结论：Ready（必填全 Pass 且无合规阻断）/ Needs work（无 Missing 但有 Weak）/ Blocked（有 Missing 或合规阻断） |
| BR-3 | 只有 Ready 才能提交审批；服务端同样校验 |
| BR-4 | 选填项缺失只给 Suggestions，不阻断 |
| BR-5 | Weak 规则示例：概述不足 2 句或超过 4 句；职责少于 3 条或以 “Responsible for” 开头；要求少于 3 条或含无法验证的词（如 strong communication）；Junior 要求 5 年以上；Remote 未写地区；职位名含营销词或内部编号 |
| BR-6 | AI 生成内容不得编造数字或事实；接受前不成为正式内容 |
| BR-7 | Confidential 块不交给 AI 改写 |
| BR-8 | 文档在分析后被修改时，分析结果标记为过期 |
| BR-9 | AI fix 重复点击不重复写入 |

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
| AC-1 | 圆标数字等于待处理项数；占位块位置正确 | P1 |
| AC-2 | 四个分组正确；每条 Weak 规则都能被触发 | P2–P7 |
| AC-3 | AI fix all 后内容合规且可 Undo 精确恢复 | P8、P9 |
| AC-4 | 单项 AI fix 后该项移到 Completed | P10 |
| AC-5 | 提交门禁与 Ready 一致，服务端也拒绝 | P11、P12 |
| AC-6 | Viewer 不能修复或提交 | P13 |

## 9. 依赖与实现

- 后端：`POST jobs/:jobId/documents/:audience/ai/analyze`、`POST jobs/:jobId/documents/:audience/ai/section`、`GET/POST/PATCH jobs/:jobId/documents/:audience/suggestions`；完整性规则 `copilot/skills/jd-completeness/standard.md`。

## 10. 待确认

1. 门禁口径：完整性标准 9 项必填，还是原型 / 线上的 11 项。
2. Weak 规则是确定性规则还是 LLM 判定（决定能否精确断言）。
3. 概述句数规则：标准是 2–4 句，原型超过 5 句才提示。
4. 点击 Keep 后是自动重新检查，还是需要再点 Analyze。
5. 跨项一致性和合规检查是否纳入本期。
