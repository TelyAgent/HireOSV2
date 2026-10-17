### Type

Bug

### Subsystem

hireos-interview

### Problem

I07 的问题卡中，`Skip` 只更新 `LiveQuestionPanel` 的组件状态；刷新或离开页面后状态消失，Review 无法区分「未问」和没有记录的题目。最后一题的 `Skip` 按钮也被禁用。证据是当前仓库代码与 PRD AC-3；预发布 Live 主流程尚未复现，待隔离轮次验证部署版本。

### User Outcome

面试官可跳过任意题，Review 能看到该题明确标为「未问」，刷新后不丢失。

### Scope

保存每题实际处理状态，允许跳过最后一题，将状态交接到 Review，并补足前后端自动回归。

#### Confirmed decision

[HUMAN-DECISION] 2026-10-17：用户回复“确认范围与 5 点”。按轮次和题目持久化未问状态，保留首次操作人和时间；重复 Skip 幂等，不自动改评分，Live 刷新和 Review 均显示。

#### Estimate analysis

复用现有轮次、题目和 Review API，增加增量持久化、幂等写入、跨页面读取和数据库/浏览器回归。跨前后端与两页面，5 点；无新评分或独立流程，不扩为 8 点。

### Non-goals

不改变 Brief 的问题生成、问题排序或自动评分。

### Acceptance Criteria

- AC-1: 给已排期轮次的任意问题（包括最后一题）执行 Skip 后，服务端保存该题为「未问」，并保留操作人、时间与题目身份；自动测试验证。
- AC-2: 刷新 Live 页面并进入对应 Review，跳过题仍显示「未问」，不会显示为已问或消失；集成测试验证。
- AC-3: 自动测试覆盖中间题、最后一题、重复 Skip 与刷新后的状态。

### References

[I07 PRD](https://github.com/TelyAgent/HireOSV2/blob/c4b610500d33a279c03251091c5f0af13b831318/docs/product/Interview/I07_Live_Interview/PRD.md)；[I07 User Cases](https://github.com/TelyAgent/HireOSV2/blob/c4b610500d33a279c03251091c5f0af13b831318/docs/product/Interview/I07_Live_Interview/User_Cases.md)；[I07 Loop IO](https://github.com/TelyAgent/HireOSV2/blob/c4b610500d33a279c03251091c5f0af13b831318/docs/product/Interview/I07_Live_Interview/Loop_IO.md)；[UX/UI 审查标准](https://github.com/TelyAgent/HireOSV2/blob/c4b610500d33a279c03251091c5f0af13b831318/docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)。

本地测试报告：docs/product/Interview/I07_Live_Interview/Test_Report_2026-10-15.md（尚未提交；线上 I07 主流程未取得隔离数据，不能据此声称预发布已复现）。；[问题卡代码](https://github.com/TelyAgent/HireOSV2/blob/c4b610500d33a279c03251091c5f0af13b831318/hireos-interview/job-Interview-front/src/features/live-interview/LiveQuestionPanel.tsx#L8-L62)。

### Dependencies

持久化和显示契约已由 Owner 确认；复用现有轮次/题目身份，不新增自动评分规则。

### Risk

medium

### Owner

@JsonSuCoder

### Estimate

5

### AI Ready

Yes

### Reproduction

当前仓库：打开 `LiveQuestionPanel.tsx`，可见 `skipped` 仅由 `useState` 保存，`skip()` 只更新该集合，且最后一题 `Skip` 使用 `disabled={last}`。预发布复现需隔离的已排期轮次，跳过题后刷新并查 Review/记录；本轮未具备该测试数据。

### Expected / Actual

预期：题目状态持久化，最后一题可标「未问」，Review 可识别。实际（代码证据）：跳过状态仅在本次页面访问中，最后一题无法点击 Skip；预发布实际行为待验证。

### Environment

本地仓库提交 `c4b610500d33a279c03251091c5f0af13b831318`；预发布入口：[Interview](https://hireos.aipollo.me/hireos/interview/)；部署 SHA 未知。Chrome/macOS；未进入隔离 Live 场次。附件为仓库代码截图，非线上复现截图。

### Severity

S2
