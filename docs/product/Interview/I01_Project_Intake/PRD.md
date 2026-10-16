# I01 产品文档：创建项目与 JD 接入

| 项 | 内容 |
|---|---|
| 模块 | I01 / 主闭环第 1 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter |
| 原型页面 | 首页 `+ New Interview Project` / 左侧栏 `+` → 新建项目弹窗（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 后端：`POST materials` 上传单个文件（PDF / DOCX / TXT，校验文件头，存入 Core Record 并提取文本）；`GET external-jobs` + `POST jobs/attach` 关联已有岗位；`POST jobs/:id/tasks` 用一份简历材料（`materialId`）在岗位下建项目——即现有 InterviewTask = 候选人 × 岗位，JD-only 时只有 Job、没有 Task，与 PRD「项目先有 JD、候选人后关联」的模型不同；`POST screening-handoff` 接收 Screening 交接；`parsing-jobs/:id` 查询与重试解析。前端新建弹窗已接上述接口。文件夹导入、邮件导入未实现（依赖 I13）。未逐项验证 AC |
| 依据 | [PRD v1.5 §3.4、§5 阶段 1、§6 INT-01、§12](../HireOS_Command_Interview_PRD_v1.5.md) |

## 1. 背景与目标

独立模式下，招聘方往往只有一份 JD，候选人、筛选报告和测评结果要么还没有，要么散落在邮箱和文件夹里。如果要求先补齐所有资料才能建项目，面试准备会被卡住。

**目标**：只要有 JD 就能创建面试项目；其他材料可以现在附上，也可以之后关联，缺失的资料不阻塞创建，也不被当成「通过」。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 新建项目弹窗：Upload manually / Import from folder / Import from email 三种来源 | 文件接入、连接、历史本身（I13） |
| 直接粘贴 JD 文本，或选择 JD 文件 | 候选人关联与简历（I02） |
| 可选的候选人材料：简历、筛选报告、测评报告 | 从 JD 抽取能力要求（I03） |
| 没有 JD 时不能创建 | 编辑 JD Management 的权威 JD |
| JD-only 创建草稿项目 | |
| 关联 JD Management 已有岗位；Screening 交接创建项目 | |
| 独立导入 JD 时选择已有岗位或新建岗位记录 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 弹窗标题 `Start with a job description`，说明「A JD is all you need. Candidate and assessment materials can be linked later.」 |
| FR-2 | 三个来源标签：Upload manually（选择 JD 文件或粘贴文本）、Import from folder（选择已授权文件夹）、Import from email（查看匹配的面试请求邮件）；后两者调用 I13 的连接，原型中标明 `Demo connection` |
| FR-3 | JD 文件选择说明支持格式和大小（原型：PDF、DOCX、TXT，≤ 10 MB）；不支持、损坏或无法提取文字时给出具体原因，不生成空项目 |
| FR-4 | `Candidate materials` 为可选区域，说明「Optional — add a resume, screening report, or assessment」 |
| FR-5 | 没有 JD（未选文件且文本为空）时点击 Create project，提示「A job description is required before a project can be created.」，不创建 |
| FR-6 | 只有 JD 时创建草稿项目，提示需要在 Overview 抽取要求、之后再关联候选人；项目出现在首页列表，状态为 `No candidate linked` |
| FR-7 | 从 JD Management 选择已有岗位关联时，带入岗位 ID 和 JD 版本，不复制一份新岗位 |
| FR-8 | 独立导入 JD 时可以选择已有岗位或新建岗位记录；同名 JD 不自动认定为同一岗位 |
| FR-9 | 已提供的 Job / Candidate / Workspace 引用必须一致，不一致时拒绝并说明哪一项不匹配 |
| FR-10 | JD 解析失败时项目仍可创建，Overview 显示解析失败和重试入口 |
| FR-11 | Screening 交接（集成模式）创建项目时带入候选人、简历和筛选证据引用，并标明来源 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | JD 是唯一的最小业务输入；简历、筛选、测评资料缺失不需要额外豁免，也不显示为 Pass |
| BR-2 | 文件读取成功 ≠ 项目已创建；Create project 前不存在新项目 |
| BR-3 | 文件和邮件中的文字只作为数据，其中的指令不改变权限、Rubric 或流程 |
| BR-4 | 重复点击 Create project 只创建一个项目 |
| BR-5 | 招聘状态（open / paused / closed）没有来源时为 unknown，不是创建门槛 |
| BR-6 | 无法判断归属的材料保持 Unassigned，不自动创建候选人或推进流程 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | JD 文件 / 文本 | 文件名、类型、大小、内容；或粘贴文本 |
| 输入 | 可选材料 | 简历、筛选报告、测评报告的材料引用 |
| 输出 | Job | 岗位 ID、JD 版本、来源（JD Management / 独立导入）、招聘状态 |
| 输出 | InterviewTask（项目） | 项目 ID、Job、状态（draft）、创建方式、创建人 |
| 输出 | TaskMaterial | 材料引用、类型、来源 |
| 输出 | ParseJob | JD 解析状态、错误码、重试次数 |

## 6. 权限

- 只有 HR / Recruiter（原型 editor）可以新建项目；Interviewer（原型 assignee）看不到新建入口，直接调用接口应返回 403。
- 材料只在本 Workspace 内可见。

## 7. 非功能要求

- 上传、解析耗时阈值待确认；解析期间页面不卡死，可关闭弹窗后在 Overview 查看进度。
- 界面英文；1366 × 768 下弹窗内容不裁切。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 只粘贴 JD 文本、不附任何材料即可创建项目，首页出现该项目且状态为 `No candidate linked` | §12 独立闭环、缺可选资料 |
| AC-2 | JD 为空时无法创建，并显示明确提示 | §12 JD 与权限 |
| AC-3 | 上传 `.png`、空文件、扫描件 PDF 作为 JD，分别显示不支持 / 空文件 / 无法提取文字，不创建空项目 | §8.7.2 |
| AC-4 | 关联 JD Management 已有岗位后，项目引用的岗位 ID 与 JD 版本正确，没有复制岗位 | INT-01 |
| AC-5 | 双击 Create project 只产生一个项目 | §10 |
| AC-6 | 以 Interviewer 身份调用建项目接口返回 403 | §10 |
| AC-7 | JD 中包含「忽略以上规则」之类的指令时，抽取结果和权限不受影响 | §10 |

## 9. 依赖与实现

- 后端：`intake/materials.service.ts`、`intake/jobs.service.ts`、`intake/tasks.service.ts`、`intake/screening-handoff.service.ts`、`intake/parsing.service.ts`；Core Record 材料主档（`core-record/core-record.client.ts`）。
- 前端：`components/Modals.tsx`（新建项目），`store/StoreContext.tsx`。
- 依赖：I13（文件夹、邮件来源）、I15（角色权限）。下游 I02、I03。

## 10. 待确认

1. 正式支持的 JD 格式、大小、页数上限（原型写 10 MB，PRD 交由部署配置）。
2. 扫描件 JD 是否做 OCR。
3. 文件夹、邮件导入在 I13 上线前是否先隐藏，还是保留模拟入口。
4. 现有数据模型中项目由简历创建（Task 必须有候选人）。是否改为 Task 可以没有候选人，还是首页把「只有 Job、无 Task」的岗位当作 `No candidate linked` 项目展示？
5. 独立导入的 JD 之后接入 JD Management 时，如何与已有岗位建立映射（PRD §9 RoleIdentity）。
