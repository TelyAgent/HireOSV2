### Type

Bug

### Subsystem

hireos-interview

### Problem

线上 Review 展示五个推荐按钮，但未见本轮整体推荐的理由输入；当前工作区接口也只接收推荐枚举。

### User Outcome

阅读推荐的 HR/HM 能理解面试官为何作出该判断。

### Scope

本轮推荐理由的填写、保存、展示和接口校验。

#### Confirmed decision

[HUMAN-DECISION] 2026-10-17 用户确认范围与 3 点：先填必需的推荐理由，再点击推荐选项立即一起保存；可单独保存理由修改，取消推荐时清空理由；刷新后保留，失败保留输入，历史缺失显示未记录。复用现有轮次接口，不新增整体 Scorecard 提交流程。

#### Estimate analysis

3 点，Owner 已确认。复用单轮次 recommendation PATCH/读取与现有 Review 控件，新增可空历史字段和服务端非空校验；覆盖 AC-1 空白/有效理由和取消、AC-2 刷新/轮次隔离、AC-3 数据库/API/浏览器回归。涉及数据迁移与前后端，不是 1/2 点的纯展示修正；不承担整体 Scorecard 提交、修订工作流或跨服务联动，低于 5 点。采用起始尺度，无已验收同类历史点数参照。

### Non-goals

不修改推荐枚举或最终录用决定。

### Acceptance Criteria

- AC-1:面试官选择推荐时可填写理由；缺少必需理由时不能提交。

- AC-2:重新打开 Review 后，推荐及理由均保留。

- AC-3:自动测试覆盖空理由拒绝、有效保存和重新读取。

### References

FR-8；User Journey 步骤 6。I08 PRD：`docs/product/Interview/I08_Review_Scorecard/PRD.md`；User Journey：`docs/product/Interview/I08_Review_Scorecard/User_Journey.md`；线上测试报告：`docs/product/Interview/I08_Review_Scorecard/Test_Report_2026-10-15.md`。这些文档目前位于本地工作区，尚未提交到 GitHub。

#### Screenshot

本轮推荐区域未显示推荐理由输入项。

![I08 线上测试截图 6](https://github.com/user-attachments/assets/f5124ef7-a8ab-4420-937c-89ee8f414859)

### Dependencies

保存时机已由 Owner 确认：随推荐立即保存，不依赖整体 Scorecard 提交流程。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

Yes

### Reproduction

打开已完成轮次 Review，查看“Interviewer recommendation”：只有推荐选项，没有理由输入。

### Expected / Actual

预期：推荐附理由。实际：可见页面与当前工作区接口仅记录选项。

### Environment

HireOS Interview 线上环境；Chrome 桌面浏览器；2026-10-15；线上构建号未知。截图仅保留相关界面区域，未包含候选人姓名。

### Severity

S2

### Estimate

3
