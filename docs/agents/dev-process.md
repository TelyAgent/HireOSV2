# HireOS AI 协作研发流程

本页是导航入口，当前权威流程为 [a2a_dev_process.md](../../a2a_dev_process.md)，Agent 约束为 [AGENTS.md](../../AGENTS.md)。旧的 Claude Review、合并后手动批量 QA 方案已由 Codex 正式流水线取代；历史兼容入口与首次迁移要求见 [GitHub 配置说明](../../.github/README.md)。

1. 按 Issue Form 创建任务，填写 Subsystem、Estimate 与类型专属字段。Owner 确认具体点数并消除影响行为的未决问题后，设置 AI Ready=Yes。
2. Agent 读取 Issue 全部评论、适用 AGENTS、规格、代码和测试，实现最小变更。
3. PR 使用仓库模板，Closes 一个主 Issue，逐项记录 AC 与实际测试证据。
4. CI 基础检查 → Codex Review（含安全）→ Merge gate；Human Supervisor 审批并合并。
5. Codex QA 自动验收实际合并提交；Quality Ledger 发布 Review/QA 两阶段记录，Human Supervisor 业务验收或分诊缺陷。

正常工作走 Issue→PR；直接 push、绕过检查或其他例外需有明确人工批准和 GitHub 记录。自动关闭不代表完成业务验收。

设计交接见 [Claude Design 指南](claude-design-github-codex-workflow.md)，分诊见 [标签规则](triage-labels.md)，架构决策见 [ADR](../adr/README.md)，实际 npm monorepo 命令及工作流关系见 [Actions 说明](../../.github/workflows/README.md)。
