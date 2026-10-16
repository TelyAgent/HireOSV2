# W12 User Cases：候选人对比

| 项 | 内容 |
|---|---|
| 模块 | W12 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 10 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致。
- **状态**：前端有 fixture 原型，后端未实现；标 🟡 的用例只能在原型数据上验证界面，不能验证持久化。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W12-01 | 只能选择已评分候选人 | 边界 | P1 | 🟡 部分可测 | 步骤 1 | P5–P7 | FR-2、AC-8（W13） |
| UC-W12-02 | 同阶段 final 可直接比较 | 功能 | P0 | ❌ 未实现 | 步骤 2–3 | P1 | BR-1 |
| UC-W12-03 | AI draft 与 final 混合不排名 | 功能 | P0 | 🟡 部分可测 | 步骤 3 | P2 | AC-1 |
| UC-W12-04 | 未测维度显示 Unknown | 功能 | P0 | 🟡 部分可测 | 步骤 4 | P3 | AC-2 |
| UC-W12-05 | 修订轮与初稿不混排 | 功能 | P1 | ❌ 未实现 | 异常 | P4 | AC-6 |
| UC-W12-06 | 无权限候选人显示 Restricted | 安全 | P0 | ❌ 未实现 | 可见性 | P8 | BR-8 |
| UC-W12-07 | 差异下钻到证据 | 功能 | P1 | ❌ 未实现 | 步骤 5 | P1 | FR-6、FR-11 |
| UC-W12-08 | Stale 与 Refresh | 功能 | P1 | ❌ 未实现 | 步骤 7–8 | P9 | AC-3 |
| UC-W12-09 | 评论、视图与导出 | 功能 | P1 | ❌ 未实现 | 步骤 6、9 | P10–P12 | AC-4 |
| UC-W12-10 | 对比、排序、导出不触发发送 | 安全 | P0 | ❌ 未实现 | 步骤 10 | P13 | AC-5 |

## 3. 用例详情

### UC-W12-01 只能选择已评分候选人

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S0_employer | list_invalid_one、list_invalid_unscored、list_invalid_five | 边界 | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Cluster by JD 中查看候选人 | Jordan、Casey（无分数）不可勾选 | UI |
| 2 | 只选 1 人 | 不能开始对比，提示至少 2 人 | UI |
| 3 | 尝试选 5 人 | 第 5 人不可选或提示上限 4 人 | UI |

**追溯**：User Journey 步骤 1 · 闭环 P5–P7 · PRD FR-2

### UC-W12-02 同阶段 final 可直接比较

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_two_final_results | list_final_valid | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开对比 | 提示「Both results are final and directly comparable.」；首列维度固定 | UI |
| 2 | 切换 Same stage | 可排序 | UI |
| 3 | 查快照 | 记录源结果版本 | DB |

**追溯**：User Journey 步骤 2–3 · 闭环 P1 · PRD BR-1

### UC-W12-03 AI draft 与 final 混合不排名

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S0_employer | list_mixed_valid | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 对比 Alex 与 Taylor | 默认 Current summary；提示含 AI draft、仅供参考 | UI |
| 2 | 看整体结论 | 「No clear overall leader」；Taylor 列标 AI draft；没有按 80 > 70 排名 | UI |

**追溯**：User Journey 步骤 3 · 闭环 P2 · PRD AC-1 · Brief P13

### UC-W12-04 未测维度显示 Unknown

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S0_employer | list_with_unknown | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 加入 Jordan 对比（若允许未评分者以 Unknown 列出） | Jordan 的维度显示 Unknown，不显示 0 | UI |
| 2 | 打开显示 Unknown 开关 | Unknown 行可见；关闭后隐藏 | UI |

**追溯**：User Journey 步骤 4 · 闭环 P3 · PRD AC-2

### UC-W12-05 修订轮与初稿不混排

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_result_released + 修订轮 final | list_with_revision | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Same stage 模式 | Alex 修订轮不与他人初稿排在一起，标 Not comparable | UI |
| 2 | Changes since last round 模式 | 显示 Alex 初稿与修订的变化 | UI |

**追溯**：异常表 · 闭环 P4 · PRD AC-6、BR-2

### UC-W12-06 无权限候选人显示 Restricted

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| hr_restricted | S_two_final_results | restricted_viewer | 安全 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开他人保存的对比 | 无权限的候选人显示 Restricted | UI |
| 2 | 查接口响应 | 不含无权限候选人的分数和证据 | API |

**追溯**：可见性 · 闭环 P8 · PRD BR-8

### UC-W12-07 差异下钻到证据

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_two_final_results | list_final_valid | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点 Key differences 中一条 | 打开对应候选人的证据片段 | UI |
| 2 | 看 AI 摘要（跑 2 次） | 每个重要论点附证据；不强选赢家 | UI |

**追溯**：User Journey 步骤 5 · 闭环 P1 · PRD FR-6、FR-11

### UC-W12-08 Stale 与 Refresh

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | 已保存 Alex + Taylor 快照，之后 Taylor Finalize | — | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开旧快照 | 显示 Stale | UI |
| 2 | Refresh | 新快照；旧快照仍在列表中 | UI、DB |

**追溯**：User Journey 步骤 7–8 · 闭环 P9 · PRD AC-3 · Brief P13

### UC-W12-09 评论、视图与导出

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_two_final_results | PNG、PDF；4 人 | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 只看差异、加评论、保存视图 | 保存成功；团队 Rubric 和分数不变 | UI、DB |
| 2 | 导出 PNG / PDF（深色主题下操作） | 文件为浅色，字号正常 | 外部 |
| 3 | 超过单页人数导出 | 要求选子集或分页；没有漏人 | UI、外部 |

**追溯**：User Journey 步骤 6、9 · 闭环 P10–P12 · PRD AC-4 · Brief P14

### UC-W12-10 对比、排序、导出不触发发送

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_two_final_results | — | 安全 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 创建对比、排序、导出 | mock 收件箱无新邮件；无新 Invitation | 外部、DB |
| 2 | 某列 Next action | 生成提案，需批准；批准前无发送 | UI、外部 |

**追溯**：User Journey 步骤 10 · 闭环 P13 · PRD AC-5 · Brief P14
