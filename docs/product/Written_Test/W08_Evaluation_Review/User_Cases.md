# W08 User Cases：评分与人工复核

| 项 | 内容 |
|---|---|
| 模块 | W08 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 12 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致。
- **AI 输出**：按判定条件检查；同一输入至少跑 2 次。
- **状态**：✅ 可测；🟡 部分可测；❌ 未实现（执行时标记 known gap）。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W08-01 | 提交后生成 AI 初评草稿 | AI 质量 | P0 | ✅ 可测 | — | P1 | FR-1、BR-4 |
| UC-W08-02 | AI 失败不写 0，可人工评分 | 异常 | P0 | 🟡 部分可测 | 步骤 8 | P2 | AC-3 |
| UC-W08-03 | 评审页三层结构 | UI | P1 | 🟡 部分可测 | 步骤 1–2 | P3 | FR-1、FR-2 |
| UC-W08-04 | 分数可下钻到证据位置 | 功能 | P0 | ❌ 未实现 | 步骤 3 | P3 | AC-5 |
| UC-W08-05 | 覆盖必须填理由，原值保留 | 功能 | P0 | 🟡 部分可测 | 步骤 4 | P4、P5 | AC-4 |
| UC-W08-06 | 必评 Unknown 时 Overall 为空 | 功能 | P0 | ❌ 未实现 | 步骤 5 | P6 | AC-2 |
| UC-W08-07 | 总分算法（Alex = 70） | 功能 | P0 | 🟡 部分可测 | — | P12 | AC-1 |
| UC-W08-08 | Accept all AI scores | 功能 | P1 | ✅ 可测 | 步骤 6 | P7 | FR-5 |
| UC-W08-09 | Re-run AI 不覆盖人工分 | 功能 | P1 | ❌ 未实现 | 步骤 7 | P8 | FR-6 |
| UC-W08-10 | 不完整的提交不能 Finalize | 边界 | P0 | ❌ 未实现 | 步骤 9 | P9 | AC-7 |
| UC-W08-11 | Finalize 只生成一个 final | 幂等 | P0 | 🟡 部分可测 | 步骤 10 | P5、P10 | AC-6、非功能 |
| UC-W08-12 | AI 与人工分差过大提示复核 | 功能 | P2 | ❌ 未实现 | 异常 | P11 | BR-9 |

## 3. 用例详情

### UC-W08-01 提交后生成 AI 初评草稿

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| 系统 | S_inv_accepted_deadline | Jordan 提交答案 | AI 质量 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 候选人提交 | 自动生成 AI 初评 | DB |
| 2 | 查初评内容 | 每个 criterion 有分数、满分、证据 / 理由；整体有 summary | DB |
| 3 | 打开评审页 | Overall（AI）标「Draft only, not a hiring probability」；不在 Results to release 中 | UI |

**追溯**：闭环 P1 · PRD FR-1、BR-4

### UC-W08-02 AI 失败不写 0，可人工评分

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_inv_accepted_deadline | 注入 llm_fail | 异常 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 候选人提交时 AI 超时 | 提交仍成功 | API |
| 2 | 打开评审页 | 显示 AI 失败原因；没有 0 分；可人工评分 | UI、DB |
| 3 | 人工逐项评分并 Finalize | 生成 final | DB |

**追溯**：User Journey 步骤 8 · 闭环 P2 · PRD AC-3 · Brief P09（AI 失败时的界面提示未确认）

### UC-W08-03 评审页三层结构

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_attempt_submitted_ai_draft | — | UI | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Taylor 的评审页 | 首层 Overall（human）、Overall（AI）、Coverage / Confidence；分数与 Coverage、Confidence 分开 | UI |
| 2 | 看 Criteria 表 | 满分、AI 分、人工分、Confidence、Coverage、理由 | UI |

**追溯**：User Journey 步骤 1–2 · 闭环 P3 · PRD FR-1、FR-2（Coverage / Confidence 未确认）

### UC-W08-04 分数可下钻到证据位置

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_attempt_submitted_ai_draft | — | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点 Analysis 的 View evidence | 显示理由和原文片段，带页码或工作表单元格 | UI |
| 2 | 点片段 | 定位到原文件对应位置 | UI |

**追溯**：User Journey 步骤 3 · 闭环 P3 · PRD AC-5

### UC-W08-05 覆盖必须填理由，原值保留

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_attempt_submitted_ai_draft | override_no_reason、override_with_reason | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 改分不填理由 | 不能保存，提示 Override reason 必填 | UI |
| 2 | 填理由后保存 | 保存成功 | UI |
| 3 | 查数据 | 原 AI 值、新值、理由、操作人、时间都在 | DB |
| 4 | 绕过前端不带理由提交 finalize | 返回 4xx | API |

**追溯**：User Journey 步骤 4 · 闭环 P4、P5 · PRD AC-4（现有 finalEvaluation 含 overridden / overrideReason；服务端是否强制未确认）

### UC-W08-06 必评 Unknown 时 Overall 为空

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_attempt_submitted_ai_draft | required_unknown | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 把 Communication 标为 Unknown | Overall 显示为空，并说明「必评项未知」 | UI |
| 2 | 查数据 | overall = null；不是 0；其余项没有被重新归一化 | API、DB |

**追溯**：User Journey 步骤 5 · 闭环 P6 · PRD AC-2、BR-2

### UC-W08-07 总分算法（Alex = 70）

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_attempt_submitted_ai_draft | alex_scores | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 人工分设为 30/40、20/40、20/20 | Overall 显示 70 | UI |
| 2 | 查数据 | overall = 70 | DB |

**追溯**：闭环 P12 · PRD AC-1（多题权重和能力分配未实现，仅单题可验证）

### UC-W08-08 Accept all AI scores

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_attempt_submitted_ai_draft | accept_all_ai | 功能 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点 Accept all AI scores | 人工分等于 AI 分 | UI |
| 2 | Finalize 后查数据 | 记录为人工确认，finalizedBy 为当前用户 | DB |

**追溯**：User Journey 步骤 6 · 闭环 P7 · PRD FR-5

### UC-W08-09 Re-run AI 不覆盖人工分

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | 接 UC-W08-05 步骤 2 | — | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Re-run AI | 生成新 AI 版本；旧版本可查 | DB |
| 2 | 看人工分 | 不变 | UI、DB |

**追溯**：User Journey 步骤 7 · 闭环 P8 · PRD FR-6

### UC-W08-10 不完整的提交不能 Finalize

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_inv_started_missing | — | 边界 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Casey 的评审页 | 提示提交不完整，需先处理缺失项 | UI |
| 2 | 直接调用 finalize | 返回 4xx | API |

**追溯**：User Journey 步骤 9 · 闭环 P9 · PRD AC-7

### UC-W08-11 Finalize 只生成一个 final

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager + HR | S_attempt_submitted_ai_draft | override_with_reason；注入 double_click、concurrent | 幂等 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 双击 Confirm finalize | 只生成 1 个 final | DB |
| 2 | 两人同时 Finalize | 一人成功，另一人看到冲突提示 | UI、API |
| 3 | 查页面和统计 | 评分只读；Results to release +1；评分复核任务完成 | UI |

**追溯**：User Journey 步骤 10 · 闭环 P5、P10 · PRD AC-6、非功能

### UC-W08-12 AI 与人工分差过大提示复核

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_attempt_submitted_ai_draft | big_gap | 功能 | P2 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 人工 Overall 40，AI 80 | 提示分差过大，建议人工复核；不阻止保存 | UI |

**追溯**：异常表 · 闭环 P11 · PRD BR-9（阈值待确认）
