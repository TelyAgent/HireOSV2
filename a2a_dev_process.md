# 以 GitHub 为核心的 AI-to-AI 软件研发提效落地方案

## 摘要

本方案把 **GitHub 定义为公司研发唯一权威协作中心（Single Source of Truth）**：文件保存长期上下文，Issue 保存任务/需求/Bug 状态，PR 保存代码变更、AI 审查和验收证据；任何影响研发决策的讨论必须最终写入 GitHub Issue/PR comments。GitHub 原生支持结构化 Issue Forms、PR Template、Required Checks/Reviews、Conversation Resolution 和 Merge Queue，适合将流程本身机器化。Codex 负责代码实现、测试生成与执行、PR Review、安全检查、测试报告和 Bug 初步分析，团队成员的主要职责转变为**定义约束、监督 Agent、审批例外与最终业务验收**；Codex 已支持基于仓库的 `AGENTS.md`、CI 自动运行、结构化 JSON 输出及 GitHub PR Review。设计工作逐步从 Figma 转向 Claude Design，但最终设计意图和 handoff 仍必须沉淀到 GitHub，使 Codex 不依赖设计人员口头解释即可完成实现。

## 全公司统一运行模型

### GitHub 中三类对象的唯一职责

强制采用以下模型，而不是让 Slack、Claude/Codex 对话历史或个人文档成为隐性知识库。


| 对象           | 唯一职责                                                | 禁止事项                  |
| ------------ | --------------------------------------------------- | --------------------- |
| **Files**    | 产品规则、技术规范、设计、AI 指令、测试策略、测试报告、架构决策、运行手册              | 不把长期有效信息只留在聊天记录       |
| **Issue**    | 需求、任务、Bug、决策入口；定义“为什么做、做到什么程度”                      | Issue 未清楚前不得直接 Coding |
| **PR**       | 实现、验证、AI Review、测试证据和合并决策；定义“实际上改了什么”               | 不允许无 Issue 的正常功能 PR   |
| **Comments** | AI↔AI、Human↔AI、Human↔Human 的正式沟通记录                  | 不允许 Slack/会议中的决定不回写   |
| **Slack**    | `urgent / incident / security` 等紧急事件提醒，并附 GitHub 链接 | 不讨论需求、不审批方案、不形成最终决策   |


GitHub 的 Issue Forms 可以设置必填字段、默认 labels 和 assignees；PR Template 可以强制提供上下文；PR 可以用 `Closes #123` 与 Issue 关联并在合并后自动关闭；Slack 的 GitHub 集成支持 Issue、PR、Workflow 通知以及基于 label 的过滤，Slack 只订阅 `urgent`、`incident`、`security` 等异常类 label，而不订阅正常研发对话。

### 所有产品仓库统一目录

```text
/
├── AGENTS.md
├── GLOSSARY.md
├── .github/
│   ├── README.md
│   ├── issue-contract.md
│   ├── issue_body_template.md
│   ├── ISSUE_TEMPLATE/
│   │   ├── feature.yml
│   │   ├── bug.yml
│   │   ├── design.yml
│   │   └── tech-debt.yml
│   ├── pull_request_template.md
│   ├── prompts/
│   │   ├── qa.md
│   │   └── review.md
│   ├── schemas/
│   │   ├── issue-contract.json
│   │   ├── qa.json
│   │   └── review.json
│   ├── scripts/
│   │   ├── issue-contract.cjs
│   │   ├── context.cjs
│   │   ├── report.cjs
│   │   ├── ledger.cjs
│   │   ├── post-merge.cjs
│   │   ├── quality-source.cjs
│   │   ├── evidence-pr.cjs
│   │   ├── merge-gate.cjs
│   │   ├── automation.test.cjs
│   │   ├── post-merge.test.cjs
│   │   ├── issue-contract.test.cjs
│   │   ├── qa-environment.cjs
│   │   └── qa-environment.test.cjs
│   └── workflows/
│       ├── README.md
│       ├── ci-flow.mmd
│       ├── ci-flow.svg
│       ├── ci.yml
│       ├── codex-review.yml
│       ├── codex-qa.yml
│       └── quality-ledger.yml
├── .agents/
│   └── skills/
│       ├── qa/
│       │   └── SKILL.md
│       ├── eval-a2a-adoption/
│       │   ├── SKILL.md
│       │   ├── references/
│       │   │   ├── file-integrity.md
│       │   │   ├── compliance.md
│       │   │   └── report.md
│       │   └── scripts/
│       │       ├── grade.py
│       │       └── test_grade.py
│       ├── estimate-issue/
│       │   └── SKILL.md
│       └── check-issues/
│           └── SKILL.md
├── docs/
│   ├── product/
│   ├── specs/
│   ├── design/
│   ├── adr/
│   │   ├── README.md
│   │   └── 0001-github-as-source-of-truth.md
│   ├── agents/
│   │   └── triage-labels.md
│   ├── api/
│   ├── quality/
│   │   ├── README.md
│   │   ├── test-plans/
│   │   ├── reports/
│   │   └── bugs/
│   └── runbooks/
├── web/
│   └── AGENTS.md
├── backend/
│   └── AGENTS.md
├── ios/
│   └── AGENTS.md
└── android/
    └── AGENTS.md
```

Codex 会读取仓库中的 `AGENTS.md`，且目录越深的指令可以为特定模块提供更具体的上下文；OpenAI 也在实际项目中使用 `AGENTS.md + .agents/skills + GitHub Actions` 将重复工程任务转为可复现的 Agent 工作流。

`.github/` 中的表单、模板、prompt、机器契约、脚本和工作流共同组成流程实现，其具体文件及引用的支撑文件须完整可读。[Issue 正文校验](.github/issue-contract.md) 说明共享校验器的提交、执行和自动待分诊 Bug 模式；CLI、上下文门禁和 Ledger 使用 [issue-contract.cjs](.github/scripts/issue-contract.cjs)，字段与枚举由 [issue-contract.json](.github/schemas/issue-contract.json) 表达并通过测试与 Issue Forms 核对。工作流入口及关系见 [工作流说明](.github/workflows/README.md)。

`docs/product/`、`docs/specs/`、`docs/design/`、`docs/api/` 和 `docs/runbooks/` 按项目需求维护具体内容；`docs/quality/reports/`、`docs/quality/bugs/` 和原始 `evidence/` 是按执行阶段生成的证据路径，产物要求见 [质量台账说明](docs/quality/README.md)，不以空占位文件代替实际证据。项目专属的其他技能按需放在 `.agents/skills/`，下述四个流程技能为统一要求。

HireOS 是现有 npm/package-lock monorepo，CI 与 QA 按 `.github/ci/projects.json` 选择子工程；不在仓库根安装应用依赖。移动端角色与 `docs/mobile/platform-matrix.md` 仅在接入 iOS/Android 工程时适用，当前仓库未接入移动端，该依赖记为 N/A。

`web/AGENTS.md`、`backend/AGENTS.md`、`ios/AGENTS.md`、`android/AGENTS.md` 是可选的平台指引，仅建议按需提供，不属于统一目录的强制文件；角色表中的相关引用也不改变其可选性质。文件完整性评估将这四项记为 `na`，缺失不影响评级；已有文件中的适用约束仍须遵循。根目录 `AGENTS.md` 和下述四个 skill 仍为必需。

四个 skill 是所有产品仓库必须提供的流程指引；`SKILL.md` 及其引用的 references、scripts、schema 等支撑文件必须完整可读。仓库 `AGENTS.md` 应提供对应调用入口，其他 Agent 无技能发现能力时直接读取相应 `SKILL.md` 执行。具体步骤以链接的技能为准：

| Skill | 调用时机与职责 | 执行约束 |
| --- | --- | --- |
| [qa](.agents/skills/qa/SKILL.md) | PR 的 Codex QA 阶段或明确要求验收时，逐项验证关联 Issue AC、检查异常路径并生成结构化报告 | 自动 QA 绑定确切 Issue/PR/实际合并提交 SHA，保留真实测试证据；可补充临时测试，保持产品代码不变。QA 不替代独立 Review、安全审查或 Human Supervisor，GitHub 发布由授权工作流完成 |
| [eval-a2a-adoption](.agents/skills/eval-a2a-adoption/SKILL.md) | 评估流程落地时，先核验流程引用文件，再检查最新 10 个 Issue/10 个 PR，并按最近 4 个完整周交付量评级 | 必需文件确认缺失直接不合格；证据未知不得当作通过。只读评估，报告默认保存在当前用户系统临时目录，不自动修改或发布 GitHub 记录 |
| [estimate-issue](.agents/skills/estimate-issue/SKILL.md) | 创建或提交 Issue 前、或复核 Estimate 时，分析范围、实现、测试、依赖和不确定性 | 输出唯一的 1/2/3/5/8/TBD 及依据；建议点数由 Owner 确认。技能只读分析，提交由已获授权的调用者完成，未确认或 TBD 时保持 AI Ready=No |
| [check-issues](.agents/skills/check-issues/SKILL.md) | 检查当前仓库 Open Issues 的进展、阻塞和待办，与上次成功快照比较 | 完整分页并读取必要评论/关联证据；报告和快照只保存在当前用户系统临时目录，不写入仓库或上传 GitHub；不把关闭或活动变化直接视为已完成 |

### 全公司统一 Issue Contract

所有研发 Issue 至少必须包含：


| 字段                    | 要求                                            |
| --------------------- | --------------------------------------------- |
| `Type`                | Feature / Bug / Design / Tech Debt             |
| `Subsystem`           | HireOS 受影响子系统，与 Issue Form 选项一致              |
| `Problem`             | 当前问题，不描述解决方案                                  |
| `User Outcome`        | 用户完成后获得什么                                     |
| `Scope`               | 本次包含内容                                        |
| `Non-goals`           | 明确不做什么                                        |
| `Acceptance Criteria` | 可机器验证的完成条件                                    |
| `References`          | PRD / Design / API / ADR 等 GitHub 文件          |
| `Dependencies`        | 其他 Issue/API/服务                               |
| `Risk`                | low / medium / high                           |
| `Owner`               | 最终负责监督 AI 的人                                  |
| `Estimate`            | 1 / 2 / 3 / 5 / 8 / TBD；实施前由 Owner 确认点数，见下方规则 |
| `AI Ready`            | Yes/No；No 时 Codex 不允许实现                       |


### Estimate 管理规则

Estimate 是 Issue 的相对工作规模，包含实现、测试、文档和验收，不直接换算工时或业务价值，也不用于跨团队排名或个人绩效。所有类型的 Issue 使用同一字段；当前只增加 Estimate，不增加周计划、时间或成本字段，也不自动生成周报。

| 点数 | 起始参考 |
| --- | --- |
| 1 | 单点修改，验证范围小 |
| 2 | 局部行为变更，需要补测试 |
| 3 | 完整的小功能，涉及多个状态 |
| 5 | 跨模块变更，验证范围较大 |
| 8 | 复杂但可独立验收的交付，涉及兼容、迁移或多个系统 |
| TBD | 尚不能可靠估算，等待澄清或分诊 |

1. Agent 创建或提交 Issue 前，调用 [estimate-issue skill](.agents/skills/estimate-issue/SKILL.md) 分析范围、代码、测试、依赖和不确定性，输出唯一建议点数或 TBD 及依据；其他 Agent 可直接读取该文件执行。创建时填写评估结果，Owner 在设为 `AI Ready=Yes`、开始实施前确认具体点数，并以 `[HUMAN-DECISION]` 评论留存依据。TBD 时保持 `AI Ready=No`。
2. 用同一团队已完成的 Issue 校准估算。预计超过 8 点时优先拆为可独立验收的 Issue；若尚不能拆分，先澄清或定义有明确交付物的调查任务，保留 TBD。
3. 实施后保留开工时确认的点数。范围变化通过 `[HUMAN-DECISION]` 记录原点数、变化原因及调整估算；新增可独立交付的范围优先另建 Issue。实际耗时变化本身不改变点数。
4. 历史 Issue 本次不批量回填；后续进入实施时按新契约补齐。读取历史记录时，缺失字段记为未知，不猜测点数。
5. 后续统计时，仅累计首次达到验收完成标准的可交付 Issue 的开工点数；父子 Issue 只计一层，取消、重复关闭及同一范围重开后的返工不重复计点。点数衡量交付规模，业务结果和质量另行评估。

**Comment 协议：**

```text
[AI-PLAN]       AI准备如何执行
[AI-QUESTION]   AI发现信息不足
[AI-EVIDENCE]   测试/日志/代码证据
[AI-BLOCKED]    无法继续及原因
[HUMAN-DECISION] 人类做出的正式决策
[AI-RESULT]     AI任务完成摘要
```

原则是：**人尽量不要解释给另一个人，再让第二个人解释给 AI。** 人修改 Issue/File，Codex/Claude 等 Agent 直接读取同一份 GitHub 上下文。

### 流程落地评估

使用 [eval-a2a-adoption skill](.agents/skills/eval-a2a-adoption/SKILL.md) 评估当前项目的流程执行与交付规模，输出【不合格】、【合格】、【良好】、【优秀】及评估报告。先递归核验本流程直接或间接引用的配置、指引、约束及支撑文件，确认任何必需文件缺失即直接判【不合格】，报告缺失路径、引用来源和完整引用链，不受样本数量或交付量影响。文件完整性通过后，基础检查按创建时间选最新 10 个 Issue 和 10 个 PR，核验格式与当前阶段适用的处理过程；有确证违规则不合格。基础通过后，按最近 4 个完整自然周（默认 Asia/Shanghai、周一至周日）每周的已验收 Feature/Bug 数量和两类 Estimate 合计判断更高等级，三个指标须同时达标。具体门槛、统计排除规则和报告格式以技能为准。

仅创建技能不会执行真实评估。采集或证据不足时报告缺口并暂停正式评级，不把未知结果当作流程失败；抽样结论只适用于所检查的记录和观察窗口。

### 全公司统一 PR Contract

```markdown
## Linked Issue
Closes #____

## What Changed

## Spec / Design References

## Acceptance Criteria
- [ ] ...

## Test Evidence
- Unit:
- Integration:
- E2E:
- Codex QA report (post-merge): pending until merge

## AI Review
- [ ] Codex review passed
- [ ] Security review passed / N/A

## Risk & Rollback

## Documentation
- [ ] Updated / N/A

## Human Supervisor
@____
```

默认 Merge Gate：

`Build → Lint → Type Check → Unit → Integration → Codex Review（含安全审查）→ Merge gate → Human Supervisor → Merge`

合并后独立执行 `Codex QA → Quality Ledger → Human Supervisor 业务验收/缺陷分诊`。QA 只针对合入默认分支的普通产品 PR，验收实际 merge/squash/rebase 结果；未合并关闭与质量证据 PR 不执行产品 QA。Review 绑定 PR head，QA 绑定实际合并提交，两阶段证据分别保存。当前 CI 没有独立 E2E 步骤，适用的 E2E 验证按 Issue 与测试策略执行。

`Closes #123` 引起的 Issue 自动关闭不等于验收完成；最终交付仍须有合并后 QA 和 Human Supervisor 的验收证据。QA 失败不会逆转已发生的合并，应分诊缺陷并关联修复。

GitHub 可以把 status checks、PR review、conversation resolution 等配置为不可绕过的 merge 条件，并可对高并发仓库使用 Merge Queue。Codex GitHub Review 可以自动审查 PR，也可以在 PR 中使用 `@codex review` 要求专项检查。

## 需求与设计角色指南



### 角色操作表


| 角色             | 必须维护的 Files                                                                                      | Issue 操作                                                                                                                | PR 操作                                               | AI 工具交互                                                                                                      | 每日例行                                           | 验收标准                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------- |
| **产品经理 / 需求方** | `docs/product/*.md`：长期产品背景；`docs/specs/<issue>.md`：复杂功能规格                                        | 创建 Feature Issue；必填 Problem、Outcome、Scope、Non-goals、Acceptance Criteria；在 `AI Ready=Yes` 前确认 Estimate 点数并消除 TBD；所有需求变更以 comment+文件修改完成 | 只审核“是否满足业务 Acceptance Criteria”；不审核代码实现细节           | 先让 AI 将自然语言需求反向提问、找矛盾、生成边界案例；确认后写入 Issue；让 Codex 根据 Issue 自动拆任务                                              | 清理 `AI Ready=No`；回答 `[AI-QUESTION]`；检查需求变更是否回写 | 开发启动时 Acceptance Criteria 完整率 100%；实现阶段不得存在影响行为的 TBD；需求变化均可追溯到 comment |
| **设计师**        | `docs/design/<issue>/design-spec.md`：设计意图；`assets/`；`states.md`：页面状态；`handoff/`：Claude Design 输出 | Design Issue 必填用户流、目标平台、组件约束、loading/empty/error/permission 状态；完成后评论 `[AI-RESULT] design-ready`                         | 审核视觉/交互结果截图，不直接要求工程师口头修改；问题直接写 PR comment，让 Codex修正 | **Claude Design 为默认新设计工具**；输入 Issue + Design System，生成 prototype；最终输出 handoff bundle/截图/规格到 GitHub；Codex据此实现 | Review AI 生成设计；处理设计异常；保证所有设计变化落盘 GitHub        | 每个功能具有主流程+异常状态；Web/mobile 差异明确；PR 截图可与设计基准核查                           |




### Figma 向 Claude Design 的迁移

Anthropic 在 2026 年推出 Claude Design，其官方工作流支持根据文本、图片、文档、代码库和设计文件构建设计，可读取团队设计系统、制作交互 Prototype、组织内共享并生成给 Claude Code 的 handoff bundle。

## 研发角色指南


| 角色                      | 必须维护的 Files                                                                     | Issue 操作                                                                             | PR 操作                                                       | AI 工具交互                                                                       | 每日例行                                           | 验收标准                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| **后端工程师**               | `backend/AGENTS.md`；`docs/api/openapi.`*；相关 ADR；测试目录                            | 只接受 `AI Ready` Issue；检查 API/Data/Security Acceptance；把缺失信息以 `[AI-QUESTION]` 留在 Issue | PR 必须更新 API contract、迁移说明、测试证据；Codex Review 无 blocker 才可合并  | 把 Issue URL/编号作为 Codex 主输入，不重新口述需求；让 Codex“先读取 Issue→spec→AGENTS→实现→测试→提交 PR” | 审查 Agent PR；处理 blocked；维护 backend AGENTS 中真实命令 | API contract 与实现一致；新增行为有自动测试；breaking change 必须 ADR/版本策略                 |
| **前端工程师**               | `web/AGENTS.md`；组件约定；必要时 `docs/design/...` 实现备注                                 | 检查设计引用、API contract、响应式与状态要求；信息不足不自行猜测                                               | 必填 screenshots、浏览器/E2E 结果、设计差异；视觉问题直接让 Codex根据 PR comment 修 | Codex读取 Claude Design handoff、截图和现有 component system；让 Codex自行视觉对照并修复         | Review Codex UI diff；关注可访问性/异常状态/设计偏差          | 关键流程 E2E 通过；loading/empty/error 均实现；设计差异均显式说明                            |
| **移动端工程师**              | `ios/AGENTS.md`、`android/AGENTS.md`；`docs/mobile/platform-matrix.md`            | Issue 必填 iOS/Android 差异、最低 OS、权限/离线/生命周期要求                                           | PR 必填平台、设备/模拟器矩阵、截图、E2E/UI-test 结果                          | Codex分别读取平台 AGENTS；不要用通用 Prompt 隐含平台约束；让 Agent 自动生成平台特定测试                     | Review crash/权限/升级问题；监督 App 特定 Agent PR        | 指定 OS/device matrix 通过；关键流程自动测试；权限/恢复/网络异常有验证                            |
| **AI 工程师 / Prompt 工程师** | 根 `AGENTS.md`；`.agents/skills/*/SKILL.md`；`evals/`；Prompt/schema；Agent contract | Issue 必填目标行为、eval dataset、success metric、failure examples；Prompt 修改必须 Issue 化        | PR 必填 before/after eval、模型/配置变化、成本/延迟影响、failure analysis    | 用 Codex 编写/运行 eval；重复工作固化为 Skill，不把长期规则埋在个人 Prompt；输出尽量 JSON Schema 化         | 查看 agent failure；将重复人工纠正转成 eval 或 Skill        | eval 不退化；关键 Agent 行为具有 deterministic/rubric checks；失败案例进入 regression set |


repo 使用规则写入 `AGENTS.md`，所有工程 Issue 给 Codex 使用统一输入：

```text
Execute GitHub Issue #123.

Authoritative context:
1. Issue #123 and every GitHub comment
2. Repository AGENTS.md
3. Files explicitly linked by Issue #123
4. Existing code/tests

Rules:
- Verify Estimate is 1, 2, 3, 5 or 8 and confirmed by Owner before implementation; follow the Estimate rules in a2a_dev_process.md.
- Do not infer unresolved product requirements.
- If blocked, comment [AI-QUESTION] on the Issue.
- Implement the smallest change satisfying acceptance criteria.
- Add/update automated tests.
- Update required documentation.
- Open a PR using repository template.
- Include test evidence and link Closes #123.
```

让**任务信息存在 GitHub，由不同 Agent 重复消费**，避免不断膨胀 `AGENTS.md`，只保留跨任务真正稳定的指令。

## 产品经理负责质量管理的指南



### 去掉传统的测试角色，由产品经理使用Codex 取代传统 QA 的标准流水线

每次 PR 自动触发：

```text
PR 创建或更新
       │
       ▼
Build / Lint / Type Check / Unit / Integration
       │
       ▼
Codex Review（含 Security Review）
       │
       ▼
Merge gate → Human Supervisor → Merge 到默认分支
       │
       ▼
Codex QA Agent（检验实际合并提交）
       │
       ├──读取 Issue Acceptance Criteria
       ├──读取代码 diff
       ├──识别缺失测试
       ├──执行/补充测试
       ├──检查异常路径
       ├──检查 API/UI/Agent behavior
       └──生成结构化 QA result
       │
       ▼
Quality Ledger（合并前 Review 与合并后 QA 分阶段发布）
       │
       ├── PASS → Human Supervisor 业务验收
       │
       └── FAIL
              │
              ├── PR comment
              ├── 创建 Bug Issue
              └── 写入 Quality Ledger
```

`Codex QA` 输出 schema：

```json
{
  "result": "pass|fail",
  "issue": 123,
  "pr": 456,
  "commit": "...",
  "acceptance_criteria": [
    {
      "id": "AC-1",
      "result": "pass|fail",
      "evidence": "..."
    }
  ],
  "tests_added": [],
  "tests_executed": [],
  "regressions": [],
  "bugs": [
    {
      "severity": "S1|S2|S3|S4",
      "title": "...",
      "reproduction": "...",
      "evidence": "..."
    }
  ]
}
```

Codex 非交互运行支持 JSONL 事件以及 JSON Schema 约束输出，因此这种方式比让 QA Agent 输出自由文本更容易自动检查、比较和归档。

### 测试报告与 Bug 必须成为 Codex 可访问知识

Issue / PR双层存储：

```text
GitHub Issue / PR
      │
      ├──操作状态、comments、负责人
      │
      └──链接到
           ↓
Repository files
docs/quality/
├── reports/
│   └── PR-456.md
└── bugs/
    └── BUG-789.md
```

其中：

**PR comment** 保存本次 QA Summary；**Actions Artifact** 保存大量日志、截图、coverage 等原始证据；`docs/quality/reports/PR-456.md` 为长期索引，`PR-456-review.md` 与 `PR-456-qa.md` 分别保存合并前/后的可搜索摘要及各自提交身份；**Bug Issue** 负责 workflow 状态；`docs/quality/bugs/BUG-789.md` 由自动化镜像关键上下文，供后续 Codex 读取。

GitHub Actions 原生支持将测试输出上传为 artifacts，也支持把 Markdown 测试摘要直接写到 workflow run summary。

Bug 文档采用机器友好的 front matter：

```yaml
---
issue: 789
status: open
severity: S2
source_pr: 456
affected_paths:
  - backend/auth/
reproduced_by_codex: true
fix_pr:
---
```

然后正文固定为：

```markdown
# Symptom
# Expected
# Reproduction
# Evidence
# Root-cause hypothesis
# Fix verification
```

这样修复 Agent 的输入可以极简为：

> Fix #789. Read the Issue, all comments and `docs/quality/bugs/BUG-789.md`. Reproduce first, then fix, add regression test, update bug document and open PR.

这实现真正的：

**Codex-QA → GitHub Bug → Codex-Fix → PR → Codex-Review**
