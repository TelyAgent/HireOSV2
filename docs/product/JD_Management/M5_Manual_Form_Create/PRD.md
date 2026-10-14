# M5 产品文档：手动表单创建职位

| 项 | 内容 |
|---|---|
| 模块 / 优先级 | M5 / P0 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Recruiter / TA；Hiring Manager 也可使用 |
| 同目录文档 | [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 实现现状 | ✅ 前端表单校验可用；服务端校验和成功保存未在线上验证（F-008、F-009）；#34（创建失败时静默生成本地假职位）已由 #38 修复，需回归 |
| 依据 | [User Journeys v1.0 §A3.5](../HireOS_Command_JD_Management_User_Journeys_v1.0.md)、测试脚本 v0.1 J5（已于 #30 删除）、[完整性标准 v0.1 A8](../HireOS_Command_JD_Completeness_Standard_v0.1.md) |

## 1. 背景与目标

用户不想用 AI，要逐字段自己控制内容。

**目标**：填写表单后直接创建职位；非法数据在前端和服务端都被拦截。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 对话内表单，必填 / 选填字段 | AI 起草或改写 |
| 前端逐项校验 + 服务端校验 | Workspace 预览 |
| 直接创建并进入编辑页 | 完整性检查（创建后由 M6 负责） |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 点击入口后在对话中显示表单，标出必填和选填 |
| FR-2 | 必填：职位名称、地点、招聘人数、岗位职责、岗位要求（口径待确认，见 §10） |
| FR-3 | 选填：级别、雇佣类型、工作方式、部门、汇报线、薪资范围（最小、最大、周期） |
| FR-4 | 点击 Save 时逐项校验，缺失或非法的字段标红并提示，不创建 |
| FR-5 | 校验通过后直接创建并跳转编辑页，不经过 Workspace 预览 |
| FR-6 | 表单内容原样进入文档对应章节（Responsibilities、Requirements、Compensation 等） |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 招聘人数必须是 ≥1 的整数（`0`、`1.5`、`-1` 都拒绝）；上限 10000（后端校验） |
| BR-2 | 职位名称 1–200 字符 |
| BR-3 | 薪资最大值不能低于最小值；显示格式如 `USD 25–40 per hour` |
| BR-4 | 只填 `1.` 或空行的职责视为空 |
| BR-5 | 前端校验能被绕过，服务端必须再次校验，不产生脏数据 |
| BR-6 | 不调用 AI，不产生 AiRun |
| BR-7 | 创建失败时不得生成本地假职位，必须提示失败（#34） |
| BR-8 | 未填的选填项在字段行不显示；特殊字符（如 `3+`）原样保留 |
| BR-9 | 双击 Save 只创建一个职位（幂等键） |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | 表单 | title、location、headcount、responsibilities、requirements、level、employment type、workplace type、department、reports to、salary{min,max,currency,period} |
| 输出 | Core Job | title、location、openings、seniority、employmentType、team、status=draft、createdBy |
| 输出 | internal 文档 | 按章节写入的块 |

## 6. 权限

同 M1。Viewer 打开创建入口的预期待确认。

## 7. 非功能要求

- 保存响应时间阈值待确认。

## 8. 验收标准

| ID | 验收 | 对应闭环路径 |
|---|---|---|
| AC-1 | 合法数据直接创建，内容与表单一致，无 AiRun | P1 |
| AC-2 | 每种非法数据在前端被拦截，不发出创建请求 | P2–P8 |
| AC-3 | 绕过前端提交非法数据，服务端拒绝 | P9–P15 |
| AC-4 | 双击 Save 只创建一个职位 | P16 |
| AC-5 | 断网时提示失败，输入不丢，不生成假职位 | P17 |

## 9. 依赖与实现

- 后端：`POST copilot/conversations/:id/fields`（表单字段）、`PATCH jobs/:id`（zod 校验：title 1–200、openings 1–10000 整数）。手动创建实际调用的接口以实现为准。

## 10. 待确认

1. 必填项口径：v0.1 写 5 项；线上表单（测试报告 E8）还包含 Role summary 和 Level；完整性标准 9 项；原型 README 11 项。
2. 手动创建实际调用的接口。
3. Viewer 打开入口时，入口不可见还是可见但不可用。
