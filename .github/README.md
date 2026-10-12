# GitHub 研发流程配置

流程说明见 [`docs/agents/dev-process.md`](../docs/agents/dev-process.md)。本目录包含：

| 路径 | 作用 |
| --- | --- |
| `ISSUE_TEMPLATE/` | Feature / Bug / Design / Tech Debt 四种表单，禁用空白 Issue |
| `pull_request_template.md` | PR Contract |
| `ci/projects.json` | CI 检查的子项目注册表和 `known_failing` 欠账清单 |
| `workflows/ci.yml` | 总入口：detect → checks → contract → review → publish-review → Merge gate |
| `workflows/claude-review.yml` | Claude 只读代码审查，输出符合 `schemas/review.json` 的 JSON |
| `prompts/review.md` | Review 标准 |
| `scripts/` | 选择改动项目、执行检查、校验 Issue/报告、发布评论；自测在 `automation.test.cjs` |

## 启用步骤（需要仓库管理员）

1. **认证**：在 Settings → Secrets → Actions 中配置以下任一项：
   - `ANTHROPIC_API_KEY`：按 API 用量计费；
   - `CLAUDE_CODE_OAUTH_TOKEN`：使用 Claude 订阅额度，本地运行 `claude setup-token` 生成。

   两个都缺时，Review 会失败，不会默认放行。
2. **标签**：创建 `needs-triage`、`urgent`、`incident`、`security`、`blocked`，见 [`triage-labels.md`](../docs/agents/triage-labels.md)。
3. **分支保护**：给 `main` 配置 Ruleset，要求必需检查 `Merge gate` 通过、至少 1 个人工审批、所有讨论已解决、新提交使旧审批失效。YAML 本身无法开启这些设置。
4. **工作方式切换**：开启分支保护后，不能再直接 push 到 `main`，所有改动都要走 PR。

## 运行规则

- **只检查改动的子项目**：PR 只跑改到的子项目；改了 `.github/ci/`、`ci.yml` 或 `.github/scripts/` 时跑全部；push 到 main 和手动运行也跑全部。只改文档的 PR 不跑项目检查，但仍然要过 Issue contract 和 Review。
- **`known_failing`**：清单里的检查照样执行，失败只出 warning；如果其中某项已经能通过，CI 会提示把它从清单删掉。不要往清单里加新条目来让 CI 变绿。
- **Review 的触发条件**：只有 Issue contract 通过、且改动的子项目检查全部通过后，才调用 Claude，避免浪费额度。修改 PR 描述（`edited`）也会重新跑整个 CI。
- **安全**：
  - 只对来自本仓库分支的 PR 运行 AI 检查，fork 的 PR 会失败（仓库是公开的）。
  - Claude 只拿到只读工具（Read/Grep/Glob 和 git diff/log/show），审查任务本身没有写权限。
  - 发布评论在单独的任务里进行，使用默认分支的脚本，并且先校验报告再发布；报告缺失或无效时，评论标记为 `[AI-BLOCKED]`。
- **首次合入**：发布评论的任务使用默认分支上的脚本，所以引入本配置的第一个 PR 无法发布 Review 评论，这是预期行为；合入之后的 PR 就正常了。
