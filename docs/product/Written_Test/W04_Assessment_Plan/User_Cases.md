# W04 User Cases：候选人测评计划

| 项 | 内容 |
|---|---|
| 模块 | W04 |
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
| UC-W04-01 | 计划页结构与空状态 | UI | P1 | ✅ 可测 | 步骤 1–3 | P1 | FR-1、FR-3、FR-12 |
| UC-W04-02 | 从题库添加，题库原题不变 | 功能 | P0 | ✅ 可测 | 步骤 4 | P2 | AC-2 |
| UC-W04-03 | 概念题不能加入计划 | 功能 | P0 | 🟡 部分可测 | 步骤 4 | P3 | BR-7 |
| UC-W04-04 | AI 生成题目 | AI 质量 | P1 | ✅ 可测 | 步骤 5 | P4 | FR-4 |
| UC-W04-05 | AI 输入校验与失败 | 异常 | P1 | ✅ 可测 | 异常 | P5、P6 | FR-4 |
| UC-W04-06 | 双击添加只加一项 | 幂等 | P1 | ✅ 可测 | — | P7 | 非功能 |
| UC-W04-07 | 编辑、删除未发送的计划项 | 功能 | P0 | ✅ 可测 | 步骤 6–7 | P8–P9 | FR-7 |
| UC-W04-08 | 已发送的计划项不能修改 | 功能 | P0 | 🟡 部分可测 | 步骤 8 | P10 | AC-3 |
| UC-W04-09 | 冻结为待发送版本不立即发送 | 功能 | P1 | ❌ 未实现 | 步骤 9 | P11 | FR-8 |
| UC-W04-10 | 补测生成新版本，不覆盖已完成作答 | 功能 | P0 | ❌ 未实现 | 步骤 11 | P12 | AC-4、AC-6 |
| UC-W04-11 | 前置条件满足只生成待确认任务 | 功能 | P1 | ❌ 未实现 | — | P13 | AC-5 |
| UC-W04-12 | 关系未确认时不能发送 | 功能 | P0 | ❌ 未实现 | 步骤 12 | P14 | AC-1 |

## 3. 用例详情

### UC-W04-01 计划页结构与空状态

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_empty | — | UI | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 从 My Tasks 点任务进入计划 | 四个 tab：Assessment plan、Submission、Comprehensive evaluation、Evaluation result；面包屑返回 My Tasks | UI |
| 2 | 看顶部信息 | 验证目标、Owner（未设置时为发起人）、提交截止时间 | UI |
| 3 | 看题目区 | 空状态提示点击 Add assessment question | UI |

**追溯**：User Journey 步骤 1–3 · 闭环 P1 · PRD FR-1、FR-3、FR-12

### UC-W04-02 从题库添加，题库原题不变

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_empty | from_bank | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Add assessment question → From Question Bank，选 FIN-001 | 显示 Approved v1，说明修改只作用于该候选人 | UI |
| 2 | 修改 Prompt 后保存 | 计划项显示修改后内容 | UI、DB |
| 3 | 打开题库 FIN-001 | 内容未改变 | UI、API |

**追溯**：User Journey 步骤 4 · 闭环 P2 · PRD AC-2

### UC-W04-03 概念题不能加入计划

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_empty | from_bank_concept | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 在题库选择器中查找 FIN-009 | 不可选，或可见但禁用并说明原因 | UI |
| 2 | 直接调用 `POST /cases/:caseId/plan-items` 带 FIN-009 | 返回 4xx | API |

**追溯**：User Journey 步骤 4 · 闭环 P3 · PRD BR-7（服务端拦截未实现）

### UC-W04-04 AI 生成题目

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_empty | ai_generated | AI 质量 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | AI-generated，查看建议 | 给出基于岗位要求的 Test focus 建议 | UI |
| 2 | 输入 Test focus，Confirm generate | 生成题目和 Scoring rubric；提示生成成功 | UI |
| 3 | 刷新页面 | 计划项仍在，内容为生成时快照 | DB |
| 4 | 同一输入再跑一次 | 题目与 Test focus 相关，Rubric 有 criterion 和满分 | UI |

**追溯**：User Journey 步骤 5 · 闭环 P4 · PRD FR-4

### UC-W04-05 AI 输入校验与失败

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_empty | ai_empty_focus；ai_generated + 注入 llm_fail | 异常 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Test focus 为空，Confirm generate | 提示「Enter a test focus first.」 | UI |
| 2 | 模拟 AI 失败 | 显示失败，抽屉内容保留；无新计划项 | UI、DB |

**追溯**：异常表 · 闭环 P5、P6 · PRD FR-4

### UC-W04-06 双击添加只加一项

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_empty | from_bank；注入 double_click | 幂等 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 双击确认添加 | 只新增 1 个计划项 | DB |

**追溯**：闭环 P7 · PRD 非功能要求

### UC-W04-07 编辑、删除未发送的计划项

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_ready | op_edit、op_delete | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Edit question，修改后 Save changes | 提示「Question updated.」；内容更新 | UI、DB |
| 2 | Delete question | 提示「Question deleted.」；计划项删除 | UI、DB |

**追溯**：User Journey 步骤 6–7 · 闭环 P8–P9 · PRD FR-7

### UC-W04-08 已发送的计划项不能修改

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_inv_sent_deadline | op_edit | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 查看已发送的计划项 | 显示 Sent；编辑、删除不可用 | UI |
| 2 | 直接调用 PATCH / DELETE | 返回 4xx；邀请快照不变 | API |

**追溯**：User Journey 步骤 8 · 闭环 P10 · PRD AC-3（服务端拦截未确认）

### UC-W04-09 冻结为待发送版本不立即发送

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_ready | — | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 确认计划 | 页面说明已冻结为待发送版本，未发送 | UI |
| 2 | 查数据 | 生成计划版本；没有 Invitation，没有发信记录 | DB、外部 |

**追溯**：User Journey 步骤 9 · 闭环 P11 · PRD FR-8

### UC-W04-10 补测生成新版本，不覆盖已完成作答

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_final_unreleased | supplemental_fin002 | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 以补证类型添加 FIN-002 | 新 PlanItem 类型为补证 | UI、DB |
| 2 | 查看 History | 两个计划版本；FIN-001 的 Attempt 和分数 70 在原版本下不变 | UI、DB |

**追溯**：User Journey 步骤 11 · 闭环 P12 · PRD AC-4、AC-6 · Brief P12

### UC-W04-11 前置条件满足只生成待确认任务

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_ready，FIN-002 前置为 FIN-001 | — | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 模拟 FIN-001 完成 | 生成「发送 FIN-002」待确认任务 | DB |
| 2 | 查邀请 | 没有自动创建 FIN-002 邀请 | API、外部 |

**追溯**：闭环 P13 · PRD AC-5、BR-3

### UC-W04-12 关系未确认时不能发送

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_core_candidate_unlinked | — | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Riley 的计划 | 显示「Confirm the candidate's role link first」；Send to candidate 禁用 | UI |
| 2 | 直接调用创建邀请接口 | 返回 4xx | API |

**追溯**：User Journey 步骤 12 · 闭环 P14 · PRD AC-1
