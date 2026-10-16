# W11 User Cases：下一步决定与交接

| 项 | 内容 |
|---|---|
| 模块 | W11 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 11 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致。
- **外部检查**：Interview 接收方用 mock 服务或本地 hireos-interview。
- **状态**：✅ 可测；🟡 部分可测；❌ 未实现（执行时标记 known gap）。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W11-01 | Next action 选项与说明 | UI | P1 | ✅ 可测 | 步骤 1 | — | FR-1 |
| UC-W11-02 | Hold 后 Resume 回到原状态 | 功能 | P0 | ✅ 可测 | 步骤 2–3 | P1 | AC-5 |
| UC-W11-03 | 暂缓期间的进度事件 | 边界 | P1 | ✅ 可测 | 步骤 3 | P2 | FR-2 |
| UC-W11-04 | Close testing 进入终态 | 功能 | P0 | ✅ 可测 | 步骤 4 | P3–P6 | AC-5 |
| UC-W11-05 | 交付包预览内容完整 | 功能 | P1 | ❌ 未实现 | 步骤 5 | P7 | FR-4 |
| UC-W11-06 | 正常交接与时间线 | 集成 | P0 | 🟡 部分可测 | 步骤 6 | P8 | AC-1 |
| UC-W11-07 | 文件未 ready 不发事件 | 异常 | P0 | ❌ 未实现 | 步骤 7 | P9 | AC-1、BR-8 |
| UC-W11-08 | 总线宕机与无 ACK | 异常 | P0 | ❌ 未实现 | 步骤 8–9 | P10、P11 | AC-2、AC-4 |
| UC-W11-09 | 重复交接不重复建 intake | 幂等 | P0 | 🟡 部分可测 | 异常 | P12 | AC-2 |
| UC-W11-10 | Interview 未启用仍可导出 | 功能 | P1 | ❌ 未实现 | 步骤 10 | P13 | AC-3 |
| UC-W11-11 | Fail / 证据不足也能出报告 | 功能 | P2 | ❌ 未实现 | 步骤 11 | P14 | AC-6 |

## 3. 用例详情

### UC-W11-01 Next action 选项与说明

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | — | UI | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Release 页 Next action 区 | 有 Request revision、Add supplemental test、Prepare Interview handoff、Hold、Close testing；说明先提案、批准后才发送 | UI |

**追溯**：User Journey 步骤 1 · PRD FR-1

### UC-W11-02 Hold 后 Resume 回到原状态

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | — | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Hold | Case status = on_hold；statusBeforeHold = released | DB |
| 2 | Resume | status = released | DB |

**追溯**：User Journey 步骤 2–3 · 闭环 P1 · PRD AC-5

### UC-W11-03 暂缓期间的进度事件

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | 处于已发送邀请状态的 Case，已 Hold | 候选人提交 | 边界 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 暂缓期间候选人提交 | status 仍为 on_hold；statusBeforeHold 更新为 review_pending | DB |
| 2 | Resume | status = review_pending | DB |

**追溯**：User Journey 步骤 3 · 闭环 P2 · PRD FR-2

### UC-W11-04 Close testing 进入终态

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | close_passed、close_rejected、close_withdrawn、close_invalid | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 以三个合法原因分别关闭（各用一个 seed） | status = closed；closeReason、closedAt 写入；Task completed | DB |
| 2 | 以 `unknown` 关闭 | 返回 4xx；状态不变 | API |
| 3 | 关闭后注入进度事件 | 被忽略 | DB |

**追溯**：User Journey 步骤 4 · 闭环 P3–P6 · PRD AC-5

### UC-W11-05 交付包预览内容完整

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | — | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Prepare Interview handoff | 预览含当前结果、精确快照、证据、已做案例、反馈披露、未测能力、关键冲突、InterviewFocus | UI |
| 2 | 查是否已发送 | 预览阶段没有事件或调用 | DB、外部 |

**追溯**：User Journey 步骤 5 · 闭环 P7 · PRD FR-4

### UC-W11-06 正常交接与时间线

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | — | 集成 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 确认交接 | Case status = handed_off；记录 interviewTaskId | DB |
| 2 | 查 Interview 端 | 出现对应面试任务 | 外部 |
| 3 | 打开交付页 | 时间线 Result finalized → Preparing → File ready → Event queued → Published → Intake received → Imported | UI |
| 4 | 查事件 | 只携带包 ref，不含完整报告 | DB |

**追溯**：User Journey 步骤 6 · 闭环 P8 · PRD AC-1 · Brief F05（现有为同步 HTTP，步骤 3–4 未实现）

### UC-W11-07 文件未 ready 不发事件

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | 注入 core_unavailable | 异常 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 确认交接时 Core 不可用 | 不显示 File ready；有重试入口 | UI |
| 2 | 查 Outbox | 没有事件 | DB |

**追溯**：User Journey 步骤 7 · 闭环 P9 · PRD AC-1、BR-8 · Brief F10

### UC-W11-08 总线宕机与无 ACK

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | 注入 bus_down；下游不回执 | 异常 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 总线宕机时确认交接 | 「Handoff queued」；Outbox pending；结果不变 | UI、DB |
| 2 | 恢复总线 | 自动继续到 Imported | UI |
| 3 | 下游不回执 | 「Awaiting confirmation」 | UI |

**追溯**：User Journey 步骤 8–9 · 闭环 P10、P11 · PRD AC-2、AC-4 · Brief F06

### UC-W11-09 重复交接不重复建 intake

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | 注入 double_click；事件重投 | 幂等 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 双击确认交接 | Interview 端只有 1 个任务 | 外部 |
| 2 | 交接后再次调用 interview-handoff | 不重复创建（返回冲突或已交接） | API |

**追溯**：异常表 · 闭环 P12 · PRD AC-2（终态校验已有，事件重投未实现）

### UC-W11-10 Interview 未启用仍可导出

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | interview_disabled | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开交付页 | 说明 Interview 未启用 | UI |
| 2 | Export report-only package | 生成可下载的包；没有内部交接事件 | 外部、DB |

**追溯**：User Journey 步骤 10 · 闭环 P13 · PRD AC-3 · Brief P15、F12

### UC-W11-11 Fail / 证据不足也能出报告

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_result_released | result_fail | 功能 | P2 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 导出独立报告 | 报告生成，标出未测能力和证据不足；没有伪造分数或附件 hash | 外部 |

**追溯**：User Journey 步骤 11 · 闭环 P14 · PRD AC-6
