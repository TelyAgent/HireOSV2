### Type

Bug

### Subsystem

hireos-written

### Problem

线上已发布的 Q-0001 详情仅有 Preview candidate view、Delete question、Edit question，没有停用/Deprecated 操作。用户无法按 W01 规则停止新计划使用题目，同时保留旧邀请。本轮未实际停用或检查旧邀请 API。

### User Outcome

题目维护者能有记录地停用不再适用的题；新计划不能选用它，已发送邀请仍保持原版本。

### Scope

停用状态转换和历史、权限与并发校验、题库/计划选择器过滤、旧邀请回归。

#### Estimate analysis

需要跨后端状态、前端操作、计划选择器、旧邀请和回归测试，属于跨模块且验证范围较大的变更。假设复用现有邀请快照并由版本 Issue 提供历史模型，建议 5 点；若依赖方案变化需重新评估。

### Non-goals

不硬删除题目；不撤销已经发送的邀请。

### Acceptance Criteria

- AC-1: 有权限用户能将已发布题停用；详情和历史显示操作者、时间与 Deprecated 状态；重复停用不产生重复历史；自动测试覆盖权限和幂等。
- AC-2: 停用题不出现在新计划 Add from Question Bank 中；直接绕过 UI 选用时 API 返回明确 4xx；集成测试覆盖 UI 与 API 门禁。
- AC-3: 已发送邀请继续读取发送时的题目版本和内容；自动测试覆盖旧邀请回归。

### References

- [W01 PRD](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/PRD.md)：FR-11、AC-6。
- [W01 线上测试报告](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/Test_Report_2026-10-16.md)：W01-LIVE-04、UC-W01-11。

### Dependencies

题目状态模型与版本方案；计划选择器和邀请快照；专用测试题与旧邀请 seed。

### Risk

high

### Owner

@JsonSuCoder

### Estimate

5

### AI Ready

No

### Reproduction

1. 打开线上已发布 Q-0001 详情。
2. 检查页头操作，仅有 Preview candidate view、Delete question、Edit question。
3. 页面没有停用或 Deprecated 操作。

每次进入详情均可复现。

### Expected / Actual

预期：可停用并追溯状态变化，阻止新计划继续选用，同时保留旧邀请。

实际：只有删除与编辑，不能执行停用；旧邀请行为尚未实测。

### Environment

2026-10-16，Chrome 桌面端，线上 `https://hireos.aipollo.me/hireos/written/question-bank`，英文界面。线上构建号未知。

### Severity

S2

### Evidence

![已发布题详情没有停用入口](https://github.com/user-attachments/assets/5258b3ef-b266-4849-9111-db90df2deb35)
