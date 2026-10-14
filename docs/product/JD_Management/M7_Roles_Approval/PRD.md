# M7 产品文档：角色权限与审批

| 项 | 内容 |
|---|---|
| 模块 / 优先级 | M7 / P0 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Recruiter / TA、Hiring Manager、HR Approver、Viewer |
| 同目录文档 | [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 实现现状 | ❌ 审批流程和按角色的服务端权限都未实现；开发态只有一个固定身份（roles=admin/hr/interviewer）；Confidential 目前只在前端隐藏 |
| 依据 | 2026-10-14 用户决定（四角色、恢复审批）；[User Journeys v1.0 §2、§B6](../HireOS_Command_JD_Management_User_Journeys_v1.0.md)；[PRD v1.3 §6.2、§9](../HireOS_Command_JD_Management_PRD_v1.3.md)；[Interface Spec v1.3 §5.2–5.3](../HireOS_Command_JD_Management_Interface_Spec_v1.3.md) |

> 2026-10-14 用户决定：采用四个角色，并恢复审批流程。这替代了 [#15](https://github.com/JsonSuCoder/HireOSV2/issues/15) 的三档权限和 [#9](https://github.com/JsonSuCoder/HireOSV2/issues/9) 中“去掉审批”的部分（#9 的 Owner = 创建者保留）。该决定尚未回写到 GitHub。

## 1. 背景与目标

不同角色登录后的目的不同：Recruiter 推动 JD 完成，Hiring Manager 确认业务内容，HR Approver 决定能否发布，Viewer 只阅读。同一个职位页面不能让所有人看到相同信息和按钮；审批结论必须由人作出，并绑定精确版本。

**目标**：每个角色只看到、只能做职责内的事情，并由服务端保证；发布前必须经过 HR Approver 批准。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 四个角色的可见内容和可执行操作 | 激活到 Core role version（PRD §5.4，暂不做） |
| 提交审批、批准、退回、拒绝 | 审批转派、代理（暂不做） |
| 审批中修改内容使旧审批作废 | 下游影响复核 |
| 审批超时提醒 | 工作区成员的增删（另行定义） |
| restricted / Confidential 的服务端过滤 | |

## 3. 角色与权限

| 角色 | 登录后的主要目的 | 核心操作 | 默认限制 |
|---|---|---|---|
| Recruiter / TA | 将招聘需求整理成合格 JD，协调协作者并推动审批/交付 | 创建职位、补全字段、应用 AI 建议、保存草稿、提交审批、追踪发布 | 不能替审批人作出审批结论，不能绕过阻断项提交或发布 |
| Hiring Manager | 说明为什么招、招什么人、成功标准和团队上下文，并确认业务取舍 | 回答追问、编辑授权字段、解决冲突、确认岗位内容、参与审批 | 不能修改未授权预算/敏感字段，不能自动替代 HR 或审批政策发布 |
| HR Approver | 确认内容、预算、风险和流程前置条件已经处理 | 查看候选版本、差异、风险和影响，批准、退回或拒绝 | 不能把 AI 建议当成人工决策；无权限时不能查看 restricted 字段 |
| Viewer | 阅读获授权的 JD、分析结论和当前有效版本 | 查看职位、来源、版本和授权的 Agent 结论 | 不能应用修改、保存、提交审批、发布或查看敏感字段 |

## 4. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 职位页面按当前角色显示或禁用操作；无权操作不显示伪按钮 |
| FR-2 | Recruiter 在 Ready 状态下可以提交审批；提交时冻结候选版本（内容哈希），显示审批人 |
| FR-3 | HR Approver 从“待我审批”进入候选版本，看到内容、与上一版的差异、风险、可见范围 |
| FR-4 | HR Approver 可以批准、退回或拒绝；退回和拒绝必须填写理由 |
| FR-5 | 审批进行中修改内容，旧审批请求作废（superseded），需要重新提交 |
| FR-6 | 审批超时时提醒审批人（时长和超时行为待确认） |
| FR-7 | Hiring Manager 可以修改授权字段（职责、成功标准等）；预算和敏感字段只读 |
| FR-8 | Viewer 只读；看不到 Confidential 和敏感字段 |

## 5. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 权限在每次请求时由服务端重新校验；前端隐藏不能替代服务端控制 |
| BR-2 | 无权角色读取职位时，接口响应中不含 Confidential / restricted 正文 |
| BR-3 | 无权角色调用写接口返回 403 |
| BR-4 | 提交审批前必须 Ready（M6）；有阻断项时服务端拒绝 |
| BR-5 | 提交者不能批准自己提交的版本 |
| BR-6 | 审批决定记录人工审批人、精确版本（哈希）、时间和理由；AI 不能作为审批人 |
| BR-7 | 审批决定只对冻结的版本有效；内容变化后旧批准不适用 |
| BR-8 | 批准不等于发布；发布在 M8 由 Recruiter 执行，且引用已批准的版本 |
| BR-9 | 角色变更后，下一次请求立即按新角色生效；撤销权限后不再展示缓存的敏感内容 |

## 6. 状态

审批状态：not_submitted → pending → approved / changes_requested / rejected；pending → superseded（审批中修改）/ cancelled（撤回）。

## 7. 数据

| 对象 | 关键字段 |
|---|---|
| 角色分配 | user、role、scope（工作区 / 职位，待确认）、分配人、时间 |
| 审批请求 | request_id、job_id、候选版本哈希、提交人、提交时间、状态、审批人 |
| 审批决定 | decision_id、request_id、审批人（人工）、action、理由、时间、版本哈希 |
| 审计 | 谁、对哪个版本、做了什么、何时、结果 |

## 8. 非功能要求

- 安全：权限类测试必须在 API 层验证，不只看页面。
- 审批提醒的发送时间与审批人时区相关（待确认）。

## 9. 验收标准

| ID | 验收 | 对应闭环路径 |
|---|---|---|
| AC-1 | Recruiter 有阻断项时不能提交；Ready 时提交生成冻结的候选版本 | P1、P2 |
| AC-2 | Recruiter 不能批准自己提交的版本 | P3 |
| AC-3 | Hiring Manager 改授权字段成功、改预算被拒绝（含 API） | P4、P5 |
| AC-4 | HR Approver 批准记录完整；退回 / 拒绝必须有理由 | P6–P8 |
| AC-5 | 审批中修改内容，旧请求作废，旧决定被拒绝 | P9 |
| AC-6 | Viewer 只读，响应不含敏感正文，写接口 403 | P10、P11 |
| AC-7 | 角色变更立即生效 | P12 |

## 10. 依赖与实现

- 需要新增：角色分配、审批请求 / 决定的数据模型（Prisma 迁移）、审批接口（Interface Spec §8 建议 `POST /jd/v1/jobs/{id}/approval-requests`、`POST /jd/v1/approval-requests/{id}/decisions`）、服务端字段过滤。
- 需要多身份测试账号（线上问题 F-004）。
- 登录：#16 邮箱验证码。

## 11. 待确认

1. 审批超时：24 小时还是 48 小时；超时后提醒、升级还是自动生效。
2. 审批步骤：只有 HR Approver 一步，还是 Hiring Manager → HR 两步（PRD §6.2 默认两步）。
3. 角色由谁、在哪里分配；作用范围是工作区还是单个职位；一个人能否有多个角色。
4. Hiring Manager 的“授权字段”清单。
5. Viewer 能否评论。
6. 岗位库是否恢复审批状态列（#9 已去掉）。
