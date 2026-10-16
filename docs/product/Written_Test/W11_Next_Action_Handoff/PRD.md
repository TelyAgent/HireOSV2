# W11 产品文档：下一步决定与交接

| 项 | 内容 |
|---|---|
| 模块 | W11 / 主闭环第 9 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter、Hiring Manager |
| 原型路由 | Release 页 **Next action**、`#/deliveries/:id`（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🟡 后端 `cases/:caseId` 下有 `interview-handoff`、`hold`、`resume`、`close`（passed / rejected / withdrawn）；Interview 交接是对 hireos-interview `screening-handoff` 接口的**同步 HTTP 调用**，不是总线事件，也没有交付包文件。前端无交付页。未逐项验证 AC |
| 依据 | [PRD v1.4 §3、§9、§18.2](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §6、§9](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §5.6、P15、F05、F06、F12](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md)、[Agent 对话流程 §11](../../../../hireos-written/docs/Written_Test_Agent_Conversation_Flow.md) |

## 1. 背景与目标

结果发布后，负责人要决定下一步：修订、补测、进入面试、暂缓或结束测评。交给面试时，如果 L2 之间同步互调、或者报告文件还没准备好就发了交接事件，下游就会拿到不完整或不一致的资料；Interview 未启用时也不应阻断测评结束。

**目标**：负责人从结果页选择下一步，AI 建议不直接推进；内部交接只走总线，交付包文件 ready 后才发轻量事件；外部导出包与内部交接分开；Fail / Hold / 证据不足时也能出具独立报告。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| Next action：Request revision、Add supplemental test、Prepare Interview handoff、Hold、Close testing、岗位转看提案 | 修订 / 补测的执行（W10） |
| AssessmentPackage / AssessmentPlanPackage 内容 | Interview 排期与执行 |
| 内部交接时间线与回执 | Offer 审批与发放 |
| 外部导出（report-only 包） | 自动招聘拒绝 |
| 历史摘要导入（approximate / range、未核验） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | Release 页 Next action 区列出可选动作，并说明「先准备提案，批准后才发送；排序或对比不会触发发送」 |
| FR-2 | **Hold** 暂停 Case，**Resume** 恢复到暂停前状态；暂停期间到达的进度事件更新恢复目标 |
| FR-3 | **Close testing** 选择原因（passed / rejected / withdrawn），Case 进入终态 |
| FR-4 | **Prepare Interview handoff** 预览交付包：当前结果、精确快照、证据、已做案例、反馈披露、未测能力、关键冲突、InterviewFocus |
| FR-5 | 交付页显示目标、包版本和时间线：Result finalized → Preparing shared artifact → File ready → Event queued → Published → Intake received → Imported，每步有来源和时间 |
| FR-6 | 下游未回执时显示 Awaiting confirmation |
| FR-7 | 总线不可用时显示「Handoff queued」，评分结果保持不变 |
| FR-8 | Interview 未启用时说明情况，仍可 **Export report-only package** |
| FR-9 | 交付包文件未 ready（Uploading / Failed）时禁止发事件，Failed 提供重试上传 |
| FR-10 | 岗位转看只生成关联提案，不替换原 Case |
| FR-11 | 只有历史摘要时导入为 approximate / range 并标未核验，不生成有效分数或附件 hash |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | L2 之间只通过总线传递请求、事实和回执；不同步调用 Interview，不借 BFF / Worker 绕行 |
| BR-2 | 先把详细 JSON 产物登记为 Core FileVersion 且 ready，再用 Outbox 发轻量事件；事件不带完整报告 |
| BR-3 | 详细 JSON 含 schema / version / 主档引用 / 证据文件引用 / 授权范围；PDF 只是人读补充 |
| BR-4 | 下游 Inbox 去重；重投或乱序不重复建 Interview intake |
| BR-5 | AI 建议不直接推进；下一步由负责人批准后系统执行发信、排队和提醒 |
| BR-6 | 独立报告在 Fail / Hold / 证据不足时也可出具；招聘与 Offer 决定不由本模块替代 |
| BR-7 | 邮件交付只用于人员通知 / 外部交付 / 人工恢复，不作为同部署主档同步路径 |
| BR-8 | Core 不可用时不能声称已生成 ready 的共享文件 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Result / Release（W08、W09） | |
| 输出 | NextAction / Decision | 动作类型、提案、批准人、执行状态 |
| 输出 | AssessmentPackage | FileVersion ref、内容版本、授权范围、InterviewFocus |
| 输出 | Outbox 事件 | 事件类型、包 ref、幂等键 |
| 输出 | HandoffReceipt | 下游、状态（queued / published / received / imported）、时间 |

## 6. 权限

- 能访问该 Case 的员工可选择下一步；发送到 Interview 前需负责人确认（Agent 规则）。
- 交付包只包含下游有权看到的内容。

## 7. 非功能要求

- 交接幂等：重复点击、重投事件只产生一个 Interview intake。
- 总线停机恢复后 Outbox 自动继续，不需人工重做。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 交付包 Uploading 时不能发事件；Ready 后依次出现 Event queued、Published、Imported | Brief F05 |
| AC-2 | 模拟总线宕机、重投、乱序：Outbox pending，结果不变；下游不重复建 intake | G、Brief F06 |
| AC-3 | Interview 未启用时仍可导出 report-only 包 | Brief P15、F12 |
| AC-4 | 下游无回执时显示 Awaiting confirmation | Brief P15 |
| AC-5 | Hold 后 Resume 回到暂停前状态；Close 后 Case 为终态，Task 完成 | PRD §9 |
| AC-6 | 结果为 Fail / 证据不足时也能出具独立报告 | PRD §9 |

## 9. 依赖与实现

- 后端：`src/cases`（`case-lifecycle.service.ts` 的 `hold`、`resume`、`close`、`handoffToInterview`）。
- 前端：需新建交付页；`ReleasePage` 的 Next action。
- 依赖：W09、Core File、事件总线（Redis Streams）。下游 Interview。

## 10. 待确认

1. 现有 Interview 交接是同步 HTTP 调用（`INTERVIEW_BASE_URL/screening-handoff`），PRD 要求只走总线。总线未建成前是否保留同步调用作为过渡？如改造，Interview 接收方需同一 PR 修改。
2. Close testing 的三个原因（passed / rejected / withdrawn）是否需要通知候选人；rejected 是否与「不自动拒绝」规则冲突（这里是人工决定）。
3. 交付包导出格式（JSON + PDF）和保留期限。
