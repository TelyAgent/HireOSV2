# W13 User Cases：我的任务与首页统计

| 项 | 内容 |
|---|---|
| 模块 | W13 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 13 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致；基线任务见 baseline_tasks。
- **数字类用例**同时检查 UI 和 API，确认口径一致。
- **状态**：✅ 可测；🟡 部分可测；❌ 未实现（执行时标记 known gap）。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W13-01 | 首页结构 | UI | P1 | ✅ 可测 | 步骤 1–2 | P1 | FR-1–FR-3 |
| UC-W13-02 | 各身份基线数字 | 数据 | P0 | ❌ 未实现 | 步骤 1 | P1–P3 | AC-1 |
| UC-W13-03 | Workspace 基线数字 | 数据 | P0 | 🟡 部分可测 | 步骤 2 | P4 | AC-2 |
| UC-W13-04 | 指标卡下钻一致 | 功能 | P1 | 🟡 部分可测 | 步骤 3 | P5 | FR-4 |
| UC-W13-05 | 指标四种状态 | 异常 | P1 | ❌ 未实现 | 异常 | P6–P9 | AC-6 |
| UC-W13-06 | 切换范围不闪现旧数字 | 安全 | P0 | ❌ 未实现 | 步骤 13 | P10 | AC-6 |
| UC-W13-07 | 状态过滤数量一致 | 功能 | P1 | ✅ 可测 | 步骤 4 | P11 | FR-6 |
| UC-W13-08 | Cluster by JD 与对比入口 | 功能 | P1 | ✅ 可测 | 步骤 5 | P12 | AC-8 |
| UC-W13-09 | 任务深链接与返回 | 功能 | P1 | ✅ 可测 | 步骤 6–7 | P13 | FR-8、FR-10 |
| UC-W13-10 | Claim 与并发冲突 | 并发 | P0 | ❌ 未实现 | 步骤 8–9 | P14、P15 | AC-3 |
| UC-W13-11 | Wait 必填原因，等待仍计期限 | 功能 | P1 | ❌ 未实现 | 步骤 10 | P16、P17 | AC-4 |
| UC-W13-12 | Assign 不授予数据权限 | 安全 | P1 | ❌ 未实现 | 步骤 11 | P18 | BR-4 |
| UC-W13-13 | 任务只能通过业务动作完成 | 功能 | P0 | 🟡 部分可测 | 步骤 12 | P19、P20 | AC-5 |

## 3. 用例详情

### UC-W13-01 首页结构

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | — | UI | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 My Tasks | 显示登录人、角色、workspace；My Work 不超过 4 张卡 | UI |
| 2 | 看 More statistics | 默认折叠；展开后显示 6 个 workspace 指标 | UI |

**追溯**：User Journey 步骤 1–2 · 闭环 P1 · PRD FR-1–FR-3

### UC-W13-02 各身份基线数字

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| hr_emma / hm_daniel / admin_morgan | S0_employer | baseline_tasks | 数据 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Emma 打开 | My open = 3（t1、t3、t5）；Reviews awaiting me 是其子集，不与总数相加 | UI、API |
| 2 | Daniel 打开 | My open = 1；Available to claim = 1 | UI、API |
| 3 | Admin 打开 | My open = 0（t6 已完成） | UI、API |

**追溯**：User Journey 步骤 1 · 闭环 P1–P3 · PRD AC-1 · Brief §7（多身份、多任务未实现）

### UC-W13-03 Workspace 基线数字

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | — | 数据 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 展开 More statistics | Active projects 1、Awaiting acceptance 0、Awaiting submission 2、Submission issues 1、Results to release 1、Delivery issues 0 | UI |
| 2 | 对照 PRD §12 口径计算 | 与 API 数据一致；Submission issues 按问题组去重 | API |

**追溯**：User Journey 步骤 2 · 闭环 P4 · PRD AC-2、BR-7

### UC-W13-04 指标卡下钻一致

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | — | 功能 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 逐个点击指标卡 | 进入相同过滤条件的列表 | UI |
| 2 | 数列表条数 | 与卡片数字一致 | UI |

**追溯**：User Journey 步骤 3 · 闭环 P5 · PRD FR-4

### UC-W13-05 指标四种状态

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | metric_loading、metric_zero、metric_unavailable、metric_stale；注入 http_500 | 异常 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 分别制造四种状态 | Loading、0、Unavailable、Stale 显示各不相同；都有 as-of | UI |
| 2 | 一个指标接口 500 | 只有该卡 Unavailable，其他卡正常 | UI |

**追溯**：异常表 · 闭环 P6–P9 · PRD AC-6

### UC-W13-06 切换范围不闪现旧数字

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| hr_emma → hr_restricted | S0_employer | — | 安全 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 切换到 hr_restricted（录屏逐帧检查） | 不出现 Emma 的数字；显示受限范围数字 | UI |
| 2 | 查接口 | 只返回授权范围数据 | API |

**追溯**：User Journey 步骤 13 · 闭环 P10 · PRD AC-6 · Brief P21

### UC-W13-07 状态过滤数量一致

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | filter_*（5 个） | 功能 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 依次点击五个过滤 | 列表只含该状态；按钮上的数量与列表条数一致 | UI |

**追溯**：User Journey 步骤 4 · 闭环 P11 · PRD FR-6

### UC-W13-08 Cluster by JD 与对比入口

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | — | 功能 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 切换 Cluster by JD | 按岗位分组显示候选人 | UI |
| 2 | 点 Compare candidates | 只有已评分的候选人可选 | UI |

**追溯**：User Journey 步骤 5 · 闭环 P12 · PRD AC-8

### UC-W13-09 任务深链接与返回

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | — | 功能 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 设置过滤后点任务行 | 进入对应候选人计划页 | UI |
| 2 | 面包屑返回 | 回到 My Tasks，过滤保留 | UI |
| 3 | View resume | 打开简历抽屉 | UI |

**追溯**：User Journey 步骤 6–7 · 闭环 P13 · PRD FR-8、FR-10

### UC-W13-10 Claim 与并发冲突

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| hm_daniel + 另一 Reviewer | S0_employer | t4；注入 concurrent | 并发 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Daniel Claim t4 | assignee = Daniel；My open 1→2；Available to claim 1→0 | UI、DB |
| 2 | 两人同时 Claim | 一人成功；另一人看到「This task was claimed by another reviewer」+ Refresh | UI、API |

**追溯**：User Journey 步骤 8–9 · 闭环 P14、P15 · PRD AC-3 · Brief P16

### UC-W13-11 Wait 必填原因，等待仍计期限

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | wait_no_reason、wait_valid | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Wait 不填原因 | 不能保存 | UI |
| 2 | 填原因和恢复事件后保存 | status = waiting；原因和恢复条件保存；History 有记录 | DB、记录 |
| 3 | 看统计 | 仍计入 My open；到期仍计入 Due today / Overdue | UI |
| 4 | Resume | 回到之前状态 | DB |

**追溯**：User Journey 步骤 10 · 闭环 P16、P17 · PRD AC-4、BR-2

### UC-W13-12 Assign 不授予数据权限

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter → hr_restricted | S0_employer | t1 | 安全 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 把 t1 Assign 给 hr_restricted | 归属变更；Emma 的旧提醒撤销；对方收到分配通知 | DB、外部 |
| 2 | hr_restricted 打开任务 | 无 case_a 权限时看不到证据，提示无权限 | UI、API |

**追溯**：User Journey 步骤 11 · 闭环 P18 · PRD BR-4

### UC-W13-13 任务只能通过业务动作完成

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S0_employer | t1 | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 在任务行找「完成」 | 没有直接完成的按钮 | UI |
| 2 | 调用通用的任务完成接口 | 不存在或返回 4xx | API |
| 3 | 在 Release 页发布 Alex 的结果后 Close testing | Case 终态后 t1 completed；卡片、列表、提醒同步 | DB、UI |
| 4 | 打开版本过期的任务 | 旧动作禁用并提示刷新 | UI |

**追溯**：User Journey 步骤 12 · 闭环 P19、P20 · PRD AC-5、BR-3（现有实现在 Case 终态时完成任务，可部分验证）
