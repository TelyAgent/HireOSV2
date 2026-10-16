# W03 产品文档：测评项目与候选人关联

| 项 | 内容 |
|---|---|
| 模块 | W03 / 主闭环第 1 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter、Hiring Manager |
| 原型路由 | `#/assessments`、`#/assessments/:id`（Brief 为 `#/projects/:id`）（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🟡 后端 `intake` 接收 Screening 交接（`POST intake/screening-handoff`），按 `coreCandidateId` / `coreJobId` 幂等写入本地 `Candidate`、`Job`、`Case`；`GET cases/:id/context` 提供上下文。前端 `AssessmentsListPage`、`ProjectDetailPage` 使用 fixture。AssessmentProject、新建候选人、Confirm link、Reconciling 未实现。未逐项验证 AC |
| 依据 | [PRD v1.4 §3、§5、§18.1、§18.2](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §2、§4](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §14.1、P03、F02–F04](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md) |

## 1. 背景与目标

测评既有正式岗位招聘，也有不挂岗位的通用能力测评。正式招聘测评必须基于一个由人确认的候选人—岗位关系；如果收到邮件就自动建关系，或者每个模块各自建一份候选人，后续就会出现重复的人和错位的结果。

**目标**：只有目标或 JD 也能起草项目；候选人和岗位都使用 Core 公共主档；正式岗位邀请前由人确认招聘关系，经 Core 幂等创建或复用 Application。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 测评项目列表、新建项目、从 JD 起草项目、导入 | 修改上游 JD Management 已发布的 JD |
| 项目详情：目标、必评 / 选评题、候选人列表、状态 | 候选人计划细节（W04） |
| Add candidate：先建 Core Candidate，再 Confirm link 建 Core Application | Screening 的简历库和筛选流程 |
| Select from screened candidates：复用 Screening 已有结果 | 在本模块保存可写的 Candidate / Job / Application 主档 |
| 快速创建测评向导（Candidates → Tests → Timing & submission → Review & send） | |
| Core 不可用和响应丢失（Reconciling）处理 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 项目列表显示每个项目的岗位、必评 / 选评题、候选人数、Awaiting submission、Issues open、Results to release |
| FR-2 | **Create project** 可只填目标或 JD，不需要候选人和 Application；**Draft a project from this JD** 从未接入测评的岗位起草项目 |
| FR-3 | 项目详情候选人表显示 Candidate、Application、Plan、Status、Score、Confirmed link；未确认关系的行显示「Confirm the candidate's role link first」 |
| FR-4 | **Add candidate**：填姓名和邮箱 → 在 Core 创建 Candidate → 显示「已存在于 Core 但还没有确认的招聘关系」→ **Confirm link → create Application**；已关联的候选人直接显示 Open plan |
| FR-5 | **Select from screened candidates** 列出该岗位已有 Screening 结果且尚未进入测评的候选人，选中后复用公共记录和结果，不重新上传简历、不重复确认岗位 |
| FR-6 | **Create assessment** 快速向导：选候选人、选题包、选 Timed / Deadline only 及截止时间、预览后发送；每个候选人得到独立邀请和轮次 |
| FR-7 | Core 返回失败时显示「Shared records are temporarily unavailable」和 Retry，已填内容保留为草稿 |
| FR-8 | Core 已成功但响应丢失时进入 Reconciling（「Confirming the saved record」），用同一个 request_id 查询恢复，不提供「再创建一个」作为默认动作 |
| FR-9 | 公共 Profile 更新后，已有评分显示「Assessed using profile v1」并提示待复核，不静默改分 |
| FR-10 | 项目详情提供 **Compare candidates** 入口（进入 W12） |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | Candidate / Job / Application / File 的唯一写入方是 Core；本模块只保存逻辑引用 |
| BR-2 | 通用能力测评可以没有 Job / Application；正式岗位测评在邀请前必须有经授权确认的 Application |
| BR-3 | 收到候选人邮件不能自动创建招聘关系 |
| BR-4 | 已有有效人工关联直接复用，不重复创建 |
| BR-5 | Core 创建命令带稳定 request_id，幂等；恢复过程中候选人和 Application 数量不增加 |
| BR-6 | Case 是测评案件，不是第二个 Application |
| BR-7 | 从 Screening 进入的候选人通过总线交接和 Core FileVersion 获取资料，不读 Screening 私有表 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Core Candidate / Job / Application | candidate_id、job_id、application_id、版本 |
| 输入 | Screening 交接（InternalAssessmentRequest） | 来源事件、FileVersion ref |
| 输出 | AssessmentProject | 目标、岗位引用（可空）、必评 / 选评题、owner、状态 |
| 输出 | Case | project、candidate ref、application ref（可空）、状态、输入 manifest |
| 输出 | CoreCommand 记录 | request_id、意图、状态（pending / succeeded / reconciling / failed） |

## 6. 权限

- 创建候选人和确认招聘关系需要对该岗位的授权；转派任务不授予该权限。
- 候选人只作为受限参与者，不获得员工 Membership。

## 7. 非功能要求

- 双击 Confirm link 只创建一个 Application。
- Identity / Core 不可用时如实阻塞依赖动作，不显示假成功。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 只填目标、不选候选人也能创建项目和题库草稿 | A、Brief F03 |
| AC-2 | 新建候选人后未确认关系前，邀请按钮禁用并提示「Confirm the candidate's role link first」 | Brief §14.1、F03 |
| AC-3 | Confirm link 后在 Core 生成唯一 Application，重复确认不新增 | Brief F03 |
| AC-4 | 模拟 Core 成功但响应丢失：进入 Reconciling，恢复后候选人和 Application 数量不变 | Brief F04 |
| AC-5 | 从 Screening 选择候选人后，Case 引用相同的 candidate_id / application_id / file_version_id | Brief F02 |
| AC-6 | Profile v2 到达后，旧评分仍显示基于 v1，并出现待复核提示 | Brief F02 |
| AC-7 | Core 不可用时新建候选人失败并保留草稿，不显示已创建 | Brief F10 |

## 9. 依赖与实现

- 后端：`src/intake`（`screening-handoff.service.ts`）、`src/cases`。
- 前端：`AssessmentsListPage`、`ProjectDetailPage`。
- 依赖：Core Record、Identity（W18）；上游 Screening。下游 W04、W05。

## 10. 待确认

1. 后端当前有本地可写的 `Candidate`、`Job` 表，与 PRD「不建本地可写主档」冲突。是否改为只存 Core 引用（涉及 Prisma 迁移和 Screening 交接接口）？
2. 后端没有 AssessmentProject 实体，Case 直接挂在 Job 上。项目是否必须先建，还是允许 Case 不属于任何项目？
3. 快速创建向导（原型 Create assessment）与 W05 的五步 Composer 是否都保留。
4. 「岗位转看」只产生关联提案，提案由谁审批。
