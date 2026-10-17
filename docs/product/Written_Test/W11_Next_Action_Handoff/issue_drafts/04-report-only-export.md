### Type

Feature

### Subsystem

- hireos-written
- hireos-core-record

### Problem

W11 规定 Interview 未启用以及结果为 Fail 或证据不足时仍可导出 report-only 包。本地参考源码中的 Release 页面未找到对应入口或导出实现。

本轮线上仅有待发布和已关闭样本，没有 Interview disabled、Fail 或证据不足的隔离测试数据，因此该差距是源码与规格对照结果，不是完整的线上复现结论。

### User Outcome

HR 无需创建 Interview intake，也能取得清楚标明结果、证据范围、未测能力和证据不足项的独立报告。

### Scope

- 在符合条件的结果/交付页面提供 report-only 导出入口。
- 生成产品确认格式的结构化报告和人读报告。
- 按授权范围过滤内容，并明确未测能力和证据不足。
- Interview 未启用时不产生内部交接事件。
- 提供生成中、失败和重试状态及自动测试。

#### Estimate analysis

当前无法可靠估算：导出格式、保留期限和文件登记规则尚未确认，这些决定会影响生成器、Core FileVersion、权限、下载和清理范围。

### Non-goals

- 不以导出代替内部 Interview 交接。
- 不生成缺失证据的虚假分数、来源或附件 hash。
- 不在本功能中做招聘拒绝或 Offer 决策。

### Acceptance Criteria

- AC-1: Interview 未启用时，授权 HR 仍可导出 report-only 包，且集成测试确认没有创建内部交接事件或 Interview intake。
- AC-2: Fail 和证据不足的 Case 均可生成报告；报告明确标识未测能力与证据不足，不伪造有效分数或附件引用。
- AC-3: 导出内容遵循 Case 授权范围，并通过权限测试确认 restricted 内容不会进入文件。
- AC-4: 页面显示生成中、成功和失败状态；失败后可重试且不会重复创建有效文件版本。

### References

- `docs/product/Written_Test/W11_Next_Action_Handoff/PRD.md`：FR-8、BR-6、AC-3、AC-6。
- `docs/product/Written_Test/W11_Next_Action_Handoff/Loop_IO.md`：W11c、P13～P14。
- `docs/product/Written_Test/W11_Next_Action_Handoff/Test_Report_2026-10-16.md`：G02。
- `hireos-written/hireos-written-front/src/pages/ReleasePage.tsx`：当前 Release 页面实现。

### Dependencies

- Blocked by: 产品确认导出格式、保留期限和文件登记规则。
- Core FileVersion/下载能力。
- Interview entitlement 状态读取。

### Risk

medium

### Owner

@mincai2010-maker

### Estimate

TBD

### AI Ready

No

### User Flows

1. HR 打开已发布结果或交付页面。
2. Interview 未启用时，页面说明原因并保留 Export report-only package 操作。
3. 对 Fail 或证据不足结果，HR 仍可启动导出。
4. 页面显示生成中、失败重试或下载成功状态。
5. 下载文件明确列出未测能力、证据不足和授权范围，并且不产生内部交接事件。
