# HireOS AI 协作研发流程

本文改编自团队的 a2a-base-repo 方案，按 HireOS 的 monorepo 结构和工具（Claude Code）落地。Agent 规则见根目录 [`AGENTS.md`](../../AGENTS.md)，CI 启用步骤见 [`.github/README.md`](../../.github/README.md)。

## 核心原则

GitHub 是研发决策的唯一权威来源。人尽量不要先讲给另一个人、再由那个人转述给 AI：人改 Issue 或文件，Agent 直接读同一份上下文。

| 对象 | 职责 | 禁止 |
| --- | --- | --- |
| Files（`AGENTS.md`、`docs/`、`PORTS.md`） | 长期规则、规格、设计、ADR、运行手册 | 长期有效的信息只留在聊天记录里 |
| Issue | 为什么做、做到什么程度（AC） | Issue 没写清楚就开始写代码 |
| PR | 实际改了什么、测试证据、Review、合并决策 | 正常功能 PR 不关联 Issue |
| Comments | AI 与人之间的正式沟通 | Slack 或会议里做的决定不回写 |
| Slack / 微信 | 只发 urgent / incident / security 提醒，附 GitHub 链接 | 讨论需求、审批方案 |

## 什么时候走流程

本项目只有一名开发者，Issue 主要由开发者自己提，产品经理偶尔会提。main 允许管理员直接 push，所以流程按需使用：

| 直接 push main | 走 Issue → PR |
| --- | --- |
| 日常小修小改、调试、紧急修复 | 交给 AI 实现的需求 |
| | 产品经理提的需求 |
| | Prisma schema 变更、跨子系统接口变更 |
| | `.github/`、`AGENTS.md`、`CLAUDE.md` 的变更 |

直接 push 后，CI 仍会检查全部子项目。失败不会拦住这次 push，但 Actions 页面会显示红叉并发邮件提醒。

## Issue 怎么来

Issue 由人描述、由 Claude 创建，不需要手动填表单：

```text
你描述需求（自己的，或转述产品经理的）："建个 Issue：……"
   ↓
Claude 读代码，按表单字段起草 Issue（含 AC-1..n），在对话里给你看，并列出假设和疑问
   ↓
你确认或修改 AC
   ↓
Claude 用 gh 创建 Issue（AI Ready=Yes）；有未决问题时则 AI Ready=No + [AI-QUESTION]
   ↓
"Execute GitHub Issue #n"（或者一开始就说"建好后直接做"）
```

产品经理如果直接在 GitHub 上用表单提了 Issue，对 Claude 说“整理 Issue #n”，由 Claude 补全 AC，你确认后再改为 AI Ready=Yes。

## 一个需求的完整路径

```text
你描述需求 → Claude 起草 Issue（Feature / Bug / Design / Tech Debt）
   │  Problem、Scope、Non-goals、AC-1..n、Risk、Owner
   ▼
你确认 AC → Claude 创建 Issue，AI Ready=Yes
   │  有未决问题时：AI Ready=No + [AI-QUESTION]
   ▼
开发者让 Claude Code 执行："Execute GitHub Issue #123"
   │  Agent 依次读 Issue+评论 → AGENTS.md → 链接文件 → 代码，实现最小变更并补测试
   ▼
开 PR（模板，Closes #123）
   ▼
CI：改动的子项目跑 build/lint/typecheck/test
    → Issue contract 校验 → Claude Review（只读）+ Claude QA（按 AC 实际验证），并行
    → 两条 PR 评论 [AI-EVIDENCE] → Merge gate
   ▼
Human Supervisor 验收业务结果 → 合并 → 按 PR 的 Deploy 一节人工部署
```

给 Claude Code 的标准输入：

```text
Execute GitHub Issue #123.

Authoritative context:
1. Issue #123 and every comment
2. AGENTS.md
3. Files linked by Issue #123
4. Existing code and tests

Rules:
- Do not infer unresolved product requirements; comment [AI-QUESTION] instead.
- Implement the smallest change satisfying every AC, with tests.
- Open a PR using the template with Closes #123 and real test evidence.
```

## 角色

| 角色 | 主要职责 |
| --- | --- |
| 产品经理 | 描述需求（口头或在 Issue 里），回答 `[AI-QUESTION]`，按 AC 验收业务结果，不审代码细节 |
| 设计 | 在 Design Issue 里交付；批准的设计放到 `docs/design/<issue>/`（design-spec.md、states.md、handoff/），完成后评论 `[AI-RESULT] design-ready` |
| 工程师 | 把 Issue 编号交给 Agent，不重新口述需求；审 Agent 的 PR；维护 `AGENTS.md` 和 CI 注册表 |
| Human Supervisor（目前就是开发者本人） | 分诊、设置 AI Ready、审批例外、最终合并 |

## 评论协议

```text
[AI-PLAN]        执行计划
[AI-QUESTION]    缺少信息或需求冲突
[AI-EVIDENCE]    测试、日志、代码证据
[AI-BLOCKED]     无法继续，以及解除条件
[HUMAN-DECISION] 人做出的正式决定
[AI-RESULT]      完成摘要
```

分诊标签见 [`triage-labels.md`](triage-labels.md)，ADR 规范见 [`docs/adr/`](../adr/README.md)。

## 分期落地

**第一期（当前）**

- `AGENTS.md` + `CLAUDE.md`
- 4 种 Issue 表单（增加了 Subsystem 字段）和 PR 模板（增加了 Database、Deploy 两节）
- CI：只检查 PR 改到的子项目；历史欠账登记在 `.github/ci/projects.json` 的 `known_failing` 里，只警告不阻断
- Issue contract 校验 + Claude Review + Merge gate

**第二期（前提：测试补起来）**

- 清空 `known_failing`：修复 core-record、interview、screening 后端的 lint，interview 后端测试，interview 前端 build
- 给前端补测试（至少每个子系统的 smoke/E2E），给 written 后端补测试
- 接入 Claude QA：按 AC 逐项验收、补充临时测试，输出 `qa.json`
- 接入 Quality Ledger：QA 发现的 Bug 自动建 Issue，并在 `docs/quality/` 下生成报告

第一期不做 QA 的原因：目前大部分子项目几乎没有测试，AI QA 拿不到可执行的验证手段，结果会大多是失败或阻塞，噪音大于价值。
