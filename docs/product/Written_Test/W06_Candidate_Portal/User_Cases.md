# W06 User Cases：候选人门户：验证、接受与作答

| 项 | 内容 |
|---|---|
| 模块 | W06 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 14 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致。
- **安全类用例**必须检查 API 响应，不能只看页面。
- **状态**：✅ 可测；🟡 部分可测；❌ 未实现（执行时标记 known gap）。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W06-01 | 邀请页信息完整 | UI | P1 | 🟡 部分可测 | 步骤 1 | P1 | FR-2 |
| UC-W06-02 | GET 打开链接无副作用 | 安全 | P0 | ❌ 未实现 | 步骤 1 | P1 | AC-1 |
| UC-W06-03 | 邮箱验证后接受，Timed 未开始计时 | 功能 | P0 | ❌ 未实现 | 步骤 2–3 | P2 | AC-2 |
| UC-W06-04 | 验证码错误或过期 | 边界 | P1 | ❌ 未实现 | 异常 | P3 | FR-3 |
| UC-W06-05 | 拒绝邀请 | 功能 | P1 | ❌ 未实现 | 步骤 3' | P4 | AC-4 |
| UC-W06-06 | Timed 点击 Start test 后计时 | 功能 | P0 | ❌ 未实现 | 步骤 4 | P6 | AC-2 |
| UC-W06-07 | Deadline only 无倒计时 | 功能 | P1 | ❌ 未实现 | 步骤 4' | P7 | AC-3 |
| UC-W06-08 | 上传是草稿，离开再回来仍在 | 功能 | P0 | ❌ 未实现 | 步骤 6–7 | P7 | AC-5 |
| UC-W06-09 | 正式提交、回执与锁定 | 功能 | P0 | 🟡 部分可测 | 步骤 8–9 | P7 | AC-5、AC-6 |
| UC-W06-10 | 双击提交只提交一次 | 幂等 | P0 | 🟡 部分可测 | — | P10 | 非功能 |
| UC-W06-11 | 含宏文件被隔离 | 安全 | P1 | ❌ 未实现 | 异常 | P8 | BR-9 |
| UC-W06-12 | 缺件时的提交清单 | 边界 | P1 | ❌ 未实现 | 步骤 8 | P9 | FR-12 |
| UC-W06-13 | 越权访问被拒绝且无数据闪现 | 安全 | P0 | ❌ 未实现 | 异常 | P12、P13 | AC-7 |
| UC-W06-14 | 手机完成接受、上传、提交 | 设备 | P1 | ❌ 未实现 | 全部 | P14 | AC-8 |

## 3. 用例详情

### UC-W06-01 邀请页信息完整

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_inv_sent_timed | — | UI | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开邀请链接 | 显示公司、岗位、题目名称、预计工作量、期限（含时区）、AI use policy、帮助入口 | UI |

**追溯**：User Journey 步骤 1 · 闭环 P1 · PRD FR-2（现有 `/apply/:token` 显示岗位、题目、期限）

### UC-W06-02 GET 打开链接无副作用

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate / 邮件扫描器 | S_inv_sent_timed | — | 安全 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 用 curl 对邀请链接和 `GET /public/invitations/:token` 各请求 3 次 | 返回邀请信息 | API |
| 2 | 查数据 | Invitation 未接受；Attempt 未开始；验证码未消耗；Case 状态未推进 | DB |

**追溯**：User Journey 步骤 1 · 闭环 P1 · PRD AC-1、BR-1（现有实现首次 GET 即改为 opened 并推进 Case）

### UC-W06-03 邮箱验证后接受，Timed 未开始计时

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_inv_sent_timed | otp_valid | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Verify your email，输入验证码 | 「Email verified.」；出现 Accept / Decline | UI |
| 2 | 查会话 | 受限参与者身份，无员工 Membership | 记录 |
| 3 | Accept | 「Invitation accepted.」；显示 Start test 并说明点击后开始计时 | UI |
| 4 | 查数据 | Acceptance = accepted；Attempt.started_at 为空 | DB |

**追溯**：User Journey 步骤 2–3 · 闭环 P2 · PRD AC-2 · Brief P04

### UC-W06-04 验证码错误或过期

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_inv_sent_timed | otp_wrong、otp_expired | 边界 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 分别输入错误、过期验证码 | 提示失败，可重发；不出现 Accept | UI |
| 2 | 查数据 | 邀请状态不变 | DB |

**追溯**：异常表 · 闭环 P3 · PRD FR-3

### UC-W06-05 拒绝邀请

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_inv_sent_deadline | otp_valid | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 验证后点 Decline | 二次确认「You can't undo this from the portal. HR will be notified.」 | UI |
| 2 | 确认 | 「Invitation declined.」；HR 收到通知 | UI、外部 |
| 3 | 直接调用接受接口 | 返回 4xx | API |

**追溯**：User Journey 步骤 3' · 闭环 P4 · PRD AC-4

### UC-W06-06 Timed 点击 Start test 后计时

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | 接 UC-W06-03 | — | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点击 Start test | 显示 Timer running 和剩余时间（90 分钟） | UI |
| 2 | 查数据 | Attempt.started_at 写入 | DB |

**追溯**：User Journey 步骤 4 · 闭环 P6 · PRD AC-2、BR-2

### UC-W06-07 Deadline only 无倒计时

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_inv_accepted_deadline | — | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开任务 | 按钮为 Open assignment；只显示截止日，没有倒计时 | UI |

**追溯**：User Journey 步骤 4' · 闭环 P7 · PRD AC-3

### UC-W06-08 上传是草稿，离开再回来仍在

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_inv_accepted_deadline | file_ok；注入 refresh | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 上传两个文件 | 每行 Uploaded draft → Scanning → Ready；说明上传是草稿 | UI |
| 2 | 查数据 | 有 SubmissionDraft；没有 Receipt；Case 未进入待评分 | DB |
| 3 | 关闭标签页 | 提示有未提交草稿 | UI |
| 4 | 重新打开 | 草稿仍在 | UI |

**追溯**：User Journey 步骤 6–7 · 闭环 P7 · PRD AC-5、BR-3 · Brief P05

### UC-W06-09 正式提交、回执与锁定

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | 接 UC-W06-08 | file_ok | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Submit answers | 最终清单列出已上传文件 | UI |
| 2 | 确认 | 显示回执时间和「Your answers are submitted.」 | UI |
| 3 | 再次尝试上传或提交 | 页面说明本轮已锁定；接口返回 4xx | UI、API |
| 4 | 查雇主端 | Task、评分队列、Awaiting submission 统计同步更新 | DB、UI |

**追溯**：User Journey 步骤 8–9 · 闭环 P7 · PRD AC-5、AC-6（现有文本提交后会生成 AI 初评，文件提交未实现）

### UC-W06-10 双击提交只提交一次

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_inv_accepted_deadline | 注入 double_click | 幂等 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 双击确认提交 | 只有 1 个提交、1 次 AI 初评 | DB、记录 |

**追溯**：闭环 P10 · PRD 非功能要求（`Submission.invitationId` 唯一，可部分验证）

### UC-W06-11 含宏文件被隔离

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_inv_accepted_deadline | file_macro | 安全 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 上传 xlsm | 显示不可用及原因 | UI |
| 2 | 查记录 | 宏未执行；文件未绑定到作答 | 记录、DB |

**追溯**：异常表 · 闭环 P8 · PRD BR-9

### UC-W06-12 缺件时的提交清单

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_inv_accepted_deadline | file_partial | 边界 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 只上传 memo 后 Submit answers | 清单标出缺少 xlsx | UI |
| 2 | 确认（若允许） | 提示「Submitted with missing items — HR will follow up.」；雇主端出现缺件问题 | UI、DB |

**追溯**：User Journey 步骤 8 · 闭环 P9 · PRD FR-12（是否允许提交待确认）

### UC-W06-13 越权访问被拒绝且无数据闪现

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| cand_other | S_inv_accepted_deadline | — | 安全 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 用 Jordan 的链接，以他人邮箱验证 | 验证失败；接口返回 403 / 404，不含 Jordan 的数据 | API |
| 2 | 观察页面加载过程 | 无 Jordan 信息短暂出现；无员工菜单 | UI |
| 3 | 会话过期后操作 | 要求统一身份重新验证；草稿保留 | UI、DB |

**追溯**：异常表 · 闭环 P12、P13 · PRD AC-7 · Brief P21、F08

### UC-W06-14 手机完成接受、上传、提交

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_inv_sent_deadline | device_mobile；file_ok | 设备 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 390×844 下完成验证、接受、上传、提交 | 每步主操作在安全区可见；长文件名换行；无横向滚动 | UI |
| 2 | 200% 缩放 | 主要操作和 Close 可达 | UI |

**追溯**：User Journey 全部步骤 · 闭环 P14 · PRD AC-8
