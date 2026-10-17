### Type

Bug

### Subsystem

hireos-written

### Problem

已发布题目只有编辑/删除入口，没有可追溯的停用动作，不能明确停止新计划选用并同时保留旧邀请。

### User Outcome

题目维护者能停用不适用的已发布题，查看操作者、时间和版本；新计划不能继续选用，旧邀请内容不变。

### Scope

基于 #365 的不可变版本新增停用状态和审计，重复停用幂等，题库详情操作与历史、计划 UI/API 门禁、旧邀请回归。沿用当前工作区访问规则，不扩展角色权限。

#### Human decision and estimate

2026-10-17 Owner 确认范围与原 Estimate 5。停用后允许编辑为新草稿，再显式发布新版本，不直接恢复旧版本。复用 #365 版本、计划门禁和邀请快照，但增加迁移/审计、状态转换、并发契约和前后端验收，超过单点 3 点；不新增审批/权限工作流，按 5 点处理，不扩到 8 点。

### Non-goals

不硬删除题目，不撤销或改写已发送邀请，不新增身份/角色/权限流程，不直接恢复被停用的旧版本。

### Acceptance Criteria

- AC-1: 当前工作区用户可停用已发布题；记录并显示操作者、时间、版本及 Deprecated 状态；重复或并发停用只产生一次历史，过期修订拒绝，跨工作区拒绝。
- AC-2: 停用题不在新计划题库选择项中；绕过页面直接选用返回明确 4xx；数据库/浏览器测试覆盖。
- AC-3: 已发送邀请继续读取原版本内容；停用后编辑产生新草稿，只有显式发布新版本后可被新计划选用，原停用记录不变；自动测试覆盖。

### References

- #365
- docs/product/Written_Test/W01_Question_Bank/PRD.md
- docs/product/Written_Test/W01_Question_Bank/Test_Report_2026-10-16.md

### Dependencies

#365 已在当前分支实现并通过本地验证。Owner 已确认状态边界与 5 点，不依赖新的权限或审批服务。

### Risk

high

### Owner

@JsonSuCoder

### Estimate

5

### AI Ready

Yes

### Reproduction

已发布题目详情只有预览、编辑、删除，没有停用动作；不修改真实题目。

### Expected / Actual

预期停用阻止新选用并保留审计和旧邀请；实际缺少停用入口与对应历史。

### Environment

原始观察 2026-10-16 Chrome 线上英文题库，构建号未知。本轮仅在 codex/issue-fixes 分支和隔离本地测试数据上验证。

### Severity

S2
