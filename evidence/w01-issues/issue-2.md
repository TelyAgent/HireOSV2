### Type

Bug

### Subsystem

hireos-written

### Problem

线上 Import ZIP 弹窗显示 `Demo adapter`，Choose File 禁用；点击 `Parse (demo)` 后显示固定的「1 prompt · 2 materials · 1 internal answer key」提示。用户没有上传文件，也看不到旧候选人提交的分类预览和确认门禁，容易把演示提示误认为真实解析。

### User Outcome

出题人能上传 ZIP，先核对题目、候选人材料、内部答案和旧提交的分类，再明确确认导入；内部资料不进入候选人视图。

### Scope

ZIP 上传、解析结果与错误状态、四类内容预览、人工确认前不入库、导入后 Draft 状态及隔离验证。

#### Estimate analysis

需要前后端上传、解析安全、Core FileVersion、确认事务和候选人隔离。允许的文件类型、扫描策略和 W18 接口尚未确定，关键实现路线和验证范围未收敛，当前不能可靠估算。

### Non-goals

不改变已存在题目的版本；不把旧候选人提交重新发送给候选人。

### Acceptance Criteria

- AC-1: 上传合成 ZIP 后，预览分别列出 1 个题目、2 份材料、1 份内部答案和 1 份旧候选人提交；旧提交清楚标为不会外发；自动测试核对分类。
- AC-2: 用户确认分类和隔离前，数据库中没有新题或材料；确认后题目以 Draft 入库，候选人预览/API 不含内部答案和旧提交；集成测试覆盖确认前后状态。
- AC-3: 损坏 ZIP 与含不允许内容的包返回可理解错误，可重新上传；自动测试覆盖拒绝、宏不执行和无部分入库。

### References

- [W01 PRD](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/PRD.md)：FR-9、BR-5、AC-4。
- [W01 线上测试报告](https://github.com/TelyAgent/HireOSV2/blob/main/docs/product/Written_Test/W01_Question_Bank/Test_Report_2026-10-16.md)：W01-LIVE-02、UC-W01-12/13。

### Dependencies

Core FileVersion 接入、ZIP 安全策略、测试包及隔离测试环境；正式导入字段和文件类型需与 W01/W18 规格对齐。

### Risk

high

### Owner

@JsonSuCoder

### Estimate

TBD

### AI Ready

No

### Reproduction

1. 打开线上 Question Bank，点击 Import ZIP。
2. 观察 Choose File 为禁用状态。
3. 不选择文件，点击 Parse (demo)。
4. 页面仍显示固定 Parsed 提示。

每次打开弹窗均可复现。本轮未上传文件或写入题库。

### Expected / Actual

预期：上传文件后才解析，并显示题目、材料、内部答案和旧候选人提交的分类预览及确认门禁。

实际：没有上传文件，只显示固定 toast，不能进入真实确认导入流程。

### Environment

2026-10-16，Chrome 桌面端，线上 `https://hireos.aipollo.me/hireos/written/question-bank`，英文界面。线上构建号未知。

### Severity

S2

### Evidence

ZIP 文件选择禁用：

![Import ZIP 文件选择禁用](https://github.com/user-attachments/assets/f468140f-d3dc-4a1b-b390-dc01f2351b96)

未上传文件即显示固定解析提示：

![Parse demo 固定提示](https://github.com/user-attachments/assets/8b101d75-2559-4a1b-b390-dc01f2351b96)
