# M7 角色权限与审批：线上测试报告（2026-10-14）

## 1. 结论

**判定：不通过（已知功能缺口）；15 个用例均不能判为通过。** 本次在已发布页面观察到：当前账号只有“管理员、HR”角色；成员权限页可分配的角色只有“管理员、HR、面试官”；职位库没有待审批入口或审批状态列；职位详情没有“提交审批”、候选版本或审批决定入口。M7 产品文档本身也将审批流程及按角色的服务端权限标为未实现。本次未取得四个 M7 测试身份、Ready 且含 Confidential 的专用职位、已登录 API/数据库只读访问，因此**不能用 UI 缺口推断所有服务端请求的实际返回码，也不能宣称敏感字段隔离已验证**。

报告依据：[PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop IO](Loop_IO.md) 和 [UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)。上述 M7 文档版本为 v1.0 草稿；超时时长、审批步骤、授权字段等未决规则不作为既定验收阈值。

## 2. 环境、方法与证据

| 项 | 记录 |
|---|---|
| 测试时间 | 2026-10-14 约 19:26–19:28（北京时间） |
| 环境 | Chrome 已登录会话，`https://hireos.aipollo.me/hireos/jd/jobs`；已发布环境，页面没有显示构建号 |
| 身份 | 页面显示“蔡敏”；个人设置显示“管理员、HR”。没有将其推定为 Recruiter、Hiring Manager、HR Approver 或 Viewer |
| 方法 | 实际打开职位库、测试草稿、已发布职位、个人设置和成员权限页；读取页面可访问树、DOM 和可见截图；对照本地仓库控制器与权限代码。仅做只读观察，未变更成员权限、职位、审批或发布状态 |
| 线上 API / DB | 没有可用的已登录 API 调试会话或数据库只读连接；未执行权限写接口。浏览器页面观察不能替代 API/DB 断言 |
| 构建映射 | 本地代码只用于解释可疑缺口；未获得线上构建号，不能断言本地 HEAD 与线上完全一致 |

### 可复核证据

| ID | 来源 | 实际观察 |
|---|---|---|
| E1 | [线上职位库](https://hireos.aipollo.me/hireos/jd/jobs) | 列表为“全部职位 22 / 我的职位 0 / 已发布 7 / 草稿 15”；表格列为职位名称、招聘状态、生效版本、部门、创建者、地点、编制、更新时间。没有“待我审批”入口或审批状态列。 |
| E2 | [测试草稿](https://hireos.aipollo.me/hireos/jd/jobs/65685cc8-95a8-4052-9440-ce192eaf4c8f) | `[UJ-TEST] M6 Analyze 20261014` 显示“草稿”“未发布”“分析 5”“已保存”；“发布”按钮因 5 项待补充而禁用。页面未见“提交审批”及其禁用原因、审批人或候选版本。此职位并非 M7 的 Ready seed。 |
| E3 | [已发布职位](https://hireos.aipollo.me/hireos/jd/jobs) 中的“AI 工具产品经理” | 详情头部同时显示“已发布”（招聘状态）和“未发布”（JD 发布状态），有 JD ID、版本历史、文档、分析及“发布”按钮；未见审批状态、审批版本哈希、审批记录。两个状态缺少明确对象标签，容易误解。 |
| E4 | [个人设置](https://hireos.aipollo.me/hireos/jd/settings/profile) | 当前用户角色显示“管理员”“HR”，没有 M7 四角色中的专用业务角色标识。 |
| E5 | 同一设置页“成员与权限” | 成员角色选择器仅有“管理员”“HR”“面试官”。本次只展开选项，没有修改任何人的角色。 |
| E6 | 本地代码（非线上部署证明） | [JobsController](../../../../hireos-jd/hireos-jd-backend/src/jobs/jobs.controller.ts) 的读取、更新和状态变更接口使用认证守卫，未见 M7 审批请求/决定接口或字段级角色检查；[WorkspaceGuard](../../../../hireos-jd/hireos-jd-backend/src/auth/workspace.guard.ts) 将会话角色放入 identity，守卫本身只完成身份验证。 |

## 3. 逐用例执行结果

状态含义：**已观察到缺口**只陈述页面中实际缺少的入口或角色；**阻断、未执行**表示无法建立必要身份/数据/接口前置条件，不计为通过，也不虚构 HTTP 状态或 DB 结果。

| 用例 | 预期核心结果 | 本次实际结果与证据 | 判定 |
|---|---|---|---|
| UC-M7-01 未 Ready 不能提交 | 禁用提交并解释；API 422 | E2 为未 Ready 草稿，但根本没有提交审批按钮；无法测试其禁用解释。API 未调用。 | 已观察到入口缺口；API 未验证 |
| UC-M7-02 提交并冻结版本 | Ready 后 pending、版本哈希、审批人 | E1–E2 无提交入口；无 Ready 且含 Confidential 的 seed；未创建请求。 | 阻断、未执行 |
| UC-M7-03 禁止自审批 | 提交者调用决定接口得 403 | UC-02 未建立 pending 请求；无决定入口/已登录 API 调试条件。 | 阻断、未执行 |
| UC-M7-04 HM 改授权字段 | 职责可保存并审计 | E5 不提供 Hiring Manager 角色；没有 HM 测试账号；未修改现有职位。 | 阻断、未执行 |
| UC-M7-05 HM 改预算被拒 | UI 只读，API 403，值不变 | 同上，且没有专用预算 seed；不能用当前管理员身份代替 HM。 | 阻断、未执行 |
| UC-M7-06 HR Approver 批准 | 候选版本、差异、风险、人工决定 | E1 无待我审批入口，E2 无候选版本；无 HR Approver 身份及 pending 请求。 | 已观察到入口缺口；决定未执行 |
| UC-M7-07 无理由退回/拒绝 | 阻止提交、保持 pending | 无审批决定界面与 pending 请求；未触发动作。 | 阻断、未执行 |
| UC-M7-08 有理由退回/拒绝 | 记录理由，Recruiter 可见并重提 | 同上；未生成决定或通知。 | 阻断、未执行 |
| UC-M7-09 审批中修改 | 旧请求 superseded，旧决定 409/422 | 没有 pending 请求；未改线上职位。 | 阻断、未执行 |
| UC-M7-10 Viewer 只读 | 无编辑控件、无 Confidential | E5 没有 Viewer 角色；未用 Viewer 登录，不能验证页面隔离。 | 阻断、未执行 |
| UC-M7-11 Viewer API 隔离 | GET 不含敏感正文；写请求全 403 | 无 Viewer 身份和 Confidential seed；未取得已登录 API/DB 证据。 | 安全断言未验证 |
| UC-M7-12 角色变更即生效 | Recruiter ↔ Viewer 下次请求即时变化 | E5 没有这两种角色；未修改任何真实成员权限。 | 阻断、未执行 |
| UC-M7-13 审批人无 restricted 权限 | UI/API 均不含 restricted 值 | 无 HR Approver 子权限和候选版本；未取得 API 响应。 | 安全断言未验证 |
| UC-M7-14 双击提交幂等 | 仅一个 pending 请求 | E2 无提交入口；未触发双击，也未查询请求记录。 | 阻断、未执行 |
| UC-M7-15 超时提醒 | 按规则提醒和更新状态 | 无 pending 请求、时钟控制或已确认的超时规则。 | 阻断、未执行 |

### AC 覆盖

| 验收标准 | 结论 | 主要缺口 |
|---|---|---|
| AC-1 提交门槛与冻结版本 | 未满足/未完整验证 | UI 无提交入口；API/DB 未验证 |
| AC-2 禁止自审批 | 未验证 | 无 pending 请求及双身份 |
| AC-3 HM 字段权限 | 未验证 | 无 HM 身份、授权字段最终清单及 API 证据 |
| AC-4 审批决定与理由 | 未满足/未完整验证 | UI 无审批入口；决定记录未验证 |
| AC-5 修改使旧审批失效 | 未验证 | 无 pending 请求 |
| AC-6 Viewer 与 restricted 隔离 | 未验证，属于安全阻断 | 无 Viewer/受限审批人及已登录 API 响应 |
| AC-7 角色变更即时生效 | 未验证 | 四角色不可分配，未做权限变更 |

## 4. 问题清单与最小修复方向

| ID / 级别 | 角色、旅程步骤 | 证据与用户影响 | 建议及复验 |
|---|---|---|---|
| M7-LIVE-01 / P0 | Recruiter 步骤 2–3；HR Approver 步骤 6–8 | E1–E2：无提交审批、待我审批及决定入口。Recruiter 无法把 Ready 版本交给审批人，审批人无法作出人工决定。 | 实现审批请求、候选版本、决定与状态入口；用 UC-01/02/06/07/08/09/14 在 UI+API+DB 重验。 |
| M7-LIVE-02 / P0 | HM 步骤 4–5；Viewer 步骤 10–12；角色变更 | E4–E5：角色仅管理员/HR/面试官，无法构造四角色测试。若仅依靠页面隐藏，无法保证敏感内容隔离。 | 确认角色分配范围和授权字段，提供四角色测试身份；在服务端逐请求校验读写和字段过滤，复验 UC-04/05/10/11/12/13。当前**没有线上越权成功的实测证据**，故此项是验收阻断，不称为已证实泄露。 |
| M7-LIVE-03 / P1 | Recruiter / Approver 查看职位 | E3：同一头部同时显示“已发布”和“未发布”，没有标明分别属于招聘状态、JD 对外发布状态。审批状态也缺席，用户难以判断版本是否可审批或已交付。 | 分别标注各状态对象，显示审批状态、候选版本与下一负责人；复验用户能正确区分 Draft/Approval/Publication。 |
| M7-LIVE-04 / P1 | Recruiter 步骤 2；Approver 步骤 6 | E2：有 5 项分析问题时，“发布”按钮说明禁用原因，但没有“提交审批”及缺失项修复到审批的路径。 | 完整性结果关联 Ready 门槛，显示“修复 → 提交审批 → 等待谁处理”的下一步。 |

## 5. UX/UI 审查（强制 U1–U10）

审查对象：职位库 → 职位详情 → 审批路径。目标角色为 Recruiter / TA 和 HR Approver，辅助检查 HM/Viewer。页面视觉证据只覆盖当前管理员/HR 会话，不代表其他角色视图。

| 标准 | 判定 | 证据 / 限制 |
|---|---|---|
| U1 容易理解 | 失败 | E3 两个“发布”状态未标明对象；审批状态未展示 |
| U2 容易上手 | 失败 | E1–E2 没有审批入口或起点 |
| U3 快速完成任务 | 失败 | 无法完成提交与批准主任务 |
| U4 下一步明确 | 失败 | E2 只有分析问题和禁用发布，没有审批交接对象或下一步 |
| U5 提示和按钮清楚 | 部分满足 | “发布”禁用原因可见；缺少提交审批的状态及提示 |
| U6 符合真实工作方式 | 失败 | 无法进行退回、改稿、重提、人工批准 |
| U7 信息结构符合角色目标 | 失败 | E4–E5 无四角色工作台；职位库无待我审批 |
| U8 减少来回跳转 | 未验证 | 审批路径不存在，无法计数或评估上下文传递 |
| U9 可恢复和可预期 | 未验证 | 无审批超时、冲突、权限撤销及幂等测试条件 |
| U10 可访问、可读、可操作 | 未验证 | 本轮没有完成键盘、200% 缩放、焦点顺序的专项测试；截图/DOM 不能证明完整无障碍合规 |

```yaml
review:
  product: "JD Management"
  surface: "M7 角色权限与审批路径"
  role: "Recruiter / TA; Hiring Manager; HR Approver; Viewer（实际登录：管理员、HR）"
  journey_goal: "提交精确版本、由授权审批人决定，并按角色隔离操作与敏感信息"
  evidence:
    source: "线上 Chrome 页面可访问树、DOM、可见截图；本地代码仅作辅助"
    steps_checked: ["职位库", "未 Ready 草稿", "已发布职位", "个人设置", "成员与权限"]
  verdict: "fail"
  findings:
    - id: "M7-LIVE-01"
      severity: "P0"
      category: "state"
      step: 3
      title: "缺少提交审批与审批人处理入口"
      evidence: "E1、E2"
      user_impact: "Recruiter 与 HR Approver 无法完成主流程"
      recommendation: "实现可追溯的提交、待审批、候选版本和人工决定"
      acceptance_check: "UC-M7-01/02/06/07/08/09/14 的 UI、API、DB 断言通过"
    - id: "M7-LIVE-02"
      severity: "P0"
      category: "permissions"
      step: 10
      title: "四角色与字段级权限无法验收"
      evidence: "E4、E5；缺少多身份和已登录 API 证据"
      user_impact: "不能证明 Viewer 和无受限权限审批人的数据隔离"
      recommendation: "建立角色分配与服务端字段过滤、读写授权"
      acceptance_check: "UC-M7-04/05/10/11/12/13 经不同身份 API 复验"
  usability_check:
    understandable: "fail"
    learnable: "fail"
    efficient: "fail"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "fail"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "无四角色测试账号、Ready+Confidential 专用 seed"
    - "无已登录 API/DB、线上构建号和可控时钟"
    - "未做键盘、200% 缩放和焦点专项检查"
```

## 6. 完整复验所需条件

1. 产品先确定：审批一步还是两步、超时时长及动作、HM 授权字段、角色分配范围、Viewer 评论权限、岗位库审批状态列。四角色和恢复审批已在 M7 文档确定，但文档注明该决定尚未回写 GitHub，应同步到对应 Issue/PR 决策记录。
2. 提供独立的 Recruiter、HM、HR Approver、Viewer 及“无 restricted 权限的审批人”测试身份，并提供可重置的 `S_job_incomplete`、`S_job_ready_with_confidential` 专用职位。
3. 提供已登录 API/DB 只读验证方式、审计记录以及可控时钟/提醒观察通道；按 UC-M7-01–15 逐项执行，权限类必须检查 API 返回体及写操作后的数据不变。
4. 单独完成键盘、200% 缩放、焦点与错误提示专项检查。未执行的检查不得补记为通过。

本次**未新建、修改或删除线上数据**；没有执行部署、发布、外发或权限变更；没有创建 GitHub Issue。
