# W07 User Cases：提交收件与 Submission Inbox

| 项 | 内容 |
|---|---|
| 模块 | W07 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 13 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)。另增注入 `mail_scan_delay`（扫描完成时间晚于可信接收时间）。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致；邮件由 mock 收件服务注入。
- **状态**：✅ 可测；🟡 部分可测；❌ 未实现（执行时标记 known gap）。本模块收件能力整体未实现。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W07-01 | Inbox 分组与技术细节折叠 | UI | P1 | ❌ 未实现 | 步骤 1 | P12 | FR-1 |
| UC-W07-02 | 完整邮件自动提交与两封回执 | 功能 | P0 | ❌ 未实现 | — | P1 | AC-1 |
| UC-W07-03 | 扫描延迟按可信接收时间判定按时 | 边界 | P0 | ❌ 未实现 | 异常 | P2 | AC-6 |
| UC-W07-04 | 身份或线程不清进入 Needs confirmation | 功能 | P0 | ❌ 未实现 | 步骤 2 | P3–P6 | AC-4、AC-5 |
| UC-W07-05 | 人工确认归属 | 功能 | P0 | ❌ 未实现 | 步骤 3 | P12 | FR-3 |
| UC-W07-06 | 咨询和自动回复不算提交 | 功能 | P1 | ❌ 未实现 | 步骤 4 | P9–P10、P13 | BR-2 |
| UC-W07-07 | 缺件、请求补件并恢复 | 功能 | P0 | ❌ 未实现 | 步骤 5–7 | P7、P14 | AC-4 |
| UC-W07-08 | 可疑附件隔离 | 安全 | P0 | ❌ 未实现 | 步骤 8 | P8 | AC-4 |
| UC-W07-09 | 邮件与上传重复只算一次 | 幂等 | P0 | ❌ 未实现 | 异常 | P11 | AC-2 |
| UC-W07-10 | 已提交后不同附件不覆盖 | 功能 | P0 | ❌ 未实现 | 步骤 10 | P15 | AC-3 |
| UC-W07-11 | Submission 详情 | UI | P1 | 🟡 部分可测 | 步骤 9 | P16 | FR-9 |
| UC-W07-12 | Excel 证据不编造重算结果 | 功能 | P2 | ❌ 未实现 | 步骤 9 | P16 | AC-7 |
| UC-W07-13 | 跨 workspace 邮件隔离 | 安全 | P0 | ❌ 未实现 | 可见性 | P17 | AC-5 |

## 3. 用例详情

### UC-W07-01 Inbox 分组与技术细节折叠

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | 各类邮件各 1 封 | UI | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Submission Inbox | 按 Received / Needs confirmation / Incomplete / Submitted / Duplicate / Quarantined 显示 | UI |
| 2 | 打开任一邮件 | Message-ID、DKIM / SPF、hash 只在 Technical details 中 | UI |

**追溯**：User Journey 步骤 1 · 闭环 P12 · PRD FR-1（前端为 fixture）

### UC-W07-02 完整邮件自动提交与两封回执

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| 系统 / Candidate | S_inv_accepted_deadline | mail_complete | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | mock hr@ 收到邮件 | Inbox 显示 Submitted，匹配原因「Matched by reply thread」 | UI |
| 2 | 查数据 | Response 来源 email；Received、Processed 两个时间都保存 | DB |
| 3 | 查 mock 候选人收件箱 | 收件回执与正式提交回执两封，分开 | 外部 |
| 4 | 查雇主端 | Task、评分队列、Awaiting submission 统计更新 | UI |

**追溯**：闭环 P1 · PRD AC-1 · Brief P06

### UC-W07-03 扫描延迟按可信接收时间判定按时

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| 系统 | S_inv_accepted_deadline | mail_late_scan；注入 mail_scan_delay | 边界 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 注入邮件 | 判定为按时提交 | UI、DB |
| 2 | 查日志 | 记录实际处理完成时间（截止后） | 记录 |

**追溯**：异常表 · 闭环 P2 · PRD AC-6、BR-5

### UC-W07-04 身份或线程不清进入 Needs confirmation

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| 系统 | S_inv_accepted_deadline + 第二岗位任务 + Round 2 进行中 | mail_wrong_sender、mail_old_thread、mail_two_assignments、mail_new_thread | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 分别注入 4 封 | 均为 Needs confirmation，原因分别为 Unknown sender / Round 1 — closed / More than one assignment found / 无线程 | UI |
| 2 | 查数据 | 都未提交；没有落到最近轮次 | DB |

**追溯**：User Journey 步骤 2 · 闭环 P3–P6 · PRD AC-4、AC-5 · Brief P08、F07

### UC-W07-05 人工确认归属

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | 接 UC-W07-04 | mail_new_thread | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Confirm assignment，选 Jordan 的 FIN-001 Round 1 | 邮件绑定；附件完整则 Submitted | UI、DB |
| 2 | 查记录 | 确认人和时间 | 记录 |

**追溯**：User Journey 步骤 3 · 闭环 P12 · PRD FR-3、BR-3

### UC-W07-06 咨询和自动回复不算提交

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_inv_accepted_deadline | mail_question、mail_autoreply | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 注入两封 | 都不算提交；Jordan 仍为 Awaiting submission | UI、DB |
| 2 | 对咨询邮件点 Not a match | 移出待处理 | UI |

**追溯**：User Journey 步骤 4 · 闭环 P9–P10、P13 · PRD BR-2

### UC-W07-07 缺件、请求补件并恢复

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_inv_started_missing | mail_missing → 补件邮件 | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Casey 的邮件 | Incomplete，列出缺失文件 | UI |
| 2 | Request missing files | 候选人在本轮线程收到补件通知 | 外部 |
| 3 | 注入补件邮件 | 问题组关闭；Submitted；提交时间为补件到达时间 | UI、DB |
| 4 | 查 Submission issues 统计 | 从 1 变 0 | UI |

**追溯**：User Journey 步骤 5–7 · 闭环 P7、P14 · PRD AC-4 · Brief P08

### UC-W07-08 可疑附件隔离

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Operations（admin_morgan） | S_inv_accepted_deadline | mail_macro_spf_fail | 安全 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 注入邮件 | Quarantined，提示「Held for Operations review — not auto-processed」 | UI |
| 2 | 查记录 | 宏和附件未执行；未提交 | 记录、DB |

**追溯**：User Journey 步骤 8 · 闭环 P8 · PRD AC-4、BR-8

### UC-W07-09 邮件与上传重复只算一次

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| 系统 | Jordan 已在 Portal 提交 | mail_same_as_upload | 幂等 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 注入同样附件的邮件 | Duplicate | UI |
| 2 | 查数据 | 只有 1 个提交、1 次评分任务 | DB |

**追溯**：异常表 · 闭环 P11 · PRD AC-2 · Brief P07

### UC-W07-10 已提交后不同附件不覆盖

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_attempt_submitted_ai_draft | mail_conflict | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 注入不同附件 | 显示冲突，左右对比差异 | UI |
| 2 | 查数据 | 原提交和 AI draft 不变 | DB |
| 3 | 查可选动作 | 开新修订轮或经批准更正；没有「覆盖」 | UI |

**追溯**：User Journey 步骤 10 · 闭环 P15 · PRD AC-3 · Brief P07

### UC-W07-11 Submission 详情

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_attempt_submitted_ai_draft | — | UI | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Taylor 的 Submission | Received、Processed 时间；原始压缩包下载；交付文件逐项 Preview / Missing；Candidate / Round / Task binding | UI |
| 2 | 点 Go to evaluation | 进入 W08 评审页 | UI |

**追溯**：User Journey 步骤 9 · 闭环 P16 · PRD FR-9（现有页面显示文本答案，无压缩包和文件）

### UC-W07-12 Excel 证据不编造重算结果

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_attempt_submitted_ai_draft（含 xlsx） | — | 功能 | P2 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 预览 Excel 证据 | 显示工作表、单元格、公式、缓存值和「Calculation not verified」 | UI |
| 2 | 查证据数据 | 计算状态为未验证，没有重算值 | API |

**追溯**：User Journey 步骤 9 · 闭环 P16 · PRD AC-7

### UC-W07-13 跨 workspace 邮件隔离

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| hr_other_ws / hr_restricted | S0_employer | mail_cross_ws | 安全 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | hr_other_ws 打开 Inbox | 看不到 ws_demo 的邮件 | UI、API |
| 2 | hr_restricted 打开 Inbox | 只看到有权限 Case 的邮件 | UI、API |

**追溯**：可见性 · 闭环 P17 · PRD AC-5、§6 权限
