# M7 User Cases：角色权限与审批

| 项 | 内容 |
|---|---|
| 模块 | M7 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 同目录文档 | [产品文档](PRD.md) · [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 用途 | 按 User Journey 整理的功能测试用例；每条用例可以单独执行 |
| 用例数 | 15 |

## 1. 使用说明

- **前置数据**：Seed 名称的定义见 [模块索引 README](../README_Modules.md#seed前置状态目录)；每条用例用 seed 直接造出前置数据，不依赖其他用例先执行（标注“接 UC-xx”的除外）。
- **测试数据**：名称与 [Loop_IO.md](Loop_IO.md) 第 2 节一致。
- **检查位置**：UI 页面 / API 接口响应 / DB 持久化数据 / 记录（AiRun、活动、审计、日志）/ 外部（对外页面、mock 服务）。权限和安全类用例必须检查 API，不能只看 UI。
- **AI 输出**：按判定条件检查，不比对固定文字；AI 质量类用例同一输入至少跑 2 次。
- **状态**：✅ 可测；🟡 部分可测（部分步骤依赖未实现功能）；❌ 未实现（用例照写，执行时标记 known gap，不算通过）。
- **注入**：double_click、network_down、llm_fail 等注入点的含义见 [模块索引 README](../README_Modules.md#注入点j10-横切套件)。

## 2. 用例总览

| ID | 标题 | 类型 | 优先级 | 状态 | User Journey | 闭环路径 | 验收标准 |
|---|---|---|---|---|---|---|---|
| UC-M7-01 | 未 Ready 不能提交审批 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 2 | P1 | AC-1 |
| UC-M7-02 | 提交审批并冻结版本 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 3 | P2 | AC-1 |
| UC-M7-03 | 提交者不能批准自己的版本 | 权限 | P0 | ❌ 未实现（known gap） | 步骤 3 | P3 | AC-2 |
| UC-M7-04 | Hiring Manager 修改授权字段 | 权限 | P0 | ❌ 未实现（known gap） | 步骤 4 | P4 | AC-3 |
| UC-M7-05 | Hiring Manager 不能修改预算 | 权限 / 安全 | P0 | ❌ 未实现（known gap） | 步骤 5 | P5 | AC-3 |
| UC-M7-06 | HR Approver 查看候选版本并批准 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 6、8 | P6 | AC-4 |
| UC-M7-07 | 退回 / 拒绝必须填写理由 | 边界 | P0 | ❌ 未实现（known gap） | 步骤 7 | P7 | AC-4 |
| UC-M7-08 | 退回 / 拒绝带理由 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 7 | P8 | AC-4 |
| UC-M7-09 | 审批进行中修改内容 | 功能 | P0 | ❌ 未实现（known gap） | 步骤 13 | P9 | AC-5 |
| UC-M7-10 | Viewer 只读 | 权限 | P0 | ❌ 未实现（known gap） | 步骤 10 | P10 | AC-6 |
| UC-M7-11 | Viewer 接口层隔离 | 安全 | P0 | ❌ 未实现（known gap） | 步骤 11–12 | P10、P11 | AC-6 |
| UC-M7-12 | 角色变更立即生效 | 权限 | P1 | ❌ 未实现（known gap） | 禁止副作用 | P12 | AC-7 |
| UC-M7-13 | 无 restricted 权限的审批人 | 安全 | P1 | ❌ 未实现（known gap） | 步骤 9 | P13 | AC-6 |
| UC-M7-14 | 双击提交只生成一个审批请求 | 幂等 | P1 | ❌ 未实现（known gap） | — | P14 | AC-1 |
| UC-M7-15 | 审批超时提醒 | 功能 | P2 | ❌ 未实现（known gap） | 步骤 14 | （待补 P15） | — |

## 3. 用例详情

### UC-M7-01 未 Ready 不能提交审批

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Recruiter / TA | S_job_incomplete | — | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点击提交审批 | 按钮不可用并说明原因 | UI |
| 2 | 直接调用提交接口 | 返回 422 | API |

**追溯**：User Journey 步骤 2 · 闭环 P1 · PRD AC-1

### UC-M7-02 提交审批并冻结版本

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Recruiter / TA | S_job_ready_with_confidential | — | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 点击提交审批 | 显示审批人和被冻结的版本 | UI |
| 2 | 查询审批请求 | status=pending；记录候选版本哈希、提交人、时间 | API / DB |

**追溯**：User Journey 步骤 3 · 闭环 P2 · PRD AC-1

### UC-M7-03 提交者不能批准自己的版本

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Recruiter / TA | 接 UC-02 | — | 权限 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | Recruiter 调用审批决定接口批准自己的请求 | 返回 403；请求仍为 pending | API |

**追溯**：User Journey 步骤 3 · 闭环 P3 · PRD AC-2

### UC-M7-04 Hiring Manager 修改授权字段

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_job_ready_with_confidential | hm_allowed_fields（职责） | 权限 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 修改职责并保存 | 保存成功 | UI |
| 2 | 查询修改记录 | 记录修改人和时间 | DB / 记录 |

**追溯**：User Journey 步骤 4 · 闭环 P4 · PRD AC-3

### UC-M7-05 Hiring Manager 不能修改预算

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Hiring Manager | S_job_ready_with_confidential | hm_denied_fields（内部预算） | 权限 / 安全 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 尝试编辑预算字段 | 字段只读 | UI |
| 2 | 直接调用接口修改预算 | 返回 403；值不变 | API / DB |

**追溯**：User Journey 步骤 5 · 闭环 P5 · PRD AC-3

### UC-M7-06 HR Approver 查看候选版本并批准

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR Approver | 接 UC-02 | approve | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 从待我审批进入候选版本 | 显示内容、与上一版的差异、风险、可见范围 | UI |
| 2 | 点击批准 | status=approved；决定记录人工审批人、版本哈希、时间 | API / DB |

**追溯**：User Journey 步骤 6、8 · 闭环 P6 · PRD AC-4

### UC-M7-07 退回 / 拒绝必须填写理由

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR Approver | 接 UC-02 | changes_no_reason、reject_no_reason | 边界 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 不填理由点击退回、拒绝 | 不能提交，提示必须填写理由；请求仍为 pending | UI / API |

**追溯**：User Journey 步骤 7 · 闭环 P7 · PRD AC-4

### UC-M7-08 退回 / 拒绝带理由

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR Approver | 接 UC-02 | changes_with_reason、reject_with_reason | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 填写理由并退回（或拒绝） | status=changes_requested（或 rejected），记录理由 | API / DB |
| 2 | Recruiter 打开职位 | 看到退回理由，可以修改后重新提交 | UI |

**追溯**：User Journey 步骤 7 · 闭环 P8 · PRD AC-4

### UC-M7-09 审批进行中修改内容

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Recruiter / TA | 接 UC-02 | — | 功能 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 请求 pending 时 Recruiter 修改正文 | 旧请求 status=superseded；提示需要重新提交 | UI / DB |
| 2 | HR Approver 对旧请求作出决定 | 被拒绝（409 或 422） | API |

**追溯**：User Journey 步骤 13 · 闭环 P9 · PRD AC-5

### UC-M7-10 Viewer 只读

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Viewer | S_job_ready_with_confidential | — | 权限 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开职位 | 只读；没有编辑类按钮；看不到 Confidential 和敏感字段 | UI |

**追溯**：User Journey 步骤 10 · 闭环 P10 · PRD AC-6

### UC-M7-11 Viewer 接口层隔离

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Viewer | S_job_ready_with_confidential | — | 安全 | P0 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 读取职位接口 | 响应中不含 Confidential 正文 | API |
| 2 | 调用编辑、保存、提交审批、发布接口 | 全部返回 403；数据无变化 | API / DB |

**追溯**：User Journey 步骤 11–12 · 闭环 P10、P11 · PRD AC-6

**备注**：线上问题 F-015

### UC-M7-12 角色变更立即生效

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| 管理员 + Viewer | S_job_ready_with_confidential | — | 权限 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 把 viewer_a 改为 Recruiter，viewer_a 再次请求 | 立即可以编辑 | API |
| 2 | 改回 Viewer，viewer_a 再次请求 | 立即返回 403；页面不再展示缓存的敏感内容 | API / UI |

**追溯**：User Journey 禁止副作用 · 闭环 P12 · PRD AC-7

**备注**：角色分配入口待确认

### UC-M7-13 无 restricted 权限的审批人

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR Approver | 含 restricted 字段的候选版本 | approver_no_restricted | 安全 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 打开候选版本 | restricted 字段不可见 | UI |
| 2 | 查看接口响应 | 不含 restricted 值 | API |

**追溯**：User Journey 步骤 9 · 闭环 P13 · PRD AC-6

### UC-M7-14 双击提交只生成一个审批请求

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| Recruiter / TA | S_job_ready_with_confidential | 注入 double_click | 幂等 | P1 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 快速双击提交审批 | 只有 1 个 pending 请求 | API |

**追溯**：User Journey — · 闭环 P14 · PRD AC-1

### UC-M7-15 审批超时提醒

| 角色 | 前置数据 | 测试数据 | 类型 | 优先级 | 状态 |
|---|---|---|---|---|---|
| HR Approver | 接 UC-02 | 时钟快进到超时 | 功能 | P2 | ❌ 未实现（known gap） |

| # | 操作 | 预期结果 | 检查位置 |
|---|---|---|---|
| 1 | 等待超时（时钟控制） | 按规则提醒审批人 | 记录 |
| 2 | 查询审批请求 | 状态按超时规则变化（待确认：提醒 / 升级 / 自动生效） | API |

**追溯**：User Journey 步骤 14 · 闭环 （待补 P15） · PRD —

**备注**：超时时长和行为待确认

## 4. 验收标准覆盖

| PRD 验收标准 | 覆盖用例 |
|---|---|
| AC-1 | UC-M7-01、UC-M7-02、UC-M7-14 |
| AC-2 | UC-M7-03 |
| AC-3 | UC-M7-04、UC-M7-05 |
| AC-4 | UC-M7-06、UC-M7-07、UC-M7-08 |
| AC-5 | UC-M7-09 |
| AC-6 | UC-M7-10、UC-M7-11、UC-M7-13 |
| AC-7 | UC-M7-12 |

## 5. 统计

| 维度 | 分布 |
|---|---|
| 类型 | 功能 6、权限 4、权限 / 安全 1、边界 1、安全 2、幂等 1 |
| 优先级 | P0 11、P1 3、P2 1 |
| 状态 | ❌ 未实现（known gap） 15 |
