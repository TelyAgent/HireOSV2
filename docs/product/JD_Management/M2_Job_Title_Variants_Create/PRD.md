# M2 产品文档：从职位名称生成三个版本并创建

| 项 | 内容 |
|---|---|
| 模块 / 优先级 | M2 / P0 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Recruiter / TA；Hiring Manager 也可使用 |
| 同目录文档 | [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 实现现状 | ✅ 后端已有 title-variants、refine-variants 接口；线上被 F-001/F-002 阻塞 |
| 依据 | [User Journeys v1.0 §A3.2](../HireOS_Command_JD_Management_User_Journeys_v1.0.md)、[测试脚本 v0.1 J2](../HireOS_Command_JD_Management_User_Journeys_v0.1.md)、[PRD v1.3 §5.1](../HireOS_Command_JD_Management_PRD_v1.3.md) |

## 1. 背景与目标

用户已经知道要招什么职位，希望快速看到几种不同写法并选出最合适的一种。

**目标**：输入职位名后得到三个风格不同、事实一致的版本，选定一个直接创建职位。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 根据职位名生成 A / B / C 三个风格版本 | 三问引导（M1） |
| 卡片与 Workspace 页签联动对比 | 完整性检查（M6） |
| Refine：一次指令同时修改三个版本 | 审批与发布（M7、M8） |
| 用选中版本创建职位 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 点击入口后，入口标题作为用户消息出现；Agent 只发引导文案，不内嵌输入框或按钮；底部输入框聚焦 |
| FR-2 | 用户发送职位名后，职位名在对话中只出现一次，显示生成中状态 |
| FR-3 | 生成三个版本：A Concise & direct、B Warm & people-first、C Detailed & structured |
| FR-4 | 对话中显示 3 张选择卡片；Workspace 顶部有 A / B / C 页签，与卡片选择联动 |
| FR-5 | Refine 指令同时更新三个版本，并高亮改动；停留在当前所选版本 |
| FR-6 | 点击 `Create job with version X` 用所选版本创建职位 |
| FR-7 | 职位名为空时不生成，并提示输入 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 三个版本的事实字段（职位名、地点、HC、工作方式、薪资）必须一致，只有表达风格不同 |
| BR-2 | 只有本入口生成三个版本；其他入口只生成 1 份草稿 |
| BR-3 | 创建后的职责、要求与所选版本逐字一致 |
| BR-4 | 不得出现输入中没有的公司事实 |
| BR-5 | 创建规则同 M1 BR-1～BR-3、BR-6、BR-7 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | 职位名 | 文本，非空 |
| 输入 | Refine 指令 | 文本 |
| 输出 | 三个版本 | 每个版本的 summary、responsibilities、requirements 等；风格标签 |
| 输出 | 选择结果 | 所选版本标识 |
| 输出 | Core Job + internal 文档 | 内容 = 所选版本 |

## 6. 权限

同 M1：Recruiter / TA、Hiring Manager 可创建；HR Approver、Viewer 待确认。

## 7. 非功能要求

- 三个版本的生成时间阈值待确认。
- 同一职位名生成多次，每次都满足 BR-1。

## 8. 验收标准

| ID | 验收 | 对应闭环路径 |
|---|---|---|
| AC-1 | 生成三个风格版本，事实字段一致 | P1 |
| AC-2 | Refine 后三版一起更新，停留在当前版本 | P2 |
| AC-3 | 创建内容与所选版本一致 | P1 |
| AC-4 | 空职位名不触发生成 | P3 |
| AC-5 | AI 失败可恢复 | P4 |

## 9. 依赖与实现

- 后端：`POST copilot/conversations/:id/title-variants`、`POST copilot/conversations/:id/refine-variants`、`POST copilot/conversations/:id/confirm-draft`。

## 10. 待确认

1. “事实一致”用字段级比对还是 LLM 判定。
2. 哪些字段允许 AI 填默认值，界面是否标注“默认”。
3. 无法识别的职位名（如 `Chief Tidy Officer`）是先追问含义，还是直接生成。
