### Type

Bug

### Subsystem

hireos-written

### Problem

已关闭结果页同时显示人工评分 `5/100`、候选人结果“未达到岗位标准”，以及 `Testing closed · Reason: Passed`。页面没有解释 `Passed` 是能力通过、仅表示流程结束，还是人工覆盖决定，导致结果和关闭状态难以一致理解。

线上截图及可访问树证据见后续 `[AI-EVIDENCE]` 评论。本问题只确认页面信息冲突；现有证据不足以断定人工决定本身错误。

### User Outcome

HR 和后续接手者能准确理解测评结果、关闭原因及其决策依据，不会因 `Passed` 的歧义误判候选人状态。

### Scope

- 明确 `passed` 关闭原因的业务语义。
- 调整结果页关闭状态文案，使测评结论与流程决定可以区分。
- 在需要人工覆盖时展示决策人、时间和依据。
- 补充低分、正常通过、人工覆盖组合的自动测试。

#### Estimate analysis

当前无法可靠估算：产品尚未确认 `passed` 是能力结论还是流程关闭类型，且审计展示范围未定。语义确认后再由 Owner 评估局部文案修复或状态模型调整的规模。

### Non-goals

- 不根据分数自动改写已有人工决定。
- 不重新评估或更改现有候选人的评分。
- 不改变 W09 的发布规则。

### Acceptance Criteria

- AC-1: 当关闭原因与测评结论含义不同时，结果页明确区分二者，并通过组件测试验证两类信息不会合并成同一个“通过”状态。
- AC-2: 当人工决定覆盖测评结论时，授权用户能看到决策人、决定时间和覆盖依据，并通过 API 与 UI 集成测试验证一致性。
- AC-3: 自动测试覆盖低分未通过、正常通过、人工覆盖三种状态组合，确认每种组合的关闭文案与决策记录准确。

### References

- `docs/product/Written_Test/W11_Next_Action_Handoff/PRD.md`：FR-3、AC-5。
- `docs/product/Written_Test/W11_Next_Action_Handoff/Test_Report_2026-10-16.md`：F01。
- `docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md`：U1、U4、U5。

### Dependencies

产品需确认 `passed` 的准确业务含义，以及人工覆盖时必须保留的审计字段。

### Risk

medium

### Owner

@mincai2010-maker

### Estimate

TBD

### AI Ready

No

### Reproduction

前置条件：线上存在一个已发布并已关闭、关闭原因为 `passed` 的 Case。

1. 打开 Written Test 的 My Tasks。
2. 进入状态为 `Testing closed` 的 Case。
3. 打开 `Evaluation result`。
4. 同时查看人工总分、Candidate preview 和 Next action 中的关闭原因。

本轮观察频率为 1/1 个符合前置条件的可访问样本。

### Expected / Actual

预期：页面清楚区分测评结论与流程关闭决定；若人工决定覆盖低分结果，应展示覆盖依据。

实际：同页显示人工 `5/100`、`This assessment did not meet the bar for this role` 和 `Testing closed · Reason: Passed`，没有解释三者关系。

### Environment

- 时间：2026-10-16，Asia/Shanghai。
- 环境：`https://hireos.aipollo.me/hireos/written/`，Chrome 桌面浏览器。
- 线上构建号：未知。
- 本地参考 HEAD：`c4b610500d33a279c03251091c5f0af13b831318`，不代表线上构建。
- 截图含候选人信息，仅供仓库授权成员处理；见 `[AI-EVIDENCE]` 评论。

### Severity

S3
