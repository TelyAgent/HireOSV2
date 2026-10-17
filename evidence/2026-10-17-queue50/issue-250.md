### Type

Bug

### Subsystem

hireos-interview

### Problem

线上草稿与已确认 Rubric 卡显示要求、权重及 Expected evidence，但未显示 Required L、简历匹配 Claim、无匹配空状态和 STAR 追问。草稿编辑面板也没有 Required L 字段。

### User Outcome

HR/HM 能在每张能力卡上看到通过门槛、待核实的简历经历和对应追问。

### Scope

能力卡的等级要求、Claim、无匹配状态与 STAR 追问的呈现和保存。

#### Confirmed decision

[HUMAN-DECISION] 2026-10-17：用户在本任务确认 Estimate=5（回复“确认以上点数”）。能力验证卡作为现有 Rubric 页的候选人视图，复用同一能力 ID 和 JD 等级；Claim 按候选人隔离，STAR 复用现有生成能力，不新建独立卡片审批流程。Required L 来自 JD 结构化字段。

#### Estimate analysis

复用 #325 等级基础和现有 Brief STAR；新增候选人 Claim、引用校验、空/错误/版本状态及 UI/API 回归。跨模块为 5，等级基础不重复计点。#325 完成并验证后解除依赖。

### Non-goals

不将简历 Claim 当作已验证事实；不自动决定候选人是否达标。

### Acceptance Criteria

AC-1:每张能力卡显示并可核查 Required L 及其含义。
AC-2:有相关简历时显示带来源且标记为待核实的 Claim；无匹配时显示 No matching experience found。
AC-3:每张卡显示与该能力相关的 STAR 追问；自动测试覆盖有简历与无简历的两种数据。

### References

docs/product/Interview/I03_Requirements_Rubric/PRD.md（当前本地工作树，尚未提交） FR-3、FR-6；docs/product/Interview/I03_Requirements_Rubric/User_Cases.md（当前本地工作树，尚未提交） UC-I03-05；docs/product/Interview/I03_Requirements_Rubric/Test_Report_2026-10-15.md（当前本地工作树，尚未提交） F-03。

### Dependencies

Refs #325（JD 逐项等级链路已在同分支提供，L3/L4/未知来源及快照回归通过；全量本地验收仍继续）。对象关系已确认：Rubric 页候选人视图，不是新独立审批对象。本项可开始接入，不代表 #325 已关闭。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

打开草稿和已确认 Rubric，查看能力卡及草稿编辑面板；对照 PRD FR-3、FR-6 的必需字段。

### Expected / Actual

预期：能看到 Required L、Claim 或无匹配提示、STAR 追问。实际：只显示要求、优先级、权重、Expected evidence 等。

### Environment

线上 https://hireos.aipollo.me/hireos/interview/；2026-10-15；Chrome 桌面端；线上构建号未知。本地源码仅作为旁证，未证明与线上部署完全一致。

### Severity

S2

### Estimate

5
