# M1 Quick Start 线上测试报告（2026-10-14）

## 结论

**不通过，不建议按当前 M1 验收标准放行。** 15 条用例中，通过 3 条，失败 8 条，部分通过 1 条，未验证 3 条。核心阻断是缺失答案时仍直接生成职位草稿，以及不能推断职位名时擅自命名；单字输入还产生了未经提供的年限要求。测试中创建的唯一职位已持久化，按用户决定保留供排查（见“测试数据清理”）。

本报告记录 **2026-10-14 16:30–16:38 CST** 在已发布环境中的实际操作结果。产品预期依据本目录 [PRD](PRD.md)、[User_Journey](User_Journey.md)、[Loop_IO](Loop_IO.md)、[User_Cases](User_Cases.md) 及上级目录测试脚本 J1。以上文档标为草稿，待确认项不作为已确认阈值。

## 环境与方法

| 项 | 实测信息 |
|---|---|
| 地址 | `https://hireos.aipollo.me/hireos/jd/jobs` |
| 浏览器 | Chrome 155.0.8059.40，macOS |
| 语言 | English 和中文 |
| 登录身份 | 已登录用户；页面右上角显示“蔡敏”（报告不记录邮箱或令牌） |
| 线上构建号 | 页面未显示，无法确认；本地仓库 HEAD `c0e47a6` **不能视为线上构建号** |
| 初始数据 | 页面加载完成后“全部职位 15 / 草稿 8”；首次页面加载中曾短暂显示 0，不作为基线 |
| 测试数据 | 仅使用文档提供的虚构问答及 `[UJ-TEST]` 职位；未输入候选人数据或真实薪资 |
| 检查方式 | Chrome 页面可访问树与可见页面、刷新后列表计数；未取得线上数据库或已登录 API 调试会话 |

未登录请求 `GET /hireos/jd/api/jobs` 和 `GET /hireos/jd/api/copilot/conversations` 均返回 HTTP 401；这只验证匿名访问被拒绝，不能替代用例要求的已登录 API/DB 检查。

## 用例结果

| 用例 | 结果 | 实际观察与判定 |
|---|---|---|
| UC-M1-01 入口说明与三问 | **通过** | “i” 展示说明且未进入入口；点击 Quick Start 后，标题作为用户消息出现一次，Agent 在一条消息中列出三问，输入框获得焦点。 |
| UC-M1-02 完整回答生成草稿 | **失败** | 英文完整三行输入生成 1 份草稿，Workspace 并列出现，创建前职位数仍为 15；草稿字段未逐项标注“用户回答 / AI 推断”。折叠的 Captured inputs 只列原始回答。 |
| UC-M1-03 草稿质量 | **失败** | 英文草稿有 5 条职责，要求包含 SQL、增长分析和实验设计的语义；概述仅 2 句且未出现当时的职位名“越南增长负责人（Vietnam Growth Manager）”。中文草稿对未提供的经验年限写入“3 年及以上”。同一英文输入未完成两次严格重复质量测量。 |
| UC-M1-04 部分回答追问 | **失败** | 只提交前两行 `We have nobody owning growth in Vietnam` / `Build a repeatable local growth process`，约 20–30 秒后直接生成“越南市场增长负责人”草稿，未追问硬技能。职位数保持 15。 |
| UC-M1-05 无法推断职位名 | **失败** | 提交 `Things are messy` / `Tidy them up` / `Patience, curiosity, kindness` 后，未追问 Job title，直接生成“运营/业务流程优化专员”草稿，并推断地点“中国大陆”。未继续发送 `Chief Tidy Officer`，因为首个必需追问已缺失。 |
| UC-M1-06 对话修改 | **通过** | 发送 `add TikTok growth experience and make it remote` 后，用户消息显示一次；Workspace 提示 2 处高亮，工作地点改为“远程”，要求新增 TikTok 增长经验。 |
| UC-M1-07 创建并持久化 | **失败** | 点击 Create 后显示 “The JD is created”，但仍停留在列表和对话，需另点 “View the created JD” 才进入编辑页。刷新后该职位仍为 Draft，有 Public 和 Internal 文档块；编辑字段显示 Location、Headcount、空的 Level，缺少 Workplace type。创建后瞬间“我的职位 1”，刷新列表变为“我的职位 0”，与当前用户归属不一致；Owner 的服务端身份及 AiRun/审批记录未用 API/DB 核实。 |
| UC-M1-08 中文回答创建 | **失败** | 中文三行回答生成 1 份草稿，但要求自行加入未提供的“3 年及以上”经验，违反 BR-4；未将这份不合格草稿创建为第二个线上职位。 |
| UC-M1-09 AI 失败恢复 | **未验证** | 本次 AI 请求均完成；没有可控 `llm_fail` 注入。Retry、Start over 和故障后的 New conversation 未能按失败路径验证。普通 New conversation 能清空消息和草稿并返回五个入口。 |
| UC-M1-10 生成中刷新 | **部分通过** | 发送中文三行回答后立即刷新：职位总数仍为 16，未产生半成品；页面回到职位列表，原会话与输入没有自动恢复到可继续编辑状态。 |
| UC-M1-11 双击 Create | **通过** | 对 `[UJ-TEST] Growth Operations Manager 20261014` 快速双击 Create：列表从 15 增至 16，仅出现 1 条同名草稿；刷新后仍为 16。 |
| UC-M1-12 单字输入 | **失败** | Quick Start 只发送 `a`，系统未继续追问，直接生成“业务运营专员”草稿；要求中出现未提供的“1 年以上”经验。未点击 Create。 |
| UC-M1-13 语音输入 | **未验证** | 当前自动化会话没有可供麦克风采集的真实语音，也未授权浏览器麦克风权限；未把按钮可见误记为转写通过。 |
| UC-M1-14 首页直接描述 | **失败** | 在未选入口的 Create a Job 首页发送 `We need an HR Lead for a new business unit` 后，系统只追问“最核心的使命是什么”，没有进入 Quick Start 并同时提出三问。 |
| UC-M1-15 响应时间基线 | **未验证** | 未在发送瞬间与完整结果时使用统一计时点记录 3 次完整输入的精确耗时；≤2 秒 / ≤20 秒只是待确认建议，不能判定通过。 |

统计口径：**通过 3 / 失败 8 / 部分通过 1 / 未验证 3 = 15**。生成失败的子步骤不记作其他下游步骤通过。

## 验收标准覆盖

| AC | 结论 | 依据 |
|---|---|---|
| AC-1 只追问未答问题 | **失败** | UC-M1-04、UC-M1-12 均未追问。 |
| AC-2 追问 Job title | **失败** | UC-M1-05 未追问并擅自命名。 |
| AC-3 一份合格草稿 | **失败** | 数量为 1，但概述不含职位名、中文生成编造年限，字段来源不可逐项识别。 |
| AC-4 修改高亮且消息不重复 | **通过** | UC-M1-06。 |
| AC-5 Create 前无职位，Create 后符合规则并持久化 | **失败** | 创建前无新职位、双击仅 1 条和刷新持久化通过；自动跳转、字段行及当前用户归属不符合或未核实。 |
| AC-6 AI 失败恢复 | **未验证** | 无可控故障注入，不能据正常生成推断恢复能力。 |

## 缺陷与风险

| ID | 建议优先级 | 复现与影响 |
|---|---|---|
| M1-LIVE-01 | P0 | 部分回答及单字输入均直接生成草稿，绕过三问完整性。复现：Quick Start → 只发前两行，或只发 `a`。对应 AC-1、FR-2。 |
| M1-LIVE-02 | P0 | 无法识别职位名时不追问，擅自生成“运营/业务流程优化专员”。对应 AC-2、FR-3。 |
| M1-LIVE-03 | P0 | AI 输出可写入输入不存在的硬性经验年限：中文三问产生“3 年及以上”，单字 `a` 产生“1 年以上”。对应 BR-4。 |
| M1-LIVE-04 | P1 | 草稿无逐字段来源标记；英文概述未包含职位名。对应 FR-5、BR-5、AC-3。 |
| M1-LIVE-05 | P1 | Create 后不自动跳编辑页；编辑页缺 Workplace type，未填写 Level 仍显示空字段。对应 FR-7、BR-3、AC-5。 |
| M1-LIVE-06 | P1，需 API 复核 | 页面显示当前用户“蔡敏”，新职位在“我的职位 0”，列表显示另一创建者标识；需以已登录 API 核查 `createdBy` 与身份映射。对应 BR-2。 |
| M1-LIVE-07 | P2 | 首页直接输入岗位描述未转入 Quick Start 三问。对应 UC-M1-14。 |

### 完整复现步骤

以下步骤整理自本次线上实际操作。共同前置条件：以有职位创建权限的账号登录 `https://hireos.aipollo.me/hireos/jd/jobs`，打开 **Create a Job / Ask Copilot**；每组输入从新的会话开始，以免前一份草稿影响结果。AI 文案可能变化，复测应按字段与行为判定，不要求生成文字逐字相同。本次没有保存各草稿全文，以下“实际结果”仅陈述已记录的观察。

#### M1-LIVE-01：缺失回答仍生成草稿

1. 在新会话中选择 **Quick Start**，等 Agent 一次列出三问。
2. 只发送前两行：`We have nobody owning growth in Vietnam` 换行 `Build a repeatable local growth process`；不要提供第三问的硬技能。
3. 等待生成结束，检查对话是否只追问第三问、Workspace 是否出现草稿。另开新会话重复步骤 1，只发送 `a`，再次检查。

**预期：**前两行输入后只追问硬技能；单字输入后继续收集有效回答；两种情况都不应生成完整草稿。**实际：**前两行输入约 20–30 秒后直接生成“越南市场增长负责人”草稿；单字 `a` 直接生成“业务运营专员”草稿，均未先追问。两次均未点击 Create；对应 UC-M1-04、UC-M1-12。

#### M1-LIVE-02：职位名无法推断时未追问

1. 新会话选择 **Quick Start**，发送三行：`Things are messy` 换行 `Tidy them up` 换行 `Patience, curiosity, kindness`。
2. 等待回复，检查系统是否在生成草稿前追问 Job title。

**预期：**无法从这三行确定职位名时先追问，用户可再回答 `Chief Tidy Officer`。**实际：**系统没有追问，直接生成“运营/业务流程优化专员”草稿，并推断地点为“中国大陆”。当时未继续发送 `Chief Tidy Officer`；对应 UC-M1-05。

#### M1-LIVE-03：生成了用户未提供的经验年限

1. 新会话选择 **Quick Start**，发送中文三行：`团队缺少人负责日常运营` 换行 `希望他组建运营团队，负责产品日常运营` 换行 `数据分析, SQL, 流程管理`。
2. 草稿出现后检查“要求”中的经验年限。另开新会话，只发送 `a`，检查生成草稿的“要求”。

**预期：**输入没有年限时，不得写入具体经验年限。**实际：**中文草稿出现“3 年及以上”，单字输入的草稿出现“1 年以上”。这两份草稿均未点击 Create；对应 UC-M1-08、UC-M1-12 和 BR-4。

#### M1-LIVE-04：字段来源不可逐项识别，概述缺职位名

1. 新会话选择 **Quick Start**，一次发送英文三行：`We have nobody owning growth in Vietnam` 换行 `Build a repeatable local growth process` 换行 `SQL, growth analytics, experiment design`。
2. 等待右侧 Workspace 展开，检查草稿标题、概述、各字段的来源标记，并展开 **Captured inputs**。

**预期：**每个草稿字段可识别为“用户回答”或“AI 推断”；概述包含本次草稿的职位名。**实际：**生成 1 份草稿，当时标题为“越南增长负责人（Vietnam Growth Manager）”；概述有 2 句但未出现该职位名；各字段没有逐项来源标记，Captured inputs 只集中列出原始回答。报告未保存概述逐字文本；对应 UC-M1-02、UC-M1-03。

#### M1-LIVE-05：创建后未自动跳转，编辑字段不符

1. 在已生成的测试草稿上点击 **Create job from this draft**。本次创建的职位为 `[UJ-TEST] Growth Operations Manager 20261014`，职位 ID 为 `1cde000d-d94e-431b-a7b2-41ba6fab63d4`。
2. 观察创建成功后的页面；如仍在当前页，点击 **View the created JD** 进入编辑页。
3. 刷新编辑页，检查职位状态、Public / Internal 文档块，以及顶部字段行的 Location、Headcount、Workplace type、Level。

**预期：**Create 成功后直接进入编辑页；字段行包含 Location、Headcount、Workplace type，未提供 Level 时不显示 Level。**实际：**先出现 “The JD is created”，但仍停留在列表和对话；需再点击 View the created JD。刷新后职位仍为 Draft，Public / Internal 文档块存在；字段行有 Location、Headcount 和空的 Level，缺 Workplace type。该测试职位按用户决定保留；对应 UC-M1-07。

#### M1-LIVE-06：当前用户与“我的职位”归属显示不一致（待 API 复核）

1. 使用页面右上角显示“蔡敏”的已登录账号，按 M1-LIVE-05 的步骤创建 `[UJ-TEST] Growth Operations Manager 20261014`。
2. 创建后观察“我的职位”计数；刷新职位列表，再查找同名职位并检查“我的职位”计数与列表中的创建者标识。

**预期：**如果职位 Owner 为当前用户，刷新后仍应计入“我的职位”，且列表创建者标识与账号身份一致。**实际：**创建后瞬间显示“我的职位 1”，刷新后变为“我的职位 0”，列表显示另一创建者标识。**核查边界：**尚未通过已登录 API/DB 读取 `createdBy` 并核对身份映射，因此目前只能确认 UI 显示不一致，不能断言服务端 Owner 错误；对应 UC-M1-07、BR-2。

#### M1-LIVE-07：首页直接描述未进入 Quick Start 三问

1. 打开 **Create a Job** 首页，保持在尚未选择任何入口的状态。
2. 直接在输入框发送 `We need an HR Lead for a new business unit`。
3. 检查系统是否切入 Quick Start，并在同一条消息中提出三问。

**预期：**首页直接描述招聘意图后进入 Quick Start 的三问收集。**实际：**系统只追问“最核心的使命是什么”，没有同时提出三问；对应 UC-M1-14。

以上为本次测试报告中的缺陷记录，**未创建 GitHub Issue**。当前仓库规则要求创建 Issue 前先给用户看草稿并取得确认。

## 测试数据清理与未验证项

本次仅创建 1 个职位：`[UJ-TEST] Growth Operations Manager 20261014`，职位 ID `1cde000d-d94e-431b-a7b2-41ba6fab63d4`，可在 [编辑页](https://hireos.aipollo.me/hireos/jd/jobs/1cde000d-d94e-431b-a7b2-41ba6fab63d4/document) 查看。**保留供排查**：2026-10-14 用户明确选择保留该职位，因此未删除。其他测试只生成未确认的 Copilot 草稿，列表始终只因上述职位增加 1 条。

编辑页核验截图保存在仓库忽略目录 `.local/m1-test-evidence/created-job.png`，未纳入公开仓库。截图显示草稿状态、Public / Internal 文档块，以及字段行的 Location、Headcount、空 Level；无需包含真实职位信息。

要完整关闭尚未验证项，需要：可控的 AI 故障注入条件、可用的麦克风和真实语音输入、已登录 API/DB 只读核查权限，以及计时工具或浏览器性能记录。若需要缺陷跟踪，先按仓库 Issue 模板起草并由用户确认后再创建。
