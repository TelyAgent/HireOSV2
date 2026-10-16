# I02 User Cases：项目概览与候选人关联

| 项 | 内容 |
|---|---|
| 模块 | I02 项目概览与候选人关联 |
| 版本 / 日期 | v1.0 / 2026-10-15（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [输入输出闭环](Loop_IO.md) · [User Journey](User_Journey.md) |
| 依据 | [PRD.md](PRD.md)；公共约定见 [Interview README](../README.md) |
| 实现现状 | 🟡 Overview 读取项目详情；可更新 intake 和附加材料；没有“先建项目后关联候选人”的接口；重复处理、Triage、Recent activity 未实现 |

用例数：11

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
| UC-I02-01 | JD-only 项目的 Overview | 功能 | P0 | 🟡 部分可测 | 步骤 1–2 | P1 | AC-1 |
| UC-I02-02 | 选择候选人关联 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 3 | P2 | AC-2 |
| UC-I02-03 | 只上传简历关联 | 功能 | P1 | ❌ 未实现（known gap） | 步骤 3 | P3 | FR-7 |
| UC-I02-04 | 缺少关联输入 | 边界 | P1 | ❌ 未实现（known gap） | 异常与恢复 | P4 | FR-7 |
| UC-I02-05 | 重复筛选报告 Resolve | 功能 | P1 | ❌ 未实现（known gap） | 步骤 4 | P7 | AC-3 |
| UC-I02-06 | 未 Triage 的附件不成为证据 | 功能 | P1 | ❌ 未实现（known gap） | 步骤 5 | P8 | AC-4 |
| UC-I02-07 | 未关联时进入 Brief 被拦截 | 功能 | P0 | 🟡 部分可测 | 步骤 7 | P9 | AC-5 |
| UC-I02-08 | Interviewer 只读与 403 | 权限 | P0 | ❌ 未实现（known gap） | 可见 / 不可见 | P10 | AC-6 |
| UC-I02-09 | 未上传简历时入口为弱态 | UI | P1 | ✅ 可测 | 步骤 6 | P5 | AC-7 |
| UC-I02-10 | 简历抽屉预览与返回 | UI | P2 | ✅ 可测 | 步骤 6 | P5 | FR-11 |
| UC-I02-11 | 双击关联只生效一次 | 幂等 | P1 | ❌ 未实现（known gap） | 异常与恢复 | P6 | FR-7 |

## 3. 用例详情

### UC-I02-01 JD-only 项目的 Overview

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_jd_only_project | — | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Overview | 头部 Candidate not linked；简历 / 筛选 / 测评为可选缺失，不显示 Pass；覆盖率提示需要候选人证据 | UI |

**追溯**：User Journey 步骤 1–2 · 闭环 P1 · PRD AC-1

### UC-I02-02 选择候选人关联

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_jd_only_project | elena | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Link candidate → 选择 Elena Torres → 确认 | 头部显示候选人；默认简历出现在 Source materials；状态前进 | UI |
| 2 | 查询项目 | 引用 candidate_id 与 resume material_id | API |

**追溯**：User Journey 步骤 3 · 闭环 P2 · PRD AC-2

**备注**：缺少先建后关联的接口

### UC-I02-03 只上传简历关联

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_jd_only_project | resume_only | 功能 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 上传一份简历并确认 | 关联成功，简历为当前版本 | UI / API |

**追溯**：User Journey 步骤 3 · 闭环 P3 · PRD FR-7

### UC-I02-04 缺少关联输入

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_jd_only_project | none | 边界 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 不选候选人也不上传简历，点击确认 | 提示 Select a candidate or upload a résumé.；项目不变 | UI |

**追溯**：User Journey 异常与恢复 · 闭环 P4 · PRD FR-7

### UC-I02-05 重复筛选报告 Resolve

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_project_with_materials | dup_screening | 功能 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点击 Resolve | 新版本为当前版本 | UI |
| 2 | 查看旧版本 | 仍可查看，标 superseded | UI / DB |

**追溯**：User Journey 步骤 4 · 闭环 P7 · PRD AC-3

### UC-I02-06 未 Triage 的附件不成为证据

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_project_with_materials | unassigned_attachment | 功能 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 查看各证据列表 | 未 Triage 的附件不出现 | UI |
| 2 | Triage 为测评报告 | 出现在测评材料下 | UI / DB |

**追溯**：User Journey 步骤 5 · 闭环 P8 · PRD AC-4

### UC-I02-07 未关联时进入 Brief 被拦截

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_jd_only_project | — | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点击 Interview Brief | 提示先关联候选人，不进入 | UI |

**追溯**：User Journey 步骤 7 · 闭环 P9 · PRD AC-5

### UC-I02-08 Interviewer 只读与 403

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Interviewer | S_project_linked | — | 权限 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 以 interviewer_a 打开项目 | 只能进入 Overview、Brief、Live Interview、Review，其余标签置灰 | UI |
| 2 | 调用关联接口 | 返回 403 | API |

**追溯**：User Journey 可见 / 不可见 · 闭环 P10 · PRD AC-6

**备注**：后端无业务角色校验

### UC-I02-09 未上传简历时入口为弱态

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_jd_only_project | — | UI | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点击简历入口 | 入口为弱态，不打开抽屉 | UI |

**追溯**：User Journey 步骤 6 · 闭环 P5 · PRD AC-7

### UC-I02-10 简历抽屉预览与返回

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_project_linked | elena | UI | P2 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点击简历入口 | 右侧抽屉打开预览 | UI |
| 2 | 关闭抽屉 | 回到原位置 | UI |

**追溯**：User Journey 步骤 6 · 闭环 P5 · PRD FR-11

### UC-I02-11 双击关联只生效一次

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_jd_only_project | elena；注入 double_click | 幂等 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 快速双击确认关联 | 只产生一次关联和一份简历挂载 | API / DB |

**追溯**：User Journey 异常与恢复 · 闭环 P6 · PRD FR-7

## 4. 验收标准覆盖

| PRD 验收标准 | 覆盖用例 |
|---|---|
| AC-1 | UC-I02-01 |
| AC-2 | UC-I02-02 |
| AC-3 | UC-I02-05 |
| AC-4 | UC-I02-06 |
| AC-5 | UC-I02-07 |
| AC-6 | UC-I02-08 |
| AC-7 | UC-I02-09 |

## 5. 统计

| 维度 | 分布 |
|---|---|
| 类型 | 功能 6、边界 1、权限 1、UI 2、幂等 1 |
| 优先级 | P0 4、P1 6、P2 1 |
| 状态 | ✅ 可测 2、🟡 部分可测 2、❌ 未实现（known gap） 7 |
