# Repository Agent Instructions

这些规则适用于整个仓库。目录更深处的 `AGENTS.md` 可以补充模块专属约束；任务专用要求以 GitHub Issue、其全部评论和链接文件为准。

## 权威上下文

开始工作前按顺序读取：

1. 关联 GitHub Issue 及全部 Issue comments。
2. `AGENTS.md` 和任务涉及目录下更深层的 `AGENTS.md`。
3. Issue 明确链接的产品规格、设计、API、ADR 和运行手册。
4. 现有代码、测试、配置和目标提交的 diff。

GitHub 是研发决策的唯一权威来源：Files 保存长期规则，Issue 保存需求、任务和 Bug 状态，PR 保存实现、测试证据、Review 和合并决策。聊天或 Slack 中影响研发的决定必须回写 Issue 或 PR comment；Slack 只用于 `urgent`、`incident`、`security` 提醒并附 GitHub 链接。流程总览见 [`a2a_dev_process.md`](a2a_dev_process.md)，术语见 [`GLOSSARY.md`](GLOSSARY.md)。

## Issue 和 PR 门槛

- 正常工作必须关联一个主 Issue，PR 使用 `Closes #<number>`；其他依赖使用 `Refs #<number>`。
- Issue 必须具备 Type、Subsystem、Problem、User Outcome、Scope、Non-goals、Acceptance Criteria、References、Dependencies、Risk、Owner、Estimate 和 `AI Ready`。Type 只能是 Feature、Bug、Design 或 Tech Debt；线上 Incident 使用 Bug Type 搭配 `incident` 标签。`AI Ready=Yes` 且每项 AC 使用唯一的 `AC-1`、`AC-2` 编号后，才开始实现。
- 通过 CLI/API 创建或修改 Issue 正文时，读取并复用 [Issue Markdown 模板](.github/issue_body_template.md)，按对应 [Issue Form](.github/ISSUE_TEMPLATE/) 补齐类型专属字段。所有字段标题必须独占一行，使用 `### <字段名>`，名称与表单 `attributes.label` 完全一致；字段内容中的子标题使用四级或更深标题。提交前核对必需字段非空、字段标题唯一且均为三级、Type/Risk/Estimate/AI Ready 取值与表单一致、AC 编号唯一。CLI/API 不会自动应用 Issue Form；正文格式由创建者保证。
- 创建或修改任意 Issue 正文字段前，对完整的最终正文运行 `node .github/scripts/issue-contract.cjs <正文文件> submission`，退出码 0 后提交；执行前使用 `execution` 模式。校验范围、人工证据职责及仅限 Ledger 的待分诊 Bug 例外见 [Issue 正文校验](.github/issue-contract.md)。局部更新也必须检查完整契约。
- 需求、依赖或验收条件存在影响行为的未决问题时，在 Issue 留下 `[AI-QUESTION]` 并停止依赖该信息的实现；不要自行猜测产品意图。
- 创建或提交 Issue 前、或复核 Estimate 时，调用 [estimate-issue skill](.agents/skills/estimate-issue/SKILL.md)；其他 Agent 可直接读取执行。将唯一结果写入 Estimate，保留分析依据；建议点数仍需 Owner 确认。
- Estimate 遵循 [Estimate 管理规则](a2a_dev_process.md#estimate-管理规则)：允许 1、2、3、5、8 或 TBD；实施前由 Owner 确认具体点数，TBD 时保持 `AI Ready=No`。Agent 提供估算理由，实施后保留原估算并按规则记录范围变化。
- PR 使用 [pull request template](.github/pull_request_template.md)，说明变更、规格引用、每项 AC、测试证据、Review、安全、风险回滚、文档和 Human Supervisor。

## 实现和验证

- 先理解 Issue 和现有约束，再实现满足 AC 的最小变更；保持用户已有改动，避免无关重构。
- 从仓库配置和 CI 工作流发现真实命令，不凭记忆创造测试命令。本仓库应用工程使用 npm 与 package-lock.json 安装依赖和执行脚本；命令及项目范围以 CI 注册表为准。CI 的检查顺序以 [`.github/workflows/ci.yml`](.github/workflows/ci.yml) 为准：Build、Lint、Type Check、Unit、Integration、Codex Review、Merge gate；Human Supervisor 审批并合并后，由独立的 [Codex QA 工作流](.github/workflows/codex-qa.yml) 验收实际合并提交。QA 不属于合并门禁。当前未配置 E2E 阶段；PR 分类与质量证据 PR 的适用检查以该工作流及其调用脚本为准。
- 现有自动化脚本可用 `node --test .github/scripts/automation.test.cjs .github/scripts/post-merge.test.cjs .github/scripts/issue-contract.test.cjs .github/scripts/qa-environment.test.cjs` 验证。新增或修改功能时，补充有意义的自动测试，并在 PR 中记录实际命令、退出码和证据路径；未执行的测试不能写成通过。
- 评估当前项目的 a2a 流程落地效果或四级评级时，调用 [eval-a2a-adoption skill](.agents/skills/eval-a2a-adoption/SKILL.md)，先递归核验流程引用文件，确认必需文件缺失即不合格；再检查最新 10 个 Issue / 10 个 PR，按最近 4 个完整周的已验收 Feature/Bug 和 Estimate 评级，交付有证据的报告。
- 需要 QA 验收时，读取 [`.agents/skills/qa/SKILL.md`](.agents/skills/qa/SKILL.md)，逐项验证 AC，检查异常路径，并按 [`.github/schemas/qa.json`](.github/schemas/qa.json) 生成结构化报告。QA 只产生报告和证据，不替代 Review、Security Review 或 Human Supervisor。
- 需要 Codex Review 时，遵循 [`.github/prompts/review.md`](.github/prompts/review.md) 和 [`.github/schemas/review.json`](.github/schemas/review.json)，直接检查目标 diff，不依赖 QA 结论；Review 在合并前依赖基础检查，QA 在合并后执行；两阶段分别绑定 PR head SHA 和实际合并提交 SHA。

## 证据和沟通

把可复核证据保存到 `evidence/` 或 PR 关联的质量记录中：命令、退出码、日志、测试结果、截图、coverage 和代码定位。长期质量摘要由 Quality Ledger 写入 [`docs/quality/README.md`](docs/quality/README.md) 规定的路径。

正式评论使用以下前缀，并在 GitHub 留存：`[AI-PLAN]`、`[AI-QUESTION]`、`[AI-EVIDENCE]`、`[AI-BLOCKED]`、`[HUMAN-DECISION]`、`[AI-RESULT]`。阻塞说明解除条件；可复现产品缺陷说明严重程度、复现步骤和证据；环境阻塞不伪装成 Bug。

## 完成标准

任务完成前，确认：

- 每项 Acceptance Criterion 都有实现或明确的阻塞/失败证据。
- 受影响的自动测试已运行，测试、构建、lint 和类型检查的状态真实记录。
- 必需的规格、API、设计、ADR 和运行文档已同步，或在 PR 中说明 N/A 原因。
- PR 关联正确 Issue，使用仓库模板，并包含测试证据和回滚风险。
- 没有未记录的产品决策、未解释的失败检查或声称通过的未执行测试。

除非任务或工作流明确授权，不 push、merge 或创建外部 Issue。需要正式沟通时遵循上述评论协议，由获得授权的 GitHub workflow 发布；先把结果和证据准备成可审查的变更。
