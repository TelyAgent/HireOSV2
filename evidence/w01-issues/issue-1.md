### Type

Bug

### Subsystem

hireos-written

### Problem

线上创建表单只有 `Create question`；已发布 Q-0001 的编辑表单只有 `Save changes`，详情只显示 Prompt、Rubric、Usage，没有 Versions。用户无法按 W01 约定先保存草稿、复核后发布，也无法查看旧版本。后端当前只在单条 `Question` 上自增整数 `version`，没有独立历史记录。本轮未修改线上题目，不能据此声称已发送邀请内容发生变化。

### User Outcome

出题人能先保存草稿，再发布精确版本；编辑已发布题时生成可追溯的新版本，旧邀请仍指向原内容。

### Scope

W01 草稿/发布状态、QuestionVersion 历史、创建与编辑 UI、版本入口、发布幂等和旧邀请快照回归。

#### Estimate analysis

涉及前后端、数据迁移、历史兼容和邀请回归。发布复核规则及版本数据方案未定，可能需要拆为状态/版本模型、发布流程和迁移回归等独立交付，当前不能可靠估算。

### Non-goals

不改变现有题干内容；不处理 ZIP 导入或候选人评分流程。

### Acceptance Criteria

- AC-1: 创建有效题目后可保存为 Draft；Draft 不在新计划可选题中，发布前能查看并复核字段；自动测试覆盖 Draft 状态和选择器门禁。
- AC-2: 发布 v1 后编辑内容并发布生成 v2；Versions 显示当前与早期版本，v1 内容不可原地覆盖；自动测试核对两版内容。
- AC-3: 已发送 v1 邀请继续返回 v1 快照；两次快速发布只生成一个目标版本；集成测试覆盖旧邀请和重复请求。

### References

- [W01 PRD](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/PRD.md)：FR-8、FR-10、BR-2/3、AC-2。
- [W01 线上测试报告](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/Test_Report_2026-10-16.md)：W01-LIVE-01、UC-W01-06/08/10。
- `hireos-written/hireos-written-front/src/components/QuestionCreateDrawer.tsx`
- `hireos-written/hireos-written-backend/prisma/schema.prisma`

### Dependencies

发布是否需他人复核仍是 W01 PRD 待确认事项；QuestionVersion、RoleMapping、ScoringProfile 数据方案需产品与工程确认。旧邀请 seed 和迁移/回滚方案是验收依赖。

### Risk

high

### Owner

@JsonSuCoder

### Estimate

TBD

### AI Ready

No

### Reproduction

1. 打开线上 Question Bank，点击 Create question，观察主操作只有 Create question。
2. 打开已发布 Q-0001，点击 Edit question，观察主操作只有 Save changes。
3. 检查详情 tab，仅有 Prompt、Rubric、Usage，没有 Versions。

每次进入相应页面均可复现。本轮未提交修改。

### Expected / Actual

预期：支持 Draft → Publish 和版本历史；修改已发布内容时创建新版本并保留旧版本。

实际：线上没有相应可操作路径。后端内容更新会自增版本整数，但当前证据不能证明独立历史和旧邀请行为。

### Environment

2026-10-16，Chrome 桌面端，线上 `https://hireos.aipollo.me/hireos/written/question-bank`，英文界面，页面显示登录用户「蔡敏」。线上构建号未知；本地参考提交 `c4b6105`，不代表线上版本。

### Severity

S2

### Evidence

创建表单无草稿/发布动作：

![Create question 只有直接创建](https://github.com/user-attachments/assets/4c98981f-9220-40ab-b3ac-37ecca60c4ea)

已发布题编辑只有 Save changes：

![Edit question 只有 Save changes](https://github.com/user-attachments/assets/4b5fde1c-901e-4166-8b06-fc3eb72eb72e)
