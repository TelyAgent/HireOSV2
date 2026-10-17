### Type

Bug

### Subsystem

hireos-interview

### Problem

已发布项目的决定页只有决定选项和记录时间，未显示人工理由、记录人或决定版本；线上 AI 草稿引用呈现为 UUID 与评分文本，没有可从页面打开的来源入口。HR/HM 难以复核人工决定与 AI 建议各自依据。

### User Outcome

HR、HM 和后续复核者能区分 AI 建议与人工决定，并追溯相应证据。

### Scope

人工阶段决定的理由、记录人、时间和版本；AI 草稿证据引用的展示与定位。

#### Confirmed decision

[HUMAN-DECISION] 2026-10-17：用户回复“确认范围与 5 点”。人工理由可填写并随决定保存，显示记录人、时间和独立决定版本；历史缺失字段显示未记录；AI 引用打开生成时的评分快照，不冒充最新评分。

#### Estimate analysis

复用现有决定 API 和 ParseJob 引用快照，增加理由/身份/独立版本持久化和页面引用入口，覆盖保存、版本和跨任务隔离。跨 API/数据/UI 为 5 点；不实现新评分算法、Offer 或身份角色系统。原 TBD 范围已通过本轮代码核查和 Owner 决定收敛。

### Non-goals

不改变 AI 评分算法或 Offer 审批规则。

### Acceptance Criteria

- AC-1:记录人工阶段决定时可以填写理由，查看时显示理由、记录人、时间和决定版本。
- AC-2:AI 草稿中的证据引用可以打开并定位相应评分或原始证据，且引用对象与当前决定上下文匹配。
- AC-3:自动测试覆盖人工理由持久化、版本展示及引用导航。

### References

- `docs/product/Interview/I10_Decision_Confirmation/PRD.md`：FR-1、FR-2、数据要求（当前产品文档，待合入仓库）。
- `docs/product/Interview/I10_Decision_Confirmation/Test_Report_2026-10-15.md`：I10-UX-01（测试报告，待合入仓库）。
- [Interview PRD v1.5](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Interview/HireOS_Command_Interview_PRD_v1.5.md)。

### Dependencies

现有决定和 ParseJob 结构已核对，历史未知显示与快照引用策略已由 Owner 确认。

### Risk

medium

### Owner

@JsonSuCoder

### Estimate

5

### AI Ready

Yes

### Reproduction

打开已有已发布项目的 Decision & Next Steps，查看已记录决定与 AI 草稿。只读观察，不修改真实决定。

### Expected / Actual

预期：可查看人工理由、记录人和版本，并从 AI 引用打开来源。实际：决定区只显示选项和时间；AI 草稿引用未提供来源入口。

### Environment

HireOS Command Interview 线上环境；Chrome 桌面端；2026-10-15 观察；线上构建号未知。公开截图只展示决定区域，不包含真实候选人评分；AI 引用问题以文字观察记录，需在隔离数据上复测。

![决定区仅显示选项及记录时间](https://raw.githubusercontent.com/TelyAgent/HireOSV2/codex/i10-issue-evidence/docs/product/Interview/I10_Decision_Confirmation/evidence/decision-controls.jpg)

### Severity

S2
