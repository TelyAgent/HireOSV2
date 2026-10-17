### Type

Feature

### Subsystem

hireos-screening

### Problem

#200 的批量筛选目前只有单应用进程内去重；评估读取最新岗位输入，调用 AI 前没有持久化任务，无法跨进程限流、恢复或冻结批次依据。

### User Outcome

固定成员和输入的批次能持久执行，部分失败不影响其他项，重试不会重复分析成功项；重启后能区分未运行与结果未知。

### Scope

第一段：PostgreSQL 批次/条目持久化、输入快照、启动幂等、跨进程每工作区最多 2 项运行、取消排队项、明确失败项人工重试、未知结果核对与恢复、API 和隔离数据库故障测试。

#### Human decision and estimate

2026-10-17 Owner 确认上述范围与 Estimate 8，批准创建两个子 Issue。复用现有评估器、PostgreSQL 和数据库测试，不引入外部队列。跨模型迁移、持久执行、并发与恢复验证超过 5 点；限于后端执行，不含工作台与新工作流，按 8 点验收。父 #200 仅汇总，不重复计点。无同类已验收队列历史参照，采用仓库起始尺度。

### Non-goals

不提交人工决定、不通知候选人、不改变评分规则、不做新权限模型，不实现第二段工作台。超时和未知结果不自动重试；不承诺外部 AI 调用 exactly-once。

### Acceptance Criteria

- AC-1: 启动时固定工作区、岗位、成员和全部评估输入；之后新增成员或修改岗位/简历不改变已保存批次；重复启动相同幂等键返回同批次，不同内容冲突。
- AC-2: 独立进程/连接争抢任务时同工作区同时运行最多 2 项；结果和条目状态事务一致，成功项不重复执行或创建 Application。
- AC-3: 一项明确失败不阻止其他项完成；只有明确失败项可人工重试，重试请求幂等，成功、取消、运行中、未知项不能被该请求重新分析。
- AC-4: 取消只取消 queued 项，running 项不强行中断并保留最终结果；重复取消幂等。
- AC-5: 崩溃或超时后未能确定的结果保持 unknown，不自动重新调用 AI；核对已提交结果后可恢复 completed；没有可靠结果不能伪装成功或明确失败。API 返回持久状态和准确计数。
- AC-6: 本地临时 PostgreSQL schema 验证并发、部分失败、冻结输入、幂等、取消、恢复和跨工作区隔离；记录迁移、回滚及未知结果处置方式。

### References

- Parent: #200
- docs/product/Resume_Screening/F09_Screening_Workspace_Ranking/PRD.md
- docs/product/Resume_Screening/F09_Screening_Workspace_Ranking/Loop_IO.md
- docs/product/Resume_Screening/F09_Screening_Workspace_Ranking/User_Cases.md
- hireos-screening/hireos-screening-backend/src/screening/screening.service.ts

### Dependencies

复用 F08 评估器和当前 PostgreSQL。Owner 已确认并发、取消、未知重试边界和 8 点。

### Risk

high

### Owner

@JsonSuCoder

### Estimate

8

### AI Ready

Yes

### User Flows

创建固定批次，读取持久进度；取消排队项；查询未知结果；仅对明确失败项发送人工重试。第一段通过 API/数据库验收，父 #200 保留打开。
