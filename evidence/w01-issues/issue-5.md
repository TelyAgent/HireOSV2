### Type

Bug

### Subsystem

hireos-written

### Problem

在 Question Bank 中设置岗位「高级 AI 产品经理」、能力「Workflow设计与流程建模」并搜索 `Q-0001`，点击结果进入详情；通过主导航返回题库后，搜索为空且两个筛选都回到 All。列表行没有规范要求的右侧预览，用户为查看多题详情需反复设置筛选。

### User Outcome

招聘者连续筛题时可快速预览题目；进入详情并返回后仍保留原搜索、岗位、能力及合理的列表位置。

### Scope

列表选中预览与详情往返的筛选/滚动状态保持；相应路由与 UI 测试。

#### Estimate analysis

涉及列表交互、状态保持和 UI 回归，属于涉及多个界面状态的完整小功能，不需要数据迁移或跨服务修改，建议 3 点。

### Non-goals

不改变过滤匹配逻辑或题目内容。

### Acceptance Criteria

- AC-1: 列表选中题目时可在右侧查看预览，不必离开当前筛选结果；列表无直接发送候选人的动作；UI 测试验证预览内容和操作边界。
- AC-2: 从筛选结果打开详情后返回，搜索词、岗位、能力和列表位置保持；刷新与深链行为有确定规则并有路由测试。
- AC-3: UI 自动测试覆盖「设置三项筛选 → 打开 Q-0001 → 返回 → 条件与结果仍在」。

### References

- [W01 PRD](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/PRD.md)：FR-2/3。
- [W01 线上测试报告](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/Test_Report_2026-10-16.md)：W01-LIVE-05、UC-W01-01/02。
- `hireos-written/hireos-written-front/src/pages/QuestionBankPage.tsx`

### Dependencies

None

### Risk

low

### Owner

@JsonSuCoder

### Estimate

3

### AI Ready

No

### Reproduction

1. 打开线上 Question Bank。
2. 选择岗位「高级 AI 产品经理」、能力「Workflow设计与流程建模」，搜索 `Q-0001`。
3. 点击 Q-0001 行进入详情。
4. 点击主导航 Question Bank 返回列表。
5. 观察搜索为空、岗位和能力均回到 All，列表重新显示两条题目。

本轮重复操作可复现。

### Expected / Actual

预期：列表提供右侧预览；进入详情并返回后保持搜索、岗位、能力和列表位置。

实际：点击行直接跳详情，返回后三项筛选均重置。

### Environment

2026-10-16，Chrome 桌面端，线上 `https://hireos.aipollo.me/hireos/written/question-bank`，英文界面。线上构建号未知。

### Severity

S3

### Evidence

进入详情前岗位、能力和编号筛选已设置：

![进入详情前筛选已设置](https://github.com/user-attachments/assets/684393a9-9991-490a-b991-e4a783889f1a)

返回列表后三项筛选回到默认：

![返回后筛选丢失](https://github.com/user-attachments/assets/fe67ec87-6099-42ea-b704-30d7ab8d816c)
