# W09 User Cases：结果发布与候选人通知

| 项 | 内容 |
|---|---|
| 模块 | W09 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 10 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致。
- **安全类用例**必须检查 API 响应。
- **状态**：✅ 可测；🟡 部分可测；❌ 未实现（执行时标记 known gap）。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W09-01 | Release 页内部 / 候选人分栏 | UI | P1 | ✅ 可测 | 步骤 1 | P1 | FR-1、FR-2 |
| UC-W09-02 | 披露方式切换预览 | 功能 | P1 | ✅ 可测 | 步骤 2–3 | P2–P3 | AC-4 |
| UC-W09-03 | 两项确认才能发布 | 边界 | P0 | 🟡 部分可测 | 步骤 4 | P4 | FR-4 |
| UC-W09-04 | 发布成功与通知 | 功能 | P0 | 🟡 部分可测 | 步骤 5 | P5 | FR-5 |
| UC-W09-05 | 退信不回滚，可重试通知 | 异常 | P0 | ❌ 未实现 | 步骤 6 | P6 | AC-2 |
| UC-W09-06 | 双击发布只发一次 | 幂等 | P1 | 🟡 部分可测 | 异常 | P7 | 非功能 |
| UC-W09-07 | 候选人结果不含内部字段 | 安全 | P0 | ❌ 未实现 | 步骤 7 | P8 | AC-1 |
| UC-W09-08 | 非 final 显示 Under review | 功能 | P0 | ❌ 未实现 | 步骤 8 | P9 | AC-3 |
| UC-W09-09 | 非 final 不能发布 | 边界 | P0 | 🟡 部分可测 | 异常 | P10 | AC-3 |
| UC-W09-10 | 纠正生成新版本 | 功能 | P1 | ❌ 未实现 | 步骤 9 | P11 | AC-5 |

## 3. 用例详情

### UC-W09-01 Release 页内部 / 候选人分栏

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_final_unreleased | — | UI | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Alex 的 Release 页 | 左栏 Overall（human）70、是否覆盖、Finalized by | UI |
| 2 | 看右栏 | Outcome、Score、Feedback、Next step；注明「Never includes: internal ranking, reviewer notes, or the internal answer key.」 | UI |

**追溯**：User Journey 步骤 1 · 闭环 P1 · PRD FR-1、FR-2

### UC-W09-02 披露方式切换预览

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_final_unreleased | disclose_score、disclose_summary | 功能 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 选 Summary only | 预览中没有分数 | UI |
| 2 | 选 Score + summary | 预览显示 Score: 70 | UI |

**追溯**：User Journey 步骤 2–3 · 闭环 P2–P3 · PRD AC-4

### UC-W09-03 两项确认才能发布

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_final_unreleased | confirm_one | 边界 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 只勾 Internal review complete | Finalize & publish result 禁用，说明还需披露确认 | UI |

**追溯**：User Journey 步骤 4 · 闭环 P4 · PRD FR-4（服务端未校验两项确认）

### UC-W09-04 发布成功与通知

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_final_unreleased | confirm_both；disclose_summary | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 两项确认后发布 | 显示 Published；出现 Next action 区 | UI |
| 2 | 查数据 | 保存发布内容和时间；Case 状态为 released | DB |
| 3 | 查 mock 收件箱 | 候选人收到 1 封结果通知 | 外部 |
| 4 | 查统计 | Results to release 从 1 变 0 | UI |

**追溯**：User Journey 步骤 5 · 闭环 P5 · PRD FR-5（邮件通知未实现）

### UC-W09-05 退信不回滚，可重试通知

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_final_unreleased | confirm_both；注入 mail_bounce | 异常 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 发布时模拟退信 | 结果仍为 Published；Delivery 失败；显示 Retry notification | UI、DB |
| 2 | Retry notification | 只补发 1 封；不生成新 Release | 外部、DB |

**追溯**：User Journey 步骤 6 · 闭环 P6 · PRD AC-2 · Brief P10

### UC-W09-06 双击发布只发一次

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_final_unreleased | confirm_both；注入 double_click | 幂等 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 双击 Finalize & publish result | 1 个 Release、1 封通知 | DB、外部 |

**追溯**：异常表 · 闭环 P7 · PRD 非功能要求

### UC-W09-07 候选人结果不含内部字段

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_result_released（含 internal_note、覆盖记录） | — | 安全 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Alex 打开结果页 | 显示 Outcome、Feedback、Next step | UI |
| 2 | 查接口响应和 DOM | 无 internal notes、AI 分、覆盖记录、排名、参考答案、诚信信号 | API |

**追溯**：User Journey 步骤 7 · 闭环 P8 · PRD AC-1 · Brief P10

### UC-W09-08 非 final 显示 Under review

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_attempt_submitted_ai_draft | — | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Taylor 打开结果页 | 「Your submission is being reviewed… this is not your final result yet.」 | UI |
| 2 | 查接口响应 | 不含 AI draft 80 | API |

**追溯**：User Journey 步骤 8 · 闭环 P9 · PRD AC-3

### UC-W09-09 非 final 不能发布

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_attempt_submitted_ai_draft | — | 边界 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Taylor 的 Release 页 | 「No finalized result for this case yet.」 | UI |
| 2 | 直接调用 release 接口 | 返回 4xx | API |

**追溯**：异常表 · 闭环 P10 · PRD AC-3（服务端是否校验未确认）

### UC-W09-10 纠正生成新版本

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | feedback_text 修改 | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 修改 Feedback 并重新发布 | 生成 v2；页面说明已发邮件无法收回 | UI |
| 2 | 查历史 | v1 仍可查 | DB |
| 3 | 候选人打开结果页 | 显示 v2 | UI |

**追溯**：User Journey 步骤 9 · 闭环 P11 · PRD AC-5
