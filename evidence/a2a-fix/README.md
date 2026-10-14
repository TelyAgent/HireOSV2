# Issue #61：a2a 一致性修复证据

基准提交：fb46d5ac8ac07b041a25addcbccd533c2a809113；验证对象为本次修复工作树，文件 SHA-256 见 source-hashes.json。

Owner 已在 2026-10-14 的当前会话确认 Estimate=5、报告 F1–F11 范围和 AI Ready=Yes；批准依据及范围已写入 Issue #61 正文。

| 发现 | 修复 |
| --- | --- |
| F1 | Forms/schema/Markdown 模板统一 Subsystem 与 Estimate；共享 CLI 支持 submission/execution/ledger-bug，错误退出非零 |
| F2 | CI 调用 Codex Review，OPENAI_API_KEY 与 codex-review artifact 接通，PR 模板同步 |
| F3 | phase/commit/head/changed_files 分阶段采集；QA 核验 merged event 和实际合并 SHA，prompt 采用合并文件集合 |
| F4 | Ledger 的 inspectIssue/isOwner/validateIssue 接口已实现，待分诊 Bug 含 Subsystem |
| F5 | 可信 base 分类、证据 PR 限定豁免与共享 Merge gate 已接入 |
| F6 | QA 按 npm/package-lock 子工程准备依赖和 Prisma，输出 projects.json，启动 Postgres |
| F7 | 旧研发指南与 GitHub README 改为当前流程入口，移除过时默认 push/并行 QA 规则 |
| F8 | Claude batch 明确为历史手动兼容，不替代正式验收、不进入新 Ledger |
| F9 | Review 规则从可信 base、QA/发布规则从默认分支加载；不回退到受审 PR 的规则 |
| F10 | CI 加入全部流程回归；项目检查原始日志上传；QA 保存补丁、拒绝已暂存或未暂存产品变更；失败 workflow 不发布 pass |
| F11 | 根流程明确移动平台矩阵仅在工程接入时适用，当前 N/A |

验证（实际退出码）：

- `node --test .github/scripts/automation.test.cjs .github/scripts/post-merge.test.cjs .github/scripts/issue-contract.test.cjs .github/scripts/qa-environment.test.cjs`：0，45/45 通过；node-tests.log。
- `python3 -m unittest discover -s .agents/skills/eval-a2a-adoption/scripts -p test_grade.py`：0，20/20 通过；python-tests.log。
- Ruby YAML 解析所有 Actions/Issue Form 文件：0；yaml.log。仅验证语法，未安装 actionlint，不宣称运行期检查通过。
- Issue #61 最终正文 submission/execution：均 0。CLI 回归含非法正文、缺失文件与禁止的 ledger-bug CLI 模式，均正确退出 1。
- 本地文档显式链接复核：未发现缺失；references.json。
- `git diff --check`：0。

应用 build/lint/typecheck/integration 未在本地执行；本次仅改流程/脚本/文档，CI 将因共享脚本变更选择全部注册项目。Secrets、线上 Ruleset 和 GitHub Actions 实际运行尚未验证。AC-1/AC-2/AC-3 已有本地证据；AC-4 的运行期验收仍待真实 Actions。

首次迁移的可信 base 尚无新 classifier/gate 时，CI 会失败；管理员须审查并批准初始化规则交付，不能回退到 PR 自身规则或冒称检查通过。详见 .github/README.md。
