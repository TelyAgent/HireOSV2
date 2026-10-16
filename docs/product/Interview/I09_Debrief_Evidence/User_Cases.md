# I09 User Cases：跨轮 Debrief 与补证

| 项 | 内容 |
|---|---|
| 模块 | I09 跨轮 Debrief 与补证 |
| 版本 / 日期 | v1.0 / 2026-10-15（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [输入输出闭环](Loop_IO.md) · [User Journey](User_Journey.md) |
| 依据 | [PRD.md](PRD.md)；公共约定见 [Interview README](../README.md) |
| 实现现状 | 🟡 后端可读取 Debrief、AI 跨轮起草（引用原文、证据不足为 null、列未解决问题）；补证请求与补证轮生成、证据图未实现 |

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
| UC-I09-01 | 部分评估不显示最终分 | 功能 | P0 | 🟡 部分可测 | 步骤 2 | P1 | AC-1 |
| UC-I09-02 | Must-have Unknown 单独突出 | 功能 | P0 | 🟡 部分可测 | 步骤 3 | P3 | AC-2 |
| UC-I09-03 | 两轮分歧都保留 | 功能 | P1 | 🟡 部分可测 | 步骤 4 | P4 | AC-3 |
| UC-I09-04 | AI 与人工差 ≥ 2 级 | 功能 | P1 | 🟡 部分可测 | 步骤 4 | P5 | AC-4 |
| UC-I09-05 | 发起补证 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 5 | P6 | AC-5 |
| UC-I09-06 | 补证完成后刷新 | 功能 | P1 | ❌ 未实现（known gap） | 步骤 6 | P7 | AC-6 |
| UC-I09-07 | 双击只生成一个补证轮 | 幂等 | P1 | ❌ 未实现（known gap） | 异常与恢复 | P8 | AC-7 |
| UC-I09-08 | 全部评分后显示最终分 | 功能 | P1 | 🟡 部分可测 | 步骤 2 | P2 | FR-3 |
| UC-I09-09 | AI 跨轮草稿失败 | 异常 | P2 | ✅ 可测 | 异常与恢复 | P9 | — |
| UC-I09-10 | Interviewer 不能进入 Debrief | 权限 | P1 | ❌ 未实现（known gap） | 可见 / 不可见 | — | — |

## 3. 用例详情

### UC-I09-01 部分评估不显示最终分

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_all_rounds_scored_security_unknown | one_unscored | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Debrief | 显示 Partial evaluation 与覆盖率；不显示最终加权分 | UI |

**追溯**：User Journey 步骤 2 · 闭环 P1 · PRD AC-1

### UC-I09-02 Must-have Unknown 单独突出

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_all_rounds_scored_security_unknown | security_unknown | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 查看 Security & Compliance Awareness | 单独突出为 Unknown；其他高分不改变其状态 | UI |

**追溯**：User Journey 步骤 3 · 闭环 P3 · PRD AC-2

### UC-I09-03 两轮分歧都保留

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_all_rounds_scored_security_unknown | split_scores | 功能 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 查看该能力 | 两轮意见和反证都可见 | UI |

**追溯**：User Journey 步骤 4 · 闭环 P4 · PRD AC-3

### UC-I09-04 AI 与人工差 ≥ 2 级

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_all_rounds_scored_security_unknown | ai_gap | 功能 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 查看分歧列表 | 该维度被列出 | UI |
| 2 | 点击 See both traces | 同时打开两条追溯链 | UI |

**追溯**：User Journey 步骤 4 · 闭环 P5 · PRD AC-4

### UC-I09-05 发起补证

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_all_rounds_scored_security_unknown | followup | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Request more evidence → Create follow-up round | 计划出现补证轮；状态 Evidence requested | UI / DB |
| 2 | 打开决定页 | 无法确认最终结论 | UI |

**追溯**：User Journey 步骤 5 · 闭环 P6 · PRD AC-5

**备注**：补证请求未实现

### UC-I09-06 补证完成后刷新

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_followup_round_submitted | — | 功能 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Debrief | Unknown 按新证据更新 | UI |

**追溯**：User Journey 步骤 6 · 闭环 P7 · PRD AC-6

### UC-I09-07 双击只生成一个补证轮

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_all_rounds_scored_security_unknown | followup；注入 double_click | 幂等 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 快速双击 Create follow-up round | 只有 1 个补证轮 | API / DB |

**追溯**：User Journey 异常与恢复 · 闭环 P8 · PRD AC-7

### UC-I09-08 全部评分后显示最终分

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_all_rounds_fully_scored | — | 功能 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Debrief | 显示最终加权分 | UI |

**追溯**：User Journey 步骤 2 · 闭环 P2 · PRD FR-3

### UC-I09-09 AI 跨轮草稿失败

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_all_rounds_scored_security_unknown | 注入 llm_fail | 异常 | P2 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | AI 起草失败 | 显示失败和重试；各轮人工分照常显示 | UI |

**追溯**：User Journey 异常与恢复 · 闭环 P9 · PRD —

### UC-I09-10 Interviewer 不能进入 Debrief

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_all_rounds_scored_security_unknown | — | 权限 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 以 interviewer_a 打开 Debrief | 标签置灰不可进入 | UI |
| 2 | 调用 Debrief 接口 | 返回 403 | API |

**追溯**：User Journey 可见 / 不可见 · 闭环 — · PRD —

## 4. 验收标准覆盖

| PRD 验收标准 | 覆盖用例 |
|---|---|
| AC-1 | UC-I09-01 |
| AC-2 | UC-I09-02 |
| AC-3 | UC-I09-03 |
| AC-4 | UC-I09-04 |
| AC-5 | UC-I09-05 |
| AC-6 | UC-I09-06 |
| AC-7 | UC-I09-07 |

## 5. 统计

| 维度 | 分布 |
|---|---|
| 类型 | 功能 7、幂等 1、异常 1、权限 1 |
| 优先级 | P0 3、P1 6、P2 1 |
| 状态 | ✅ 可测 1、🟡 部分可测 5、❌ 未实现（known gap） 4 |
