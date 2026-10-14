# GitHub 研发流程配置

权威规则见 [a2a_dev_process.md](../a2a_dev_process.md) 与 [AGENTS.md](../AGENTS.md)，实际调度见 [工作流说明](workflows/README.md)。

- 普通任务：Issue（Owner 确认 Estimate、AI Ready=Yes）→ PR → 基础检查 → Codex Review（含安全）→ Merge gate → Human Supervisor 合并。
- 合并后：Codex QA 验收实际合并提交 → Quality Ledger 保存分阶段证据 → Human Supervisor 业务验收或缺陷分诊。Issue 自动关闭不等于验收完成。
- 质量证据 PR：必须由可信分类器核验机器人、同仓库、保留分支名和文件范围；基础检查仍执行，Review 和产品 QA 不适用。

## 启用与迁移

管理员配置 `OPENAI_API_KEY`，并允许 Actions 创建质量记录 PR。配置 [分诊标签](../docs/agents/triage-labels.md)，核对 Ruleset 的必需检查 `Merge gate`；在线保护、审批人数和 bypass 状态需要管理员实际核验，本文不声称已配置。正常工作关联 Issue/PR；例外须由 Human Supervisor 明确批准并记录 GitHub。

首次迁移需要先由管理员审查并把可信契约、分类器、门禁、报告脚本和 Codex 工作流交付到默认分支。PR 的分类/Review 规则从可信 base 加载；缺少这些文件时失败，不回退到受审 PR 自己的规则。此初始化需单独留存人工批准，不能把首次 CI 失败标为通过。

新流程以 Codex 为正式执行入口。`claude-review.yml` 不再由 CI 调用；`qa-batch.yml` / `claude-qa.yml` 仅保留历史手动兼容，不替代合并后 Codex QA，不进入新 Quality Ledger。旧报告作为历史证据保留。

## 配置入口

- [Issue 正文契约](issue-contract.md)、[Markdown 模板](issue_body_template.md)与 `ISSUE_TEMPLATE/`。
- [PR 模板](pull_request_template.md)。
- [项目注册表](ci/projects.json)：按真实 npm scripts 执行；已知失败仍运行并报警告，不为使 CI 变绿新增豁免。
- Review/QA prompt 和 schema 在 `.github/prompts/`、`.github/schemas/`；自动化回归位于 `.github/scripts/`。

Review 从 PR 的可信 base 加载 prompt/schema/validator，QA 与发布器从默认分支加载可信规则。产品代码分别检出 PR head 和实际 merge SHA。工作流文件自身也可能被 PR 修改，因此流程变更必须在 Issue Scope 中明确，并由 Human Supervisor 检查 diff。
