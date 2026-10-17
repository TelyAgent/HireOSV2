### Type

Feature

### Subsystem

hireos-screening

### Problem

#200 缺少固定选择、批量启动、逐项进度和失败恢复工作台。单人评估页面不能表达批次中的部分失败或未知结果。

### User Outcome

Recruiter 可在工作台对固定候选人集合批量筛选，刷新仍可看到准确进度，并安全取消或仅重试明确失败项。

### Scope

第二段：工作台固定选择、批次与条目进度、持久回读、取消、明确失败项重试、未知结果核对入口、桌面/窄屏浏览器和端到端验收。

#### Human decision and estimate

2026-10-17 Owner 确认范围与 Estimate 5，批准创建子 Issue。依赖第一段持久执行 API，复用工作台与现有 UI；多状态交互、恢复、端到端联调超过 3 点，不再承担队列模型或执行器，按 5 点验收。父 #200 不重复计点；没有同类已验收历史参照，采用仓库起始尺度。

### Non-goals

不重做执行队列，不自动重试未知结果，不提交人工决定，不通知候选人，不扩展身份权限模型。

### Acceptance Criteria

- AC-1: 启动只包含确认时所选候选人；后来新增候选人不被悄悄纳入；重复点击或网络重试使用同一幂等键，不产生重复批次。
- AC-2: 工作台显示 queued/running/completed/failed/cancelled/unknown 和逐项状态，刷新后回读；计数与后端一致，机器任务与人工待办分开。
- AC-3: 取消仅停止排队项，运行项仍显示进度并保留结果；只允许重试明确失败项，未知项提供核对动作，不自动重跑；请求失败保留当前选择和上下文。
- AC-4: 桌面与窄屏浏览器覆盖启动、部分失败、取消、重试、断线/刷新和 unknown；隔离数据端到端验证成功项未重复分析、Application 数未增加。
- AC-5: 两段验收证据齐全后才可将父 #200 标记修复；第一段通过不等同于本段完成。

### References

- Parent: #200
- docs/product/Resume_Screening/F09_Screening_Workspace_Ranking/PRD.md
- docs/product/Resume_Screening/F09_Screening_Workspace_Ranking/Loop_IO.md
- docs/product/Resume_Screening/F09_Screening_Workspace_Ranking/User_Cases.md
- hireos-screening/hireos-screening-front/src/pages/ScreeningWorkspacePage.tsx

### Dependencies

#424 第一段 API 已在当前分支实现，隔离数据库和 HTTP 验收通过，build/lint/typecheck/test 全部通过（217 tests，见 evidence/2026-10-17-queue50/424-results.json）。Owner 已确认 5 点，本段依赖解除，可以实施；父 #200 尚未完成。

### Risk

high

### Owner

@JsonSuCoder

### Estimate

5

### AI Ready

Yes

### User Flows

选择候选人后确认批次，观察逐项状态；刷新回读；取消排队项，核对未知项，只重试明确失败项；完成两段验收后汇总父 Issue。
