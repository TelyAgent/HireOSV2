# M1 产品文档：Quick Start 三问创建职位

| 项 | 内容 |
|---|---|
| 模块 / 优先级 | M1 / P0 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Recruiter / TA；Hiring Manager 也可使用 |
| 同目录文档 | [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 实现现状 | ✅ 后端已有 Copilot 会话、消息、confirm-draft 接口；线上 AI 调用失败（F-001 / #32） |
| 依据 | [PRD v1.3 §5.1–5.2](../HireOS_Command_JD_Management_PRD_v1.3.md)、[User Journeys v1.0 §A3.1](../HireOS_Command_JD_Management_User_Journeys_v1.0.md)、测试脚本 v0.1 J1（已于 #30 删除）、[完整性标准 v0.1](../HireOS_Command_JD_Completeness_Standard_v0.1.md) |

## 1. 背景与目标

用户只知道“为什么招、要解决什么问题”，不知道怎么写完整 JD。Quick Start 用三个问题收集招聘意图，由 AI 生成一份结构化草稿，用户确认后创建职位。

**目标**：用户回答三个问题后，得到一份可编辑、带来源的草稿，并能一键创建职位。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 三问收集、缺失追问、职位名追问 | 生成多个风格版本（属于 M2） |
| 生成 1 份草稿，在 Workspace 中审阅 | 必填项完整性检查和 AI 修复（属于 M6） |
| 通过对话继续修改草稿 | 提交审批、发布（属于 M7、M8） |
| 文字和语音输入 | 薪资市场调研 |
| 创建职位（draft） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 点击 Quick Start 后，入口标题作为用户消息出现一次，Agent 用**一条消息**同时提出三个问题：为什么招 / 遇到的困难、希望候选人解决什么、必须具备的硬技能 |
| FR-2 | 用户可以一次回答全部或部分问题；Agent 只追问未回答的问题，不重复已答内容 |
| FR-3 | 无法从回答推断职位名时，追问 Job title；不使用 `New Role` 或空标题 |
| FR-4 | 三个问题都有回答后，显示生成中状态，生成 **1 份**草稿；右侧展开 Workspace，与对话并列 |
| FR-5 | 草稿每个字段标注来源（用户回答 / AI 推断），推断内容需可识别 |
| FR-6 | 用户在对话中提出修改（如“改为 Remote”），Workspace 中改动处高亮；用户消息只出现一次 |
| FR-7 | 点击 `Create job from this draft` 创建职位并跳转编辑页 |
| FR-8 | 支持语音输入：允许麦克风权限后转写并发送；拒绝权限时给出提示 |
| FR-9 | AI 失败时显示错误卡片，保留用户输入，提供 Retry 和 Start over；New conversation 清空消息和错误状态 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 点击 Create 之前，系统中不存在新职位；刷新、关闭面板也不产生半成品 |
| BR-2 | 创建后 Core Job `status=draft`，Owner = 当前用户，生成 internal 文档 |
| BR-3 | 字段行始终显示 Location、Headcount、Workplace type；未提供时 Location=`Ho Chi Minh City, VN`、Headcount=`1`；Level 不提供时不显示 |
| BR-4 | 生成内容不得包含回答中没有的数字或公司事实 |
| BR-5 | 草稿判定条件：概述 2–4 句且含职位名；职责 ≥3 条、以动词开头；要求包含用户回答的硬技能（完整性标准 B1、C1、D1） |
| BR-6 | 创建过程不产生审批、发布或外发记录 |
| BR-7 | Retry 必须幂等，不能重复创建职位 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | 用户回答 | 三个问题的文本（中/英），可来自语音转写 |
| 输出 | CopilotConversation / CopilotMessage | 会话 ID、消息、追问记录 |
| 输出 | 草稿 | title、summary、responsibilities、requirements、preferred、location、workplace type、字段来源 |
| 输出 | Core Job | job_id、title、status=draft、createdBy |
| 输出 | JobDocument(internal) | 块列表，每块有可见范围 |
| 输出 | AiRun | 模型、prompt 版本、耗时、结果状态 |

## 6. 权限

| 角色 | 能否使用 |
|---|---|
| Recruiter / TA、Hiring Manager | 可以创建 |
| HR Approver | 以角色定义为准（待确认是否可创建） |
| Viewer | 不能创建：入口不可见或不可用（待确认） |

AI 上下文只包含本次会话内容，不读取其他职位的 Confidential 内容。

## 7. 非功能要求

- 性能：首个反馈和完整结果的阈值待确认（测试脚本 v0.1 E11 建议 ≤2 秒 / ≤20 秒）。
- 中英文界面都要支持。
- 同一输入重复生成，结果都要满足 BR-5 的判定条件。

## 8. 验收标准

| ID | 验收 | 对应闭环路径 |
|---|---|---|
| AC-1 | 只回答部分问题时，只追问未答问题 | Loop_IO P2 |
| AC-2 | 推断不出职位名时追问 title | P3 |
| AC-3 | 生成 1 份草稿，满足 BR-5 | P1 |
| AC-4 | 对话修改后改动高亮，用户消息不重复 | P4 |
| AC-5 | Create 前无职位；Create 后符合 BR-2、BR-3，刷新后仍在 | P1 |
| AC-6 | AI 失败可恢复，Retry 不重复创建 | P5 |

## 9. 依赖与实现

- 后端：`POST copilot/conversations`、`POST copilot/conversations/:id/messages`（流式）、`POST copilot/conversations/:id/confirm-draft`。
- 语音：`POST audio/realtime-ticket`（Doubao 实时转写）。
- 已知线上问题：F-001 / #32（AI 请求返回 Sign-in service is unavailable）、F-002 / #33（New conversation 不重置）、F-003（没有 Retry）。

## 10. 待确认

1. “已回答”的判定标准（关键词、LLM 判定还是规则）。
2. 推断字段是否在 UI 上标注“AI 推断”；置信度是否展示。
3. HR Approver、Viewer 能否使用创建入口。
4. 性能阈值。
