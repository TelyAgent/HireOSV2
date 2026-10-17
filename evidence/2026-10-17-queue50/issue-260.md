### Type

Bug

### Subsystem

hireos-interview

### Problem

2026-10-15 线上 I05 排期审查：一个现有轮次同时显示 `Scheduled` 与 `Unassigned`。未排期轮次的 Schedule 抽屉没有面试官字段；只填写日期时间后 `Save schedule` 即启用。本次未提交写入。当前 UI 不能保证已排期轮次有负责面试官，和 I05 PRD FR-4 的“缺时间或面试官时提示”不符。

### User Outcome

HR 排期时能确认面试官；未指定面试官的轮次不能被标为已排期。

### Scope

排期时面试官的指定或前置检查、UI/API 校验、错误反馈及回归测试。与 #111 的向导交付边界对齐，避免重复实现向导。

#### Confirmed decision

[HUMAN-DECISION] 2026-10-17 Owner 确认在 Schedule 补填缺失面试官，并确认 3 点。仅未完成且未指定面试官的轮次允许补填，不更换已有面试官、不修改已确认题目/能力/其他计划内容，不自动发送邀请。

#### Estimate analysis

3 点：复用排期 API、面试官目录和轮次字段，无新模型或迁移。AC-1 增加选择入口、加载/失败状态和输入保留；AC-2 校验同工作区、仅补填及未完成，乐观锁防并发覆盖；AC-3 数据库/API/浏览器覆盖有无面试官、历史异常、刷新及失败重试。比 2 点多前后端原子更新和并发验证；不新增向导或外部服务，低于 5 点。采用起始尺度，未用未经验收的历史估算作为依据。

### Non-goals

不改变 Interview Plan 的其他轮次内容；不在本项实现真实邀请投递。

### Acceptance Criteria

- AC-1: 轮次未指定面试官时，UI 阻止保存排期，明确提示如何指定；有面试官时可继续。
- AC-2: 对未指定面试官的轮次直接调用排期 API，请求被拒绝；不能仅靠前端禁用按钮。
- AC-3: 自动测试覆盖有/无面试官两种排期；成功排期后表格不出现 `Scheduled + Unassigned`。

### References

- docs/product/Interview/I05_Scheduling/PRD.md：FR-4、AC-1（工作树中的 I05 草稿，尚未推送）。
- docs/product/Interview/I05_Scheduling/User_Cases.md：UC-I05-02、UC-I05-03（同上）。
- Refs #111（多轮规划与协调人排期向导）。
- 线上审查证据已写在本 Issue 的 Problem、Reproduction 和 Expected / Actual；线上构建号未知。

### Dependencies

Owner 已确认 Schedule 补填入口。Refs #111，仅复用现有轮次与面试官目录，不承担多轮向导、角色授权或通知服务。

### Risk

medium

### Owner

@JsonSuCoder

### Estimate

3

### AI Ready

Yes

### Reproduction

线上登录 HR 工作区，打开已有计划的 Schedule：Round 1 同时显示 `Scheduled` 和 `Unassigned`。打开未排期的 Round 2 抽屉，观察只有 Date & time、Timezone label、Meeting link；输入日期时间后保存按钮启用，面试官仍为 Unassigned。本次仅观察按钮状态，没有保存现有数据。

### Expected / Actual

预期：缺少面试官时不能保存排期，并得到可操作提示。实际：只填时间即可启用保存；现有已排期轮次无面试官。

### Environment

2026-10-15，https://hireos.aipollo.me/hireos/interview/，Chrome 桌面浏览器；线上构建号未知。生产 API 写入与 DB 未验证。

### Severity

S2
