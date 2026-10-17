### Type

Bug

### Subsystem

hireos-written

### Problem

Question Bank 首屏说明写 `Publishing a case does not send it — invitations are a separate step.`。W01 的发布对象是题目/题目版本，Case 是另一业务对象；当前文案可能让 HR 误解发布范围。

### User Outcome

招聘者看首屏即能区分「发布题目供内部选用」与「向候选人发送邀请」。

### Scope

题库首屏说明及相关中英文文案、文案回归测试。

#### Estimate analysis

文案与对应回归测试是单点修改，验证范围小，建议 1 点。

### Non-goals

不修改发布或邀请的实际业务状态、权限和数据模型。

### Acceptance Criteria

- AC-1: 题库说明明确以 Question/题目为发布对象，并说明发布不等于发送候选人邀请；UI 测试核对关键句。
- AC-2: 中英文界面用词与 W01 PRD 的 Question、Case、Invitation 对象保持一致；文案快照覆盖两种语言。

### References

- [W01 PRD](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/PRD.md)：FR-3。
- [W01 线上测试报告](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/Test_Report_2026-10-16.md)：W01-LIVE-06、UC-W01-01。
- `hireos-written/hireos-written-front/src/pages/QuestionBankPage.tsx`

### Dependencies

题目发布语义应以 W01 产品决策为准；如发布流程调整，文案同步确认。

### Risk

low

### Owner

@JsonSuCoder

### Estimate

1

### AI Ready

No

### Reproduction

1. 打开线上 Question Bank。
2. 读取标题下方说明。
3. 观察文案为 `Publishing a case does not send it — invitations are a separate step.`。

每次打开页面均可见。

### Expected / Actual

预期：明确写题目发布与邀请发送是两个动作。

实际：使用 Case 作为发布对象，容易与案件对象混淆。

### Environment

2026-10-16，Chrome 桌面端，线上 `https://hireos.aipollo.me/hireos/written/question-bank`，英文界面。线上构建号未知。

### Severity

S4

### Evidence

![题库说明使用 Publishing a case](https://github.com/user-attachments/assets/6e71ffbe-379b-44fd-93bf-ee4f730d95a3)
