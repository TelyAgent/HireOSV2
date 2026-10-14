# JD Management 模块索引

版本：v1.0（2026-10-14，草稿，待评审）

JD Management 按独立小闭环拆成 10 个模块（M1–M9 为业务闭环，M10 为各模块共用的 Copilot Agent 能力）。每个模块一个文件夹，各含四份文档：

| 文档 | 作用 | 读者 |
|---|---|---|
| `PRD.md` 产品文档 | 目标、范围、功能需求、业务规则、数据、权限、验收标准、待确认 | 产品、研发、测试 |
| `Loop_IO.md` 输入输出闭环 | 结构化流程规格（YAML）、测试数据、路径清单、流程图 | AI 生成 test case、模拟测试 |
| `User_Journey.md` 用户旅程 | 角色目的、步骤、用户判断、可见/不可见、异常恢复、交接 | 产品、设计、AI Review |
| `User_Cases.md` 用户用例 | 按 User Journey 整理的功能测试用例：前置数据、步骤、预期结果、检查位置、追溯到闭环路径和验收标准 | 测试、AI 执行测试 |

## 模块列表

| 模块 | 文件夹 | 优先级 | 主角色 | 实现现状 |
|---|---|---|---|---|
| M1 Quick Start 三问创建 | [M1_Quick_Start_Create](M1_Quick_Start_Create/) | P0 | Recruiter / TA | ✅ 后端已有；线上 AI 调用失败（#32） |
| M2 职位名三版本创建 | [M2_Job_Title_Variants_Create](M2_Job_Title_Variants_Create/) | P0 | Recruiter / TA | ✅ |
| M3 上传 JD 创建 | [M3_Upload_JD_Create](M3_Upload_JD_Create/) | P1 | Recruiter / TA | ✅ |
| M4 粘贴链接 / 文案创建 | [M4_Paste_Link_Text_Create](M4_Paste_Link_Text_Create/) | P1 | Recruiter / TA | ✅ |
| M5 手动表单创建 | [M5_Manual_Form_Create](M5_Manual_Form_Create/) | P0 | Recruiter / TA | ✅（#34 已由 #38 修复，需回归） |
| M6 Analyze 与 AI 修复 | [M6_Analyze_AI_Fix](M6_Analyze_AI_Fix/) | P0 | Recruiter / TA | ✅ |
| M7 角色权限与审批 | [M7_Roles_Approval](M7_Roles_Approval/) | P0 | 四个角色 | ❌ 审批和服务端角色权限未实现 |
| M8 发布与版本 | [M8_Publish_Versions](M8_Publish_Versions/) | P0 | Recruiter / TA、HR Approver | 🟡 无发布渠道、审批未实现 |
| M9 编辑与 Copilot 改写 | [M9_Edit_Copilot](M9_Edit_Copilot/) | P1 | Recruiter / TA、Hiring Manager | 🟡 并发控制未确认 |
| M10 JD Copilot Agent | [M10_Agent](M10_Agent/) | P0（问答与边界）；薪资调研优先级待定 | 四个角色 | 🟡 会话与改写已有；意图识别、薪资数据源、对标检索未实现 |

模块之间的业务顺序：M1–M5 创建 → M9 编辑 ⇄ M6 检查 → M7 审批 → M8 发布。M10 定义 Agent 的问答、调研和行为边界，被 M1–M6、M9 共用。测试时每个模块用 seed 直接造出前置数据，**不依赖**前一个模块真跑。全景图和状态图见 [流程图总览](HireOS_Command_JD_Management_Flowcharts_v1.0.md)。

## 公共约定

### 角色（2026-10-14 用户决定）

Recruiter / TA、Hiring Manager、HR Approver、Viewer，定义见 [M7 产品文档 §3](M7_Roles_Approval/PRD.md)。已决定恢复审批流程，该决定尚未回写到 GitHub（#15、#9）。

### 测试身份

| 身份 | 角色 | 说明 |
|---|---|---|
| recruiter_a | Recruiter / TA | 大多数模块的默认执行者 |
| hm_a | Hiring Manager | M7b、M9 |
| approver_a | HR Approver | M7a |
| approver_no_restricted | HR Approver（无 restricted 权限） | M7b |
| viewer_a | Viewer | M6 P13、M7b、M10e |

开发态目前只有一个固定身份，需要先补多身份测试账号（线上问题 F-004）。

### Seed（前置状态）目录

| Seed | 内容 | 使用模块 |
|---|---|---|
| S0_logged_in | 已登录，在职位列表，无同名职位 | M1–M5 |
| S_job_incomplete | 只有职位名、地点、HC，职责和要求各 1 条 | M6、M7、M8 |
| S_job_weak | 必填齐全，只有 1 条 Weak | M6 |
| S_job_ready | 全部合格 | M6、M9 |
| S_job_ready_with_confidential | 全部合格，含 Confidential 块和预算字段 | M7 |
| S_job_with_confidential | 含 Public 块和 Confidential 块 | M9 |
| S_job_ready_not_approved | 全部合格，审批未提交或 pending | M8 |
| S_job_approved | 全部合格且已批准，含三种可见范围的块 | M8 |
| S_job_published_v1_v2 | 已发布两个版本，差异覆盖新增、删除、修改、可见范围变化 | M8 |
| S_job_ready_plus_reference | 全部合格，已有一份对标 JD 结果，公司画像部分缺失 | M10 |

所有测试职位名加 `[UJ-TEST]` 前缀，测试后清理。

### 注入点（J10 横切套件）

在节点的 `inject` 字段中标注，测试时对该节点各跑一次：

| 注入 | 含义 | 通过标准 |
|---|---|---|
| network_down | 断网 | 有失败提示和重试；输入不丢 |
| llm_fail | AI 失败 / 超时 | 可恢复；不显示假成功；不编造 |
| double_click | 重复点击提交类按钮 | 只生效一次 |
| refresh | 中途刷新 / 后退 | 不产生半成品 |
| http_500 | 保存接口返回 500 | 不显示 Saved |
| stop_generation | 停止 AI 生成 | 半截建议不能接受 |

## 闭环文档格式

`Loop_IO.md` 的结构化规格是 AI 模拟测试的输入，mermaid 图由规格生成，不单独修改。

| 字段 | 含义 |
|---|---|
| `flow_id` | 流程编号；一个模块可以有多个子流程（如 M7a、M7b），用 YAML `---` 分隔 |
| `actor` / `actors` | 执行身份，取自测试身份表 |
| `seed` | 前置状态，取自 Seed 目录 |
| `entry` | 起始节点 |
| `max_loop` | 同一回路最多走几次，防止路径无限展开 |
| `external` | 需要模拟的外部依赖 |
| `nodes[].type` | `action` AI 执行的操作 / `decision` 按条件分支 / `check` 断言 / `terminal` 终态 |
| `nodes[].expect` | 断言内容，按检查位置分：`ui` 页面、`api` 接口响应、`db` 持久化数据、`record` AiRun / 活动 / 审计、`ext` 外部页面 |
| `nodes[].inject` | 该节点要叠加的注入点 |
| `edges` | `[from, to, {when: 触发条件}]`；条件引用测试数据名称 |

**路径清单**中一条路径对应一个 test case（已整理为各模块的 `User_Cases.md`）：写明节点序列、测试数据或注入、期望终态。产品文档中的验收标准（AC）引用这些路径编号。

**断言原则**：
- 权限类断言必须检查 `api`，不能只看 `ui`。
- AI 输出写判定条件，不写固定文字；同一输入至少跑 2 次。
- 后端未实现的功能，路径照写，测试中标记为 known gap，不写成通过。

## 与原有汇总文档的关系

| 文档 | 现在的作用 |
|---|---|
| [九模块 User Journey v1.0](HireOS_Command_JD_Management_Module_User_Journeys_v1.0.md) | 汇总版；各模块 `User_Journey.md` 由它拆出。另含拆法评估（§10）和汇总待确认（§11） |
| [流程图总览 v1.0](HireOS_Command_JD_Management_Flowcharts_v1.0.md) | 全景图、状态图、J10 横切套件；各模块泳道图已被 `Loop_IO.md` 的结构化流程替代 |
| [Flow_Spec_Sample_M5_v0.1](Flow_Spec_Sample_M5_v0.1.md) | 结构样例，已迁移到 [M5 Loop_IO](M5_Manual_Form_Create/Loop_IO.md) |
| [测试闭环输入/输出清单 v0.1](JD_Test_Loops_IO_v0.1.md) | 38 个闭环的总清单（含暂不建模块的闭环） |

修改模块内容时，以模块文件夹内的文档为准，并同步汇总文档或在汇总文档中注明。

## 建议新增（未建文件夹）

- M11 职位生命周期与清理（暂停、关闭、归档、删除）

原先建议的“M10 招聘问答与市场薪资调研”已并入 [M10_Agent](M10_Agent/)。

## 用例统计（User_Cases.md）

| 模块 | 用例数 | ✅ 可测 | 🟡 部分可测 | ❌ 未实现 |
|---|---|---|---|---|
| M1 | 15 | 15 | 0 | 0 |
| M2 | 9 | 9 | 0 | 0 |
| M3 | 11 | 11 | 0 | 0 |
| M4 | 11 | 11 | 0 | 0 |
| M5 | 12 | 12 | 0 | 0 |
| M6 | 14 | 11 | 1 | 2 |
| M7 | 15 | 0 | 0 | 15 |
| M8 | 12 | 0 | 9 | 3 |
| M9 | 17 | 15 | 1 | 1 |
| M10 | 25 | 1 | 13 | 11 |
| **合计** | **141** | **85** | **24** | **32** |

“✅ 可测”表示功能已有实现、用例可以直接执行，不代表会通过；例如 M1 在线上受 #32 影响会失败。

