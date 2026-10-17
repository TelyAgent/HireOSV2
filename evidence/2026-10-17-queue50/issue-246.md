### Type

Feature

### Subsystem

hireos-interview

### Problem

Overview 附加的筛选报告没有当前版本指向、重复处理或历史保留状态。

### User Outcome

人工明确选择当前筛选报告并可追溯保留的旧报告。

### Scope

同项目多个 screening 报告视为待处理重复；人工 Resolve 选择当前报告，其余保留为 superseded；新增报告不自动替换当前报告。历史多报告也由人工选择，不按上传时间猜测。

#### Human decision and estimate

2026-10-17 Owner 确认上述范围与 Estimate 5。含兼容迁移、当前指向与处理记录、幂等及并发保护、隔离数据库和浏览器验收。估算依据见 evidence/2026-10-17-queue50/estimate-246.md。

### Non-goals

不删除材料、不重算旧评分或已发布评估包，不实现完整 I13、Triage 或角色权限扩展。

### Acceptance Criteria

- AC-1: 同项目多个筛选报告显示 Duplicate · needs resolution；新增报告不自动替换已有当前报告，历史多个报告不得猜测当前版本。数据库迁移及页面测试覆盖。
- AC-2: 人工 Resolve 后所选报告成为当前报告，其余当时报告保留为 superseded，旧报告仍可查看；持久保存操作者、时间与处理版本。旧评分、已发布包不变。
- AC-3: 同一操作重试幂等；并发选择或新增附件导致过期输入时返回明确冲突，不覆盖新状态。工作区隔离、取消、失败保留输入、刷新回读均有数据库或浏览器测试。

### References

- docs/product/Interview/I02_Project_Overview_Linking/PRD.md FR-2、BR-3、AC-3
- docs/product/Interview/I02_Project_Overview_Linking/User_Cases.md UC-I02-05
- evidence/2026-10-17-queue50/estimate-246.md

### Dependencies

复用现有 TaskMaterial/Material 与工作区检查；不等待完整 I13，范围和点数已确认。

### Risk

medium

### Owner

@JsonSuCoder

### Estimate

5

### AI Ready

Yes

### User Flows

桌面 Overview → 筛选报告 → Resolve → 选择并确认 → 当前/旧报告查看；取消不写入，冲突保留输入并要求重新核对。
