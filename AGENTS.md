# HireOS Agent Instructions

这些规则适用于整个仓库，Claude Code（经 `CLAUDE.md` 引用）、Codex 等 Agent 共用。子目录可以放更深层的 `AGENTS.md` 补充模块约束；任务专属要求以 GitHub Issue、其全部评论和链接文件为准。流程总览见 [`docs/agents/dev-process.md`](docs/agents/dev-process.md)。

## 权威上下文

按 Issue 执行任务时，开始前按顺序读取：

1. 关联的 GitHub Issue 及全部评论（`gh issue view <n> --comments`）。
2. 本文件，以及任务涉及目录下更深层的 `AGENTS.md`。
3. Issue 明确链接的规格、设计、API、ADR（`docs/adr/`）和运行手册。
4. 现有代码、测试、配置和目标 diff。

GitHub 是研发决策的唯一权威来源：Files 保存长期规则，Issue 保存需求、任务和 Bug 状态，PR 保存实现、测试证据、Review 和合并决策。聊天、会议或 Slack 中影响研发的决定，必须回写到 Issue 或 PR 评论。

## 仓库结构

Monorepo，每个子项目独立维护 `package.json` 和 `package-lock.json`，没有根级 workspace，命令要在子项目目录里执行。

| 子系统 | 后端（NestJS + Prisma） | 前端（Vite + React） |
| --- | --- | --- |
| 职位描述 | `hireos-jd/hireos-jd-backend` | `hireos-jd/hireos-jd-front` |
| 面试 | `hireos-interview/job-Interview-backend` | `hireos-interview/job-Interview-front` |
| 简历筛选 | `hireos-screening/hireos-screening-backend` | `hireos-screening/hireos-screening-front` |
| 笔试 | `hireos-written/hireos-written-backend` | `hireos-written/hireos-written-front` |
| 核心档案 | `hireos-core-record`（API 前缀 `/api/v1`） | — |

- 端口、API 前缀、前端代理和网关是 [`PORTS.md`](PORTS.md) 唯一权威来源；新增服务先登记端口。
- `gateway/` 是本地统一网关和生产 nginx 配置；`scripts/dev.sh` 管理本地启停；`scripts/deploy/`、`docker-compose*.yml` 用于部署。
- `hireos-assessment`、`hireos-offer` 只预留了目录，还没有代码。

## 命令

只用子项目 `package.json` 里真实存在的 script，不凭记忆编造命令。CI 实际执行的检查登记在 [`.github/ci/projects.json`](.github/ci/projects.json)。

```bash
cd <子项目目录>
npm ci
npx prisma generate      # 仅后端，build/typecheck 前需要
npm run build
npm run lint             # interview 前端没有 lint
npm run typecheck
npm test                 # 仅后端：先 build，再 node --test test/*.test.cjs
```

本地启动全部服务：`scripts/dev.sh start`。CI 自动化脚本自测：`node --test .github/scripts/automation.test.cjs`。

## 两种工作方式

本项目只有一名开发者（仓库管理员），main 允许管理员直接 push。

- **直接修改**：日常小修小改、调试、紧急修复。不需要 Issue 或 PR，按用户指示改代码；是否 commit、push 由用户决定。push 到 main 后 CI 仍会检查全部子项目，但失败不会拦住这次 push。
- **Issue → PR 流程**：Issue 由用户口头描述、Agent 起草并创建（见“创建 Issue”）。用户说"Execute GitHub Issue #n"时，或者改动属于下面这些情况时，走完整流程：AI 实现的需求、产品经理提的需求、Prisma schema 变更、跨子系统接口变更、`.github/` 和 Agent 规则的变更。拿不准时问用户。

## Issue 和 PR 门槛（走流程时）

- PR 只关联一个主 Issue，正文写 `Closes #<n>`，其他依赖写 `Refs #<n>`。CI 的 `Issue contract` 检查会强制这一条。
- Issue 必须具备 Type、Subsystem、Problem、User Outcome、Scope、Non-goals、Acceptance Criteria、References、Dependencies、Risk、Owner 和 `AI Ready`。只有 `AI Ready=Yes`、且每项 AC 都有 `AC-1`、`AC-2` 这样的编号时，才开始实现。
- 需求、依赖或验收条件里有影响行为的未决问题时，在 Issue 留 `[AI-QUESTION]`，并停下依赖该信息的实现；不要自己猜产品意图。
- PR 使用 [pull request template](.github/pull_request_template.md)，在分支上开发，不直接 push main。

## 创建 Issue

Issue 由人描述需求（用户自己的，或用户转述的产品经理需求），由 Agent 起草并创建。用户说“建个 Issue：……”或类似的话时：

1. 读相关代码和文档，弄清现状，确定 Type（Feature / Bug / Design / Tech Debt）和 Subsystem。
2. 按 `.github/ISSUE_TEMPLATE/<type>.yml` 的字段起草完整的 Issue 正文，包括该表单特有的字段（例如 Bug 的 Reproduction、Severity）。格式必须与表单渲染结果一致：每个字段写成 `### 字段名`，空一行后接内容，否则 CI 的 Issue contract 解析不了。标题沿用表单前缀，例如 `[Feature] `。Owner 默认填 `@JsonSuCoder`。
3. AC 写成可验证的结果，用 `AC-1`、`AC-2` 编号，覆盖主流程和关键的异常情况。不要把实现方案写成 AC。
4. **先在对话里给用户看草稿**，单独列出你的假设和不确定的点，等用户确认或修改。不要未经确认就创建。
5. 用户确认后，用 `gh issue create` 创建：
   - 用户确认了 AC：`AI Ready` 写 `Yes`，不加 `needs-triage`。
   - 还有未决问题：`AI Ready` 写 `No`，加 `needs-triage`，并把问题以 `[AI-QUESTION]` 评论到 Issue 里。
6. 返回 Issue 链接。用户说执行（或一开始就说“建好后直接做”）时才开始实现。

`AI Ready=Yes` 只能来自用户对 AC 的明确确认，Agent 不能自己判定需求已经清楚。

## 整理 Issue

产品经理直接在 GitHub 上提了 Issue（`AI Ready=No`），用户说“整理 Issue #n”时：

1. 读取 Issue 和全部评论，以及相关代码。
2. 起草 Scope、Non-goals 和 `AC-1..n`，补全其他字段，同样先在对话里给用户看。不要改动提出人写的 Problem 和 User Outcome。
3. 用户确认后再更新 Issue；产品层面的疑问用 `[AI-QUESTION]` 评论并 @ 提出人。
4. 由用户确认 AC 后，才把 `AI Ready` 改为 Yes。

## 实现和验证

- 先理解 Issue 和现有约束，再实现满足 AC 的最小变更；保留用户已有的改动，避免无关重构。
- 改了 Prisma schema 必须附带 `prisma/migrations/` 下的迁移，并说明对线上已有数据的影响。
- 改了端口、代理前缀或网关路由，要同步 `PORTS.md`、对应的 `vite.config.ts` 和 `gateway/`。
- 跨子系统调用的接口变了，调用方和被调方要在同一个 PR 里一起改。
- 新增或修改行为时补有意义的自动测试；在 PR 里记录实际命令和结果。没执行的测试不能写成通过。
- `.github/ci/projects.json` 的 `known_failing` 是历史欠账清单。不要往里加新条目来让 CI 变绿；修好其中某项后要把它删掉。

## 安全

- 本仓库是**公开仓库**。不要提交密钥、密码、token、`.env`、生产数据或候选人个人信息；参考 `.gitignore` 里已有的排除项。
- 不要在代码、日志或 PR 里写生产服务器的凭据。
- Agent 不执行部署，也不操作生产环境；需要部署时，在 PR 的「Deploy」一节列出要部署的服务，由人来执行。

## 证据和沟通

正式评论使用以下前缀，并留在 GitHub 上：`[AI-PLAN]`、`[AI-QUESTION]`、`[AI-EVIDENCE]`、`[AI-BLOCKED]`、`[HUMAN-DECISION]`、`[AI-RESULT]`。阻塞时说明解除条件；环境问题不要伪装成产品 Bug。

除非用户明确要求，不 push、不 merge、不创建或关闭 Issue；任何情况下都不 force push，也不绕过 Merge gate 合并 PR。

## 完成标准

- 每项 AC 都已实现，或有明确的阻塞/失败证据。
- 受影响子项目的 build、lint、typecheck、test 已实际运行，结果如实记录。
- 必需的文档（`PORTS.md`、部署指南、ADR 等）已同步，或在 PR 中说明为什么不需要。
- PR 关联了正确的 Issue，使用了模板，包含测试证据、回滚方案和需要部署的服务。
