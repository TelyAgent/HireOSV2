# I10 User Cases：面试阶段决定与双方确认

| 项 | 内容 |
|---|---|
| 模块 | I10 面试阶段决定与双方确认 |
| 版本 / 日期 | v1.0 / 2026-10-15（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [输入输出闭环](Loop_IO.md) · [User Journey](User_Journey.md) |
| 依据 | [PRD.md](PRD.md)；公共约定见 [Interview README](../README.md) |
| 实现现状 | 🟡 后端支持 AI 起草结论、记录决定、按请求中的 role 分别确认（不校验真实角色）；底线例外、补证未完成阻塞未实现 |

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
| UC-I10-01 | 只有 HR 确认时为 pending | 功能 | P0 | 🟡 部分可测 | 步骤 4 | P2 | AC-1 |
| UC-I10-02 | 待确认计数 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 4 | P3 | AC-2 |
| UC-I10-03 | 继续下一轮与推荐 Offer 分开 | 功能 | P0 | ✅ 可测 | 步骤 2 | P4 | AC-3 |
| UC-I10-04 | Must-have Unknown 推荐 Offer 需例外 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 3 | P5 | AC-4 |
| UC-I10-05 | 补证未完成时不能确认 | 功能 | P0 | ❌ 未实现（known gap） | 异常与恢复 | P6 | AC-5 |
| UC-I10-06 | 确认接口校验角色 | 安全 | P0 | ❌ 未实现（known gap） | 可见 / 不可见 | P7 | AC-6 |
| UC-I10-07 | 修改决定后确认失效 | 功能 | P1 | ❌ 未实现（known gap） | 步骤 6 | P8 | AC-7 |
| UC-I10-08 | Hold / Do not proceed 不触发 Offer | 功能 | P1 | 🟡 部分可测 | 禁止副作用 | P9 | AC-8 |
| UC-I10-09 | 双方确认完成 | 功能 | P0 | 🟡 部分可测 | 步骤 5 | P1 | FR-7 |
| UC-I10-10 | 双击确认只确认一次 | 幂等 | P1 | ✅ 可测 | 异常与恢复 | P10 | FR-6 |

## 3. 用例详情

### UC-I10-01 只有 HR 确认时为 pending

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_debrief_ready_all_must_met | recommend_offer | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 选择推荐 Offer，HR 确认 | 提示仍在等 HM；状态 pending | UI / DB |
| 2 | 打开评估包 | 不能发布 | UI |

**追溯**：User Journey 步骤 4 · 闭环 P2 · PRD AC-1

### UC-I10-02 待确认计数

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR、HM | S_decision_hr_confirmed | — | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | HR 查看首页 | M04 不计该项目 | UI |
| 2 | HM 查看首页 | M04 计 1 | UI |
| 3 | 查看 G05 | 计 1；切换角色后一致 | UI |

**追溯**：User Journey 步骤 4 · 闭环 P3 · PRD AC-2

**备注**：首页统计读模型未实现

### UC-I10-03 继续下一轮与推荐 Offer 分开

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_debrief_ready_all_must_met | continue_next、recommend_offer | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 查看决定选项 | 两者是不同选项，说明不同 | UI |
| 2 | 选择 Continue to next round 并确认 | 不产生 Offer 推荐 | DB |

**追溯**：User Journey 步骤 2 · 闭环 P4 · PRD AC-3

### UC-I10-04 Must-have Unknown 推荐 Offer 需例外

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_debrief_security_unknown | exception | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 选择推荐 Offer 不填例外 | 不能保存 | UI |
| 2 | 填写例外后仅 HR 确认 | 例外未生效 | DB |
| 3 | HM 确认 | 例外生效 | DB |

**追溯**：User Journey 步骤 3 · 闭环 P5 · PRD AC-4

**备注**：底线例外未实现

### UC-I10-05 补证未完成时不能确认

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_evidence_requested | — | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | HR、HM 分别尝试确认 | 都被阻止并提示先完成补证 | UI / API |

**追溯**：User Journey 异常与恢复 · 闭环 P6 · PRD AC-5

### UC-I10-06 确认接口校验角色

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer、HR | S_decision_hr_confirmed | — | 安全 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | interviewer_a 调用确认接口 | 返回 403 | API |
| 2 | hr_a 以 HM 方确认 | 被拒绝 | API |

**追溯**：User Journey 可见 / 不可见 · 闭环 P7 · PRD AC-6

**备注**：现在按请求里的 role 字段确认

### UC-I10-07 修改决定后确认失效

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_decision_hr_confirmed | Hold → Recommend for offer | 功能 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 修改决定 | 原确认失效，需要重新确认 | UI / DB |
| 2 | 查看审计 | 有变更记录 | 记录 |

**追溯**：User Journey 步骤 6 · 闭环 P8 · PRD AC-7

### UC-I10-08 Hold / Do not proceed 不触发 Offer

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_debrief_ready_all_must_met | hold_reject | 功能 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 选择 Hold 并双方确认 | 没有 Offer 交接 | DB |
| 2 | 选择 Do not proceed 并双方确认 | 没有 Offer 交接 | DB |

**追溯**：User Journey 禁止副作用 · 闭环 P9 · PRD AC-8

### UC-I10-09 双方确认完成

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR、HM | S_debrief_ready_all_must_met | recommend_offer | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | HR 确认后 HM 确认 | 提示可以进入评估包 | UI |
| 2 | 查询确认记录 | 双方确认人、时间、意见 | API / DB |

**追溯**：User Journey 步骤 5 · 闭环 P1 · PRD FR-7

### UC-I10-10 双击确认只确认一次

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_debrief_ready_all_must_met | 注入 double_click | 幂等 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 快速双击 HR 确认 | 只有一条 HR 确认记录；再次确认提示已确认 | API / DB |

**追溯**：User Journey 异常与恢复 · 闭环 P10 · PRD FR-6

## 4. 验收标准覆盖

| PRD 验收标准 | 覆盖用例 |
|---|---|
| AC-1 | UC-I10-01 |
| AC-2 | UC-I10-02 |
| AC-3 | UC-I10-03 |
| AC-4 | UC-I10-04 |
| AC-5 | UC-I10-05 |
| AC-6 | UC-I10-06 |
| AC-7 | UC-I10-07 |
| AC-8 | UC-I10-08 |

## 5. 统计

| 维度 | 分布 |
|---|---|
| 类型 | 功能 8、安全 1、幂等 1 |
| 优先级 | P0 7、P1 3 |
| 状态 | ✅ 可测 2、🟡 部分可测 3、❌ 未实现（known gap） 5 |
