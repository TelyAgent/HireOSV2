# I11 User Cases：评估包与 Offer 交接

| 项 | 内容 |
|---|---|
| 模块 | I11 评估包与 Offer 交接 |
| 版本 / 日期 | v1.0 / 2026-10-15（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [输入输出闭环](Loop_IO.md) · [User Journey](User_Journey.md) |
| 依据 | [PRD.md](PRD.md)；公共约定见 [Interview README](../README.md) |
| 实现现状 | 🟡 后端可读取评估包、在推荐 Offer 且双方确认后把 offerState 置为 sent（本地状态，无真实 Offer 模块、无 ACK / 重试 / 版本顺序）；导出 PDF、包版本、失效标记未实现 |

用例数：8

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
| UC-I11-01 | 独立闭环走通到导出 | 端到端 | P0 | ❌ 未实现（known gap） | 步骤 1–3 | P1 | AC-1 |
| UC-I11-02 | 交接超时后重试 | 异常 | P0 | ❌ 未实现（known gap） | 步骤 5 | P2 | AC-2 |
| UC-I11-03 | 同一版本只接收一次 | 幂等 | P0 | 🟡 部分可测 | 异常与恢复 | P3 | AC-3 |
| UC-I11-04 | 旧版本重放不覆盖新版本 | 功能 | P1 | ❌ 未实现（known gap） | — | P4 | AC-4 |
| UC-I11-05 | JD 更新后标记失效 | 功能 | P1 | ❌ 未实现（known gap） | 步骤 6 | P5 | AC-5 |
| UC-I11-06 | 包不含原始材料 | 安全 | P0 | 🟡 部分可测 | 步骤 2 | P6 | AC-6 |
| UC-I11-07 | 一方确认时不能发布和交接 | 功能 | P0 | ✅ 可测 | 步骤 1 | P7 | AC-7 |
| UC-I11-08 | 导出失败与下载失败分开 | 异常 | P1 | ❌ 未实现（known gap） | 异常与恢复 | P8 | AC-8 |

## 3. 用例详情

### UC-I11-01 独立闭环走通到导出

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | 从 S_jd_only_project 开始 | JD-only 演示数据 | 端到端 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 依次完成 I01 → I10 | 每步状态正确前进 | UI |
| 2 | 打开评估包并导出 PDF | 导出成功，PDF 含 Rubric、分数、证据链接、双方确认 | UI / 外部 |

**追溯**：User Journey 步骤 1–3 · 闭环 P1 · PRD AC-1

**备注**：JD-only 建项目与导出未实现

### UC-I11-02 交接超时后重试

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_decision_both_confirmed_offer | offer_timeout | 异常 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 发送到 Offer，首次超时 | 显示失败和 Nothing was partially sent | UI |
| 2 | 重试 | 状态为已接收 | UI / 外部 |

**追溯**：User Journey 步骤 5 · 闭环 P2 · PRD AC-2

**备注**：无真实 Offer 模块与 ACK

### UC-I11-03 同一版本只接收一次

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_package_handed_off | offer_dup | 幂等 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 再次发送 | 提示 Already sent and acknowledged | UI |
| 2 | 查看 Offer mock | 只接收一次 | 外部 |

**追溯**：User Journey 异常与恢复 · 闭环 P3 · PRD AC-3

### UC-I11-04 旧版本重放不覆盖新版本

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_package_v2_handed_off | replay_v1 | 功能 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 重放 v1 | Offer 中仍是 v2 | 外部 |

**追溯**：User Journey — · 闭环 P4 · PRD AC-4

### UC-I11-05 JD 更新后标记失效

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_package_v2_handed_off | jd_update | 功能 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 更新 JD | 包显示需复核 | UI |
| 2 | 查看 Offer mock | 已交接版本被通知失效 | 外部 |

**追溯**：User Journey 步骤 6 · 闭环 P5 · PRD AC-5

### UC-I11-06 包不含原始材料

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_decision_both_confirmed_offer | — | 安全 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 查看包内容与交接数据 | 不含完整录音、转写和内部笔记；只有结构化摘要和受控引用 | UI / API |

**追溯**：User Journey 步骤 2 · 闭环 P6 · PRD AC-6

### UC-I11-07 一方确认时不能发布和交接

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_decision_hr_confirmed | — | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开评估包 | 显示 still in review；发布和交接不可用 | UI |
| 2 | 调用交接接口 | 被拒绝 | API |

**追溯**：User Journey 步骤 1 · 闭环 P7 · PRD AC-7

### UC-I11-08 导出失败与下载失败分开

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_decision_both_confirmed_offer | export_fail / download_fail | 异常 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 导出生成失败 | 显示生成失败，不显示下载失败 | UI |
| 2 | 生成成功但下载失败 | 显示下载失败，不标生成失败 | UI |

**追溯**：User Journey 异常与恢复 · 闭环 P8 · PRD AC-8

## 4. 验收标准覆盖

| PRD 验收标准 | 覆盖用例 |
|---|---|
| AC-1 | UC-I11-01 |
| AC-2 | UC-I11-02 |
| AC-3 | UC-I11-03 |
| AC-4 | UC-I11-04 |
| AC-5 | UC-I11-05 |
| AC-6 | UC-I11-06 |
| AC-7 | UC-I11-07 |
| AC-8 | UC-I11-08 |

## 5. 统计

| 维度 | 分布 |
|---|---|
| 类型 | 端到端 1、异常 2、幂等 1、功能 3、安全 1 |
| 优先级 | P0 5、P1 3 |
| 状态 | ✅ 可测 1、🟡 部分可测 2、❌ 未实现（known gap） 5 |
