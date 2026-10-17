### Type

Feature

### Subsystem

- hireos-written
- hireos-interview
- hireos-core-record

### Problem

W11 要求在 AssessmentPackage 文件 Ready 后通过 Outbox 发布轻量事件，并展示下游接收和导入回执。本地参考源码中的交接仍同步调用 Interview，未找到交付包 FileVersion、Outbox/Inbox 或回执时间线实现。

本轮线上没有已发布待交接的隔离测试 Case，因此该差距是源码与规格对照结果，不是完整的线上复现结论。

### User Outcome

HR 能确认交付包何时准备好、事件是否排队和发布、Interview 是否收到并导入；依赖恢复或事件重投后不会重复创建 intake。

### Scope

- 生成并登记版本化 AssessmentPackage，共享文件 Ready 后才允许交接。
- 通过 Outbox 发布只包含包引用的轻量事件。
- Interview Inbox 去重并记录 received/imported 回执。
- 增加交付页时间线、Handoff queued 和 Awaiting confirmation 状态。
- 覆盖 Core 不可用、总线宕机、无 ACK、重投和乱序场景。

#### Estimate analysis

当前无法可靠估算：该范围跨 Written、Core File、事件总线与 Interview，且 PRD 中同步 HTTP 过渡策略尚未决定。预计需要按交付包、事件链路、Interview intake 与前端时间线拆成可独立验收的子 Issue 后分别估算。

### Non-goals

- 不包含面试排期或面试执行。
- 不在事件中携带完整报告正文。
- 不让 AI 建议绕过负责人确认直接推进。

### Acceptance Criteria

- AC-1: AssessmentPackage 为 Uploading 或 Failed 时不产生交接事件；FileVersion Ready 后才创建 Outbox 记录，并通过集成测试核对事件只包含包引用。
- AC-2: 交付页按真实持久化记录展示 Result finalized、Preparing、File ready、Event queued、Published、Intake received、Imported；下游无 ACK 时显示 Awaiting confirmation。
- AC-3: 总线宕机时 Outbox 保持 pending、评分结果不变；恢复后自动继续，并通过故障注入测试验证无需人工重做。
- AC-4: 事件重投、乱序及用户重复确认时，Interview 仅创建一个 intake，并通过 Inbox 幂等键和集成测试验证。

### References

- `docs/product/Written_Test/W11_Next_Action_Handoff/PRD.md`：FR-4～FR-7、FR-9、AC-1、AC-2、AC-4。
- `docs/product/Written_Test/W11_Next_Action_Handoff/Loop_IO.md`：W11b、P7～P12。
- `docs/product/Written_Test/W11_Next_Action_Handoff/Test_Report_2026-10-16.md`：G01。
- `hireos-written/hireos-written-backend/src/cases/case-lifecycle.service.ts`：现有同步交接实现。

### Dependencies

- Blocked by: 产品决定同步 HTTP 的过渡策略。
- Core FileVersion/共享文件能力。
- 事件总线与 Outbox/Inbox 基础能力。
- hireos-interview intake 接收与回执契约。

### Risk

high

### Owner

@mincai2010-maker

### Estimate

TBD

### AI Ready

No

### User Flows

1. HR 在已发布结果页选择 Prepare Interview handoff，预览交付包内容，不产生外部副作用。
2. HR 确认交接后，系统生成并登记 AssessmentPackage；文件 Ready 前不发事件。
3. 文件 Ready 后，Outbox 发布轻量事件；交付页显示 queued、published、received、imported 的实际时间。
4. 总线不可用时显示 Handoff queued；下游无回执时显示 Awaiting confirmation。
5. 总线恢复或事件重投后自动继续，Interview 仅保留一个 intake。
