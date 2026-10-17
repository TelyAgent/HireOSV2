### Type

Bug

### Subsystem

hireos-interview

### Problem

已检查项目 Overview 缺少近期活动区块，无法回看已有记录；不将未实测的完整事件流声称为失败。

### User Outcome

参与者可查看项目已记录的近期事件、操作人和时间，并区分暂无记录与读取失败。

### Scope

复用 Revision，新增同工作区只读接口和 Overview 已记录的近期活动列表。仅展示真实记录，不回填或推测缺失事件。

#### Human decision and estimate

2026-10-17 Owner 确认先展示已有真实记录，并确认 Estimate 3。含接口、前端状态、隔离数据库与浏览器验收；不迁移、不新增写流程，规模高于单点 2、不涉及 5 点的新模型或工作流。依据见 evidence/2026-10-17-queue50/decisions-212-243.md。

### Non-goals

不修改角色权限和事件生成规则，不实现完整 I13，不声称覆盖创建、Scorecard 等全部事件，不输出任意审计 payload 或内部决定理由。

### Acceptance Criteria

- AC-1: Overview 展示当前项目已有 Revision 的事件、操作人 ID 和时间，最新优先，最多 20 条；未知类型明确显示未知，不补造事件。只读接口拒绝跨工作区访问。
- AC-2: 分别显示加载、暂无已记录活动和读取失败；支持局部重试，切换项目不显示前一项目记录，不阻塞其他区块。
- AC-3: 隔离数据库测试覆盖有/无记录、排序/上限/工作区隔离和敏感 payload 排除；浏览器覆盖有/无记录、失败/重试、切换项目及窄屏。

### References

- docs/product/Interview/I02_Project_Overview_Linking/PRD.md
- docs/product/Interview/I02_Project_Overview_Linking/Test_Report_2026-10-15.md (I02-UX-004)
- evidence/2026-10-17-queue50/decisions-212-243.md

### Dependencies

现有 Revision 数据；Owner 已确认不等待完整 I13 事件流。

### Risk

low

### Owner

@JsonSuCoder

### Estimate

3

### AI Ready

Yes

### Reproduction

打开原检查的两个项目 Overview，未见项目级 Recent activity。用隔离有事件和无事件数据复验。

### Expected / Actual

预期显示已记录事件或明确空状态；实际缺少区块。

### Environment

原观察：2026-10-15 Chrome 线上 interview，构建号未知。本轮仅本地隔离测试，不声称生产验收。

### Severity

S3
