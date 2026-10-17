### Type

Feature

### Subsystem

hireos-screening

### Problem

工作台缺少持久化批量运行、逐项进度、取消和明确失败项重试；单人评估不能证明跨进程恢复、输入冻结和幂等。

### User Outcome

对固定成员和基线运行批量筛选，准确查看部分失败和未知结果，只重试明确失败项而不重复分析成功项。

### Scope

本 Issue 作为汇总父项，分两段验收：#424 持久化批次执行与恢复；#425 工作台入口和端到端验收。两段均验收后才关闭父项。

#### Human decision and estimate

2026-10-17 Owner 确认每工作区最多运行 2 项；取消只停止 queued，running 不强制中断并保留结果；超时/未知不自动重试，先核对，人工只重试明确失败项。确认拆分、创建两个子 Issue，第一段 8 点、第二段 5 点。父项 Estimate=TBD 仅表示汇总不计点，不重复累计子项；父项不作为实施门禁，子项各自校验。

### Non-goals

不提交人工决定，不自动通知候选人，不改变 F08 评分规则，不扩展身份权限模型，不引入外部队列。

### Acceptance Criteria

- AC-1: 启动时固定成员及输入，运行中新增候选人或修改岗位不改变该批次，见 #424。
- AC-2: 批次/逐项 queued、running、completed、failed、cancelled、unknown 状态和计数持久一致，机器任务与人工待办分开，见 #424/#425。
- AC-3: 部分失败可恢复；只人工重试明确失败项，成功项分析次数和 Application 数不增加，见 #424/#425。
- AC-4: 取消只停止排队项；重复启动、取消、重试幂等，运行项保留结果，见 #424。
- AC-5: 超时、崩溃或未知结果不伪装完成、不自动重跑，有核对入口，见 #424/#425。
- AC-6: 两段本地自动化与浏览器/端到端证据全部齐全，才将父项判定修复；第一段完成不关闭父项。

### References

- #424
- #425
- docs/product/Resume_Screening/F09_Screening_Workspace_Ranking/PRD.md
- docs/product/Resume_Screening/F09_Screening_Workspace_Ranking/Loop_IO.md
- docs/product/Resume_Screening/F09_Screening_Workspace_Ranking/User_Cases.md
- docs/product/Resume_Screening/F09_Screening_Workspace_Ranking/Test_Report_2026-10-15.md

### Dependencies

Blocked by: #424 and #425。Owner 已确认行为边界和子项点数，两段尚未全部验收。

### Risk

high

### Owner

@JsonSuCoder

### Estimate

TBD

### AI Ready

No

### User Flows

Recruiter 固定选择集合并启动批次，查看逐项进度，取消排队项，核对未知项，仅重试明确失败项。父项只汇总子项验收，不把半成品标记完成。
