### Type

Bug

### Subsystem

hireos-written

### Problem

Q-0001 的 Usage 页把 `Used in cases` 和 `Candidates who have seen this version` 都显示为 `0`，没有 Case/候选人明细或数据来源说明。当前前端真实题映射把 `usageCount`、`seenByCount` 固定为 0；用户会把未知曝光情况误读为已核实的 0。

### User Outcome

审阅者能区分「系统尚无外部记录」和「经核实确实为零」，并查看可追溯的 Case、候选人与岗位映射。

### Scope

Usage 统计来源与未知状态展示；有记录时的明细和版本对应；相关自动测试。

#### Estimate analysis

如果仅修正未知态，是局部展示与测试；如果需要建立 QuestionExposure 或跨业务记录聚合，则涉及接口、权限和版本明细。数据来源尚未确定，两个合理范围跨越多个点数档位，当前不能可靠估算。

### Non-goals

不修改题目内容、评分结果或已发送邀请。

### Acceptance Criteria

- AC-1: 未连接或未取得外部使用记录时，Usage 明确显示 `Unknown`，不显示 `0`；组件测试覆盖未知态。
- AC-2: 有完整记录且确认无使用时可显示 `0`；有使用时列出 Case、已见候选人与准确的题目版本，汇总与明细一致；集成测试覆盖数据映射。
- AC-3: 自动测试覆盖未知、已核实零和非零三种数据状态。

### References

- [W01 PRD](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/PRD.md)：FR-7、AC-7。
- [W01 线上测试报告](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/Test_Report_2026-10-16.md)：W01-LIVE-03、UC-W01-04。
- `hireos-written/hireos-written-front/src/data/realQuestionsMerge.ts`

### Dependencies

QuestionExposure / 使用记录的数据来源与权限需要确认；当前线上 UI 无法判断服务端是否已有完整历史。

### Risk

medium

### Owner

@JsonSuCoder

### Estimate

TBD

### AI Ready

No

### Reproduction

1. 打开线上 Q-0001 详情。
2. 切换到 Usage。
3. 观察 `Used in cases 0` 和 `Candidates who have seen this version 0`，页面没有外部明细或数据来源。

每次进入 Usage 均可复现。

### Expected / Actual

预期：未取得记录时显示 Unknown；只有完整记录确认无使用时才显示 0。

实际：页面显示 0，无法区分未知与已核实零。

### Environment

2026-10-16，Chrome 桌面端，线上 `https://hireos.aipollo.me/hireos/written/question-bank`，英文界面。线上构建号未知。

### Severity

S3

### Evidence

![Usage 将未知记录展示为 0](https://github.com/user-attachments/assets/4ef9b271-269d-44ea-9fa0-e8de80647ec9)
