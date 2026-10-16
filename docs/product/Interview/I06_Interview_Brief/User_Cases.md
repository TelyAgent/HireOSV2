# I06 User Cases：面试 Brief

| 项 | 内容 |
|---|---|
| 模块 | I06 面试 Brief |
| 版本 / 日期 | v1.0 / 2026-10-15（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [输入输出闭环](Loop_IO.md) · [User Journey](User_Journey.md) |
| 依据 | [PRD.md](PRD.md)；公共约定见 [Interview README](../README.md) |
| 实现现状 | 🟡 后端基于已确认 Rubric 按 Job 生成每项能力的问题；背景摘要（Known / Unknown / Claims）、按轮快照、分工未实现 |

用例数：9

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
| UC-I06-01 | 缺筛选和测评时正常生成 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 2 | P2 | AC-1 |
| UC-I06-02 | Known 结论可打开来源 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 2 | P3 | AC-2 |
| UC-I06-03 | 快照不含之后的证据 | 功能 | P1 | ❌ 未实现（known gap） | 步骤 5 | P4 | AC-3 |
| UC-I06-04 | 未提交的分数不可见 | 安全 | P0 | ❌ 未实现（known gap） | 可见 / 不可见 | P5 | AC-4 |
| UC-I06-05 | 未关联候选人时只显示岗位要求 | 功能 | P1 | 🟡 部分可测 | 异常与恢复 | P6 | AC-5 |
| UC-I06-06 | 简历经历显示为待核实 Claim | 功能 | P0 | ❌ 未实现（known gap） | 步骤 3 | P7 | AC-6 |
| UC-I06-07 | 未排期时打开 Brief | 功能 | P1 | 🟡 部分可测 | 步骤 1 | P8 | FR-1 |
| UC-I06-08 | 推荐重点与问题 | 功能 | P1 | 🟡 部分可测 | 步骤 4 | P1 | FR-4 |
| UC-I06-09 | Brief 生成失败 | 异常 | P2 | 🟡 部分可测 | 异常与恢复 | P9 | — |

## 3. 用例详情

### UC-I06-01 缺筛选和测评时正常生成

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_round1_scheduled | no_screening | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Brief | 正常生成；筛选 / 测评标为未提供，不是通过 | UI |

**追溯**：User Journey 步骤 2 · 闭环 P2 · PRD AC-1

**备注**：背景摘要未实现

### UC-I06-02 Known 结论可打开来源

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_round1_scheduled | — | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 逐条点击 Known 结论 | 抽屉中打开对应来源，不离开 Brief | UI |

**追溯**：User Journey 步骤 2 · 闭环 P3 · PRD AC-2

### UC-I06-03 快照不含之后的证据

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_round2_scheduled_round1_submitted | later_evidence | 功能 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 第 2 轮开始后新增证据，再打开第 2 轮 Brief | 快照说明时间与范围；不含新证据 | UI |

**追溯**：User Journey 步骤 5 · 闭环 P4 · PRD AC-3

### UC-I06-04 未提交的分数不可见

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_round2_scheduled | round1_unsubmitted | 安全 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 以第 2 轮面试官打开 Brief | 看不到第 1 轮分数 | UI |
| 2 | 调用 Brief 接口 | 响应中不含第 1 轮分数 | API |

**追溯**：User Journey 可见 / 不可见 · 闭环 P5 · PRD AC-4

### UC-I06-05 未关联候选人时只显示岗位要求

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_jd_only_project | — | 功能 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Brief | 只显示岗位要求，说明没有候选人信息 | UI |

**追溯**：User Journey 异常与恢复 · 闭环 P6 · PRD AC-5

### UC-I06-06 简历经历显示为待核实 Claim

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_round1_scheduled | vague_claim | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 查看 Claims to verify | 该说法列为待核实，提示先问清范围和个人贡献 | UI |

**追溯**：User Journey 步骤 3 · 闭环 P7 · PRD AC-6

### UC-I06-07 未排期时打开 Brief

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_plan_approved | — | 功能 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Brief | 提示 Schedule a round before opening the live brief. | UI |

**追溯**：User Journey 步骤 1 · 闭环 P8 · PRD FR-1

### UC-I06-08 推荐重点与问题

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_round1_scheduled | — | 功能 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 查看本轮推荐重点 | 本轮能力、推荐问题、STAR 追问顺序 | UI |
| 2 | 查询问题接口 | 问题按已确认 Rubric 生成 | API |

**追溯**：User Journey 步骤 4 · 闭环 P1 · PRD FR-4

### UC-I06-09 Brief 生成失败

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_round1_scheduled | 注入 llm_fail | 异常 | P2 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 生成时 AI 失败 | 显示失败和重试；岗位要求仍可查看 | UI |

**追溯**：User Journey 异常与恢复 · 闭环 P9 · PRD —

## 4. 验收标准覆盖

| PRD 验收标准 | 覆盖用例 |
|---|---|
| AC-1 | UC-I06-01 |
| AC-2 | UC-I06-02 |
| AC-3 | UC-I06-03 |
| AC-4 | UC-I06-04 |
| AC-5 | UC-I06-05 |
| AC-6 | UC-I06-06 |

## 5. 统计

| 维度 | 分布 |
|---|---|
| 类型 | 功能 7、安全 1、异常 1 |
| 优先级 | P0 4、P1 4、P2 1 |
| 状态 | 🟡 部分可测 4、❌ 未实现（known gap） 5 |
