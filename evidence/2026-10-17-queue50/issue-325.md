### Type

Bug

### Subsystem

hireos-interview

### Problem

同一 Must-have 在项目 Overview 显示要求 L4，在 Debrief 显示 `Required L3`。等级降低可能导致错误的达标判断。

### User Outcome

Hiring Manager 在各页面看到一致的已确认要求等级，并据此判断 Must-have 是否达标。

### Scope

Debrief 的逐项要求等级来源及达标状态计算。

#### Confirmed decision

[HUMAN-DECISION] 2026-10-17：用户在本任务确认 Estimate=8（回复“确认以上点数”）。Required L 由 JD 结构化字段传入，不由 HR 在 Rubric 单独填写，不以统一 L3 冒充逐项要求。原建议 5 点经本轮跨系统链路核查调整为 8，用户已确认。

#### Estimate analysis

当前 JD facade 将 requirements 压平成 label，CapabilityCard 无逐项等级，Debrief 使用统一阈值；需跨 JD/Interview 契约、增量迁移、版本兼容及 L3/L4 回归，故由建议 5 调整至 8。不是依据实际耗时改分。

### Non-goals

不修改已确认 Rubric 的内容。

### Acceptance Criteria

AC-1: Debrief 对每项能力展示与当前确认版本一致的要求等级
AC-2: Must-have 达标状态使用该项要求等级判断；低于要求时不得显示达标
AC-3: 自动测试覆盖不同能力要求 L3、L4 的同一项目

### References

[I09 PRD](https://github.com/TelyAgent/HireOSV2/blob/067c1baa49ab1cf95b8cbea7f7a588c4ec82ef95/docs/product/Interview/I09_Debrief_Evidence/PRD.md)；[I09 线上测试报告](https://github.com/TelyAgent/HireOSV2/blob/067c1baa49ab1cf95b8cbea7f7a588c4ec82ef95/docs/product/Interview/I09_Debrief_Evidence/Test_Report_2026-10-15.md)；[草稿与证据索引](https://github.com/TelyAgent/HireOSV2/blob/067c1baa49ab1cf95b8cbea7f7a588c4ec82ef95/docs/product/Interview/I09_Debrief_Evidence/Issue_Drafts_With_Evidence_2026-10-15.md)

### Dependencies

JD 结构化等级来源已确认。本 Issue 承接 JD 契约、能力映射/版本存储和逐项判断；不改变已确认的历史 Rubric 内容。Refs #250（复用本项等级链路）。

### Risk

high

### Owner

@JsonSuCoder

### Estimate

8

### AI Ready

Yes

### Reproduction

在报告所用演示项目的 Overview 查看首项 Must-have 要求 L4，再到 Debrief 查看同一项。

### Expected / Actual

预期要求等级一致；实际 Debrief 显示 `Required L3`。

### Environment

同上；线上构建号未知。

### Severity

S2

### Evidence

线上截图（2026-10-15；裁切候选人姓名区域）：

![草稿 2：Draft 02 Overview L4](https://raw.githubusercontent.com/TelyAgent/HireOSV2/067c1baa49ab1cf95b8cbea7f7a588c4ec82ef95/docs/product/Interview/I09_Debrief_Evidence/Evidence_2026-10-15/Draft_02_Overview_L4.jpg)

![草稿 2：Draft 02 Debrief L3](https://raw.githubusercontent.com/TelyAgent/HireOSV2/067c1baa49ab1cf95b8cbea7f7a588c4ec82ef95/docs/product/Interview/I09_Debrief_Evidence/Evidence_2026-10-15/Draft_02_Debrief_L3.jpg)
