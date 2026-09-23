# HireOS Written Test Agent 对话交互流程

本文档描述 Written Test Agent 的模拟对话流程。说明使用中文，所有 Agent、用户、系统和按钮文案统一使用英文。

## 1. Agent 定位

Written Test Agent 是测评负责人使用的流程辅助 Agent，负责读取 Case、Round、Invitation、Submission、Evidence、Evaluation 和 Release 状态，帮助负责人完成检查、分析和下一步动作准备。

Agent 可以生成建议、执行查询和准备低风险动作。涉及候选人状态、轮次、邀请、评分发布和测评关闭的动作，必须先生成 Proposal，再由负责人确认。

## 2. 对话入口

打开 Agent 后，先展示当前上下文：

```text
Current case: Alex Morgan — Finance Operations Analyst
Current round: Round 1 — FIN-001
Current status: Result released
Current owner: John
```

Agent 首屏：

```text
Hello, I’m the Written Test Agent. I can check assessment status, explain evidence, prepare a revision or supplemental test, and create action proposals that require your confirmation.
```

快捷问题：

```text
Check Alex’s assessment status
Start a revision for Alex
Add a supplemental test for Alex
Why can’t this result be released?
Prepare the Interview handoff
```

## 3. 标准对话结构

```text
User intent
→ Read assessment context
→ Return facts and evidence
→ Provide recommendation or proposal
→ Ask for confirmation
→ Execute the confirmed action
→ Return the result and next step
```

Agent 回复需要区分事实、建议和动作。动作涉及状态变化时必须显示确认步骤。

## 4. 场景一：检查测评状态

### User

```text
Check Alex’s assessment status.
```

### Agent

```text
I checked Alex Morgan’s Written Test assessment:

- Round 1: FIN-001
- Status: Result released
- Submission: September 10, 2026 at 14:32
- AI evaluation: Complete
- Human review: Complete
- Finalize: Complete
- Candidate result: Released
- Candidate action required: None

Score: 70/100.
The largest gap is Reimbursements and exceptions, currently scored at 10/20.
```

### Quick actions

```text
[View scoring evidence] [Prepare revision] [Add supplemental test] [Prepare Interview handoff]
```

这一步为只读查询，不需要确认。

## 5. 场景二：解释评分和 Evidence

### User

```text
Why did Alex receive 10 points for Reimbursements and exceptions?
```

### Agent

```text
This competency is worth 20 points and the current human score is 10/20.

Evidence found:
- Submitted memo, section 3: describes the approval flow for expense exceptions.
- Evidence coverage: Partial.

Missing evidence:
- No clear escalation path for high-value exceptions.
- No complete review log or exception ledger.
- Controls are described at a principle level without execution steps.

The AI draft score was 8/20. Human review changed it to 10/20.
This is partial evidence coverage, not an unassessed competency.
```

### User

```text
Add this gap to a revision recommendation.
```

### Agent

```text
I prepared a Revision round 1 proposal:

- Revision goal: Add the escalation path, review log, and control steps for expense exceptions.
- Competency: Reimbursements and exceptions
- Suggested deadline: September 20, 2026 at 23:59
- Candidate-visible feedback: Yes
- Original round: Locked and preserved

This will create a new Round, PlanItem, Invitation, and candidate thread.
Would you like me to create the revision proposal?

[Create revision proposal] [Edit feedback]
```

## 6. 场景三：创建 Revision round

### After the user selects Create revision proposal

```text
The revision proposal is ready and waiting to be sent:

- Round: Revision round 1
- Invitation: Draft
- Thread: Independent revision thread
- Candidate: Alex Morgan
- Deadline: September 20, 2026 at 23:59
- Original submission: Read-only

Next steps:
[Preview candidate feedback] [Send revision invitation] [Back to Release]
```

### User

```text
Send the revision invitation.
```

### Agent

```text
Pre-send checks are complete:

✓ Candidate identity verified
✓ Job link valid
✓ Revision round is independent from Round 1
✓ Question and rubric versions locked
✓ Portal upload enabled
✓ Deadline is valid

The candidate must accept Revision round 1 before starting.
Confirm sending the revision invitation?

[Confirm send] [Cancel]
```

### After confirmation

```text
The revision invitation was sent.

The candidate can now see Revision round 1 in the Portal.
Round 1 remains Released. The revision round is Awaiting acceptance.
```

## 7. 场景四：增加 Supplemental test

### User

```text
Add a supplemental test for Alex focused on Bank reconciliation.
```

### Agent

```text
I found two questions in the Question Bank:

1. FIN-003 — Bank reconciliation deep dive
   Estimated time: 45 minutes
   Competencies: Bank reconciliation; Controls and communication

2. FIN-005 — Exception-ledger review
   Estimated time: 35 minutes
   Competency: Bank reconciliation

The supplemental test will create a new Round and will not modify the completed Round 1.
Please choose a question or adjust the competency scope.
```

### User

```text
Choose FIN-003.
```

### Agent

```text
The supplemental test proposal is ready:

- Round: Round 2 — Supplemental
- Question: FIN-003
- Estimated time: 45 minutes
- Submission: Portal upload + verified email
- Evaluation: Separate evaluation linked to the same Case

Create the new supplemental invitation?

[Create supplemental invitation] [Change question]
```

### After creation

```text
The supplemental round was created.

- Invitation: Sent
- Candidate Portal: New task available
- Round 1: Locked
- Round 2: Awaiting acceptance
```

## 8. 场景五：候选人提交和 Evidence 处理

### System event

```text
Alex submitted Revision round 1.
```

### Agent

```text
Alex’s Revision round 1 submission was received.

Submission checks:
✓ Sender is a verified email address
✓ Reply thread matched
✓ Round matched
✓ Two required files received
✓ File scan passed

Current status: Submitted — awaiting evaluation
```

### 异常示例

```text
I could not automatically assign this email to a round:

- Sender identity: Verified
- Thread match: Failed
- Attachments: Received

The submission was placed in Needs confirmation. Automatic scoring has not started.

[Open submission details] [Mark as not a match]
```

## 9. 场景六：AI 初评和人工复核

### User

```text
Start evaluating Alex’s revised answers.
```

### Agent

```text
I will create an AI draft evaluation. Nothing will be released automatically.

Scope: Revision round 1
Rubric: FIN-001 v3
Evidence: Two submitted files

Five competencies will be evaluated. Low-confidence and insufficient-evidence items will be flagged for human review.

[Start AI evaluation]
```

### After evaluation

```text
The AI draft evaluation is complete:

- 3 competencies: Full evidence
- 1 competency: Partial evidence
- 1 competency: Low confidence
- Suggested overall score: 78/100

Human review is required for:
- Reimbursements and exceptions: Insufficient evidence coverage
- Controls and communication: AI/human score difference exceeds 5 points

[Open human review] [View evidence]
```

## 10. 场景七：Finalize 和发布

### User

```text
Check whether Alex’s result is ready to release.
```

### Agent

```text
Release checks:

✓ All required competencies have human scores
✓ Low-confidence items have been reviewed
✓ AI/human differences have an explanation
✓ Candidate-visible feedback is ready
✓ Internal ranking will not be shown to the candidate
✓ Answer keys and internal reviewer notes will not be exposed

The result is ready to finalize.

[Open Finalize] [Preview candidate view]
```

### User

```text
Finalize and release the result.
```

### Agent

```text
This action changes the candidate-visible assessment status.

Candidate: Alex Morgan
Disclosure: Score + summary
Result: 78/100
Feedback: Ready

Confirm releasing this result?

[Confirm release] [Edit result]
```

### After confirmation

```text
The result was released.

- Release status: Published
- Candidate Portal: Result visible
- Internal review information: Internal only
- Revision history: Recorded
- Available next steps: Interview handoff, supplemental test, hold, close testing, or cross-role pivot
```

## 11. 场景八：Interview handoff

### User

```text
Prepare Alex’s Interview handoff.
```

### Agent

```text
The Interview handoff is ready:

- Final score: 78/100
- Strengths: Bank reconciliation; Accountant package
- Interview verification needed: Controls and communication
- Revision change: Reimbursements and exceptions improved by 8 points
- Suggested interview probe: Ask the candidate to walk through a complete escalation and review process for an expense exception.
- Excluded: Internal ranking, unnecessary personal information, and internal answer keys

[View handoff package] [Send to Interview]
```

发送到 Interview 前需要负责人确认。

## 12. 异常与升级规则

以下情况必须停止自动处理：身份无法确认、邮件无法匹配轮次、文件存在安全风险、题目版本变化、没有符合硬约束的模型、预算不足且没有回退模型、AI 与人工分差过大、候选人结果包含内部信息、修订或补测未创建独立邀请。

统一回复：

```text
I paused automatic processing because I found: {exception}.

Completed safely: {completed steps}
Blocked: {blocked action}

Recommended human action: {next step}

[Open details] [Continue manually]
```

## 13. Agent 对话审计记录

每次对话记录以下字段：

- conversation_id
- case_id
- round_id
- invitation_id
- User message
- Agent context
- Rules and model version used
- Agent recommendation
- Proposal created or not
- Confirmation required or not
- Final operator
- Execution result
- Timestamp

这些信息可在 Activity、Task History 和 Case Timeline 中回放。
