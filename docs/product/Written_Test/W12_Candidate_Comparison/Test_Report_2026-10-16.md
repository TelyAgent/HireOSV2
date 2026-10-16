# W12 候选人对比线上测试报告（2026-10-16）

## 结论

**未通过完整验收，结论为 `insufficient_context`。** 本轮在生产域名完成了 W12 入口和空状态的只读探索：对比列表为空；My Tasks 的三个岗位分组均有 `Compare candidates` 入口，已点击 1 人和 2 人分组，均提示 `No scored candidates to compare yet.`，没有进入对比详情。线上没有文档要求的 Alex/Taylor/Jordan/Casey、同岗位双 final、修订轮、受限账号等隔离 seed。本轮 **10 条用例 0 完整通过、1 部分验证、9 阻塞；6 项 AC 均未完整验证**。阻塞不等于产品缺陷，也不等于通过。

本地参考源码显示对比详情中的 Refresh、Export、Add comment 仅弹出模拟提示，对比存于前端 fixture；这属于**源码确认的实现缺口，不作为线上已复现行为**。生产健康端点 HTTP 200 只证明服务可达。本报告是线上探索测试与 UX/UI 审查，不是绑定 PR head 或合并 SHA 的正式 Codex QA。

## 范围、环境与证据

| 项目 | 记录 |
|---|---|
| 时间 | 2026-10-16，Asia/Shanghai；健康响应时间 `2026-10-16T04:13:59.066Z` |
| 入口 | [My Tasks](https://hireos.aipollo.me/hireos/written/tasks) → Cluster by JD → Compare candidates；[Comparisons](https://hireos.aipollo.me/hireos/written/comparisons) |
| 角色 | 页面正文显示 `John · HR Head · Aurora Studio`，顶栏账号显示另一名称；未获账号身份映射与权限说明，不能确认 `hm_daniel`/`hr_emma` |
| 可见数据 | All tasks 4；3 个岗位分组分别为 1、2、1 人；Pending release 1、Testing closed 1、Pending test 2；Comparisons 列表为空。真实候选人资料未在报告中转录 |
| 产品依据 | [PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop I/O](Loop_IO.md)；[JD Management UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的 U1–U10 及证据规则，按 W12 场景适配 |
| 本地参考版本 | `c4b610500d33a279c03251091c5f0af13b831318`，**不是线上构建 SHA** |
| GitHub | 未提供 W12 主 Issue、PR 或目标提交；只读检索未找到明确 W12 主 Issue。未创建 Issue/PR 或发布评论 |
| 操作边界 | 只读导航、点击对比入口、读取健康端点；未创建/修改真实候选人记录，未发送邀请或通知。无认证业务 API、数据库、邮件模拟器与服务端日志访问 |

| ID | 证据 | 可证明的事实 |
|---|---|---|
| E01 | [岗位分组 AX](evidence/2026-10-16/cluster-by-jd-ax.txt)、[截图](evidence/2026-10-16/cluster-by-jd.png) | 线上显示 3 个岗位分组及 Compare candidates 入口；截图包含招聘资料，仅限仓库内部审阅 |
| E02 | [无可比候选人 AX](evidence/2026-10-16/compare-no-scored-ax.txt)、[截图](evidence/2026-10-16/compare-no-scored.png) | 点击 2 人分组后仍在 My Tasks，提示 `No scored candidates to compare yet.`；1 人分组也观察到同一提示 |
| E03 | [空列表 AX](evidence/2026-10-16/comparisons-empty-ax.txt)、[截图](evidence/2026-10-16/comparisons-empty.png) | Comparisons 显示 `No comparisons yet.` 和回 My Tasks 的文字指引 |
| E04 | [健康响应](evidence/2026-10-16/health-body.txt)、[HTTP 响应头](evidence/2026-10-16/health-headers.txt) | `GET /hireos/written/api/health` 返回 HTTP 200，`phase-0` |
| E05 | [TasksPage.tsx](../../../../hireos-written/hireos-written-front/src/pages/TasksPage.tsx) 120–128、234 行；[fixtures.ts](../../../../hireos-written/hireos-written-front/src/data/fixtures.ts) 139 行 | 本地源码只在 0 个 scored case 时阻止；否则用内存 `COMPARISONS` 创建对比，不提供 2–4 人选择、上限或持久化证据 |
| E06 | [ComparisonsListPage.tsx](../../../../hireos-written/hireos-written-front/src/pages/ComparisonsListPage.tsx)、[ComparisonDetailPage.tsx](../../../../hireos-written/hireos-written-front/src/pages/ComparisonDetailPage.tsx) 65–79、88、125 行 | 本地源码的刷新/导出/评论为模拟 toast，差异文本无证据下钻，Next action 直接打开结果发布页；不能推定线上已部署相同代码 |

## 用例执行结果

判定口径：一条用例的 UI、API、DB、外部副作用断言全部取得实际证据才算通过；仅观察到一部分记为部分验证；缺 seed、身份或接口导致无法执行记为阻塞。

| 用例 | 结果 | 本轮证据与剩余断言 |
|---|---|---|
| UC-W12-01 只能选已评分候选人 / P1 | **部分验证** | E01–E02：无可比结果时点击入口给出明确提示，未进入详情；没有选择器可检查 1 人与 5 人边界，也无法证明未评分候选人的勾选门禁。E05 暗示 1 个 scored case 即可建对比，需隔离 seed 线上复现 |
| UC-W12-02 同阶段 final 可比 / P0 | **阻塞** | 缺同岗位、同试卷、同阶段双 final；无对比详情或快照版本 API/DB。健康响应 E04 不能替代业务验证 |
| UC-W12-03 AI draft 与 final 不排名 / P0 | **阻塞** | 缺 Alex final 70 + Taylor AI draft 80；无法观察默认模式、警示及无整体领先者 |
| UC-W12-04 Unknown / P0 | **阻塞** | 缺 Jordan/Casey 未测维度及对比详情；未验证 Unknown 开关和零分区分。该用例允许未评分者加入，与 UC-W12-01 的“只能选择已评分者”存在规格冲突，需先明确规则 |
| UC-W12-05 修订轮不混排 / P1 | **阻塞** | 缺修订轮 final 与初稿并存数据；未验证 Same stage/Changes since last round |
| UC-W12-06 Restricted / P0 | **阻塞** | 缺受限账号、共享快照和认证业务 API；未验证 UI 掩码及响应不泄露分数/证据 |
| UC-W12-07 差异下钻 / P1 | **阻塞** | 无对比详情与有证据的差异；未运行两次 AI 摘要；E06 为源码缺口而非线上证明 |
| UC-W12-08 Stale 与 Refresh / P1 | **阻塞** | 无旧快照、源结果更新与快照 API/DB；E06 仅说明本地实现是模拟 toast |
| UC-W12-09 评论、视图与导出 / P1 | **阻塞** | 无详情；未产生 PNG/PDF、未核个人偏好和团队分数、未验证超人数/深色主题；E06 为源码参考 |
| UC-W12-10 无发送副作用 / P0 | **阻塞** | 点击无可比入口未创建对比，但无邮件模拟器/Invitation DB，也未执行排序、导出或 Next action；不能据此声称无发送 |

## PRD Acceptance Criteria

| AC | 结果 | 原因 / 完成复测所需证据 |
|---|---|---|
| AC-1 混合 final/draft 默认 summary 且不选赢家 | **未验证** | 需要 Alex/Taylor seed、详情 UI 和源结果状态证据 |
| AC-2 未测维度为 Unknown 而非 0 | **未验证** | 需要 Jordan/Casey seed、矩阵 UI/API；先解决未评分者是否可加入的规则冲突 |
| AC-3 Stale、Refresh 新快照、旧快照保留 | **未验证** | 需要两个源结果版本、快照列表与 DB/API 记录 |
| AC-4 评论/只看差异/保存视图、超人数导出 | **未验证** | 需要 2–4 人和超过单页容量的隔离数据、导出文件及偏好/分数前后对照 |
| AC-5 对比/导出/排序不发送 | **未验证** | 需要 simulation adapter 邮件/通知计数、Invitation DB 前后对照 |
| AC-6 修订轮与初稿不混排 | **未验证** | 需要双轮数据、排序结果、Not comparable 标识和模式切换 |

## 旅程与 UX/UI 审查

**角色/目标**：Hiring Manager 从 My Tasks 按岗位比较已评分候选人的能力与证据，决定逐人下一步；本轮登录身份无法核实。JD 标准中 JD 审批、激活、发布的专属字段不适用 W12；采用其应用性、权限、恢复与证据要求。

| Step | 用户操作 | 预期 | 实际与证据 | 结论 |
|---|---|---|---|---|
| 1 | My Tasks → Cluster by JD | 看同岗位候选人并选择 2–4 名已评分者 | 三个岗位显示人数与对比按钮；没有可见候选人选择控件；点击 1 人/2 人分组显示无 scored 提示（E01–E02） | 入口与空反馈可用；合法人数/状态边界未验证 |
| 2 | 打开对比 | Role、Snapshot、Mode、矩阵与可比性说明 | 没有对比可打开；列表为空（E03） | 阻塞 |
| 3–6 | 查看分数、Unknown、证据、评论和视图 | 不误排名、证据可下钻、个人视图可保存 | 无详情；E06 仅见本地实现缺口 | 阻塞 |
| 7–10 | 更新结果、Refresh、Export、Next action | 旧快照保留、导出完整、提案批准前不发送 | 无隔离数据和外部计数器 | 阻塞 |

| 应用性硬项 | 判定 | 依据 / 限制 |
|---|---|---|
| U1 容易理解 | **部分** | 入口和空状态有清晰文案；页面正文与顶栏身份名称不一致，角色与可见范围难以确认（E01） |
| U2 容易上手 | **部分** | 空列表说明可从 My Tasks 岗位分组开始（E03）；对比前缺可用人数/评分状态提示（E01–E02） |
| U3 快速完成任务 | **未知** | 当前数据无法进入详情；不能测量完整路径或保存反馈 |
| U4 下一步明确 | **部分** | 无可比结果提示原因；未显示哪个候选人需要先完成评分，也无直接恢复动作（E02） |
| U5 提示和按钮清楚 | **部分** | `Compare candidates` 可点击，点击后才告知不可比（E02）；按钮旁未说明 2–4 人与评分门槛 |
| U6 符合真实工作方式 | **未知** | 无法验证同岗位分组、证据、快照及逐人提案闭环 |
| U7 信息符合角色目标 | **未知** | 账号身份映射不明，受限角色未测；顶栏与正文名称不一致（E01） |
| U8 减少跳转/重复 | **部分** | 空列表把用户导回 My Tasks；完成路径缺样本，无法评价重复操作 |
| U9 可恢复和可预期 | **未知** | 无保存/刷新/网络错误/并发操作可测；E06 源码模拟提示提示风险 |
| U10 可访问可读可操作 | **未知** | 仅观察普通桌面视图与 AX 控件文本；未完成键盘、200% 缩放、焦点、横向滚动测试，不宣称无障碍通过 |

### 发现与建议

| ID / 级别 | 角色、步骤、证据 | 影响与最小修复 | 修复后验收 |
|---|---|---|---|
| W12-UX-01 / **P2，线上观察** | Hiring Manager，Step 1；E01–E02：无可比的分组仍提供可点击 Compare，点击后只有 toast | 用户需要试错才知道无法对比。按已评分人数预先禁用并给出原因，或显示“还需 X 个已评分结果”及返回评分的入口 | 0/1/2 个已评分样本分别核按钮状态、提示和可恢复路径；合法 2–4 人可进入 |
| W12-UX-02 / **P2，线上观察** | HR/Hiring Manager，Step 1；E01：顶栏与页面正文显示不同名称 | 角色/权限上下文不清，难以判断自己看到的候选人范围；先核身份来源并统一账号展示 | 用 HR、HM、受限身份登录，核顶栏、正文、权限矩阵一致 |
| W12-RISK-03 / **P1，源码待线上复现** | Hiring Manager，Step 1–10；E05–E06：本地实现用 fixture 内存存储、1 人可创建，Refresh/Export/Comment 仅 toast，差异无证据下钻 | 若同版本已部署，可能无法满足 AC-3/4、证据可追溯和 2–4 人约束；本轮没有线上详情证据，**不记为线上缺陷** | 用隔离 seed 和线上构建 SHA 验证实际部署；检查 API/DB、导出文件、刷新版本及证据定位 |

根据标准：核心可比性、权限、持久化和外部副作用均无证据，不能判 `pass`；当前缺少前置数据，故整体为 `insufficient_context`。上述 P2 是可见 UX 问题；源码风险与环境阻塞不冒充线上复现的 P0/P1 产品缺陷。

```yaml
review:
  product: "Written Test / W12 Candidate Comparison"
  surface: "My Tasks Cluster by JD → Comparisons"
  role: "Hiring Manager（线上身份映射未核实）"
  journey_goal: "同岗位按可比结果和证据比较候选人，再逐人决定下一步"
  evidence:
    source: "线上 Chrome 页面、AX、截图 E01–E03；健康请求 E04；本地源码 E05–E06"
    steps_checked: [1, 2]
  verdict: "insufficient_context"
  findings:
    - id: "W12-UX-01"
      severity: "P2"
      category: "clarity"
      step: 1
      title: "无可比结果时仍需点击才能获知原因"
      evidence: "E01–E02"
      user_impact: "增加试错，缺少完成评分的恢复入口"
      recommendation: "提前显示已评分人数和不可用原因"
      acceptance_check: "用 0、1、2 个已评分样本复测按钮和恢复路径"
    - id: "W12-UX-02"
      severity: "P2"
      category: "clarity"
      step: 1
      title: "顶栏与正文身份名称不一致"
      evidence: "E01"
      user_impact: "角色与权限范围不清"
      recommendation: "统一登录身份显示并核对权限来源"
      acceptance_check: "分别用 HR、HM、受限账号核身份与可见范围"
  usability_check:
    understandable: "unknown"
    learnable: "unknown"
    efficient: "unknown"
    next_action_clear: "unknown"
    controls_clear: "fail"
    real_workflow_fit: "unknown"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "无 W12 隔离 seed、受限账号、详情、线上构建 SHA"
    - "无认证业务 API、数据库、邮件/通知模拟器，无法证明权限、持久化和不发送"
    - "未做键盘、200% 缩放、故障/并发注入"
```

## 执行记录与复测条件

| 检查 | 实际执行 / 结果 |
|---|---|
| 线上 UI | 打开 `/tasks` 与 `/comparisons`；切换 Cluster by JD，展开 2 人分组，点击 1 人与 2 人分组 Compare；记录 AX/截图 E01–E03。未触发对比创建或发送 |
| 健康端点 | `curl -sS --max-time 15 -D W12_Candidate_Comparison/evidence/2026-10-16/health-headers.txt -o W12_Candidate_Comparison/evidence/2026-10-16/health-body.txt -w 'HTTP %{http_code}' https://hireos.aipollo.me/hireos/written/api/health`；退出码 0，HTTP 200（E04） |
| 本地代码阅读 | 检查 E05–E06 对应文件；未改应用代码 |
| Build / Lint / Type Check / Unit / Integration | **未执行**；本轮为线上探索，不能将源码阅读或健康端点记为这些检查通过 |
| 正式 QA JSON | 未生成；缺主 Issue/PR、合并提交、QA context；不能编造身份字段 |

完整复测需提供隔离 workspace、`[UJ-TEST]`/example.com 的 `S_two_final_results`、`list_mixed_valid`、`list_with_unknown`、`list_with_revision`、1 人和 5 人边界、受限账号，以及线上构建 SHA、认证只读 API/DB 和 simulation-only 通知/邮件计数。先明确未评分候选人是否可作为 Unknown 列加入的规格冲突，再逐项执行 UC-W12-01–10 和 AC-1–6，保留每次请求、响应、快照版本、导出文件及外部计数前后证据。未经隔离和批准，不对真实候选人做发送或改分操作。

本轮只保存本地报告与证据；未创建外部 Issue/PR、发布 GitHub 评论或改变线上招聘数据。
