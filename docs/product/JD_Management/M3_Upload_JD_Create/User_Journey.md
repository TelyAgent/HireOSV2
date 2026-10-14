# M3 User Journey：上传已有 JD 创建职位（P1）

| 项 | 内容 |
|---|---|
| 模块 | M3（测试脚本 J3） |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [输入输出闭环](Loop_IO.md) |
| 来源 | [九模块 User Journey v1.0](../HireOS_Command_JD_Management_Module_User_Journeys_v1.0.md) M3 节；测试数据见 [输入输出闭环 §2](Loop_IO.md)（原测试脚本 v0.1 已于 #30 删除） |

## 角色与权限（公共，摘自 [九模块 User Journey §0.1](../HireOS_Command_JD_Management_Module_User_Journeys_v1.0.md)）

| 角色 | 登录后的主要目的 | 核心操作 | 默认限制 |
|---|---|---|---|
| Recruiter / TA | 将招聘需求整理成合格 JD，协调协作者并推动审批/交付 | 创建职位、补全字段、应用 AI 建议、保存草稿、提交审批、追踪发布 | 不能替审批人作出审批结论，不能绕过阻断项提交或发布 |
| Hiring Manager | 说明为什么招、招什么人、成功标准和团队上下文，并确认业务取舍 | 回答追问、编辑授权字段、解决冲突、确认岗位内容、参与审批 | 不能修改未授权预算/敏感字段，不能自动替代 HR 或审批政策发布 |
| HR Approver | 确认内容、预算、风险和流程前置条件已经处理 | 查看候选版本、差异、风险和影响，批准、退回或拒绝 | 不能把 AI 建议当成人工决策；无权限时不能查看 restricted 字段 |
| Viewer | 阅读获授权的 JD、分析结论和当前有效版本 | 查看职位、来源、版本和授权的 Agent 结论 | 不能应用修改、保存、提交审批、发布或查看敏感字段 |

> 2026-10-14 用户决定：采用以上四个角色，并恢复审批流程。这替代了 [#15](https://github.com/JsonSuCoder/HireOSV2/issues/15) 的三档权限和 [#9](https://github.com/JsonSuCoder/HireOSV2/issues/9) 中“去掉审批”的部分。审批流程目前后端没有实现，相关用例在实现前标记为 known gap。

## 创建类公共骨架（M1–M5 共用）

```mermaid
flowchart LR
  A[职位列表] --> B[Ask Copilot<br/>Create a Job]
  B --> C{选择入口}
  C -->|M1| D1[三问]
  C -->|M2| D2[职位名]
  C -->|M3| D3[上传文件]
  C -->|M4| D4[链接/文案]
  C -->|M5| D5[表单]
  D1 & D2 & D3 & D4 --> E[AI 提取/生成草稿]
  E --> F[Workspace 审阅<br/>可继续对话修改]
  F --> G[Create job]
  D5 --> H[前端+服务端校验]
  H --> G
  G --> I[(Core Job: draft<br/>Owner=当前用户<br/>internal 文档)]
  I --> J[职位编辑页]
```

共同规则（M1–M5 都必须满足）：

1. 每个入口标题旁有 “i”，点击只显示说明，不进入入口。
2. 点击入口后，入口标题先作为用户消息出现一次，Agent 随即引导。
3. 在点击 Create / Save **之前**，系统中不存在新职位（刷新、关闭面板后也没有半成品）。
4. 创建后：Core Job `status=draft`，Owner=当前用户，生成 internal 文档；刷新后仍在，职位列表可见。
5. 创建过程不产生发布记录，也不对外发送任何内容。
6. AI 失败时保留用户输入，提供 Retry 和 Start over；New conversation 清空消息和错误状态（对应线上问题 F-001～F-003、#32、#33）。
7. 字段行始终显示 Location、Headcount、Workplace type；未提供时 Location=`Ho Chi Minh City, VN`、Headcount=`1`；未填的选填项不显示。

# 旅程

**主角色**：Recruiter / TA（Hiring Manager 也可使用）
**登录目的**：手里已有 Word/PDF 版 JD，想直接转成系统里的结构化职位，不想重新录入。
**入口**：Ask Copilot → Upload a JD

## 输入

| 类型 | 内容 |
|---|---|
| 前置数据 | 已登录 |
| 用户数据 | `sales-jd.docx/.pdf/.txt`（同一内容三种格式）；扫描版 PDF；空文件；超过上限的文件（代码上限 10MB）；`.png`/`.zip`；含提示注入的 JD |
| 外部依赖 | 文件解析（pdf-parse、docx）；LLM（jd_parse） |

## 流程

```mermaid
flowchart TD
  S[点击 Upload a JD] --> P[立即弹出文件选择<br/>同时显示 Choose file]
  P --> X{选择文件?}
  X -->|取消| P2[不报错，可再次选择] --> P
  X -->|选择| V{文件可读?}
  V -->|否：扫描件/空/超大/格式不支持| E[明确原因 + 重试或手动入口]
  V -->|是| G[直接生成 1 份草稿<br/>字段标注来源]
  G --> W[Workspace 审阅/对话修改]
  W --> C[Create job]
  C --> O[(职位 draft)]
```

## 步骤

| # | 用户意图与操作 | 系统反馈 | 用户需要判断 |
|---|---|---|---|
| 1 | 点击入口 | **立即弹出**系统文件选择窗口；同时出现引导文案和 Choose file | — |
| 2 | 取消，再点 Choose file | 再次弹出，不报错 | — |
| 3 | 选择 `sales-jd.docx` | 无额外配置，直接生成 1 份草稿；职位名 `Sales Manager`；职责/要求/加分项取自文件 | 提取是否准确 |
| 4 | 查看地点与工作模式 | `Singapore`、`Remote`（取自文件，不是默认值） | — |
| 5 | 查看概述 | 是正常的岗位介绍，不是 “Adapted from…”；来源单独显示 | — |
| 6 | 分别上传 PDF、TXT | 三种格式解析出的职位名、职责、要求一致 | — |
| 7 | 上传异常文件 | 扫描件提示无法识别文字；空/超大/不支持格式都有明确提示并可重试；不生成空草稿 | 换文件还是转手动 |

## 输出与交接

- 持久化：附件记录（文件名、类型、大小、提取状态）；草稿；Create 后 Core Job + 文档。
- 交接 → M6。

**禁止副作用**：解析失败生成空草稿或编造内容；文件里的指令改变 AI 行为；上传完成就视为已创建。

**成功标准**：点击入口即弹出选择；三种格式结果一致；异常文件都有可操作的提示。

**测试映射**：闭环 A3；线上问题 F-006。

**待确认**：正式支持的格式和大小上限（代码 10MB，文档未写）；扫描件是否 OCR；是否做病毒/安全检查。
