### Type

Bug

### Subsystem

hireos-jd

### Problem

M5 创建的草稿在 Analyze 中出现 `2 missing · 1 to revise`，Publish 禁用提示为 `3 item(s) to complete or revise`，把一条完善建议计入阻断数。当前前端 `issueCount` 将 `missing + weakCount + blockers` 相加并用于禁用 Publish。线上未构造“仅剩建议”的隔离状态，故该路径仍需以 AC-1 复验。

### User Outcome

发布必填项缺失时用户得到具体缺项并不能发布；只有内容完善建议时，建议仍可见且可继续发布。

### Scope

区分发布阻断项与内容建议的计数和按钮状态；覆盖 Analyze、Publish 禁用原因及发布入口测试。

#### Confirmed decision

[HUMAN-DECISION] 2026-10-17：用户在本任务确认 Estimate=2（回复“确认以上点数”）。10 项必填、Level 选填；Suggestions 不阻断，真正 Weak/阻断仍阻断。旧 AC 中 To revise 不能泛指建议。Ready 后提交审批，Publish 仍需有效批准。

#### Estimate analysis

局部计数、分析分组和提示，加建议/缺项/真正阻断三组前后端回归；共用门禁基础不重复计点。

### Non-goals

不在本 Issue 重定义发布必填字段清单，不改变审批或发布渠道策略，不实际向线上渠道发布测试职位。

### Acceptance Criteria

- AC-1: 当前 10 项必填已通过、Level 可未设置、仅剩 Suggestions 时，Analyze 保留建议，前置门禁不因建议被拒绝；Publish 是否可用仍服从有效审批等既有门槛。UI/API 自动测试验证建议分级。
- AC-2: 缺一个必填项且另有建议时，阻断原因和数量仅列阻断项，建议单独展示；UI 测试验证。
- AC-3: 真正 Weak 或阻断性错误仍禁止推进并指出原因；回归测试区分 Suggestions、Weak 和 blocker。

### References

`docs/product/JD_Management/M5_Manual_Form_Create/PRD.md`（FR-8、AC-8）；`docs/product/JD_Management/M5_Manual_Form_Create/Test_Report_2026-10-14.md`；`docs/product/JD_Management/M8_Publish_Versions/PRD.md`。

### Dependencies

Refs #93（共用 M6 门禁）、#53、#56。只验证建议分级不额外阻断；真实审批链路由 #91/#93 跟踪，不把 mock 作为完整审批验收。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

1. 打开 M5 手动创建的未发布草稿，运行 Analyze。
2. 观察 `2 missing · 1 to revise` 与 Publish 的 `3 item(s) to complete or revise` 禁用提示。
3. 本地对照 `JobWorkspacePage.tsx` 的禁用分支及 `completeness.ts` 中的 `issueCount`。

### Expected / Actual

预期：完善建议不计入发布阻断；缺失必填项和真正阻断项才禁用 Publish。实际：建议与缺项合并计数并出现在禁用原因中。仅剩建议状态尚未在线上隔离复测。

### Environment

2026-10-14 已发布 JD Web 页面，桌面端 Codex in-app browser，英文界面；线上构建号未知。本地代码证据：`hireos-jd/hireos-jd-front/src/features/workspace/completeness.ts`、`src/pages/JobWorkspacePage.tsx`。

### Severity

S2

### Estimate

2
