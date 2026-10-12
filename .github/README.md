# GitHub 研发流程配置

流程说明见 [`docs/agents/dev-process.md`](../docs/agents/dev-process.md)。本目录包含：

| 路径 | 作用 |
| --- | --- |
| `ISSUE_TEMPLATE/` | Feature / Bug / Design / Tech Debt 四种表单，禁用空白 Issue |
| `pull_request_template.md` | PR Contract |
| `ci/projects.json` | CI 检查的子项目注册表和 `known_failing` 欠账清单 |
| `workflows/ci.yml` | 总入口：detect → checks → contract → review 和 qa（并行）→ 发布评论 → Merge gate |
| `workflows/claude-review.yml` | Claude 只读代码审查，输出符合 `schemas/review.json` 的 JSON |
| `workflows/claude-qa.yml` | Claude QA：按 Issue 的 AC 逐项实际验证，可以补临时测试，输出符合 `schemas/qa.json` 的 JSON |
| `prompts/review.md`、`prompts/qa.md` | Review 标准和 QA 流程 |
| `scripts/` | 选择改动项目、执行检查、校验 Issue/报告、发布评论；自测在 `automation.test.cjs` |

## 启用步骤（需要仓库管理员）

1. **认证**：在 Settings → Secrets → Actions 中配置以下任一项：
   - `ANTHROPIC_API_KEY`：按 API 用量计费；
   - `CLAUDE_CODE_OAUTH_TOKEN`：使用 Claude 订阅额度，本地运行 `claude setup-token` 生成。

   两个都缺时，Review 会失败，不会默认放行。
2. **标签**：创建 `needs-triage`、`urgent`、`incident`、`security`、`blocked`，见 [`triage-labels.md`](../docs/agents/triage-labels.md)。
3. **分支保护**（已配置，Ruleset `main-protection`）：必须走 PR、审批人数 0、必需检查 `Merge gate`、禁止删除分支和 force push。**Repository admin 在 Bypass list 中，模式为 Always**，所以管理员可以直接 push main。
   本项目只有一名开发者，GitHub 不允许作者审批自己的 PR，所以不使用人工审批和 Code Owner 审批，改为机器保证，见下面的“Review 规则来自 main”。
4. **两种工作方式**：日常修改直接 push main；AI 实现的需求、产品经理的需求、schema 变更、跨子系统接口变更、`.github/` 和 Agent 规则的变更走 Issue → PR。划分规则见 `AGENTS.md`。

## 运行规则

- **只检查改动的子项目**：PR 只跑改到的子项目；改了 `.github/ci/`、`ci.yml` 或 `.github/scripts/` 时跑全部；push 到 main 和手动运行也跑全部。只改文档的 PR 不跑项目检查，但仍然要过 Issue contract 和 Review。
- **`known_failing`**：清单里的检查照样执行，失败只出 warning；如果其中某项已经能通过，CI 会提示把它从清单删掉。不要往清单里加新条目来让 CI 变绿。
- **Review 和 QA 的触发条件**：只有 Issue contract 通过、且改动的子项目检查全部通过后，才调用 Claude，避免浪费额度。两者并行，结论互不依赖，各自发一条 PR 评论，Merge gate 要求两者都通过。修改 PR 描述（`edited`）也会重新跑整个 CI。
- **QA 的环境**：带一个空的 Postgres（`DATABASE_URL`）；Core Record、Zoom、AI 服务都不可用，需要在测试里替换成假实现。QA 可以执行 npm 和 node、在 `test/` 下写临时测试，但如果改动了产品代码，任务会直接失败。临时测试的补丁保存在 artifact `claude-qa` 中，不会提交到分支。
- **QA 的安全边界**：QA 会执行 PR 里的代码（`npm test`），而这时 Claude 的 token 也在同一个环境中。所以 QA 只对本仓库分支发起的 PR 运行，不对 fork 运行。
- **安全**：
  - 只对来自本仓库分支的 PR 运行 AI 检查，fork 的 PR 会失败（仓库是公开的）。
  - Claude 只拿到只读工具（Read/Grep/Glob 和 git diff/log/show），审查任务本身没有写权限。
  - **Review 和 QA 的规则来自 main**：两者使用的 prompt、schema 和 `report.cjs` 都从默认分支读取（QA 首次引入时，main 上还没有这些文件，会临时使用 PR 中的版本），PR 对这些文件的修改要等合并后才生效。Review 标准还要求：PR 改动 `.github/` 或 Agent 规则时，必须在 Issue 的 Scope 里写明，削弱检查要有理由，否则判为阻断。
    剩余风险：PR 仍然可以修改 `ci.yml`、`claude-review.yml` 这两个工作流文件本身，而 GitHub 的 `pull_request` 事件执行的是 PR 里的工作流。上面那条 Review 标准会把这类改动标为阻断，但无法从机制上杜绝，合并这类 PR 前请亲自看一下 diff。
  - 发布评论在单独的任务里进行，使用默认分支的脚本，并且先校验报告再发布；报告缺失或无效时，评论标记为 `[AI-BLOCKED]`。
- **首次合入**：发布评论的任务使用默认分支上的脚本，所以引入本配置的第一个 PR 无法发布 Review 评论，这是预期行为；合入之后的 PR 就正常了。
