# W13 我的任务与首页统计线上测试报告（2026-10-16）

## 结论

**W13 不能判定通过。** 线上服务可达，已用现有登录态完成只读页面和导航测试。13 条用例中，**通过 0、失败 3、部分验证 3、阻塞 7**。本轮确认首页缺少第六张统计卡、指标卡未按相同口径下钻，以及任务详情返回后丢失过滤；其他核心要求因线上没有 `S0_employer`、独立角色、隔离任务和故障注入条件而未验证。PRD 和 User Cases 本身标注为草稿及 known gap，不能把预期基线数值直接当作当前真实数据的断言。

依据所给 UX/UI 标准，核心权限、持久化、并发和任务完成证据缺失，结构化审查结论为 `insufficient_context`。本报告是线上产品检查，**不是关联 PR 合并提交的正式 Codex QA**；未找到 W13 主 Issue 或 PR，线上构建 SHA 也未取得。

## 范围、环境和证据

| 项 | 实际情况 |
|---|---|
| 需求 | [W13 PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop IO](Loop_IO.md)、[公共约定](../README.md)；跨产品采用 [UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的旅程、U1–U10、P0–P3 和证据规则 |
| GitHub | 搜索 W13、Written Test My Tasks、笔试任务统计未找到 W13 主 Issue；本轮未创建 Issue、评论或 PR。无关联 Issue comments 可作为本任务的额外决策依据 |
| 时间与入口 | 2026-10-16 约 12:10–12:15（Asia/Shanghai），[线上 My Tasks](https://hireos.aipollo.me/hireos/written/tasks)，Chrome 现有登录态 |
| 健康 | [E00 健康记录](evidence/2026-10-16/health.txt)：HTTP 200，`service=hireos-written`，`phase=phase-0`；只证明服务可达 |
| 页面证据 | [E01–E10 脱敏浏览器观察记录](evidence/2026-10-16/live-observations.txt)，来自可访问树和视觉检查；不保存真实候选人姓名、邮箱、Case UUID 截图 |
| 账号与数据 | 页头账号名与页面 `Signed in as John · HR Head · Aurora Studio` 不一致；可见 4 个真实 Case（Pending test 2、Pending release 1、Testing closed 1），**不是** `S0_employer` |
| 版本 | 本地 HEAD `c4b610500d33a279c03251091c5f0af13b831318`；线上构建 SHA 未获得，本地源码仅作交叉参考 |
| 执行边界 | 线上仅只读导航、展开、过滤、分组、抽屉和健康请求；未改真实招聘数据、未发信、未模拟并发/500、未调用完成接口或访问 DB。未运行本地 build/lint/type/unit/integration；不声称这些检查通过 |

UX/UI 标准原适用范围是 JD Management；本报告只采用通用的应用性方法与门槛，职位字段、JD 审批和发布渠道的专属条款不机械套用 W13。可访问树和截图仅证明可见状态，不能单独证明授权范围、持久化和通知交付。

## 线上执行步骤与结果

| 证据 | 角色、步骤和动作 | 预期 | 实际 | 结论 |
|---|---|---|---|---|
| E00 | 访问健康接口 | 服务可达 | HTTP 200，`phase-0` | 环境可达 |
| E01–E03 | HR 打开 My Tasks，展开 More statistics | 身份一致；≤4 张 My Work；默认折叠；展开 6 项，状态与 as-of 清晰 | 4 张行动卡、默认折叠；展开只有 5 项，缺 Delivery issues；无 as-of。初次快照列表为 0，稍后加载出 4 条，未见 Loading 文案；账号名冲突 | **失败/部分符合** |
| E04 | 查看当前列表 | 按真实数据展示数量 | All 4、Pending test 2、Pending release 1、Testing closed 1 | 当前样本已记录；非基线 seed |
| E05 | 点击 My open tasks 和 Results to release | 进入同过滤条件列表，条数与卡片一致 | 前者留在 `/tasks` 无可见过滤变化；后者到通用 `/assessments`，没有指标过滤；当前两卡均为 0，无法核对非零条数 | **失败** |
| E06 | 依次抽查 2/1/1/0 状态过滤 | 列表只含所选状态、数量一致 | Pending test 2、Pending release 1、Testing closed 1 均与行数一致；Pending submission 0 显示 Nothing here | **抽查通过**；未测全部过滤 |
| E07 | Pending test 下切换 Cluster by JD、点 Compare | 按岗位分组，只能选已评分候选人 | 两个岗位组各 1 人；未评分组点击后提示 `No scored candidates to compare yet.`，未进入对比 | **部分验证**；缺已评分正向样本 |
| E08 | 点击 View resume | 打开公共简历记录抽屉 | 抽屉打开并可关闭；同一抽屉同时显示“无交接简历正文”和“简历正文已由 Screening 交接”的相反描述 | **部分验证**；数据来源未核 |
| E09 | 在 Pending test (2) 下进入任务详情并由面包屑返回 | 回到 My Tasks 且保留过滤 | 进入对应 Case plan；返回后变为 All tasks (4) | **失败** |
| E10 | 查看任务行和动作 | 类型、优先级、期限、负责人、Claim/Wait/Assign/History 等按权限显示 | 当前行仅能观察候选人、岗位、状态、日期和 View resume；未见所列动作 | **入口缺口**；多任务模型与角色未具备，不能验证动作业务效果 |

## 13 条用例与 AC 追溯

| 用例 | 结果 | 对应证据或解除条件 |
|---|---|---|
| UC-W13-01 首页结构 | **失败** | E02–E03：4 张 My Work、折叠符合；身份文案冲突，展开仅 5/6 指标，缺 as-of |
| UC-W13-02 各身份基线数字 | **阻塞** | E04 非 `S0_employer`，无 Emma、Daniel、Morgan 三账号和 `t1–t6`；需隔离 seed + 认证 API/DB |
| UC-W13-03 Workspace 基线数字 | **阻塞** | E03 五卡均 0，非 `S0_employer`，缺 Delivery issues；需 seed 和 §12 口径 API 计算 |
| UC-W13-04 指标下钻一致 | **失败** | E05：链接到通用页而非指标过滤页；非零条数一致性另待验证 |
| UC-W13-05 指标四种状态 | **阻塞** | E01/E03 未见 Loading/as-of；无受控 0/500/stale 注入，不能完整区分四态及局部失败 |
| UC-W13-06 切换范围不闪现 | **阻塞** | 无 `hr_restricted` 身份、逐帧录屏或授权 API；未切换真实账号 |
| UC-W13-07 状态过滤数量一致 | **部分验证** | E06 抽查四类计数符合；未按用例遍历所有过滤与 API 数据 |
| UC-W13-08 Cluster by JD 与对比 | **部分验证** | E07 分组及未评分拒绝已观察；无同岗位已评分候选人的正向选择验证 |
| UC-W13-09 深链接与返回 | **失败** | E08–E09：深链和简历抽屉可用，返回丢失 Pending test 过滤 |
| UC-W13-10 Claim 与并发冲突 | **阻塞** | E10 无 Claim 入口；缺队列任务、双 Reviewer 与隔离并发环境 |
| UC-W13-11 Wait 必填与期限 | **阻塞** | E10 无 Wait/Resume 入口；缺可变更隔离任务、History、API/DB |
| UC-W13-12 Assign 不授权限 | **阻塞** | E10 无 Assign 入口；缺受限账号、权限 API 与提醒记录 |
| UC-W13-13 只能业务完成 | **部分验证** | E10 当前列表无直接完成按钮；未调用服务端接口、发布真实结果或检查任务/提醒同步；旧版本动作未测 |

| PRD AC | 本轮结论 | 核心缺口 |
|---|---|---|
| AC-1 三角色 My open/Available to claim | **未验证** | S0 seed 与三身份均缺；当前零值不等于预期基线 |
| AC-2 Workspace 六项基线 | **未验证，UI 结构失败** | 无基线 seed 与后端口径；E03 缺第六卡 |
| AC-3 并发 Claim 冲突 | **未验证** | E10 无入口及双角色并发环境 |
| AC-4 Wait 原因与不完成 | **未验证** | E10 无入口、可变任务和持久化访问 |
| AC-5 业务动作完成及同步 | **未验证** | 只证实当前列表无手动完成按钮，未执行发布/完成/提醒检查 |
| AC-6 四态与切角色不闪现 | **未验证，UI 状态缺口** | E01/E03 未见 Loading/as-of；500、stale 和切换角色未注入 |
| AC-7 父子任务/重复事件去重 | **未验证** | 无重复事件/父子任务 seed、任务 ID/API/DB 快照 |
| AC-8 只比较已评分候选人 | **部分验证** | E07 未评分分支拒绝；缺已评分正向样本和比较结果核对 |

## 应用性与 UX/UI 审查（U1–U10）

**角色/目标**：HR 打开首页决定先处理什么任务、看工作区积压、下钻到相同口径列表并完成业务动作；Reviewer 要能认领和复核；Admin 要核对全局范围。线上只覆盖现有一个身份的只读前半段旅程。

| 标准 | 结果 | 证据与限制 |
|---|---|---|
| U1 容易理解 | **失败** | E02 身份不一致；E03 指标 0 无 as-of，用户难判断是空、未加载还是不可用 |
| U2 容易上手 | **部分符合** | E03 首页和过滤入口易见；E10 任务无类型、负责人、优先级或下一步动词 |
| U3 快速完成 | **失败** | E09 返回后重新筛选；动作路径未具备，不能评估完成时间 |
| U4 下一步明确 | **失败** | E10 任务行没有明确业务动作、负责人、等待原因或完成证据 |
| U5 提示和按钮清楚 | **部分符合** | E07 未评分对比给出原因；E05 统计卡称“Same filter as list view”但落到通用页 |
| U6 符合真实工作 | **未验证** | 无 Claim/Wait/Assign、业务发布及多角色交接的线上闭环 |
| U7 角色信息结构 | **未验证** | 仅一账号且身份标签冲突，无法核三角色优先级和 restricted 范围 |
| U8 减少跳转重复 | **失败** | E09 从详情返回丢过滤；E05 下钻未携带指标上下文 |
| U9 可恢复可预期 | **未验证** | 无故障、并发、权限撤销、过期任务注入；E01 初始零值缺可识别 Loading |
| U10 可访问可操作 | **未验证** | 可访问树识别主要按钮和抽屉关闭按钮；未执行全键盘、焦点管理、200% 缩放和读屏器测试 |

## 发现与最小修复方向

| ID / 等级 | 复现、影响及证据 | 建议与复测 |
|---|---|---|
| W13-UI-01 / **P1** | 打开 My Tasks → 展开 More statistics：仅五项，缺 `Delivery issues`；E03。HR 无法在首页识别交付异常。 | 补第六卡及唯一口径和下钻；在非零/零/失败数据下对照列表/API。 |
| W13-UI-02 / **P1** | 点击 `Results to release` 卡 → 到通用 Assessments 页面，无相同指标过滤；E05。其他卡链接也缺明确过滤；本地 `TasksPage.tsx` 的 `link` 仅是通用路径。 | 为每张卡定义过滤参数和详情列表，实现卡片数=列表数；用非零隔离 seed 逐卡核对。 |
| W13-UI-03 / **P2** | 选 Pending test (2) → 点任务行 → 面包屑 My Tasks：返回 All tasks (4)；E09。需要重复定位任务。 | 在 URL 或路由状态保留过滤、视图和滚动位置，返回及刷新后复测。 |
| W13-UI-04 / **P1，身份映射待核** | 页头显示一个中文账号名，页面写 `Signed in as John · HR Head`；E02。用户无法信任“我的”任务口径。 | 统一从已认证身份显示姓名/角色/workspace；核登录会话、任务查询主体及角色切换。确认根因前不推断越权。 |
| W13-UI-05 / **P1** | 首次列表空白/0 后变为 4 条；所有卡只有 `0`，未显示 Loading、Unavailable、Stale 或 as-of；E01/E03。用户无法判断统计是否新鲜。 | 引入独立加载、错误、过期和零状态及时间；使用延迟、500、陈旧快照逐项复测，检查局部失败。 |
| W13-CONTENT-06 / **P3，需核数据源** | 简历抽屉同时提示“无交接正文”和“已交接正文”；E08。用户无法判断简历是否可用。 | 核公共记录字段后按真实来源显示单一明确文案；不把该观察当作数据丢失证明。 |

本地源码提示 `Task` 与 `Case` 1:1、只有 GET `/tasks`、统计由前端 fixture 计算；它解释了部分可见缺口，但**线上版本未核实**，不以源码推断线上权限、DB 或接口行为。W13 PRD §10 的列表结构、审批类任务、任务模型和第 4 张卡仍待产品决策；本轮不擅自选定方案。

## 结构化审查摘要

```yaml
review:
  product: "Written Test"
  surface: "W13 My Tasks 与统计首页"
  role: "HR（现有登录态；真实身份映射未核）"
  journey_goal: "找到本人任务、核对积压并下钻到业务处理"
  evidence:
    source: "线上 Chrome 可访问树/视觉观察 E01–E10；健康请求 E00；本地源码交叉参考"
    steps_checked: ["打开首页", "展开统计", "点击指标", "过滤", "按岗位分组", "简历预览", "任务深链与返回"]
  verdict: "insufficient_context"
  findings:
    - id: "W13-UI-01"
      severity: "P1"
      category: "state"
      step: 2
      title: "缺 Delivery issues 指标"
      evidence: "E03"
      user_impact: "无法从首页发现交付异常"
      recommendation: "补完整指标与口径"
      acceptance_check: "六卡逐项下钻并与非零隔离数据一致"
    - id: "W13-UI-02"
      severity: "P1"
      category: "efficiency"
      step: 3
      title: "指标卡未下钻到相同过滤列表"
      evidence: "E05"
      user_impact: "无法解释统计数字或定位记录"
      recommendation: "携带指标过滤条件进入列表"
      acceptance_check: "每卡数字与目标列表条数一致"
    - id: "W13-UI-03"
      severity: "P2"
      category: "efficiency"
      step: 6
      title: "任务详情返回丢失过滤"
      evidence: "E09"
      user_impact: "用户需重复筛选"
      recommendation: "保存过滤及视图到路由状态"
      acceptance_check: "筛选后进详情再返回仍为原过滤"
    - id: "W13-UI-04"
      severity: "P1"
      category: "clarity"
      step: 1
      title: "账号名与任务页登录人不一致"
      evidence: "E02；身份映射待核"
      user_impact: "无法信任我的任务口径"
      recommendation: "以认证身份统一显示姓名、角色和工作区"
      acceptance_check: "核对页头、任务页、认证 API 与受限范围"
    - id: "W13-UI-05"
      severity: "P1"
      category: "state"
      step: 1
      title: "统计缺加载与新鲜度状态"
      evidence: "E01/E03；故障和陈旧状态未注入"
      user_impact: "难以区分零值、未加载和旧数据"
      recommendation: "分开显示 Loading、0、Unavailable、Stale 和 as-of"
      acceptance_check: "受控延迟、500、陈旧快照和局部失败验证"
    - id: "W13-CONTENT-06"
      severity: "P3"
      category: "clarity"
      step: 7
      title: "简历抽屉出现相反的交接描述"
      evidence: "E08；数据源未核"
      user_impact: "无法判断简历正文是否可用"
      recommendation: "按公共记录真实字段显示单一状态"
      acceptance_check: "有/无交接正文各一例，核 UI 与来源记录"
  usability_check:
    understandable: "fail"
    learnable: "unknown"
    efficient: "fail"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "unknown"
    role_information_fit: "unknown"
    no_unnecessary_hops: "fail"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "无 S0_employer 与多身份"
    - "无认证 API/DB、模拟通知、并发与故障注入"
    - "线上构建 SHA 未取得，未测键盘/200% 缩放"
```

## 完整复测所需条件

1. 在 GitHub 明确 W13 主 Issue 和四项待确认产品决策，并提供线上构建 SHA。若要作为正式 QA，需关联 PR、实际合并 SHA 和全部评论。
2. 准备隔离 Workspace、`S0_employer` 六任务及 Emma/Daniel/Morgan/受限账号；测试候选人使用 `[UJ-TEST]` 与 `example.com`，外发仅走 simulation adapter，并有清理方案。
3. 提供认证只读 API/DB、MetricSnapshot/TaskHistory/通知记录和受控延迟、500、stale、重复事件及并发注入。先记录基线，再按 UC-W13-01–13、AC-1–8 执行 UI/API/DB/外部记录断言。
4. 补 UI 证据：逐卡非零下钻、角色切换录屏、返回保留过滤、键盘与焦点、200% 缩放；保存脱敏截图和请求日志。缺陷修复后重跑，不把本轮阻塞项自动改为通过。

本轮仅新增本地报告与证据文件；未修改产品代码或线上业务数据，未创建外部 Issue/PR 或发布评论。
