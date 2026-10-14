# GitHub Actions 工作流说明

权威流程见 [a2a_dev_process.md](../../a2a_dev_process.md)，初始化与权限配置见 [GitHub README](../README.md)。本文描述仓库静态配置，不证明在线 Secrets、Ruleset 或某次运行已经通过。

![流程关系](ci-flow.svg)

[Mermaid 源码](ci-flow.mmd)

## 正式入口

| 文件 | 入口与职责 |
| --- | --- |
| [ci.yml](ci.yml) | main push、PR opened/synchronize/reopened/ready_for_review/edited、手动运行；基础检查、分类、Review、Merge gate |
| [codex-review.yml](codex-review.yml) | CI 可复用调用；在基础检查与分类成功后审查 PR head |
| [codex-qa.yml](codex-qa.yml) | PR closed 且 merged=true；固定实际 merge SHA，排除未合并、fork、非默认分支及证据 PR |
| [quality-ledger.yml](quality-ledger.yml) | CI/Codex QA 完成后发布对应阶段记录，不作为 Merge gate 输入 |

`claude-review.yml` 是不再接入 CI 的旧实现；`qa-batch.yml` 调用 `claude-qa.yml` 仅供历史手动兼容，其报告不替代正式 Codex QA、不进入新 Ledger。

## CI 基础检查

`detect` 在 Node 24 上运行自动化、post-merge、Issue 契约和 QA 环境四个 Node 测试套件，再按 [projects.json](../ci/projects.json) 选择项目。[projects.cjs](../scripts/projects.cjs) 对 CI 配置或共享脚本变更选择全部注册项目；文档变更可以不选应用。push main/手动运行选择全部。

`projects` 是各子工程的矩阵任务：npm ci → 必要的 Prisma generate → 注册的 build/lint/typecheck/test。使用 Node 24、npm/package-lock，在子工程工作目录执行，没有根应用安装。数据库项目启动 Postgres。`run-check.sh` 逐项执行，失败仍继续其余检查；known_failing 是显式历史例外，不能擅自扩大。项目检查状态由 `checks` 汇总，空矩阵只有在 detect 确认无改动项目时允许跳过。

每个项目上传 `ci-evidence-<name>`：各检查日志，以及存在的 coverage/test-results/playwright-report，保留 30 天。CI 没有独立 E2E job，也不把项目的 test 自动宣称为独立 Unit/Integration 两阶段；具体测试脚本由注册表和 package.json 定义。

## 分类、Review 和门禁

`classify` 从 PR 的可信 base SHA（非 PR 事件使用 github.sha）加载 [evidence-pr.cjs](../scripts/evidence-pr.cjs) 和 [context.cjs](../scripts/context.cjs)。普通 PR 必须关联一个主 Issue，使用共享 [Issue 契约](../issue-contract.md) execution 校验，并完整读取讨论。Quality Ledger PR 仅在机器人、同仓库、保留分支及质量文件范围均验证后豁免主 Issue 与 Review。

普通 PR 的 `review` 依赖 checks/classify，调用 Codex Review，使用 OPENAI_API_KEY。产品检出 PR head；prompt、schema 和 [report.cjs](../scripts/report.cjs) 从可信 base 加载。Review 使用只读沙箱，独立检查 diff 与安全；不下载或依赖 QA 报告。

`gate` 依赖 checks/classify/review，使用可信 [merge-gate.cjs](../scripts/merge-gate.cjs)：所有事件要求基础检查与分类成功；普通 PR 要求 Review success，证据 PR 要求 Review skipped。push/手动运行不要求 Review。Ruleset 将 Merge gate 设为必需检查才实际阻止合并；Human Supervisor 完成最终合并职责。

## 合并后 QA

[target resolver](../scripts/post-merge.cjs) 从默认分支执行，重新查询 GitHub PR，核对 closed/merged、仓库、目标分支和 merge_commit_sha。QA 检出该 SHA；后续默认分支前移不改变验收对象。

[context.cjs](../scripts/context.cjs) 输出 phase=qa、commit=实际合并 SHA、head/base 元数据和完整 changed_files。文件数量、重复或截断不符时拒绝。按 PR API 文件集合检查合并结果；squash/rebase 后不用原 base/head 三点 diff 替代结果。

QA 规则、schema、validator 和 [qa-environment.cjs](../scripts/qa-environment.cjs) 从默认分支加载。环境使用 Node 24、Postgres/DATABASE_URL，按实际合并提交的项目注册表选择 touched projects，输出 evidence/projects.json，逐项目 npm ci / Prisma generate。文档任务可不安装应用。

[QA prompt](../prompts/qa.md) 与 [QA skill](../../.agents/skills/qa/SKILL.md) 要求逐项 AC、真实命令与退出码、异常路径和临时测试。既有 pre-merge CI 结果不代替合并提交验证。QA 只增加 test/evidence；guard 保存 evidence/qa-tests.patch，拒绝产品文件改动（含已暂存变更）。环境阻塞记 AC fail，不虚构产品 Bug。

结构化报告使用 [qa.json](../schemas/qa.json)，验证后上传 evidence/ 为 codex-qa；Review 为 codex-review，均保留 30 天。有效 fail 报告也返回非零状态，但保存证据。workspace-write 并非文件系统级的 test-only 权限，guard 是运行后检查；工作流自身变更仍需人工审查。

## Quality Ledger

[quality-ledger.yml](quality-ledger.yml) 监听同仓库 pull_request 来源的 CI/Codex QA completed（成功失败都可发布）。写权限仅在此发布 job，代码来自默认分支；下载 codex-review/qa，zip 上限 20MB、JSON 上限 500KB，仅提取根 JSON，不执行 artifact 代码。

[quality-source.cjs](../scripts/quality-source.cjs) 使用固定 run-name 及 GitHub PR 元数据核对身份；Review 绑定 head、QA 绑定 merge SHA。旧 CI 仅在有唯一 GitHub PR 关联时兼容，无关联则失败。报告中的编号不能决定发布对象。

[ledger.cjs](../scripts/ledger.cjs) 验证报告，分阶段发布评论和质量文件，保持另一阶段证据。缺失报告标 AI-BLOCKED，合并前尚未执行 QA 标 deferred。仅 QA 可复现 bugs 创建 needs-triage Bug：Estimate=TBD/AI Ready=No，使用有限的 ledger-bug 契约例外。文档路径、去重及证据 PR 范围见 [质量规范](../../docs/quality/README.md)。

机器人 token 创建的 PR 通常不触发常规 PR 工作流，需要维护者凭据触发后通过同样门禁。Ledger 不自动合并、不审批产品 PR；发布失败不改变已完成 CI/QA 结果。首次迁移可信规则缺失时失败，不回退到受审代码；管理员需要单独审查、批准初始化，见 GitHub README。
