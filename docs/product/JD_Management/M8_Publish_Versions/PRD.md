# M8 产品文档：发布与版本管理

| 项 | 内容 |
|---|---|
| 模块 / 优先级 | M8 / P0 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Recruiter / TA（发布）；HR Approver（发布前审批，见 M7） |
| 同目录文档 | [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 实现现状 | 🟡 后端已有 versions、publish 接口，职位状态只有 draft ↔ published；线上没有发布渠道（F-005），版本对比和恢复未验证（F-013）；审批未实现 |
| 依据 | [测试脚本 v0.1 J8](../HireOS_Command_JD_Management_User_Journeys_v0.1.md)、[完整性标准 v0.1 I2、I6、V2](../HireOS_Command_JD_Completeness_Standard_v0.1.md)、[PRD v1.3 §4.3、§6.3、§9](../HireOS_Command_JD_Management_PRD_v1.3.md)、[Interface Spec v1.3 §7.2](../HireOS_Command_JD_Management_Interface_Spec_v1.3.md) |

## 1. 背景与目标

已批准的 JD 需要发布出去；之后的修改要能追溯、对比，必要时回到旧版本。对外只能出现可公开的内容。

**目标**：每次发布生成不可变的新版本，对外只含 Public 内容；历史可追溯、可对比、可恢复。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 发布窗口、生成新版本、JD 唯一 ID | 第三方招聘渠道适配器（线上暂无渠道） |
| 未发布修改提示 | 邮件发送 JD |
| 版本历史、两版对比、恢复旧版本 | 暂停、关闭、归档（建议的 M11） |
| 渠道发布状态与撤回（有测试渠道时） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | Publish 按钮仅在 Ready 且已获 HR Approver 批准时可用 |
| FR-2 | 发布窗口显示 JD 唯一 ID（`JD-年份-编号`）、新版本号、可选版本说明、渠道选择，并说明只有 Public 块会对外 |
| FR-3 | 确认后生成新版本；页头版本徽章更新；活动记录新增一条 |
| FR-4 | 发布后修改内容，页头显示 `Unpublished changes`；对外仍是旧版本 |
| FR-5 | 再次发布时，窗口列出相对上一版的变更 |
| FR-6 | 版本页可以对比任意两个版本：新增、删除、修改、可见范围变化 |
| FR-7 | 恢复旧版本：草稿回到旧版内容，历史版本保留，新增一条恢复记录 |
| FR-8 | 有渠道时：每个渠道独立记录状态；超时或无回执时显示结果未知，主操作是查询状态 |
| FR-9 | 撤回渠道发布，记录撤回时间 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 已发布的版本内容不可修改 |
| BR-2 | 对外内容只包含 Public 块；Internal 和 Confidential 不出现在对外页面、导出或渠道中 |
| BR-3 | 发布引用精确的已批准版本，不引用“最新版” |
| BR-4 | 发布后修改内容需重新提交审批，批准后才能再次发布 |
| BR-5 | 恢复旧版本不删除任何历史，恢复结果作为新草稿，需重新审批后发布 |
| BR-6 | 双击 Publish 只生成一个版本（幂等） |
| BR-7 | 渠道结果未知时不默认重发，先查询 |
| BR-8 | 服务端再次校验门禁，不合格或未批准的发布请求被拒绝 |

## 5. 数据

| 对象 | 关键字段 |
|---|---|
| JD 唯一 ID | `JD-年份-编号`，每个职位一个 |
| JobDocumentVersion | 版本号、内容哈希、发布人、时间、说明、对应审批决定 |
| 发布记录 | 渠道、状态（not_published / publishing / published / failed / outcome_unknown / withdrawal_pending / withdrawn）、外部 ID（真实返回时） |
| Core Job | status：draft → published（Core 为 open） |
| 活动记录 | 发布、恢复、撤回 |

## 6. 权限

| 角色 | 能做 |
|---|---|
| Recruiter / TA | 发布已批准版本、查看版本、对比、恢复（恢复后需重新审批） |
| Hiring Manager | 查看版本和对比；不能发布 |
| HR Approver | 审批（M7）；查看版本 |
| Viewer | 只看当前有效版本 |

## 7. 非功能要求

- 测试只用测试渠道，发布后立即撤回（测试脚本 v0.1 §1.2）。

## 8. 验收标准

| ID | 验收 | 对应闭环路径 |
|---|---|---|
| AC-1 | 未批准或未 Ready 时不能发布，服务端也拒绝 | P1、P2 |
| AC-2 | 发布生成新版本，窗口信息完整 | P3 |
| AC-3 | 对外只含 Public 内容 | P4 |
| AC-4 | 修改后显示 Unpublished changes，对外不变 | P5 |
| AC-5 | 两版对比正确；恢复不删历史 | P6、P7 |
| AC-6 | 双击只生成一个版本 | P8 |
| AC-7 | 渠道超时显示结果未知 | P9 |

## 9. 依赖与实现

- 后端：`GET jobs/:jobId/versions`、`POST jobs/:jobId/publish`、`PATCH jobs/:id/status`（draft / published）。
- 依赖 M7 的审批结果。
- 发布渠道（线上暂无）。

## 10. 待确认

1. 测试渠道是哪个，如何控制对外影响。
2. 后端是否已有恢复接口。
3. 恢复旧版本后是否必须重新审批（本文按必须处理）。
4. 内容未变、只改版本说明时是否允许发布。
