# I05 User Cases：排期与会议邀请

| 项 | 内容 |
|---|---|
| 模块 | I05 排期与会议邀请 |
| 版本 / 日期 | v1.0 / 2026-10-15（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [输入输出闭环](Loop_IO.md) · [User Journey](User_Journey.md) |
| 依据 | [PRD.md](PRD.md)；公共约定见 [Interview README](../README.md) |
| 实现现状 | 🟡 后端保存时间、时区标签和手工会议链接（不连日历、不发邀请）；Zoom 主持流程独立；邀请投递、改期 / 取消 / 缺席、Google Meet 未实现 |

用例数：10

## 1. 使用说明

- **前置数据**：Seed 定义见 [Interview README](../README.md#seed前置状态目录)；每条用例用 seed 直接造出前置数据，不依赖其他用例先执行（标注“接 UC-xx”的除外）。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致；测试项目、候选人加 `[UJ-TEST]` 前缀，邮箱用 `example.com`。
- **检查位置**：UI / API / DB / 记录（AI 运行、审计、活动）/ 外部（会议、Offer、邮件 mock）。权限和安全类用例必须检查 API。
- **AI 输出**：按判定条件检查，不比对固定文字；AI 质量类用例同一输入至少跑 2 次。
- **状态**：✅ 可测；🟡 部分可测；❌ 未实现（照写，执行时标 known gap，不算通过）。
- **注入**：注入点含义见 [Interview README](../README.md#注入点)。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-I05-01 | 未批准计划不能排期 | 功能 | P0 | ✅ 可测 | 步骤 1 | P2 | AC-1 |
| UC-I05-02 | 排期成功 | 功能 | P0 | ✅ 可测 | 步骤 2–3 | P1 | FR-11 |
| UC-I05-03 | 缺少时间或面试官 | 边界 | P1 | ✅ 可测 | 异常与恢复 | P3 | FR-4 |
| UC-I05-04 | 时区换算 | 功能 | P0 | 🟡 部分可测 | 步骤 3 | P4 | AC-2 |
| UC-I05-05 | 邀请投递失败与重试 | 异常 | P0 | ❌ 未实现（known gap） | 步骤 4 | P5 | AC-3 |
| UC-I05-06 | 双击保存只产生一个会议 | 幂等 | P0 | 🟡 部分可测 | 异常与恢复 | P6 | AC-4 |
| UC-I05-07 | 改期后旧会议作废 | 功能 | P1 | ❌ 未实现（known gap） | 步骤 5 | P7 | AC-5 |
| UC-I05-08 | 缺席不产生低分 | 功能 | P1 | ❌ 未实现（known gap） | 步骤 6 | P8 | AC-6 |
| UC-I05-09 | Interviewer 不能排期 | 权限 | P0 | ❌ 未实现（known gap） | 可见 / 不可见 | P10 | AC-7 |
| UC-I05-10 | 新增补面轮 | 功能 | P2 | ❌ 未实现（known gap） | 步骤 7 | P9 | FR-9 |

## 3. 用例详情

### UC-I05-01 未批准计划不能排期

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_rubric_confirmed | — | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Schedule | 提示 Approve the interview plan before scheduling. | UI |
| 2 | 调用排期接口 | 被拒绝 | API |

**追溯**：User Journey 步骤 1 · 闭环 P2 · PRD AC-1

### UC-I05-02 排期成功

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_plan_approved | slot_ok | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 填写时间、面试官、会议链接并保存 | 该轮显示时间（含时区）、面试官、会议 | UI |
| 2 | 查询轮次 | scheduledAt 为 UTC | API / DB |
| 3 | 查看项目状态 | Interview in progress | UI |

**追溯**：User Journey 步骤 2–3 · 闭环 P1 · PRD FR-11

### UC-I05-03 缺少时间或面试官

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_plan_approved | slot_missing | 边界 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 不填时间保存 | 提示 Enter a date, time and interviewer. | UI |

**追溯**：User Journey 异常与恢复 · 闭环 P3 · PRD FR-4

### UC-I05-04 时区换算

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_round1_scheduled | tz_viewers | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | UTC+8 与 UTC+1 用户分别查看 | 显示各自本地时间，换算正确 | UI |
| 2 | 查询存储值 | UTC | DB |

**追溯**：User Journey 步骤 3 · 闭环 P4 · PRD AC-2

### UC-I05-05 邀请投递失败与重试

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_plan_approved | invite_fail | 异常 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 保存排期，邀请投递失败 | 显示失败原因和 No calendar hold was created | UI |
| 2 | 点击 Retry（mock 恢复） | 状态变为已发送 | UI / 记录 |

**追溯**：User Journey 步骤 4 · 闭环 P5 · PRD AC-3

**备注**：邀请发送未实现

### UC-I05-06 双击保存只产生一个会议

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_plan_approved | slot_ok；注入 double_click | 幂等 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 快速双击保存 | 只有一个有效会议和一份邀请 | API / DB |

**追溯**：User Journey 异常与恢复 · 闭环 P6 · PRD AC-4

### UC-I05-07 改期后旧会议作废

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_round1_scheduled | reschedule | 功能 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 改期 | 只有一个有效会议；旧链接失效 | DB |
| 2 | 查看参与者通知 mock | 收到更新 | 外部 |

**追溯**：User Journey 步骤 5 · 闭环 P7 · PRD AC-5

### UC-I05-08 缺席不产生低分

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_round1_scheduled | — | 功能 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 记录 no-show 并填原因 | 场次状态 no_show | DB |
| 2 | 查看该轮评分 | 没有能力低分 | API |

**追溯**：User Journey 步骤 6 · 闭环 P8 · PRD AC-6

### UC-I05-09 Interviewer 不能排期

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_plan_approved | — | 权限 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 以 interviewer_a 调用排期接口 | 返回 403 | API |

**追溯**：User Journey 可见 / 不可见 · 闭环 P10 · PRD AC-7

### UC-I05-10 新增补面轮

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_round1_completed | — | 功能 | P2 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点击 + Add make-up round | 补面轮继承当前 Rubric 版本，只考分配的能力 | UI / DB |

**追溯**：User Journey 步骤 7 · 闭环 P9 · PRD FR-9

## 4. 验收标准覆盖

| PRD 验收标准 | 覆盖用例 |
|---|---|
| AC-1 | UC-I05-01 |
| AC-2 | UC-I05-04 |
| AC-3 | UC-I05-05 |
| AC-4 | UC-I05-06 |
| AC-5 | UC-I05-07 |
| AC-6 | UC-I05-08 |
| AC-7 | UC-I05-09 |

## 5. 统计

| 维度 | 分布 |
|---|---|
| 类型 | 功能 6、边界 1、异常 1、幂等 1、权限 1 |
| 优先级 | P0 6、P1 3、P2 1 |
| 状态 | ✅ 可测 3、🟡 部分可测 2、❌ 未实现（known gap） 5 |
