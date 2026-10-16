# W01 User Cases：题库与题目版本

| 项 | 内容 |
|---|---|
| 模块 | W01 |
| 版本 / 日期 | v1.0 / 2026-10-16（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 14 |

## 1. 使用说明

- **前置数据 / 测试身份 / 注入点**：定义见 [Written Test README](../README.md#公共约定)；每条用例用 seed 直接造出前置数据，不依赖其他用例先执行（标注“接 UC-xx”的除外）。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致。
- **检查位置**：UI / API / DB / 记录（审计、活动、日志）/ 外部（mock 服务）。权限和安全类用例必须检查 API。
- **状态**：✅ 可测；🟡 部分可测；❌ 未实现（执行时标记 known gap，不算通过）。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-W01-01 | 列表列与「发布不等于发送」说明 | UI | P1 | ✅ 可测 | 步骤 1 | P1 | FR-1、FR-3 |
| UC-W01-02 | 按岗位、能力、编号过滤 | 功能 | P0 | ✅ 可测 | 步骤 2 | P1 | AC-1 |
| UC-W01-03 | 过滤无结果 | 边界 | P2 | ✅ 可测 | 步骤 2 | P2 | FR-2 |
| UC-W01-04 | 详情五个 tab 与 Reviewer only | UI | P1 | 🟡 部分可测 | 步骤 3–5 | P3 | FR-5、FR-7、AC-7 |
| UC-W01-05 | Candidate preview 不泄露内部字段 | 安全 | P0 | 🟡 部分可测 | 步骤 6 | P3 | AC-3 |
| UC-W01-06 | 创建题目并发布 | 功能 | P0 | 🟡 部分可测 | 步骤 8–9 | P4 | FR-10、FR-11 |
| UC-W01-07 | 创建 / 发布校验 | 边界 | P0 | 🟡 部分可测 | 异常 | P5–P7 | BR-4 |
| UC-W01-08 | 双击发布只生成一个版本 | 幂等 | P1 | ❌ 未实现 | — | P8 | 非功能 |
| UC-W01-09 | 保存返回 500 不显示 Saved | 异常 | P1 | ✅ 可测 | 异常 | P9 | 非功能 |
| UC-W01-10 | 编辑已发布题目生成新版本，旧邀请不变 | 功能 | P0 | ❌ 未实现 | 步骤 7 | P10 | AC-2 |
| UC-W01-11 | 停用后不可被新计划选用 | 功能 | P1 | ❌ 未实现 | 步骤 13 | P11 | AC-6 |
| UC-W01-12 | ZIP 导入分类预览 | 功能 | P1 | ❌ 未实现 | 步骤 10–11 | P12 | AC-4 |
| UC-W01-13 | ZIP 损坏或含宏 | 异常 | P2 | ❌ 未实现 | 异常 | P13–P14 | BR-5 |
| UC-W01-14 | 概念题不能邀请 | 功能 | P0 | 🟡 部分可测 | 步骤 12 | P15 | AC-5 |

## 3. 用例详情

### UC-W01-01 列表列与「发布不等于发送」说明

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_bank_fin | — | UI | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 Question Bank | 列显示 Code、Title、Role tags、Competencies、Type、Difficulty、Version、Status；页面说明发布不等于发送 | UI |
| 2 | 选中任一题 | 右侧预览；没有「发送给候选人」动作 | UI |

**追溯**：User Journey 步骤 1 · 闭环 P1 · PRD FR-1、FR-3

### UC-W01-02 按岗位、能力、编号过滤

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_bank_fin | filter_hit_role、filter_hit_multi、filter_hit_search | 功能 | P0 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 选岗位 Finance Operations Analyst | 只列出映射了该岗位的题目 | UI |
| 2 | 选岗位 Strategic Investment Associate + 能力 Analysis | FIN-004 出现；同一题在两个岗位过滤下都能找到 | UI |
| 3 | 搜索 `FIN-00` | 列出编号匹配的题 | UI |

**追溯**：User Journey 步骤 2 · 闭环 P1 · PRD AC-1

### UC-W01-03 过滤无结果

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_bank_fin | filter_miss | 边界 | P2 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 搜索不存在的标题 | 显示「No questions match these filters.」；有 Create question 入口 | UI |

**追溯**：User Journey 步骤 2 · 闭环 P2 · PRD FR-2

### UC-W01-04 详情五个 tab 与 Reviewer only

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_bank_fin | FIN-001 | UI | P1 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 FIN-001，切换五个 tab | Prompt、Materials、Rubric、Usage、Versions 均可打开 | UI |
| 2 | 看 Rubric | 内部答案旁标「Reviewer only — never shown to candidates」 | UI |
| 3 | 看 Usage | 列出 Case、已见候选人、岗位映射；无外部记录处显示 Unknown，不显示 0 | UI |

**追溯**：User Journey 步骤 3–5 · 闭环 P3 · PRD FR-5、FR-7、AC-7（Usage、Versions 依赖版本表，后端未实现）

### UC-W01-05 Candidate preview 不泄露内部字段

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_bank_fin | FIN-001 | 安全 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点击 Preview candidate view | 只显示题目、候选人可见材料、交付清单 | UI |
| 2 | 检查预览所用数据和 DOM | 不含 rubric、answer_key、internal_notes、AI 指令 | API |

**追溯**：User Journey 步骤 6 · 闭环 P3 · PRD AC-3 · Brief P02

### UC-W01-06 创建题目并发布

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_bank_fin | valid_question | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Create question，填写后 Save draft | 题目状态为草稿，version = 1，author = 当前用户 | DB |
| 2 | 在计划页题库选择器中查找 | 草稿不可被选用 | UI |
| 3 | Publish | 状态为 Published；发布历史含操作人和时间 | DB、记录 |

**追溯**：User Journey 步骤 8–9 · 闭环 P4 · PRD FR-10、FR-11（后端当前创建即 published，草稿状态未实现）

### UC-W01-07 创建 / 发布校验

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_bank_fin | invalid_no_title、invalid_dup_code、invalid_no_rubric_publish | 边界 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 分别提交三组数据 | 对应字段报错；题目数不变 | UI、DB |
| 2 | 绕过前端直接调用 `POST /questions` 提交同样数据 | 返回 4xx 和明确错误码 | API |

**追溯**：异常表 · 闭环 P5–P7 · PRD BR-4（缺 Rubric 阻断发布未实现）

### UC-W01-08 双击发布只生成一个版本

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | 接 UC-W01-06 步骤 1 | valid_question；注入 double_click | 幂等 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 快速双击 Publish | 只生成一个版本、一条发布记录 | DB、记录 |

**追溯**：闭环 P8 · PRD 非功能要求

### UC-W01-09 保存返回 500 不显示 Saved

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_bank_fin | valid_question；注入 http_500 | 异常 | P1 | ✅ 可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 保存时接口返回 500 | 显示失败和重试；不显示 Saved；输入保留 | UI |
| 2 | 查数据 | 题目数不变 | DB |

**追溯**：异常表 · 闭环 P9

### UC-W01-10 编辑已发布题目生成新版本，旧邀请不变

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_question_published_v1 | FIN-001 | 功能 | P0 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 修改 FIN-001 的 Prompt 并发布 | 生成 v2；v1 标 Superseded，可在 Versions 查看 | UI、DB |
| 2 | 以候选人身份打开使用 v1 的邀请 | 内容仍为 v1 | API |

**追溯**：User Journey 步骤 7 · 闭环 P10 · PRD AC-2、BR-3

### UC-W01-11 停用后不可被新计划选用

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_question_published_v1 | FIN-001 | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 停用 FIN-001 | 状态为 Deprecated，留历史 | DB、记录 |
| 2 | 在计划页 Add from Question Bank | FIN-001 不出现 | UI |
| 3 | 打开已发送的邀请 | 内容不变 | API |

**追溯**：User Journey 步骤 13 · 闭环 P11 · PRD AC-6

### UC-W01-12 ZIP 导入分类预览

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_zip_fin_pack | zip_valid | 功能 | P1 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Import ZIP，上传并 Parse | 预览分列题目 1、材料 2、内部答案 1、旧候选人提交 1；旧提交标为不会外发 | UI |
| 2 | 确认前查数据 | 没有入库 | DB |
| 3 | 勾选确认后导入 | 题目为草稿；材料为公共 FileVersion；Candidate preview 中无内部答案 | DB、API |

**追溯**：User Journey 步骤 10–11 · 闭环 P12 · PRD AC-4 · Brief P02

### UC-W01-13 ZIP 损坏或含宏

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_bank_fin | zip_bad_corrupt、zip_bad_macro | 异常 | P2 | ❌ 未实现 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 分别上传 | 显示具体原因；不导入；宏不执行 | UI、DB、记录 |

**追溯**：异常表 · 闭环 P13–P14 · PRD BR-5

### UC-W01-14 概念题不能邀请

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR / Recruiter | S_bank_fin | FIN-009 | 功能 | P0 | 🟡 部分可测 |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开 FIN-009 详情 / Builder | 显示「Draft the assessment before inviting candidates」 | UI |
| 2 | 在计划页和 Composer 中尝试选用 | 入口禁用，并说明原因 | UI |
| 3 | 直接调用创建邀请接口带 FIN-009 | 返回 4xx | API |

**追溯**：User Journey 步骤 12 · 闭环 P15 · PRD AC-5 · Brief P02（服务端拦截未实现）
