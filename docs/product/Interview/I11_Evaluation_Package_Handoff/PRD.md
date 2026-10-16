# I11 产品文档：评估包与 Offer 交接

| 项 | 内容 |
|---|---|
| 模块 | I11 / 主闭环第 11 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter |
| 原型页面 | 项目页 `Evaluation Package` 标签（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 后端 `GET tasks/:id/package` 返回决定、双方确认时间、是否已发布和 Offer 状态；`POST tasks/:id/package/offer` 要求决定为 recommend_offer 且双方已确认，然后把 `offerState` 置为 sent（本地状态，**没有真实 Offer 模块**，没有 ACK、失败重试、版本顺序）。导出 PDF、证据清单、包版本、失效标记未实现。前端 `PackagePage` 已接接口。未逐项验证 AC |
| 依据 | [PRD v1.5 §3.3、§3.5、§8.7.5、§10、§6 INT-11、INT-12、§12](../HireOS_Command_Interview_PRD_v1.5.md) |

## 1. 背景与目标

Offer 模块需要一份可靠的面试评估结论作为输入，但不需要、也不应该拿到全部录音和内部笔记。交接如果重复、乱序或静默失败，会导致 Offer 基于错误版本决策。

**目标**：双方确认后生成版本化的 Hiring Evaluation Package，可查看和导出；连接 Offer 时按版本可靠交接，有接收确认和失败重试；上游数据变化时标记失效。独立模式下只需查看和导出。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 包内容：岗位与 Rubric 版本、逐项评分与理由、证据清单（Evidence manifest）、交接限制（Handoff limitations）、人工复核（双方确认）、建议下一步 | Offer 的预算、HC、薪酬、审批、发放 |
| 包版本；预览（未确认时标明 unconfirmed） | 下载通道和下载历史（I13） |
| 导出 PDF（浅色打印样式） | |
| Offer 交接：发送、接收确认（ACK）、失败、重试 | |
| 失效：JD 更新、数据撤回、录制授权撤回 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 决定未记录或双方未确认时，包显示「still in review」，可以预览（标 unconfirmed），不能发布或交接 |
| FR-2 | 补证轮未完成时，包保持阻塞并说明原因 |
| FR-3 | 包头部显示「Hiring Evaluation Package · Version n」、岗位、候选人、生成时间 |
| FR-4 | Evidence manifest 列出每项能力的结论和证据引用（受控引用，不是全文） |
| FR-5 | Handoff limitations 说明：「Full recordings, transcripts and internal notes are not included by default — Offer receives structured summaries and controlled references only.」，以及已声明的限制（如证据来源是手工记录、例外） |
| FR-6 | Human review 显示 HR 和 HM 的确认人、时间和意见 |
| FR-7 | Recommended next action 显示决定，并说明 Recommend for offer 只表示「ready for Offer's review」 |
| FR-8 | `⬇ Export PDF` 导出包含 Rubric、分数、证据链接和双方确认的 PDF；导出生成与下载状态分开（I13） |
| FR-9 | Offer handoff status：未发送 / 发送中 / 已接收（ACK）/ 失败；失败时说明「Nothing was partially sent — retry any time」，提供重试 |
| FR-10 | 已接收后再次发送提示「Already sent and acknowledged by the Offer module.」 |
| FR-11 | JD 更新或上游数据撤回后，包标记需复核，已交接的版本通知 Offer 为失效或受限 |
| FR-12 | 修订后生成新版本；旧版本保留只读，不能覆盖新版本 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 生成或发送评估包 ≠ 批准或发放 Offer |
| BR-2 | 同一包版本 Offer 只接收一次；乱序到达时旧版本不能覆盖新版本 |
| BR-3 | 交接失败可重试，不产生部分发送 |
| BR-4 | Offer 接收确认后，工作流才推进 Application；接收失败保留可重试状态 |
| BR-5 | 默认只交付必要的评估和受控证据引用，不复制全部录音、转写或内部笔记 |
| BR-6 | 导出文档使用适合阅读和打印的浅色样式，不受个人暗色偏好影响 |
| BR-7 | 包内容和结论归 Interview；文件模块只保存产物引用并提供下载 |
| BR-8 | 首页「Evaluation packages completed — last 30 days」按项目计，修订和重发不重复累计 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Decision、确认记录、RequirementEvaluation、EvidenceLink | |
| 输出 | HiringEvaluationPackage | 包 ID、版本、项目、Rubric 版本、内容快照、生成时间、状态（in_review / published / invalidated） |
| 输出 | ExportArtifactRef | 产物 ID / 版本、格式、生成状态 |
| 输出 | Offer 交接记录 | 包版本、尝试次数、状态（sent / acked / failed）、失败原因、幂等键 |

## 6. 权限

- HR / Recruiter：发布、导出、交接、重试。
- Hiring Manager：查看、导出。
- Interviewer：不能查看（待确认）。
- Offer 模块只能读取交接的包版本和受控引用。

## 7. 非功能要求

- 交接幂等：重复事件不产生重复包或 Offer。
- 导出失败与下载失败分开显示。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | JD-only → 计划 → 面试 → 证据 → 反馈 → Debrief → 双方确认 → 包导出，独立闭环可以走通 | §12 独立闭环 |
| AC-2 | 模拟首次交接超时：显示失败且未部分发送；重试后状态为已接收 | 原型 |
| AC-3 | 同一包版本重复发送，Offer 只接收一次 | §12 重复 / 乱序交接 |
| AC-4 | 先发 v2 再收到 v1 的重放，v1 不覆盖 v2 | §12 重复 / 乱序交接 |
| AC-5 | JD 更新后包显示需复核，已交接的版本被标记失效 | §12 JD 更新 / 数据撤回 |
| AC-6 | 包中不包含完整录音、转写和内部笔记 | §10 |
| AC-7 | 只有一方确认时不能发布和交接 | INT-11 |
| AC-8 | 导出生成失败不显示为下载失败；导出成功但下载失败不标为生成失败 | FILE-AC08 |

## 9. 依赖与实现

- 后端：`intake/tasks.service.ts`（`package`、`sendOffer`）。
- 前端：`pages/project/PackagePage.tsx`。
- 依赖：I10、I13（导出下载）；Offer 模块（`hireos-offer` 目前只有目录）。下游 Offer。

## 10. 待确认

1. Offer 模块未实现前，交接按钮是否隐藏，只保留导出。
2. 导出格式：PDF 之外是否需要 Markdown / JSON。
3. 只有 Recommend for offer 才交接 Offer（现有实现），还是 Do not proceed 也需要把包交给下游存档。
4. Interviewer 能否查看最终评估包。
