# M8「发布与版本管理」线上测试报告

测试日期：2026-10-14，约 19:25–19:29（Asia/Shanghai）  
结论：**未达到验收条件**。完成了线上只读的发布门禁、版本历史和快照检查；12 条用例中 **部分验证 2 条、未验证 7 条、已知缺口 3 条**。另发现一个已标为 `Published` 的职位没有任何 JD 发布版本。发布、外部渠道、恢复、服务端门禁和幂等均未完成端到端验证，不能据此宣称通过。

## 1. 依据、环境与边界

| 项 | 本次记录 |
|---|---|
| 产品依据 | [PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop IO](Loop_IO.md)，均为 v1.0 草稿 |
| UX/UI 依据 | [JD Management UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md)，按步骤留证并检查 U1–U10 |
| 线上入口 | [Job Library](https://hireos.aipollo.me/hireos/jd/jobs)，Codex in-app browser，英文界面 |
| 可见身份 | 页首“蔡敏”；无法从 UI 确定当前角色、服务端身份和字段权限 |
| 线上构建 | 页面未显示构建号；本地仓库 HEAD `c0e47a6` **不是**线上构建证据 |
| 列表基线 | 加载完成后 All Jobs 22 / My Jobs 0 / Published 7 / Drafts 15；本次没有主动提交新增、编辑、发布、撤回或删除职位 |
| 取证方法 | 在真实线上 UI 打开现有职位、版本历史与只读快照；检查可访问树、可见文案、按钮状态，并刷新复核一处不一致 |

仓库 [AGENTS.md](../../../../AGENTS.md) 的安全规则写明 Agent 不操作生产环境；M8 [PRD §7](PRD.md) 又要求发布测试只用测试渠道并随即撤回，但文档确认线上没有测试渠道。本次因此只进行页面查看，不提交 Publish、不主动改写现有职位、不直接调用写接口。**读取接口也未必是严格无副作用的**：本地 `versions.service.ts` 的 `GET versions` 实现会在缺少 JD 编号时调用 `ensureCode` 分配编号；由于未取得线上部署版本和 DB 变更记录，不能证明本次页面查看绝对没有写入。此边界使报告覆盖了所有用例的判定状态，但**不是完整的端到端执行**。也未取得已登录 API/DB 只读入口、审计记录、渠道回执、可控超时/断网注入或多角色账号。UI 截图/可访问树不能证明这些结果。

## 2. 按 User Journey 的线上证据

| Step | 实际操作 | 预期 | 线上观察 | 判定 |
|---|---|---|---|---|
| 入口/门禁 | 打开现有测试 Draft：[`[UJ-TEST] M6 Analyze 20261014`](https://hireos.aipollo.me/hireos/jd/jobs/65685cc8-95a8-4052-9440-ce192eaf4c8f) | 不完整时不能发布，并解释原因 | 页头 `Draft`、`JD-2026-0018`、`Not published`；Publish 禁用，帮助文案 `5 item(s) to complete or revise before publishing — see Analysis`；Analyze 5。另一 [Draft](https://hireos.aipollo.me/hireos/jd/jobs/e72229a2-028f-40bc-a96b-b02ec3829701) 为 Analyze 2，同样禁用。 | **部分满足**：仅确认不完整草稿的 UI 门禁；未验证未批准门禁及 API |
| 1 发布窗口 | 尝试寻找可安全打开窗口的已批准、Ready 测试 seed | 窗口显示 JD ID、版本、说明、渠道与 Public 范围 | 可见样本没有符合门禁的测试 seed；未打开 Publish 窗口。 | 未验证 |
| 2 发布 v1 | 未确认发布 | 新版本、徽章、活动记录与状态变化 | 一个现有[已发布职位](https://hireos.aipollo.me/hireos/jd/jobs/bdc48b9a-9dd5-4be7-a753-d7d88fd3ba5d)页头显示 `JD-2026-0010`、`v1 published`；历史中 `v1`、`Oct 13, 2026`、`Linh Tran`、`First publication`，可打开 `SNAPSHOT (READ-ONLY)`。这证明**历史读取**可用，不证明本次发布写入、审批绑定或活动记录。 | 部分旁证；发布行为未验证 |
| 3 外部内容 | 未打开对外页面 | 只有 Public，无 Internal/Confidential | 历史快照有 Public 标记，但它是内部只读快照，不能代替外部渠道输出。 | 已知缺口 / 未验证 |
| 4 未发布修改 | 未编辑线上职位 | `Unpublished changes`，外部保持旧版 | 无可安全修改的发布测试 seed；未测试。 | 未验证 |
| 5 发布 v2 | 未再次发布 | 版本号 +1，确认窗列出差异 | 无已批准测试 seed 和测试渠道。 | 未验证 |
| 6 版本对比 | 打开上述 v1 历史，并检查另一个 [Published 职位](https://hireos.aipollo.me/hireos/jd/jobs/2c317388-d082-46b0-af25-17976afd8d4b) | 可选择任意两版，对比增删改与可见范围 | 第一个职位只有 v1；第二个职位的历史为空，没有 v1/v2 测试 seed。未能打开两版对比。 | 未验证；另见 M8-LIVE-01 |
| 7 恢复旧版 | 未执行恢复 | 草稿回到旧版，历史保留，新增记录 | 无 v1/v2 测试 seed；线上未执行写操作。 | 未验证 |
| 8 撤回 | 未执行 | 测试渠道页面下线并记时 | 无测试渠道和撤回路径证据。 | 已知缺口 / 未验证 |
| 历史键盘操作 | 在第二个职位打开 Version history 后按 Escape | 可退出当前浮层 | 浮层关闭，焦点返回 Version history 按钮。 | 本路径通过 |

**额外状态观察：**[Growth Operations Manager](https://hireos.aipollo.me/hireos/jd/jobs/2c317388-d082-46b0-af25-17976afd8d4b) 在列表和详情为 `Published`，同一详情页却显示 `Not published`；Version history 写明 `Not published yet — the first Publish creates v1.`。刷新后仍如此。详情页同时显示 `Unsaved changes`，本次未编辑该职位；这一点需要核实原有草稿状态及保存标识来源，不能仅凭 UI 判定服务端数据被改写。列表的 `ACTIVE VERSION` 列在所见 7 个 Published 行均显示 `None`；该列可能指其他版本类型，暂不据此推断所有职位没有 JD 发布版本。

## 3. 用例与 AC 判定

| 用例 | 结果 | 关键证据 / 缺口 |
|---|---|---|
| UC-M8-01 未批准或未 Ready | **部分验证** | 不完整 Draft 的 Publish 禁用且有原因；未批准条件未测，审批能力标为 known gap |
| UC-M8-02 服务端拒绝不合格发布 | **未验证** | 未直调已登录 publish API，未比对版本数；预期 422 不能靠禁用按钮证明 |
| UC-M8-03 发布窗口信息 | **未验证** | 无 Ready 且已批准测试 seed，未打开窗口 |
| UC-M8-04 发布生成新版本 | **未验证** | 现有 v1 可读取；本次未发布，未核查 hash、审批决定、Core 状态、活动记录 |
| UC-M8-05 仅 Public 对外 | **已知缺口** | 无测试渠道；内部快照不能证明外部过滤 |
| UC-M8-06 修改后提示 | **未验证** | 未改动已发布内容，也无外部页面对照 |
| UC-M8-07 两版对比 | **未验证** | 所见样本至多一版；无 v1/v2 差异 seed |
| UC-M8-08 恢复旧版 | **未验证** | 无 v1/v2 seed，未写入恢复草稿；历史保留/记录未核查 |
| UC-M8-09 双击 Publish 幂等 | **未验证** | 未发布、未注入 double_click，也未查 API/DB |
| UC-M8-10 渠道超时 | **已知缺口** | 无渠道桩与回执状态 |
| UC-M8-11 已发布版本不可改 | **部分验证** | v1 打开为 `SNAPSHOT (READ-ONLY)`；未直调修改接口或核对 hash |
| UC-M8-12 撤回测试渠道 | **已知缺口** | 无测试渠道，也未执行撤回 |

统计：**部分验证 2 / 未验证 7 / 已知缺口 3 = 12**。这里的“部分验证”仅代表可见 UI 断言成立，**不等于用例通过**。

| PRD AC | 判定 | 原因 |
|---|---|---|
| AC-1 门禁与服务端拒绝 | **部分验证** | 不完整草稿 UI 门禁成立；审批门禁和 API 422 未验证 |
| AC-2 新版本与窗口 | **未验证** | 可读现有 v1 快照，但未执行发布；另有 Published/无版本状态矛盾 |
| AC-3 仅 Public 对外 | **已知缺口** | 无测试渠道和外部页面 |
| AC-4 未发布修改 | **未验证** | 无修改和对外旧版对照 |
| AC-5 比较与恢复 | **未验证** | 无两版 seed，未执行恢复 |
| AC-6 双击幂等 | **未验证** | 未执行双击或核对版本数 |
| AC-7 渠道超时 | **已知缺口** | 无渠道桩 |

## 4. 发现与修复验收

| ID / 严重度 | 证据与影响 | 最小修复方向 / 复验 |
|---|---|---|
| M8-LIVE-01 / **P1** · 发布状态与版本历史冲突 | [Growth Operations Manager](https://hireos.aipollo.me/hireos/jd/jobs/2c317388-d082-46b0-af25-17976afd8d4b) 列表和页头为 `Published`，页头并列 `Not published`，历史提示首次 Publish 将创建 v1；刷新后仍如此。Recruiter 无法确认当前对外生效的 JD 版本，版本追溯中断。 | 先核实该职位是否属历史 Core 状态迁移、JD 发布记录缺失或状态映射问题；明确区分招聘状态与 JD 发布状态及当前有效版本。复验同一职位在列表、详情、历史、API 的状态和版本引用一致；若无 JD 版本，明确说明原因和下一步。 |
| M8-LIVE-02 / **P2，待核查** · 未操作时显示待保存 | 同一职位在本次只读打开和刷新后显示 `Unsaved changes` 与 Save。可能让用户误以为本次有待提交改动；尚无证据确认是否原有未保存草稿、加载转换或前端状态错误。 | 用无历史编辑的独立会话复现，并对比加载前后的草稿 revision/hash；只有实际更改后才显示待保存。 |
| M8-GAP-01 / **P0 验收阻塞** · 缺测试渠道 | PRD 明确线上无渠道且测试须在测试渠道发布后撤回；AC-3、AC-7、UC-M8-12 无法安全验证。这里是**测试条件缺口**，不把它误记为已复现的外发产品缺陷。 | 提供隔离测试渠道、可控成功/超时/无回执桩、可查询状态与撤回记录；验证对外仅 Public，测试后撤回。 |
| M8-GAP-02 / **P0 验收阻塞** · 缺审批与角色 seed | 文档记录审批尚未实现；当前不能形成“Ready 且已批准”的可追溯发布条件，也不能检验 Recruiter/Manager/Viewer 权限。 | 落地 M7 审批与固定版本引用后，准备四角色测试账号和 approved / not-approved / incomplete seed；以 UI 与服务端接口同时核验。 |

本地代码仅作为排查线索，**不能替代线上构建证据**：`JobWorkspacePage.tsx` 当前的 Publish 禁用条件主要检查完整性和是否有内容变更；`versions.service.ts` 的发布逻辑可见 revision/no-change 校验及版本写入，但没有从上述阅读中得到线上审批校验或 422 行为的证明。需用部署版本、已登录 API 和测试 DB 复核。

## 5. UX/UI 应用性检查（U1–U10）

角色按 User Journey 设为 Recruiter / TA，目标是发布已批准 JD、确认外部范围并追溯/恢复版本。线上会话显示“蔡敏”，**角色归属未证实**。

| 标准 | 判定 | 证据与限制 |
|---|---|---|
| U1 容易理解 | **失败** | JD ID 与 Draft/Published 徽章可见；M8-LIVE-01 的 `Published` + `Not published` 同屏冲突 |
| U2 容易上手 | **部分满足** | Version history 有可访问标题；Publish 禁用提示引导到 Analysis，但未直接列缺失项或审批路径 |
| U3 快速完成任务 | **未验证** | 无合格 seed，未能走完发布、渠道确认与撤回 |
| U4 下一步明确 | **部分满足** | 不完整草稿提示去 Analysis；Published/无版本样本未说明该找谁修复或如何建立当前版本 |
| U5 提示和按钮清楚 | **部分满足** | 不完整时 Publish 的禁用原因可读；发布确认窗未打开，影响范围与渠道文案未验证 |
| U6 符合真实工作方式 | **未验证** | 无审批、渠道、恢复端到端路径；只能读历史快照 |
| U7 角色信息结构 | **未验证** | 单一可见账号；未测 Recruiter、Manager、Approver、Viewer 不同权限 |
| U8 减少跳转重复 | **部分满足** | 职位详情页可直接打开历史并返回；发布/恢复主流程未走通 |
| U9 可恢复和可预期 | **未验证** | Escape 关闭历史浮层成功；网络中断、渠道未知、重试幂等未注入 |
| U10 可访问可操作 | **部分满足** | 历史浮层有标题和 Close，Escape 可关闭且焦点回到历史按钮；未测 200% 缩放、完整键盘路径及读屏体验 |

按审查标准，核心外发、权限、持久化和恢复缺少证据，故 **review verdict = `insufficient_context`，M8 整体验收不通过**。M8-LIVE-01 须在允许用户将 `Published` 解释为已有可追溯 JD 发布版本前处理。

```yaml
review:
  product: "JD Management"
  surface: "M8 Publish & Versions"
  role: "Recruiter / TA（会话角色未证实）"
  journey_goal: "发布已批准 JD，并追溯、比较和恢复版本"
  evidence:
    source: "线上 UI 可访问树、可见页面、刷新复核；本地代码仅作排查线索"
    steps_checked: ["入口门禁", "现有 v1 历史与快照", "历史浮层键盘退出", "Published/无版本状态"]
  verdict: "insufficient_context"
  findings:
    - id: "M8-LIVE-01"
      severity: "P1"
      category: "state"
      step: 6
      title: "Published 与 Not published/空历史冲突"
      evidence: "JD-2026-0002 同屏显示 Published 和 Not published；历史称首次 Publish 将生成 v1，刷新后不变"
      user_impact: "Recruiter 无法确定当前生效的 JD 版本"
      recommendation: "核对状态映射和历史迁移，显示一致的发布状态与版本引用"
      acceptance_check: "同一职位在列表、详情、历史和 API 中状态及版本一致"
  usability_check:
    understandable: "fail"
    learnable: "unknown"
    efficient: "unknown"
    next_action_clear: "fail"
    controls_clear: "unknown"
    real_workflow_fit: "unknown"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "没有可安全使用的已批准 Ready 测试 seed 或测试渠道"
    - "没有线上构建号、已登录 API/DB、审计记录和多角色账号"
    - "未执行发布、编辑、恢复、撤回、双击或故障注入"
```

## 6. 完成全量验收所需条件

1. 提供与真实招聘隔离的 M8 测试职位：`S_job_approved`、`S_job_ready_not_approved`、`S_job_incomplete`、`S_job_published_v1_v2`，最后一个必须覆盖增删改及可见范围变化。
2. 提供已登录的只读 API/DB/审计核查方式，以及可控的 publish 非法请求、双击、断网和渠道超时测试方式；记录线上构建号。
3. 提供隔离测试渠道及撤回路径，复验外部 Public 过滤、每渠道状态、结果未知与撤回时间。
4. 产品确认 PRD 的待决点：测试渠道、恢复接口、恢复后审批与“只改版本说明是否可发布”。审批依赖先按用户已确认的“恢复审批”方向实施。

本次仅主动新增本地报告文件；未创建 GitHub Issue，也未主动提交线上数据变更。读取版本历史是否触发编号分配尚未核实。正式缺陷 Issue 仍按仓库流程先给用户看草稿并确认。

## 7. 后续产品决定（2026-10-15；不改变上述测试事实）

用户已明确：当前 Publish 仅生成内部版本；每次成功 Publish 生成新版本；历史 Published 无版本职位统一补为 v1；内容未变、只改版本说明不得 Publish。M7 审批采用邮件中的审批按钮，并将确定的审批信息回传。上述决定已写入更新后的 [M8 PRD](PRD.md) 与 [问题清单](Issues_and_Product_Decisions_2026-10-15.md)。本报告第 3 节的 12 条统计仍是 **2026-10-14 当时规格下的执行记录**，不是调整后 14 条用例的重测结果；渠道相关用例现属后续阶段。
