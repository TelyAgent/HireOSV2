# 质量台账文档

Quality Ledger 在合并前 CI 或合并后 Codex QA 完成后发布对应阶段的记录，长期文件按以下路径保存：

```text
docs/quality/
├── reports/PR-<pr-number>.md          # 公共索引
├── reports/PR-<pr-number>-review.md   # 合并前 Review
├── reports/PR-<pr-number>-qa.md       # 合并后 QA
└── bugs/BUG-<issue-number>.md
```

## Reports

`PR-<n>.md` 保存关联 Issue、来源 Estimate、两个阶段的链接，以及最近发布阶段的结果、提交、run ID 和 attempt。每个阶段或重跑更新这些元数据，使后续台账 PR 仍包含分类器要求的索引文件变更。阶段文件尚未发布时链接可能暂不可用，不代表验收已通过。`PR-<n>-review.md` 记录 PR head 的代码/安全审查；`PR-<n>-qa.md` 记录实际合并提交的 AC、测试、回归和缺陷。两个文件各自包含明确的阶段、Issue/PR、commit SHA、运行链接和结果。

每次发布只修改当前阶段文件和公共索引，沿已有台账分支树保留另一阶段文件。两个阶段也使用不同机器人评论标记，重跑只更新本阶段评论，发布顺序不影响另一阶段的证据。合并前 QA 标记为 deferred until after merge；缺失当前阶段报告才记 not completed 和 [AI-BLOCKED]，不把缺失当作通过。

原始日志、截图、coverage 和结构化 JSON 保存在 Actions artifact，不复制到长期摘要。来源 Estimate 按发布时的 Issue 正文保存；TBD 保留为 TBD，历史字段缺失或为空时标注 `Missing (historical source Issue has no Estimate)`，不推算点数、不回填历史报告。新建待分诊 Bug 的 Estimate=TBD 与来源 Issue 点数独立。

## 提交和来源身份

[quality-source.cjs](../../.github/scripts/quality-source.cjs) 只接受同仓库 pull_request 来源、名称与路径匹配的 CI/Codex QA 运行。Review 通过固定运行名 `Review before merge · PR #<n> · <head SHA>` 绑定运行的 PR head；CI 发布延迟到合并后、PR 关联数组为空时仍能核对身份。旧 CI 没有该运行名时必须有唯一的 GitHub PR 关联。QA 通过固定运行名 `QA after merge · PR #<n> · <merge SHA>` 取得 GitHub run 元数据中的对象身份，再查询 PR API 确认 closed/merged、默认分支和实际合并 SHA。QA 兼容 workflow_run.pull_requests 为空；artifact 不决定发布对象。默认分支后来前移不改变已合并 PR 的 QA 目标。

旧的合并前 QA artifact 不能作为合并后验收。旧的单文件台账和评论不批量迁移；它们保留为历史证据，新阶段记录使用新文件/标记。首次新版发布会将对应 PR 的公共索引改为阶段链接，旧阶段的原文仍可从 Git 历史或旧评论读取。

## Bugs

`bugs/BUG-<n>.md` 是合并后 QA 发现的可复现缺陷快照。文件使用 front matter：issue、status、severity、source_pr、affected_paths、reproduced_by_codex 和 fix_pr；正文固定包含 Symptom、Expected、Reproduction、Evidence、Root-cause hypothesis、Fix verification。环境与证据使用实际合并提交 SHA。

Bug 文档由台账发布流程镜像，修复 PR 负责更新状态、受影响路径、fix PR 和验证结果。环境阻塞只记录为 [AI-BLOCKED]，不创建产品 Bug。合并后 QA 失败不会逆转已发生的合并，应由 Human Supervisor 分诊缺陷并关联修复；Issue 自动关闭也不等于业务验收完成。

质量台账 PR 需要 Human Supervisor 验收合并；它不自动合并产品 PR，也不绕过分支保护。

## 质量证据 PR 的 CI

台账 PR 不关闭源 Issue。CI 根据 GitHub 元数据验证：作者为 github-actions[bot] Bot、分支为同仓库 `quality-ledger/pr-<源 PR>`。完整文件列表必须包含对应 `reports/PR-<源 PR>.md`，其余只允许该来源的 `PR-<源 PR>-review.md`、`PR-<源 PR>-qa.md` 和 `bugs/BUG-<Issue>.md`，且只允许新增或修改。空列表、截断列表、删除、重命名、其他来源的阶段文件或产品文件均拒绝。

通过分类的证据 PR 保留 Build、Lint、Type Check 和测试，跳过合并前 Review；合并后 target 也排除产品 QA。Merge gate 要求分类和基础检查成功且 Review 确实跳过。发布器对这类 PR 不发布评论、Issue 或新台账 PR，避免递归。Human Supervisor 仍需验收合并。

分类从可信 base 加载；gate 的检出配置以 [ci.yml](../../.github/workflows/ci.yml) 为准。首次交付新版文件范围与阶段发布器时，需要先将相关脚本和工作流交付到默认分支；旧运行不自动取得新工作流。保持 Merge gate 名称并核对 Ruleset，不把合并后 QA 设置为合并前 required check。
