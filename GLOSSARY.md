# 研发流程术语表

本术语表收录 GitHub 研发流程中跨 Issue、PR、Actions 和 Agent 共享的含义。任务专用的定义仍以对应 Issue、spec 或 ADR 为准。

| 术语 | 定义 |
| --- | --- |
| **Single Source of Truth** | GitHub 是影响研发决策的唯一权威协作中心。长期规则进入 Files，任务状态进入 Issue，变更和验收证据进入 PR。 |
| **Issue Contract** | Issue 的最小契约：Type、Subsystem、Problem、User Outcome、Scope、Non-goals、Acceptance Criteria、References、Dependencies、Risk、Owner、Estimate、AI Ready。 |
| **PR Contract** | PR 的最小契约：关联 Issue、变更说明、规格引用、验收条件、测试证据、AI Review、安全审查、风险回滚、文档和监督者。 |
| **Acceptance Criteria（AC）** | 可机器验证的完成条件，使用 `AC-1`、`AC-2` 等唯一编号；QA 必须逐项给出证据。 |
| **Estimate** | Issue 的相对工作规模，取值 1、2、3、5、8 或 TBD；包含实现、测试、文档和验收。实施前由 Owner 确认具体点数，详见 [Estimate 管理规则](a2a_dev_process.md#estimate-管理规则)。 |
| **AI Ready** | Issue 是否具备可执行的需求、依赖和验收条件。只有 `Yes` 才允许 Agent 实现；`No` 时先补齐上下文。 |
| **Codex QA** | 在 PR 合入默认分支后，根据 Issue 的 AC 验收实际合并提交，执行或补充测试，检查异常路径并输出结构化 QA JSON；不属于合并门禁。 |
| **Codex Review** | 不读取或沿用 QA 结论，独立阅读规格和代码 diff，检查正确性、回归、安全和测试覆盖；在合并前依赖基础检查执行，是 Merge gate 的必需阶段。 |
| **Quality Ledger** | CI 或合并后 Codex QA 完成后，分别发布 Review/QA 的提交与证据；保留两个阶段的文档和评论，并将可复现 QA 缺陷转为待分诊 Bug。 |
| **Evidence** | 支撑结论的命令、退出码、日志、测试结果、截图、coverage 或代码定位；不能用“命令存在”替代执行证据。 |
| **Human Supervisor** | 负责澄清约束、审批例外并完成最终业务验收的人；Agent 不代替其合并或审批职责。 |
| **正式评论协议** | `[AI-PLAN]`、`[AI-QUESTION]`、`[AI-EVIDENCE]`、`[AI-BLOCKED]`、`[HUMAN-DECISION]`、`[AI-RESULT]` 六类可检索前缀。 |
