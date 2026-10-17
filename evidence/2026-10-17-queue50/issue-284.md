### Type

Bug

### Subsystem

hireos-interview

### Problem

Review 曾把轮次完成日期显示为 submitted；文案已修复，但独立 Scorecard 状态及对应验收仍缺失。

### User Outcome

面试官准确区分轮次完成、评分卡草稿、已提交及修订草稿。

### Scope

保留已有 Interview completed / 面试完成于修复，复用 #283 真实提交状态补齐展示与浏览器回归。

#### Owner confirmed remaining estimate

Owner 在当前 Codex 会话确认剩余工作 2 点：真实状态展示、刷新和浏览器回归，不重复计算 #283 的模型/提交工作。比文案-only 的 1 点多持久状态验收，无新模型不需 3 点。已有 AC-1 修复及证据保留，未声称其余 AC 完成。

### Non-goals

不修改轮次完成时间或评分数据，不以 completedAt 推断提交，不重复实现 #283。

### Acceptance Criteria

- AC-1: 轮次完成、评分卡未提交时，不能把轮次完成标为评分卡提交；保留既有文案回归。
- AC-2: 轮次状态与评分卡草稿/已提交/修订草稿独立展示，提交时间及操作人来自真实记录。
- AC-3: 浏览器覆盖轮次完成但评分卡草稿、已提交及修订草稿，刷新后状态一致。

### References

`docs/product/Interview/I08_Review_Scorecard/PRD.md`；`docs/product/Interview/I08_Review_Scorecard/User_Journey.md`；`docs/product/Interview/I08_Review_Scorecard/Test_Report_2026-10-15.md`；`evidence/local-issues-317-260-284-2026-10-17.md`；Issue 已有部分修复评论。Refs #283, #426。

### Dependencies

Blocked by: #283。等待独立提交状态实现，当前保持未完成；#426 为其账号关联前置。

### Risk

low

### Owner

@JsonSuCoder

### Estimate

2

### AI Ready

No

### Reproduction

打开已完成轮次的 Review，检查独立评分卡状态。原 submitted 文案已修复，目前仍无真实草稿/提交状态展示。

### Expected / Actual

预期：分别展示轮次完成与评分卡状态。实际：只修复轮次完成文案，缺独立提交状态。

### Environment

原报告为 2026-10-15 HireOS Interview 线上 Chrome 桌面，部署版本未知；后续文案修复已合并 main 517a5b6fffd121f61de9709ab68e1e9f1728b3e4，本轮在 codex/issue-fixes 本地继续。

### Severity

S3
