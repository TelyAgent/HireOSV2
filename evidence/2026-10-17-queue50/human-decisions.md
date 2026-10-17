# Human Decisions - 2026-10-17

Source: the user's answers to the three async questions in this chat. Branch: `codex/issue-fixes`.

Status: local reviewable comment drafts only, for publication through an authorized GitHub workflow. No Issue body, AI Ready, Estimate, state or production record was changed. No PR, push or merge. Product confirmation does not stand in for Owner approval of an Estimate.

## #93 / #87

[HUMAN-DECISION] 用户确认：“以最新 PRD 为准：10 项必填、Level 选填”。旧 Issue 中的 11 项必填口径需要同步为 10 项，Level 不再作为必填缺失项阻断。

本次确认不取消其他门禁：未确认 AI 草稿、未保存或过期 revision、真正的 Weak/阻断项仍需分别验收；Suggestions 与阻断项不能混计。Ready 后提交审批，不能将本次确认理解为允许绕过审批直接发布。

待做：同步 Issue 的完整验收正文；核查前后端同 revision 校验；补充仅缺 Level、缺一个必填字段、仅 Suggestions、真实 Weak、未确认/未保存/过期等回归，以及绕过 UI 请求无副作用的测试。不能据本次回答关闭 #93 或 #87。

## #397 / #399

[HUMAN-DECISION] 用户确认：“允许，但必须记录覆盖理由、决定人和时间”。因此测评结果未达标时允许人工选择 Passed；该操作是人工覆盖决定，不自动改变原测评结果。

待做：提交前提示冲突并收集覆盖理由；服务端校验并持久化覆盖理由、可信决定人和决定时间；API 与回看页清楚区分测评结论与人工决定，并展示相同审计信息。历史缺失信息应标为未记录，不自动改写历史决定，不补造理由、决定人或时间。

测试范围：正常通过、未达标关闭为 rejected、未达标覆盖为 passed、缺少覆盖理由、越权/跨工作区访问、重复/并发关闭与失败无部分写入，以及历史缺少审计字段的回看。上述是待验证范围，不是已通过测试。

## #325 / #250

[HUMAN-DECISION] 用户确认：“由 JD 的结构化字段传入”。每张能力卡 Required L 的权威来源为 JD 结构化数据，不由 HR 在 Rubric 中另行填写，也不以统一 L3 充当逐卡要求。

待做：核对并建立 JD 结构化要求、对应版本与能力卡之间的可追溯映射，使 Overview、Rubric 和 Debrief 使用同一已确认版本的逐项等级；Must-have 达标比较使用该项 Required L。覆盖同一项目分别要求 L3/L4 的测试。缺少等级的数据不能伪装成明确要求 L3；缺失数据如何处理仍应对照正式规格。

范围边界：最初回答只确认等级来源。用户随后在 Estimate 评估轮确认“按建议：Rubric 页候选人视图”：验证卡复用现有 Rubric 能力 ID 和 JD 等级，Claim 按候选人隔离，STAR 复用现有生成能力，不新建独立卡片审批流程。这解除对象关系问题，不代表 Claim 来源、无匹配状态和 STAR 追问已经实现或验收；这些 AC 必须保留。

## Execution Contract Recheck

Live issue bodies and all returned comments for all six issues were read with `gh issue view --repo TelyAgent/HireOSV2 --json number,title,body,comments` during this follow-up. The following checks used the previously collected body files under `/tmp/hireos-queue-contracts-gIZYvZ/`; the corresponding gate fields agree with the live responses.

Command for each row: `node .github/scripts/issue-contract.cjs /tmp/hireos-queue-contracts-gIZYvZ/<number>.md execution`.

| Issue | Exit | Validator result | Additional observed gate state |
| --- | --- | --- | --- |
| #93 | 1 | Missing Issue field: Estimate | AI Ready Yes |
| #87 | 1 | Missing Issue field: Estimate | AI Ready Yes |
| #397 | 1 | AI Ready must be Yes | Estimate TBD |
| #399 | 1 | AI Ready must be Yes | Estimate TBD |
| #325 | 1 | AI Ready must be Yes | Estimate 5, analysis explicitly says pending Owner confirmation |
| #250 | 1 | Missing Issue field: Estimate | AI Ready No |

[AI-BLOCKED] 产品问题已获得以上明确答复，但当前六个 Issue 的执行契约均未通过。按最新仓库指令，本次不开始这六项的新实现。解除条件：通过授权流程留存产品决定，补齐或确认 Estimate，核对剩余 AC/依赖，按完整正文校验后更新 AI Ready，再通过 execution 校验。不把本地评论草稿误报为已发布评论，也不把先前批次测试用作这些新行为的验收证据。
