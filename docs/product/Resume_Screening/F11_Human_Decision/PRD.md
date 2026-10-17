# F11 产品文档：人工决定与例外审批

| 项 | 内容 |
|---|---|
| 模块 | F11 / 主流程第 11 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | 岗位配置的筛选负责人（Recruiter / TA 或 Hiring Manager）；例外审批需 Hiring Manager + HR Approver |
| 原型路由 | `#/applications/:id/decision`（[原型 v2](../../../design/Resume_Screening/HireOS-Resume-Screening-Prototype-v2.html)） |
| 同目录文档 | [输入输出闭环](Loop_IO.md) · [User Journey](User_Journey.md) · [User Cases](User_Cases.md) |
| 实现现状 | 🟡 后端 `decisions`：决定结果 strong_advance / advance / hold / do_not_advance / request_information，下一步 record_only / send_assessment / move_to_interview；**例外审批把 HR 和 HM 两条批准写成同一操作人**（见 #20）；**未见 Assign Review 和批量决定**。前端 `DecisionPage`。#27 反馈决策页把顾虑压缩为数字。未逐项验证 AC |
| 依据 | [PRD v1.3 §2、§4.3、§6.1、§7](../../../../hireos-screening/docs/Resume_Screening_PRD_v1.3.md)、[用户旅程 v0.2 J6](../../user-journeys/Resume_Screening_User_Journeys_v0.2.md) |

## 1. 背景与目标

推进、暂缓或不推进候选人，是招聘流程中影响最大的动作。AI 只能给建议，最终必须由有权限的人显式提交；决定要绑定当时的评估版本，避免基于过期信息推进。

**目标**：所有决定都由有权限的人显式提交、绑定评估版本并留痕；AI 建议不预选、不自动执行；拒绝与拒绝通知是两个独立动作；越过岗位底线需要双人批准。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 单人决定、批量决定 | 生成交接包和投递（F12） |
| 下一步选择（笔试、面试、补资料、仅记录） | 候选人通知的发送通道（通知，功能拆分 F14） |
| 例外审批、双人确认 | 执行笔试、面试 |
| 过期检测、并发控制 | Offer 审批 |
| 撤销决定与更正 | |
| 拒绝通知（单独确认后触发） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 决定选项：Strong Advance、Advance、Hold、Reject（不予推进）、Request Information、Assign Review；推进类可选下一步：Send Assessment、Move to Interview、仅记录 |
| FR-2 | 决定页显示 AI 建议作为参考，**不预选**任何选项 |
| FR-3 | 决定页完整展示未解决的 concern（不只是数量），以及待核实项 |
| FR-4 | 提交时必须填写理由；表单有字段级校验，错误提示在对应字段旁 |
| FR-5 | 提交后记录决定人与时间；同岗位的其他负责人能看到同样的记录 |
| FR-6 | 所有正式决定（包括 Hold、Reject、Request Information、仅记录）必须绑定当前已完成评估；缺失、过期或未完成时阻止提交，要求重评后重新确认，不允许旧依据绕过（2026-10-17 Owner 确认，#215） |
| FR-7 | 越过岗位明确底线的推进（例如 not_eligible 仍要推进）进入例外审批，由负责人发起，需要 Hiring Manager（HM 方）和 HR Approver（HR 方）两个不同的人批准；发起人不能批准自己发起的例外 |
| FR-8 | 岗位可配置普通决定也需要双人确认；所有批准绑定同一决定版本 |
| FR-9 | Reject 提交后出现 **Send candidate decline notice**，不会自动发送；点击后先预览、再确认 |
| FR-10 | 批量决定：先列出精确的候选人清单、当前版本、动作、理由和例外，确认后逐项提交，显示逐项结果；部分失败可以重试 |
| FR-11 | 已交接的决定可以撤销，撤销后向下游发送更正 |
| FR-12 | 下一步需要他人批准时，显示为待审批提案，而不是已推进 |
| FR-13 | 跳过工作流明确要求的笔试，需要有效例外；未安装 Assessment 或笔试为 optional / not_required 时，不生成虚假豁免 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | AI 建议不能自动触发推进、拒绝或通知；Send Assessment、Move to Interview 是显式交接请求 |
| BR-2 | 决定绑定 evaluation 和输入版本 |
| BR-3 | 提交携带页面所见评估 ID、版本及最后决定 ID；版本改变或他人/不同内容提交返回冲突并保留输入。同一人、同内容、同评估版本精确重试返回原决定及 replayed=true，不重放任务/审计/交接副作用。撤回后的旧页面不能重建决定，必须刷新确认（2026-10-17 Owner 确认，#216） |
| BR-4 | HR 或 HM 都可以作为主筛选人，权限由岗位配置决定，不按角色名称默认 |
| BR-5 | 例外推进默认需要 Hiring Manager 与 HR Approver 两个不同人员的有效批准；同一人不能同时充当两个批准人，发起人不能批准 |
| BR-6 | Hold 不关闭补资料任务；Reject 后取消未执行的推进和提醒 |
| BR-7 | 撤销已交接的决定只向下游发更正通知，不直接取消下游已执行的笔试或面试 |
| BR-8 | Hold / Reject 也可以形成筛选报告 |
| BR-9 | 改分生成 HumanAssessment，不覆盖 AI 分数（见 F08） |
| BR-10 | 推进决定完成「简历筛选复核」和「下一步处理」任务；任务只在业务写入成功后完成 |
| BR-11 | 拒绝通知不包含内部评语和排序 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | ScreeningEvaluation | 版本、建议、过期状态 |
| 输出 | ScreeningDecision | 结果、下一步、理由、决定人、时间、绑定的评估版本、expected_version、状态 |
| 输出 | DecisionExceptionApproval | 角色、批准人、理由、时间、绑定的决定版本 |
| 输出 | FeedbackEvent | 供偏好学习使用的操作事实 |
| 输出 | WorkflowTransition | 交给 F12 的推进请求 |

## 6. 权限

- 只有岗位配置的负责人能提交决定；操作时重新校验权限。
- 例外审批的两个批准人必须分别是 Hiring Manager 和 HR Approver；Viewer 不能提交决定。

## 7. 非功能要求

- 双击提交只生效一次。
- 提交失败时提示出现在操作附近，已填写的内容不丢失。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | AI 建议推进、人工选 Hold：只保存 Hold，不创建推进请求 | SCR-05 |
| AC-2 | JD 更新后旧评估标 stale，不能直接推进；新评估经人工确认后才能交接 | SCR-07 |
| AC-3 | 跳过明确要求的笔试需要有效例外；optional / not_required 时不虚造测评结果 | SCR-18 |
| AC-4 | 决定页不预选 AI 建议；Reject 与发拒绝通知分开，都需要人工确认 | J6-8～11 |
| AC-5 | 例外审批需要 Hiring Manager 和 HR Approver 两个不同的人批准；发起人批准、同一人重复批准都被拒绝 | PRD §2、#20 |
| AC-6 | 并发提交时第二个人看到已有决定，不覆盖 | PRD §6.1 |
| AC-7 | 批量决定先展示精确清单，逐项提交，部分失败可恢复 | PRD §7 |
| AC-8 | 决定页完整展示未解决的顾虑 | #27 |

## 9. 依赖与实现

- 后端：`src/decisions`（`decisions.service.ts`、`interview-handoff-dispatcher.service.ts`）。
- 前端：`DecisionPage`。
- 依赖：F08，可从 F09 / F10 进入；权限依赖功能拆分 F19。下游 F12，偏好学习（功能拆分 F16）。
- 相关 Issue：#20、#26、#27。

## 10. 待确认

1. Assign Review 是决定的一种，还是任务转派（F13）的入口。
2. 岗位配置「普通决定也需双人确认」的入口位置。
3. 已确认（2026-10-17，#215）：不允许使用旧依据；所有正式决定要求当前已完成评估。
4. 拒绝通知的模板和发送通道。

## 11. 决定提交契约（#215 / #216）

`POST /api/applications/:id/decisions` 除原有结果、理由、下一步外，必须包含：

- `expectedEvaluationId`：用户确认的评估 ID。
- `expectedEvaluationVersion`：该评估正整数版本。
- `expectedDecisionId`：页面所见最后决定 ID；没有历史决定时显式传 `null`。撤回后重新加载最新记录再确认。

缺失前置条件返回 400 `DECISION_PRECONDITION_REQUIRED`；没有当前已完成评估返回 409 `CURRENT_EVALUATION_REQUIRED`；评估变化返回 409 `EVALUATION_VERSION_CONFLICT`；决定冲突返回 409 `DECISION_CONFLICT` 和已有决定引用（不存在时 null）。拒绝路径不写业务副作用。

同人同内容同评估版本、仍有效的已提交决定可重放返回（`replayed=true`），仅读取历史结果，不重新批准或再次完成任务；新的创建返回 `replayed=false`。已撤回的决定不能重放为成功。

返回的决定包含 `evaluationId`、`evaluationVersion`、`evaluationCompletedAt`；从决定绑定的评估读取，不冒用当前评估。历史未绑定或缺失的字段返回 null，页面显示“未记录”。不回填历史决定。

部署时同时更新前后端；旧客户端缺少前置条件会明确失败，刷新页面后重试。无新增数据库迁移。回滚至旧后端会失去新增门禁，不能仅回滚前端来绕过检查。身份、例外审批、通知和其他待确认项未在这两项中扩展。
