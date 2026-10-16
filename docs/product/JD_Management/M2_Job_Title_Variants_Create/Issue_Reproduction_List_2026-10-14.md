# M2 线上问题清单与完整复现步骤（2026-10-14）

来源：[M2 线上测试报告](Test_Report_2026-10-14.md)。以下是测试发现和待核查项，**尚未创建 GitHub Issue**。测试环境为 `https://hireos.aipollo.me/hireos/jd/jobs`，页面显示登录名“蔡敏”；线上构建号和服务端身份未取得。每次开始复现前，等待职位列表加载完成，确认不是加载中的临时 0 计数。测试后的两条 Draft 保留供复核，见文末。

## 已复现的问题

### 1. M2-LIVE-01 · P0 · 三版本的事实字段不一致

**依据**：M2 PRD BR-1、AC-1；User Journey 步骤 4；UC-M2-03。

**前置条件**：可进入 JD Management 的已登录账号。

**复现步骤**：

1. 打开职位列表，点击 **New job** → **Start with a Job Title**。
2. 在底部输入框发送 `Finance Manager`，等待生成结束。
3. 依次点击 A、B、C 卡片或 Workspace 页签，对照标题下的地点与工作方式。
4. 点击 **New conversation**，重复步骤 1–3，再生成一次相同输入。
5. 在其中一轮选 B，发送 `make it remote`；等待完成后再次逐个查看 A、B、C。

**预期**：同一次生成的三版只改变表达风格，职位名、地点、HC、工作方式及薪资事实逐字段一致；Refine 后仍一致。

**实际**：第一次 A/B/C 的地点分别为“中国大陆（具体城市可编辑）”“中国大陆（具体城市可根据公司安排）”“中国大陆”；Refine 后 A 为“远程”，B/C 为“远程（中国大陆）”。第二次同样输入时，A 为“上海”，B 为“中国大陆（支持远程/混合办公）”，C 为“中国大陆，工作地点以公司实际办公城市为准”。第二轮还出现工作方式差异。

**影响与验收**：招聘人员无法从三版中可靠选出事实正确的版本。修复后用相同输入至少重复两轮，逐字段比较三版及 Refine 结果，并确认事实来源明确。

### 2. M2-LIVE-06 · P1 · 仅输入职位名时填入未提供的岗位事实

**依据**：M2 PRD BR-4、BR-5（继承 M1 BR-3）；User Journey 创建类公共规则 7。哪些字段允许 AI 默认填值仍在 PRD 待确认项中。

**前置条件**：新的 M2 会话，不输入其他岗位背景。

**复现步骤**：

1. 打开职位列表 → **New job** → **Start with a Job Title**。
2. 只发送 `Finance Manager`，不提供地点、工作方式、部门、资历年限、薪资或公司情况。
3. 查看 A/B/C 的字段和 Requirements，必要时点击 **Captured inputs** 确认输入只有职位名。
4. 另起新会话重复一次，观察地点是否随生成改变。

**预期**：不得把没有来源的公司事实当成已知条件。公共规则指定未提供地点时使用 `Ho Chi Minh City, VN`；若产品允许其他 AI 默认值，应明确规则并在界面标注来源。

**实际**：生成内容写入“财务部”、第一轮“中国大陆”、第二轮“上海”，并把“支持远程/混合办公”写入其中一版；这些地点、部门和工作方式在输入中没有来源，界面也未标出默认属性。要求另含“5 年及以上”等 AI 拟定条件；此类建议是否允许直接作为岗位要求仍需产品确认。此项与第 1 项不同：即便三版彼此一致，仍可能共同写入未经确认的公司事实。

**影响与验收**：未经确认的地点、工作模式或资历可能进入最终 JD。修复后对仅含职位名的输入核对每个事实字段的来源、默认规则和展示标签；不允许字段在同一输入的多次生成中任意变化。默认值的具体范围需产品确认。

### 3. M2-LIVE-02 · P1，需 API 复核 · 创建者归属显示不一致

**依据**：M2 PRD BR-5 → M1 BR-2；User Journey 创建类公共规则 4；UC-M2-05。

**前置条件**：在同一个显示“蔡敏”的已登录页面会话中测试；复现前记录 All Jobs、My Jobs 计数。

**复现步骤**：

1. 按第 1 项的步骤生成 `Finance Manager`，选择 B，发送 `make it remote`。
2. 点击 **Create job with version B**；确认跳转到 Draft 编辑页。
3. 返回 Job Library，刷新并查看 `Finance Manager` 行的 **OWNER** 和 **My Jobs** 计数。
4. 在同一页面会话打开 **New job** → **Start with a Job Title**，发送 `[UJ-TEST] Finance Manager 20261014`。
5. 点击 **Create job with version A**，返回列表，刷新并查看第二条的 OWNER 和 My Jobs。

**预期**：两条职位的服务端 owner 都应是当前认证用户，并能在其 My Jobs 中找到；展示身份应一致。

**实际**：第一条列表 Owner 为 UUID `ee348e0e-d8db-4e82-bb6b-b9928954348f`，创建后 My Jobs 仍是 0；第二条 Owner 显示 `Linh Tran`，My Jobs 变为 1。页面右上角始终显示“蔡敏”。

**限制与验收**：目前只能证明 UI 归属/身份显示不一致，不能仅凭可见名字断定数据库写错用户。需要使用已登录只读 API/DB 比对认证主体、`createdBy`、owner 与列表映射，并确认两条职位在正确账号的 My Jobs 中。

### 4. M2-LIVE-03 · P1，需 API/DB 复核 · 创建后未见 internal 文档

**依据**：M2 PRD BR-5 → M1 BR-2；User Journey 创建类公共规则 4；UC-M2-05。

**前置条件**：已生成任一 M2 版本。

**复现步骤**：

1. 选择 B，点击 **Create job with version B**。
2. 在自动打开的 JD 编辑页查看 Document 的 **Public / Internal / Confidential** 计数。
3. 刷新编辑页，待加载与 Saved 状态稳定后再次查看计数和内容区。
4. 对带 `[UJ-TEST]` 标记的 A 版创建流程重复步骤 2–3。

**预期**：创建 Core Job Draft，并生成规格要求的 internal 文档；刷新后仍可核实其存在与内容。

**实际**：第一条稳定状态为 Public 21、Internal 0；第二条创建后为 Public 19、Internal 0。两条的主要 JD 内容显示在 Public 区。

**限制与验收**：`Internal 0` 证明 UI 未展示 internal 块，不能排除后台另有独立文档对象。用 API/DB 检查文档对象、内容和可见性；若对象存在但 UI 计数遗漏，修正展示并验证权限。

### 5. M2-LIVE-04 · P2 · 空职位名点击发送无反馈

**依据**：M2 PRD FR-7、AC-4；UC-M2-06。

**前置条件**：新开的 M2 会话，输入框为空。

**复现步骤**：

1. 打开职位列表 → **New job** → **Start with a Job Title**。
2. 保持底部输入框为空，不输入空格或其他字符。
3. 检查 **Send** 是否禁用，然后点击一次。
4. 查看输入框附近、对话区和错误提示区是否出现必填反馈。

**预期**：发送按钮不可用且原因清楚，或点击后提示输入职位名；不触发生成、不新增 AiRun。

**实际**：Send 在可访问状态中仍为 enabled，点击后没有生成，也没有可见提示。AiRun 未取得读取权限，因此“无新增 AiRun”尚未验证。

**影响与验收**：用户无法区分必填校验与页面无响应。修复后同时检查 UI 反馈和服务端无生成请求/AiRun。

### 6. JD-COMMON-01 · P1，共性问题 · 字段行缺 Workplace type，Level 状态不稳定

**依据**：M2 User Journey 创建类公共规则 7；M2 PRD BR-5 → M1 BR-3。M1 线上测试报告已记录类似现象。

**前置条件**：已生成 M2 版本，准备创建职位。

**复现步骤**：

1. 点击 **Create job with version B** 或 **Create job with version A**。
2. 在进入编辑页后的职位标题字段行检查可见字段。
3. 等待 Saved，再刷新页面并重新检查同一字段行。

**预期**：字段行始终有 Location、Headcount、Workplace type；未输入的 Level 不显示。

**实际**：页面显示 Location、Headcount、Level，未见 Workplace type。新建瞬间 Level 显示 `Mid`，刷新稳定后字段仍占位但变为空。

**影响与验收**：工作模式不易审阅，空字段和瞬态值可能误导用户。修复后检查创建后与刷新后的字段行完全一致，Workplace type 可见，未提供的 Level 不出现。此项建议与 M1 的同类问题合并处理。

## 规格冲突与 UX 待核查项

### 7. M2-LIVE-05 · 产品决策待定 · 罕见职位名未确认含义

**依据**：M2 User Journey“异常与恢复”要求先确认含义；M2 PRD §10 与 UC-M2-08 则将行为预期列为待确认。

**复现步骤**：

1. 打开职位列表 → **New job** → **Start with a Job Title**。
2. 只发送 `Chief Tidy Officer`，不补充岗位解释。
3. 等待 Agent 反馈，观察它是否先询问含义，或直接输出 A/B/C。
4. 打开 A 版，查看岗位职责、部门和地点。

**Journey 预期**：先确认这个罕见职位名的含义，再生成三版。**实际**：直接生成三版，把岗位解释为行政/办公室管理，加入“行政与运营部”及“中国大陆”地点。由于 PRD 与 Journey 尚未统一，本项记录为**规格冲突**，不擅自定性为已确认产品缺陷。明确规则后才能给出通过/失败判定。

### 8. UX-M2-01 · P2 待核查 · 创建后的下一步信息不完整

**依据**：UX/UI 审查标准 U4；M2 交接至 JD 编辑/完整性检查。

**复现步骤**：

1. 按主流程创建 `Finance Manager` 并进入 Draft 编辑页。
2. 查看顶部状态、**Publish**、**Analyze** 和页面上是否有明确的 Next action、负责人、截止时间及等待原因。

**实际**：页面显示 Draft/Not published；Publish 禁用，帮助文案提示还有项目需修订，Analyze 可用；未见明确的下一步负责人或截止时间。M2 规格未定义截止时间或任务分配，因此此项属于 UX 审查观察，需结合真实角色工作台和任务上下文再定严重度。

## 尚未执行的验证

以下是**测试覆盖缺口，不是已复现产品缺陷**：

- UC-M2-07：缺少可控 `llm_fail` 或 `network_down`，错误卡、输入保留、Retry/Start over、失败后无职位均未验证。
- 空输入与双击路径：未读取 AiRun、请求日志或 DB 幂等记录；UI 上的“未生成”和“只出现一个职位”不等同于服务端证明。
- 创建者、internal 文档、权限边界及无对外副作用：未取得已登录 API/DB 只读证据，也没有多角色测试账号。
- UX U10：未执行完整键盘路径、200% 缩放、屏幕阅读器或错误字段关联检查。

## 本次测试数据

| 用途 | 职位 | ID | 处置 |
|---|---|---|---|
| B 版创建与持久化 | [Finance Manager](https://hireos.aipollo.me/hireos/jd/jobs/812d37af-bc2e-4e21-a3c7-2853cd01b6cc/document) | `812d37af-bc2e-4e21-a3c7-2853cd01b6cc` | Draft，保留供复核 |
| 双击创建 | [[UJ-TEST] Finance Manager 20261014](https://hireos.aipollo.me/hireos/jd/jobs/872db0e1-f2ee-4861-a022-b1e2a6565dc5/document) | `872db0e1-f2ee-4861-a022-b1e2a6565dc5` | Draft，保留供复核 |

本清单不含凭据、候选人资料或真实薪资。未删除测试职位，未创建或关闭 Issue。
