# HireOS Agent Instructions

这些规则适用于整个仓库，Claude Code（经 `CLAUDE.md` 引用）、Codex 等 Agent 共用。子目录可以放更深层的 `AGENTS.md` 补充模块约束；任务专属要求以 GitHub Issue、其全部评论和链接文件为准。流程总览见 [`docs/agents/dev-process.md`](docs/agents/dev-process.md)。

## 权威上下文

开始工作前按顺序读取：

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

## Issue 和 PR 门槛

- 正常工作必须关联一个主 Issue，PR 正文写 `Closes #<n>`，其他依赖写 `Refs #<n>`。CI 的 `Issue contract` 检查会强制这一条。
- Issue 必须具备 Type、Subsystem、Problem、User Outcome、Scope、Non-goals、Acceptance Criteria、References、Dependencies、Risk、Owner 和 `AI Ready`。只有 `AI Ready=Yes`、且每项 AC 都有 `AC-1`、`AC-2` 这样的编号时，才开始实现。
- 需求、依赖或验收条件里有影响行为的未决问题时，在 Issue 留 `[AI-QUESTION]`，并停下依赖该信息的实现；不要自己猜产品意图。
- PR 使用 [pull request template](.github/pull_request_template.md)。

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

除非任务明确授权，不 push、不 merge、不创建或关闭 Issue。

## 完成标准

- 每项 AC 都已实现，或有明确的阻塞/失败证据。
- 受影响子项目的 build、lint、typecheck、test 已实际运行，结果如实记录。
- 必需的文档（`PORTS.md`、部署指南、ADR 等）已同步，或在 PR 中说明为什么不需要。
- PR 关联了正确的 Issue，使用了模板，包含测试证据、回滚方案和需要部署的服务。
