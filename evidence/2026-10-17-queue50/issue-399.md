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

#### Confirmed decision

[HUMAN-DECISION] 2026-10-17 追加确认：新增并保存人工确认的结构化“达标/未达标”结论；历史无结论显示未知，选择 Passed 时必须填写理由。不解析自由文本，也不以原 UI 默认 65 分线推定结论。新发布请求必须提供 assessmentOutcome=met/not_met；历史只读兼容。

[HUMAN-DECISION] 2026-10-17：用户在本任务确认 Estimate=5（回复“确认以上点数”）。允许人工 Passed 覆盖未达标测评，必须记录并显示理由、决定人和时间；测评结果和关闭决定分别展示。

#### Estimate analysis

按独立完整范围同样涉及审计迁移、服务端校验和 API/UI 回看，评为 5；实际与 #397 合并实施，不额外累计 5 点。

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

与 #397 共用修复、迁移和证据；由 #397 主实现，两项分别核对 AC，重复范围仅计一次交付量。

### Risk

medium

### Owner

@mincai2010-maker

### Estimate

5

### AI Ready

Yes

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
