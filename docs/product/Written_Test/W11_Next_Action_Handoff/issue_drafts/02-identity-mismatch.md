### Type

Bug

### Subsystem

- hireos-written
- hireos-identity

### Problem

Written Test 任务页顶栏显示“蔡敏”，正文区域同时显示 `Signed in as John · HR Head · Aurora Studio`。操作者无法仅凭页面确认当前使用哪个身份执行发布、关闭或交接等高影响动作。

现有证据确认身份文字不一致，但尚未证明服务端权限错配或越权。

### User Outcome

用户在任务页、结果页和确认界面看到一致的当前身份，并能确认谁有权执行操作、谁会被记录为决策人。

### Scope

- 核对 Shell、Identity 与 Written Test 的当前用户来源和演示身份映射。
- 统一顶栏、任务正文和决策确认界面的当前身份展示。
- 验证操作审计 actor 与界面展示身份一致。
- 补充至少两个授权身份的切换与刷新测试。

#### Estimate analysis

当前无法可靠估算：身份文字可能来自前端演示 fixture、Shell 会话或 Identity 映射，定位结果会决定是单点展示修复还是跨模块身份集成修复。

### Non-goals

- 不在缺少服务端证据时宣称存在越权。
- 不重构无关的账号设置或组织成员管理。
- 不改变现有角色权限模型，除非调查确认模型本身错误。

### Acceptance Criteria

- AC-1: 顶栏、任务页和高影响动作确认界面显示同一个已认证操作者，并通过 UI 集成测试验证页面刷新后仍一致。
- AC-2: 服务端审计记录中的 actor 与界面展示的操作者一致，并通过认证 API 集成测试验证至少两个授权身份。
- AC-3: 自动测试覆盖账号切换、直接深链和刷新场景，不复用前一用户的显示名称或角色。

### References

- `docs/product/Written_Test/W11_Next_Action_Handoff/User_Journey.md`：角色与入口。
- `docs/product/Written_Test/W11_Next_Action_Handoff/Test_Report_2026-10-16.md`：F02。
- `docs/product/HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md`：U1、U7、角色与权限。

### Dependencies

需核实 Shell、hireos-identity 与 hireos-written 的会话身份来源及演示用户映射。

### Risk

medium

### Owner

@mincai2010-maker

### Estimate

TBD

### AI Ready

No

### Reproduction

1. 登录线上 HireOS Command。
2. 打开 Written Test 的 `My Tasks`。
3. 对比页面右上角账号名称与任务区的 `Signed in as` 文案。

本轮观察频率为稳定 1/1 次页面加载。

### Expected / Actual

预期：两处显示同一个当前认证用户及其角色。

实际：顶栏显示“蔡敏”，任务区显示 `Signed in as John · HR Head · Aurora Studio`。尚未验证服务端实际授权身份。

### Environment

- 时间：2026-10-16，Asia/Shanghai。
- 环境：`https://hireos.aipollo.me/hireos/written/tasks`，Chrome 桌面浏览器。
- 线上构建号：未知。
- 本地参考 HEAD：`c4b610500d33a279c03251091c5f0af13b831318`，不代表线上构建。
- 截图含候选人信息，仅供仓库授权成员处理；见 `[AI-EVIDENCE]` 评论。

### Severity

S3
