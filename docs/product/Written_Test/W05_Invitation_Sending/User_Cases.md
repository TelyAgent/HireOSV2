# W05 User Cases：邀请与批量发送

| 项 | 内容 |
|---|---|
| 模块 | W05 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 12 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致。
- **外部检查**：发信用 mock SMTP / simulation adapter，不发送真实邮件。
- **状态**：✅ 可测；🟡 部分可测；❌ 未实现（执行时标记 known gap）。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W05-01 | 单人 Timed 发送 | 功能 | P0 | ✅ 可测 | 步骤 1、3 | P1 | AC-4、FR-11 |
| UC-W05-02 | 单人 Deadline only 发送 | 功能 | P0 | ✅ 可测 | 步骤 3 | P2 | AC-4 |
| UC-W05-03 | 缺截止时间不能发送 | 边界 | P1 | ✅ 可测 | 步骤 2 | P3 | FR-11 |
| UC-W05-04 | 邀请冻结题目快照 | 功能 | P0 | ✅ 可测 | — | P1 | AC-6、BR-5 |
| UC-W05-05 | 单人发信失败后重试 | 异常 | P0 | 🟡 部分可测 | 异常 | P4 | BR-4 |
| UC-W05-06 | 双击发送只发一次 | 幂等 | P0 | 🟡 部分可测 | 异常 | P5、P11 | 非功能 |
| UC-W05-07 | 收件人必须已确认关系 | 功能 | P0 | ❌ 未实现 | 步骤 5–6 | P6 | AC-1 |
| UC-W05-08 | 时间、提交渠道、披露说明 | UI | P1 | ❌ 未实现 | 步骤 7–8 | P7 | FR-3–FR-5 |
| UC-W05-09 | 草稿退出再回来 | 功能 | P2 | ❌ 未实现 | 步骤 9 | P8 | AC-7 |
| UC-W05-10 | 逐人预览与独立邮件 | 功能 | P0 | ❌ 未实现 | 步骤 10–11 | P9 | AC-3、BR-2、BR-3 |
| UC-W05-11 | 批量部分失败只重试失败项 | 异常 | P0 | ❌ 未实现 | 步骤 11–12 | P10 | AC-2 |
| UC-W05-12 | 批准后改关键条件使批准失效 | 功能 | P2 | ❌ 未实现 | 步骤 13 | P12 | AC-5 |

## 3. 用例详情

### UC-W05-01 单人 Timed 发送

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_ready | single_valid_timed | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 计划页点 Send to candidate | 抽屉显示题目、Mode、Duration、Deadline、Result disclosure、From / Reply-To 预览 | UI |
| 2 | 选 Timed、90 分钟、截止、Score + summary，Confirm send | 提示「Invitation sent to candidate.」；计划项显示 Sent | UI |
| 3 | 查数据 | Invitation mode=timed、durationMin=90、deadline、disclosurePolicy 正确；Case 状态为已发送 | DB |
| 4 | 查 mock 收件箱 | 候选人收到 1 封；含链接、期限、工作量 | 外部 |

**追溯**：User Journey 步骤 1、3 · 闭环 P1 · PRD AC-4、FR-11（From / Reply-To 为工作区 SMTP 账号，非 hr@，见待确认）

### UC-W05-02 单人 Deadline only 发送

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_ready | single_valid_deadline | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 选 Deadline only | 不显示时长，只显示截止 | UI |
| 2 | 发送后查数据 | mode=deadline_only，durationMin 为空 | DB |

**追溯**：User Journey 步骤 3 · 闭环 P2 · PRD AC-4

### UC-W05-03 缺截止时间不能发送

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_ready | single_no_deadline | 边界 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 不填截止，Confirm send | 提示「Set a deadline first.」；没有 Invitation | UI、DB |
| 2 | 直接调用接口不带 deadline | 返回 4xx | API |

**追溯**：User Journey 步骤 2 · 闭环 P3 · PRD FR-11

### UC-W05-04 邀请冻结题目快照

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | 接 UC-W05-01 | — | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 发送后修改题库中该题和计划项（未发送副本） | — | — |
| 2 | 以候选人身份打开邀请 | 题目内容为发送时的快照 | API |

**追溯**：闭环 P1 · PRD AC-6、BR-5

### UC-W05-05 单人发信失败后重试

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_ready | single_valid_timed；注入 mail_bounce | 异常 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 模拟 SMTP 失败后发送 | 页面明确显示发信失败，不显示「已发送」 | UI |
| 2 | 查数据 | Invitation 已创建；有失败的 Delivery 记录 | DB |
| 3 | Retry | 只补发 1 封；仍只有 1 个 Invitation | 外部、DB |

**追溯**：异常表 · 闭环 P4 · PRD BR-4（现有接口返回 `emailSent=false`，无 Delivery 记录和重试）

### UC-W05-06 双击发送只发一次

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_case_plan_ready | single_valid_timed；注入 double_click | 幂等 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 快速双击 Confirm send | 只有 1 个 Invitation、1 封邮件 | DB、外部 |

**追溯**：异常表 · 闭环 P5、P11 · PRD 非功能要求（服务端幂等键未实现）

### UC-W05-07 收件人必须已确认关系

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer + S_core_candidate_unlinked | recipients_mixed | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Recipients 加入 Riley | 不能加入，说明需要先确认 Core Application | UI |
| 2 | 加入无计划项的 Priya | Tests & materials 提示先去计划页加题 | UI |

**追溯**：User Journey 步骤 5–6 · 闭环 P6 · PRD AC-1

### UC-W05-08 时间、提交渠道、披露说明

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | batch_auto_submit、batch_confirm_mode | UI | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 选 Timed / Deadline only | Timed 显示时长和截止；Deadline only 只显示截止 | UI |
| 2 | 选 auto-submit | 说明「Complete answers sent from your verified email can be submitted automatically」 | UI |
| 3 | 选确认模式 | 说明还需在 Portal 确认 | UI |
| 4 | Result disclosure | 说明永不包含内部排名、notes、答案 | UI |

**追溯**：User Journey 步骤 7–8 · 闭环 P7 · PRD FR-3–FR-5

### UC-W05-09 草稿退出再回来

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | recipients_two | 功能 | P2 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 填到第 3 步后 Save draft & exit | 退出；没有发信 | UI、外部 |
| 2 | 重新打开 | 各步内容保留 | UI、DB |

**追溯**：User Journey 步骤 9 · 闭环 P8 · PRD AC-7

### UC-W05-10 逐人预览与独立邮件

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | recipients_two | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Review & send | 逐人预览模板、题包版本、预计工作量、时区、From / Reply-To = hr@sendinglabs.com | UI |
| 2 | Send invitations | 进入逐项 Delivery 列表，不只弹 toast | UI |
| 3 | 查 mock 收件箱 | 每人 1 封独立邮件；收件人字段只有本人 | 外部 |

**追溯**：User Journey 步骤 10–11 · 闭环 P9 · PRD AC-3、BR-2、BR-3

### UC-W05-11 批量部分失败只重试失败项

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | recipients_two；对 Priya 注入 mail_bounce | 异常 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 发送 | Jordan Sent；Priya Simulated bounce + Retry | UI |
| 2 | Retry failed | 只给 Priya 重发 | 外部 |
| 3 | 查数据 | Jordan 只有 1 封；没有重复候选人或 Invitation | DB |

**追溯**：User Journey 步骤 11–12 · 闭环 P10 · PRD AC-2 · Brief P03

### UC-W05-12 批准后改关键条件使批准失效

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | recipients_two | 功能 | P2 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 到 Review & send 并确认后，回到 Timing 改截止 | 提示旧确认失效，需要重新确认 | UI |

**追溯**：User Journey 步骤 13 · 闭环 P12 · PRD AC-5
