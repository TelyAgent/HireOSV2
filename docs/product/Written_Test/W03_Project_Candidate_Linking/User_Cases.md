# W03 User Cases：测评项目与候选人关联

| 项 | 内容 |
|---|---|
| 模块 | W03 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 12 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致。
- **状态**：✅ 可测；🟡 部分可测；❌ 未实现（执行时标记 known gap）。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W03-01 | 项目列表统计列 | UI | P1 | ❌ 未实现 | 步骤 1 | — | FR-1 |
| UC-W03-02 | 只有目标也能创建项目 | 功能 | P0 | ❌ 未实现 | 步骤 2 | P1、P2 | AC-1 |
| UC-W03-03 | 从 JD 起草项目 | 功能 | P2 | ❌ 未实现 | 步骤 3 | P3 | FR-2 |
| UC-W03-04 | 新建候选人后未确认关系不能邀请 | 功能 | P0 | ❌ 未实现 | 步骤 5 | P4 | AC-2 |
| UC-W03-05 | Confirm link 生成唯一 Application | 幂等 | P0 | ❌ 未实现 | 步骤 6 | P4、P7 | AC-3 |
| UC-W03-06 | 已关联候选人不重复创建 | 幂等 | P1 | ❌ 未实现 | 步骤 7 | P8 | BR-4 |
| UC-W03-07 | Core 不可用时如实阻塞 | 异常 | P0 | ❌ 未实现 | 步骤 10 | P5 | AC-7 |
| UC-W03-08 | Core 响应丢失后对账恢复 | 异常 | P0 | ❌ 未实现 | 步骤 11 | P6 | AC-4 |
| UC-W03-09 | 从 Screening 交接 / 选择候选人复用公共 ID | 集成 | P0 | 🟡 部分可测 | 步骤 8 | P9、P10 | AC-5 |
| UC-W03-10 | Screening 交接重复投递不重复建 Case | 幂等 | P0 | ✅ 可测 | 步骤 8 | P9 | BR-5 |
| UC-W03-11 | 快速创建向导 | 功能 | P1 | 🟡 部分可测 | 步骤 9 | P11–P13 | FR-6 |
| UC-W03-12 | Profile 更新后旧评分待复核 | 功能 | P1 | ❌ 未实现 | 步骤 12 | P14 | AC-6 |

## 3. 用例详情

### UC-W03-01 项目列表统计列

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | — | UI | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Assessments | prj_fin 显示必评 FIN-001、选评 FIN-002；Candidates 4；Awaiting submission 2；Issues open 1；Results to release 1 | UI |

**追溯**：User Journey 步骤 1 · PRD FR-1（前端为 fixture）

### UC-W03-02 只有目标也能创建项目

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | project_goal_only、project_with_job | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 用 project_goal_only 创建 | 项目 active，job_ref 为空，没有 Application | DB |
| 2 | 进入题库 / Builder | 可正常起草题目 | UI |
| 3 | 用 project_with_job 创建 | job_ref 指向 Core Job；没有复制一份可写 JD | DB |

**追溯**：User Journey 步骤 2 · 闭环 P1、P2 · PRD AC-1 · Brief F03

### UC-W03-03 从 JD 起草项目

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | Other open roles 中任一岗位 | 功能 | P2 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点击 Draft a project from this JD | 生成项目草稿，目标预填自岗位 | UI、DB |

**追溯**：User Journey 步骤 3 · 闭环 P3 · PRD FR-2

### UC-W03-04 新建候选人后未确认关系不能邀请

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | cand_new | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Add candidate → Create candidate (Core) | Core 新增 1 个 Candidate；提示还没有确认的招聘关系 | UI、API |
| 2 | 打开该候选人计划，查看邀请按钮 | 禁用，显示「Confirm the candidate's role link first」 | UI |
| 3 | 直接调用创建邀请接口 | 返回 4xx | API |

**追溯**：User Journey 步骤 5 · 闭环 P4 · PRD AC-2 · Brief F03

### UC-W03-05 Confirm link 生成唯一 Application

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_core_candidate_unlinked | 注入 double_click | 幂等 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 双击 Confirm link → create Application | Core 中只有 1 个 Application；Case 引用它 | API、DB |
| 2 | 查看候选人行 | Confirmed link 显示已确认；出现 Open plan | UI |

**追溯**：User Journey 步骤 6 · 闭环 P4、P7 · PRD AC-3

### UC-W03-06 已关联候选人不重复创建

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | cand_existing_linked | 幂等 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 用 Alex 的邮箱 Add candidate | 提示已关联本岗位，直接 Open plan | UI |
| 2 | 查数据 | Candidate、Application 数量不变 | API |

**追溯**：User Journey 步骤 7 · 闭环 P8 · PRD BR-4

### UC-W03-07 Core 不可用时如实阻塞

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | cand_new；注入 core_unavailable | 异常 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Create candidate (Core) | 显示「Shared records are temporarily unavailable」和 Retry；表单内容保留 | UI |
| 2 | 查数据 | Core 无新 Candidate；本地无半成品 Case | API、DB |

**追溯**：User Journey 步骤 10 · 闭环 P5 · PRD AC-7 · Brief F10

### UC-W03-08 Core 响应丢失后对账恢复

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | cand_new；注入 core_response_lost | 异常 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Create candidate (Core) | 显示「Confirming the saved record」；没有「再创建一个」默认按钮 | UI |
| 2 | 恢复完成 | 显示同一个候选人 | UI |
| 3 | 查数据 | Core 中该邮箱只有 1 个 Candidate；记录中同一个 request_id | API、记录 |

**追溯**：User Journey 步骤 11 · 闭环 P6 · PRD AC-4 · Brief F04

### UC-W03-09 从 Screening 交接 / 选择候选人复用公共 ID

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_screened_candidates | — | 集成 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Select from screened candidates，选 2 人，Create assessment plan | 每人一个 Case；不要求重新上传简历或确认岗位 | UI |
| 2 | 查 Case | 引用的 candidate_id / application_id / file_version_id 与 Screening 相同 | DB |
| 3 | 所有已筛选候选人都进入测评后再打开 | 显示「No unassigned screened candidates for this role right now.」 | UI |

**追溯**：User Journey 步骤 8 · 闭环 P9、P10 · PRD AC-5 · Brief F02（后端 `intake/screening-handoff` 已有；选择抽屉为 fixture）

### UC-W03-10 Screening 交接重复投递不重复建 Case

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| — （系统） | S0_employer | 同一 coreCandidateId + coreJobId 的交接请求 | 幂等 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 调用 `POST /intake/screening-handoff` 两次 | 返回成功 | API |
| 2 | 查数据 | 同一候选人和岗位只有 1 个 Case、1 个 Task | DB |

**追溯**：User Journey 步骤 8 · 闭环 P9 · PRD BR-5

### UC-W03-11 快速创建向导

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer（2 名已关联候选人） | wizard_missing_candidate、wizard_missing_test；FIN-001 | 功能 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 不选候选人点 Continue | 提示「Select at least one candidate first.」 | UI |
| 2 | 不选题包点 Continue | 提示「Select a test first.」 | UI |
| 3 | 选 2 人、FIN-001、Deadline only，Send invitations | 显示「Invitations sent and assessment rounds created.」；每人一封独立邀请和首轮 | UI、DB |

**追溯**：User Journey 步骤 9 · 闭环 P11–P13 · PRD FR-6

### UC-W03-12 Profile 更新后旧评分待复核

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_final_unreleased；Core Profile 更新到 v2 | — | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Alex 的 Case | 显示「Assessed using profile v1」并提示待复核 | UI |
| 2 | 查结果 | Overall 仍为 70，未自动重算 | DB |

**追溯**：User Journey 步骤 12 · 闭环 P14 · PRD AC-6 · Brief F02
