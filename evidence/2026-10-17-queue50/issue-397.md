### Type

Bug

### Subsystem

hireos-written

### Problem

2026-10-16 线上已发布、已结束的一条 Written Test Case，在同一 Evaluation result 页面同时显示最终人工分数 5/100、候选人结果 `This assessment did not meet the bar for this role`，以及 `Testing closed · Reason: Passed`。页面没有说明“未达标”与“Passed”为何并存，招聘者无法从回看页判断关闭决定的依据。截图见创建后的 `[AI-EVIDENCE]` 附件评论。此观察不证明评分或关闭决定本身错误，也不推断后端状态被覆盖。

### User Outcome

招聘者能分别识别已发布测评结果与关闭测评的业务决定；两者看似相反时，可查看决策依据并复核相应记录。

### Scope

核对已发布结果、关闭原因及审计记录的来源；明确允许的状态组合与冲突提示；修正 Evaluation result 的呈现及必要的保存校验，并补自动回归测试。

#### Confirmed decision

[HUMAN-DECISION] 2026-10-17 追加确认：新增并保存人工确认的结构化“达标/未达标”结论；历史无结论显示未知，选择 Passed 时必须填写理由。不解析自由文本，也不以原 UI 默认 65 分线推定结论。新发布请求必须提供 assessmentOutcome=met/not_met；历史只读兼容。

[HUMAN-DECISION] 2026-10-17：用户在本任务确认 Estimate=5（回复“确认以上点数”）。允许测评未达标时人工选择 Passed，但必须记录覆盖理由、决定人和时间；历史决定和已发布测评不自动改写。

#### Estimate analysis

增量审计字段与历史兼容、DTO/API 校验、事务保存、内部回看及 UI/API/并发测试；不重建评分/通知系统。#399 重叠范围不重复累计交付量。

### Non-goals

不根据 5/100 自动推翻人工决定，不重算评分，也不直接修改这条已发布的真实候选人结果。

### Acceptance Criteria

- AC-1: 已发布测评未达标而人工选择 Passed 时，提交前提示覆盖并收集非空理由；服务端校验并保存理由、可信决定人和时间，直接 API 请求不能绕过。
- AC-2: 回看页区分已发布测评结果与人工关闭决定；显示可核查的覆盖说明，对历史缺失字段如实显示未记录，不改写原结果或历史决定。
- AC-3: 自动测试覆盖正常通过、未达标拒绝、未达标人工通过、缺理由及异常/并发路径，核对 UI/API/持久化一致性及失败无部分写入。

### References

- `docs/product/Written_Test/W09_Result_Release/PRD.md`（结果发布与 Next action）
- `docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md`（U1、U4；按本次 Written Test 场景采用）
- 本地测试记录：`docs/product/Written_Test/W10_Revision_Supplemental/Test_Report_2026-10-16.md` E04；截图见创建后的 `[AI-EVIDENCE]` 评论。

### Dependencies

与 #399 共用同一修复和证据，主实现由本 Issue 承接；产品覆盖政策已确认。

### Risk

medium

### Owner

@JsonSuCoder

### Estimate

5

### AI Ready

Yes

### Reproduction

1. 在同一线上登录会话打开 Written Test → My Tasks → 已结束的一条 Case → Evaluation result。
2. 对照 Final overall、Candidate preview Outcome 和 Next action 的关闭原因。2026-10-16 一次线上只读检查复现；未对真实记录执行写入。

### Expected / Actual

Expected: 测评结果与关闭决定的含义清楚；若结论不同，页面给出可核查的决策说明。

Actual: 同屏显示 5/100、`This assessment did not meet the bar for this role`、`Reason: Passed`，无解释。

### Environment

2026-10-16 线上 `https://hireos.aipollo.me/hireos/written/tasks`；Chrome 桌面；线上构建 SHA 未知。本地参考 HEAD `c4b610500d33a279c03251091c5f0af13b831318`，未核实等于线上版本。截图已裁去候选人姓名和邮箱，见附件评论。

### Severity

S2
