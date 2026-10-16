# W10 User Cases：修订、重考与补测

| 项 | 内容 |
|---|---|
| 模块 | W10 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 10 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致。
- **状态**：本模块全部 ❌ 未实现（执行时标记 known gap）。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W10-01 | 发起修订生成独立新轮 | 功能 | P0 | ❌ 未实现 | 步骤 1–3 | P1 | AC-1、BR-2 |
| UC-W10-02 | 反馈为空不能发送 | 边界 | P2 | ❌ 未实现 | 异常 | P2 | FR-1 |
| UC-W10-03 | 反馈发出后不可修改 | 功能 | P1 | ❌ 未实现 | 步骤 3 | P3 | AC-5 |
| UC-W10-04 | 未收到修订答案显示 Not comparable | 功能 | P1 | ❌ 未实现 | 步骤 4 | P4 | AC-3 |
| UC-W10-05 | 候选人接受修订并邮件提交 | 功能 | P0 | ❌ 未实现 | 步骤 5–6 | P5 | AC-1 |
| UC-W10-06 | 旧线程回复不进入新轮 | 边界 | P0 | ❌ 未实现 | 异常 | P6 | AC-1、BR-2 |
| UC-W10-07 | 修订对照与评分，原轮不变 | 功能 | P0 | ❌ 未实现 | 步骤 7–8 | P5 | AC-2、BR-4 |
| UC-W10-08 | 双击发送修订只建一轮 | 幂等 | P1 | ❌ 未实现 | 异常 | P7 | 非功能 |
| UC-W10-09 | 补测生成新 PlanItem 与新邀请 | 功能 | P0 | ❌ 未实现 | 步骤 9–10 | P8 | AC-4 |
| UC-W10-10 | Rescore 与 Retake 分开记录 | 功能 | P2 | ❌ 未实现 | 步骤 11 | P9、P10 | BR-1 |

## 3. 用例详情

### UC-W10-01 发起修订生成独立新轮

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | feedback_hint；new_deadline | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Release 页 Request revision，填写反馈、披露级别 hint_only、内部 notes、新截止 | 弹窗说明原轮锁定、新轮有独立邀请和线程 | UI |
| 2 | Send revision request | 「Revision round 1 requested — candidate has been notified.」 | UI |
| 3 | 查数据 | 新 Round（revision）、新 Invitation、FeedbackPackage 固定；Round 1 锁定 | DB |
| 4 | 查 mock 收件箱 | 候选人收到主题含「Revision round 1」的独立邮件；不含内部 notes | 外部 |

**追溯**：User Journey 步骤 1–3 · 闭环 P1 · PRD AC-1、BR-2

### UC-W10-02 反馈为空不能发送

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | feedback_empty | 边界 | P2 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 不填反馈发送 | 提示必填；没有新轮 | UI、DB |

**追溯**：异常表 · 闭环 P2 · PRD FR-1

### UC-W10-03 反馈发出后不可修改

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_revision_round1_sent | — | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开修订页 Feedback tab | 反馈只读 | UI |
| 2 | 直接调用修改接口 | 返回 4xx | API |

**追溯**：User Journey 步骤 3 · 闭环 P3 · PRD AC-5

### UC-W10-04 未收到修订答案显示 Not comparable

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_revision_round1_sent | — | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开修订页 | 「Not yet accepted by candidate」；「Not comparable — awaiting revised submission.」；Original 可查看 | UI |
| 2 | 查数据 | delta = null | API |

**追溯**：User Journey 步骤 4 · 闭环 P4 · PRD AC-3

### UC-W10-05 候选人接受修订并邮件提交

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_revision_round1_sent | reply_revision_thread | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 结果页看到 Revision round 1 | 显示提示、新期限、Accept revision | UI |
| 2 | Accept revision | 新轮已接受 | DB |
| 3 | 回复修订线程附上新答案 | 「Matched by reply thread — Round 1 revision」；「Revised answers submitted — HR has been notified.」 | UI |
| 4 | 查数据 | 新 Attempt 属于修订轮 | DB |

**追溯**：User Journey 步骤 5–6 · 闭环 P5 · PRD AC-1 · Brief P11

### UC-W10-06 旧线程回复不进入新轮

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Candidate | S_revision_round1_sent（已接受） | reply_round1_thread | 边界 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 回复原 Round 1 线程附上新答案 | Inbox 中为 Needs confirmation，原因 Round 1 — closed | UI |
| 2 | 查数据 | 修订轮没有作答 | DB |

**追溯**：异常表 · 闭环 P6 · PRD AC-1、BR-2

### UC-W10-07 修订对照与评分，原轮不变

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | 接 UC-W10-05 | — | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开修订页 | Original / Feedback / Revised 可切换；Compare changes 列出每个问题的已修正 / 部分 / 未解决和提示披露级别 | UI |
| 2 | 评分后 Approve revised scores | 修订轮 final | DB |
| 3 | 查 Round 1 | 分数 70 和 Release 不变 | DB |

**追溯**：User Journey 步骤 7–8 · 闭环 P5 · PRD AC-2、BR-4、BR-5

### UC-W10-08 双击发送修订只建一轮

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | feedback_hint；注入 double_click | 幂等 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 双击 Send revision request | 1 个新轮、1 封邮件 | DB、外部 |

**追溯**：异常表 · 闭环 P7 · PRD 非功能要求

### UC-W10-09 补测生成新 PlanItem 与新邀请

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | FIN-002 | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Add supplemental test，按未测能力选 FIN-002 | 新 PlanItem 类型为补证；原 FIN-001 PlanItem 不变 | DB |
| 2 | 发送 | 新 Invitation；候选人端标「Additional assessment」，需接受 | UI、DB |
| 3 | 查原分数 | 70 不变 | DB |

**追溯**：User Journey 步骤 9–10 · 闭环 P8 · PRD AC-4 · Brief P12

### UC-W10-10 Rescore 与 Retake 分开记录

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_result_released | — | 功能 | P2 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Rescore | 新 Evaluation 版本；没有新 Attempt；已发布 Release 不变 | DB |
| 2 | Retake | 新 Attempt 和新 Invitation；与原轮不混排 | DB |

**追溯**：User Journey 步骤 11 · 闭环 P9、P10 · PRD BR-1
