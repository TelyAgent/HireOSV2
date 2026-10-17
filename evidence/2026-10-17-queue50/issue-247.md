### Type

Feature

### Subsystem

hireos-interview

### Problem

未归类附件缺少人工归类入口和处理记录，不能明确区分待处理附件与已分类材料。

### User Outcome

用户可将未归类附件归入正确材料分类，未确认附件不会被当作候选人证据。

### Scope

仅允许 other → screening 或 assessment，保存归类操作者和时间。screening 接入 #246 重复报告处理。

#### Human decision and estimate

2026-10-17 Owner 确认范围及 Estimate 5。含兼容迁移、原子归类与审计、幂等和并发保护、隔离数据库及浏览器验收。依据见 evidence/2026-10-17-queue50/estimate-247.md。

### Non-goals

不支持归为简历/JD、撤销或更换已归类类型，不变更附件内容、旧评分或已发布包，不扩展角色权限或完整 I13。

### Acceptance Criteria

- AC-1: other 附件单独显示 Unassigned · needs triage，不进入已分类材料或候选人证据列表；测试覆盖归类前后过滤。
- AC-2: 人工确认 screening/assessment 后材料出现在对应分类并保留操作者和时间；screening 原子更新 #246 成员版本且不替换已有当前报告，归类失败不产生部分更新。
- AC-3: 同人同目标重复请求幂等，不同选择/操作者冲突；跨工作区/项目和非法类型被拒绝。数据库覆盖归类与 Resolve 并发、数据不变及事务回滚；浏览器覆盖取消、失败保留输入、刷新和归类记录。

### References

- docs/product/Interview/I02_Project_Overview_Linking/PRD.md FR-3、BR-4、AC-4
- docs/product/Interview/I02_Project_Overview_Linking/User_Cases.md UC-I02-06
- evidence/2026-10-17-queue50/estimate-247.md

### Dependencies

#246 已在当前分支实现并本地验证；复用 TaskMaterial/Material 和工作区规则，不等待完整 I13。

### Risk

medium

### Owner

@JsonSuCoder

### Estimate

5

### AI Ready

Yes

### User Flows

Overview → 未归类附件 → 选择筛选/测评类型 → 确认 → 对应材料分类及归类记录；取消不写入，错误保留选择。桌面 Web。
