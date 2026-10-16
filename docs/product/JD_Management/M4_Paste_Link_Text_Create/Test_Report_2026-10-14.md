# M4「粘贴链接或文案创建职位」线上测试报告

测试日期：2026-10-14（Asia/Shanghai；同日补测用户提供的阿里巴巴职位链接）；2026-10-15 按产品决定重判 M4-LIVE-06  
功能结论：**不通过**。11 条用例中，通过 4 条、部分满足 4 条、失败 2 条、未验证 1 条。主要问题是用户提供的公开职位页无法被线上 M4 读取、粘贴文案未保留工作方式、导入草稿自动改写/增写内容，以及其他公开链接生成的草稿缺少独立来源标签。安全用例只能证明 UI 反馈，无法证明服务端没有发出内网或非 HTTP 请求。

## 1. 依据、环境与方法

| 项 | 内容 |
|---|---|
| 产品依据 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[User Cases](User_Cases.md)；原测试依据为 v1.0 草稿，M4-LIVE-06 于 2026-10-15 按 v1.1 产品决定重判 |
| UX 依据 | [JD Management UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) |
| 环境 | 已发布页面 `https://hireos.aipollo.me/hireos/jd/jobs`；Codex in-app browser，英文界面，约 1280 × 720 桌面视口 |
| 身份 | 页面右上角显示“蔡敏”；创建页显示 Owner 头像名 Linh Tran，列表 My Jobs +1。未获得认证主体及角色的服务端证据 |
| 线上构建 | 页面未显示构建号；本地仓库版本不能作为线上版本证据 |
| 方法 | UI 实际点击、粘贴、发送、创建、返回列表及刷新后观察；公开网页内容另与原网页核对。未使用已登录 API/DB、服务端日志或可控故障注入 |
| 基线 | 加载完成后 All Jobs 18、My Jobs 0、Published 7、Drafts 11 |
| 测试数据 | `not a link`、`http://127.0.0.1:1/uj-test`、`file:///tmp/uj-test-m4.txt`、`ftp://example.com/jd`、`https://httpbin.org/status/404`、`https://github.com/login`、`https://example.com/`、[Findigs 公开招聘页](https://jobs.lever.co/findigs/2e0f9c8f-ab2f-4b92-bdb9-bc594308b88d)，以及 v0.1 §3.2 的 Customer Success Manager 文案 |

PRD 要求用本地 mock 服务测外链；线上服务不能访问测试机的 localhost。本次以真实公开页面替代验证可观察的主流程，无法控制 HTTP 日志、重定向、2MB 页面或读取记录。因此“页面被真实读取”由源页面特有事实与草稿对应来支持，不能等同于服务端请求次数和读取记录验证。未对外发布、外发或使用候选人数据。

## 2. 旅程与用例结果

| 用例 / 步骤 | 实际操作与可观察结果 | 结论 |
|---|---|---|
| UC-M4-01 / 入口 | `New job → Paste a Link or Text`。入口标题作为用户消息出现一次；Agent 仅给引导文案；输入框提示 `Paste a link or the JD text…` 并获得焦点。 | **通过** |
| UC-M4-02 / 无效输入 | 发送 `not a link`；回复 `That doesn’t look like a link or a JD. Paste a job posting URL (starting with http:// or https://) or the full JD text.`；仍可在当前步骤输入。 | **通过** |
| UC-M4-03 / 公开链接 | 发送 Findigs 招聘页 URL，仅显示一条 URL 用户消息。草稿职位名 `Senior Customer Success Manager`，包含 Findigs、EBR/QBR、6 年经验、Proptech/Fintech 与 USD 145K–175K，这些均可在[源页面](https://jobs.lever.co/findigs/2e0f9c8f-ab2f-4b92-bdb9-bc594308b88d)核对。草稿有 Create 按钮；**未见独立来源标签**。同日补测用户提供的[阿里巴巴职位页](https://campus-talent.alibaba.com/campus/position/199907740040?deptCodes=)：浏览器可见完整“AI应用算法工程师”职位内容，但 M4 两次读取均报“没有从这个页面读取到职位内容”，无草稿。两条链接均未点击 Create。 | **部分满足**：Findigs 可读取但缺来源；阿里巴巴链接失败；访问次数、读取记录和 Create 后状态未验证 |
| UC-M4-04 / 需登录 | `https://github.com/login` 被读成登录页；回复“当前内容是 GitHub 登录页面”，要求补充岗位字段；无草稿。未直接说明“需要登录/无法访问”，也没有清晰的“改为粘贴全文”按钮。 | **部分满足** |
| UC-M4-05 / 404 | `https://httpbin.org/status/404` 返回错误卡：`打开这个链接失败（404），请改为粘贴 JD 文案。` 有 Retry、Start over，输入保留；无草稿。 | **通过** |
| UC-M4-06 / 非职位页 | `https://example.com/` 回复该示例域名不含可用职位描述，要求补充或上传完整 JD；无草稿。 | **通过** |
| UC-M4-07 / 内网地址 | `http://127.0.0.1:1/uj-test` 显示 `不支持访问内网地址。`，有 Retry、Start over；无草稿。未测试 `169.254.169.254`，也未取得服务端出站请求日志。 | **部分满足**：UI 拒绝已证实，未发请求未验证 |
| UC-M4-08 / 非 HTTP 协议 | `file:///tmp/uj-test-m4.txt` 被解释成一个本地文件路径；`ftp://example.com/jd` 被解释成仅含 FTP 链接。两者都没有草稿，但没有明确“只支持 http/https”的拒绝提示；未取得出站日志。 | **部分满足**：未生成草稿；协议拒绝及无读取未证实 |
| UC-M4-09 / 粘贴文案 | 同一 Customer Success Manager 样例运行两次。两轮均识别职位名、4+ 年、英文写作与 SaaS，并生成草稿；第一轮创建后 Location=`Hanoi, Vietnam`。**Hybrid 未出现在两轮草稿或创建后的固定字段行**；原文 3 条职责、2 条要求、1 条加分项，第一轮扩展为 6/5/2，第二轮为 6/6/2，并加入未提供的 CRM、分析工具、客户健康度等条件。 | **失败**：AC-5 要求的工作方式及字段准确性不满足 |
| UC-M4-10 / 原文保留与修改建议隔离 | 公开链接的 11 条职责基本按源页顺序逐条翻译；两轮粘贴文案均自动增写职责或条件。输出作为草稿正文呈现，未作为独立建议供用户先确认。 | **失败**：2026-10-15 产品决定导入时不自动改写，可单独给修改建议；当前行为不满足 AC-6 |
| UC-M4-11 / 页面 >2MB | 无可公开访问、内容类型为 HTML 且可控大小的线上测试夹具；本次未提交超限页面。 | **未验证** |

统计：**通过 4 / 部分满足 4 / 失败 2 / 未验证 1 = 11**。`UC-M4-03` 的 Create 步骤没有执行：真实第三方职位内容的持久化和版权边界仍待产品确认；创建链路已通过文案路径单独验证。M4-LIVE-06/UC-M4-10 的原始观察未变，仅按 2026-10-15 产品决定调整判定。

### 创建与持久化检查

第一轮粘贴文案点击 `Create job from this draft`，进入[测试 Draft](https://hireos.aipollo.me/hireos/jd/jobs/0b53643b-3243-45c0-89ff-e02d94bb79a0/document)，显示 `JD-2026-0015`、`Draft`、`Not published`、`Saved`。职责、要求和加分项与创建前卡片可见内容一致。页面显示 `Public 20 / Internal 0 / Confidential 0`；Location 为 `Hanoi, Vietnam`，Headcount 为 1，另短暂显示用户未提供的 `Level=Mid`，刷新后 Level 变为空值；**始终未见 Workplace type/Hybrid**。返回列表后 All Jobs 19、My Jobs 1、Published 7、Drafts 12，新增一条 Customer Success Manager Draft；Owner 列为 Linh Tran。刷新编辑页后仍看到 Draft 与文档内容，UI 层持久化通过。服务端 owner、Core Job、internal 文档实体和 AiRun 未核查。该测试 Draft 保留供复核，未删除、发布或外发。

## 3. 验收标准判定

| AC | 判定 | 证据及限制 |
|---|---|---|
| AC-1 无效输入提示 | **通过** | UC-M4-02 明确说明重新粘贴方式 |
| AC-2 公开链接真实读取并生成草稿 | **部分满足，用户提供的链接失败** | Findigs 源页特有事实与草稿相符，但缺来源标签；阿里巴巴职位页在浏览器可见，线上 M4 两次均未读出内容；访问日志及链接 Create 未核查 |
| AC-3 登录 / 404 / 非职位页说明原因且不编造 | **部分满足** | 三类均未生成草稿；登录页提示是内容不足，缺清晰手动入口；404 和非职位页可理解 |
| AC-4 内网与非 HTTP 协议拒绝 | **未完整验证** | 内网 UI 明确拒绝；file/ftp 未生成草稿但未明确拒绝，未取得服务端无出站请求证据 |
| AC-5 文案解析字段准确 | **失败** | 两轮均丢失 Hybrid，职责/条件数量和内容超出原文；创建后无 Workplace type |
| AC-6 不自动改写；建议与草稿隔离 | **失败** | Findigs 的 11 条职责作为草稿正文被逐项翻译；粘贴文案也直接增写内容，均未先作为独立建议供用户确认 |

## 4. 发现与复现

| ID / 级别 | 角色、步骤、证据与影响 | 最小修复方向及验收 |
|---|---|---|
| M4-LIVE-01 / **P1 · state/ai_boundary** | Recruiter 在步骤 5 粘贴含 `Hanoi, hybrid` 的文案，两轮草稿都不展示 Hybrid；创建后只有 Location/Headcount/Level，没有 Workplace type。招聘人员无法确认混合办公是否被保存，后续可能把错误工作方式交给候选人。 | 将地点和工作方式分别提取为结构化字段；草稿与创建页均展示。相同文案运行两轮，均显示 `Hanoi, VN` 与 `Hybrid`，刷新后保持。 |
| M4-LIVE-02 / **P1 · ai_boundary** | 步骤 5 原文仅 3/2/1 条，第一轮变成 6/5/2，第二轮 6/6/2；新增 CRM、客户健康度、分析工具等未由用户提供的招聘条件。会改变筛选门槛。 | 区分“原文事实”和“AI 建议”，不得将新增硬性条件直接写进 Draft；逐条核对来源与输出，未经确认的条件应标注建议或不写入。 |
| M4-LIVE-03 / **P1 · clarity/ai_boundary** | 步骤 3 Findigs 链接只在用户消息出现，草稿卡片没有独立来源标签。用户审阅草稿时无法直接识别其依据或回到原页面。 | 在草稿卡片及创建后的来源元数据中显示 URL/来源类型；刷新后仍可追溯，权限适当。 |
| M4-LIVE-04 / **P1 · state** | 步骤 5 创建后的编辑页显示 `Internal 0`，而公共创建规则要求生成 internal 文档；只获得 UI 证据，尚不能排除后端另有不可见对象。内部招聘上下文可能未交接。 | 用已登录 API/DB 核查文档对象、类型、内容和权限；若确实未生成则补齐，并让 UI 正确显示。 |
| M4-LIVE-05 / **P2 · clarity/recoverable** | `file://`、`ftp://` 输入被作为普通文本解释，提示“文档内容不足”，没有说明协议不受支持；GitHub 登录页也未给出明确的粘贴全文入口。用户不清楚失败原因和可恢复路径。 | 协议识别在 AI 处理前完成，统一显示“只支持 http/https”；登录页说明需要登录并提供粘贴正文入口。 |
| M4-LIVE-06 / **P1 · ai_boundary** | 公开职位页 11 条职责几乎逐项翻译并作为导入草稿正文展示；粘贴文案两轮也自动扩写。2026-10-15 产品决定：M4 导入不改写，可给修改建议。当前行为使用户无法直接保存与来源一致的职位内容。 | 导入草稿保留来源内容、事实与条件；修改建议单独呈现，用户确认前不应用。以公开页和粘贴文案各运行两轮，核对草稿未自动翻译、改写或增写。外链抓取与保存的授权、版权边界仍另行确认。 |
| M4-LIVE-07 / **P1 · state/recoverable** | 用户提供的阿里巴巴校园招聘职位页在普通浏览器中无需登录即可看到“AI应用算法工程师”、北京/广州/杭州/上海及完整职责要求；将同一 URL 输入线上 M4，首次和 Retry 均报“没有从这个页面读取到职位内容”，无草稿。Retry 后出现两张相同错误卡。直接读取该 URL 的初始 HTML 为 HTTP 200、4,144 字节，正文仅有 `<div id="app"></div>`，不含职位名；这与当前后端只抓取初始 HTML 的行为吻合。该公开职位无法沿 M4 链接主流程创建。 | 核查线上抓取响应与正文提取过程；对需客户端渲染的页面提供可用的读取方式或明确说明限制。用该 URL 复测，职位名、地点及职责与源页一致，且 Retry 不堆叠重复错误卡。 |

未将 `Owner=Linh Tran` 与页头“蔡敏”直接判为错归属：My Jobs 确实 +1，但缺少认证主体映射。`Level=Mid` 与固定字段行不符，属于 M1–M5 公共骨架问题，与现有 M2 报告观察相同，需跨模块处理。

## 5. UX/UI 审查（U1–U10）

角色：已登录职位创建者；实际业务角色未从服务端确认。目标：把公开职位或现有 JD 文案转成可审阅的草稿，再创建 Draft 并交给 M6 编辑。

| 标准 | 结论 | 证据与限制 |
|---|---|---|
| U1 容易理解 | **部分满足** | 入口说明了链接或全文；生成卡片明确职位名。外链草稿缺来源标签，协议失败说明不准 |
| U2 容易上手 | **通过（本路径）** | 入口、引导和输入提示直接；焦点在输入框 |
| U3 快速完成任务 | **通过（步骤）** | 入口→粘贴→Create 无重复输入；未测精确耗时或超时阈值 |
| U4 下一步明确 | **部分满足** | Draft 自动进入编辑页，显示状态与 Saved；失败时可继续输入，但登录页无专门手动入口 |
| U5 提示和按钮清楚 | **部分满足** | Create、Retry、Start over 明确；file/ftp 未说明协议限制 |
| U6 符合真实工作方式 | **失败** | Hybrid 丢失，导入草稿自动翻译/扩写内容和硬性条件，招聘人员需逐条反查原文 |
| U7 信息结构符合角色目标 | **未验证** | 单一会话，无 Recruiter/Manager/Approver/Viewer 权限及字段可见性证据 |
| U8 减少跳转与重复输入 | **通过（本路径）** | 同一侧栏完成粘贴审阅；Create 直接打开编辑页 |
| U9 可恢复和可预期 | **部分满足** | 404/内网错误保留输入，有 Retry/Start over；阿里巴巴链接 Retry 后重复错误卡。网络断开、AI 失败、未知结果和权限撤销未注入 |
| U10 可访问、可读、可操作 | **部分观察，整体未验证** | 输入框获得焦点，Draft/错误有文字状态；未测完整键盘路径、200% 缩放、屏幕阅读器和焦点恢复 |

按审查标准，存在未豁免 P1，UX verdict 为 **conditional_pass**；按产品 AC，AC-5 失败且 AC-2/3/4 未完整满足，因此 M4 功能结论仍为**不通过**。

```yaml
review:
  product: "JD Management"
  surface: "M4 Paste a Link or Text → Draft → Create"
  role: "已登录职位创建者（服务端角色未确认）"
  journey_goal: "从公开链接或现有文案生成并创建可编辑的职位 Draft"
  evidence:
    source: "线上 UI 可访问树、可见页面、创建后编辑页和职位列表；公开源页内容"
    steps_checked: [1, 2, 3, 4, 5, 6]
  verdict: "conditional_pass"
  findings:
    - id: "M4-LIVE-01"
      severity: "P1"
      category: "state"
      step: 5
      title: "Hybrid 工作方式在草稿和创建页丢失"
      evidence: "两轮输入含 hybrid；创建页仅显示 Hanoi, Vietnam、Headcount、Level"
      user_impact: "招聘条件可能被错误交接"
      recommendation: "单独提取并持久化 Workplace type"
      acceptance_check: "两轮解析及创建后刷新均显示 Hybrid"
    - id: "M4-LIVE-02"
      severity: "P1"
      category: "ai_boundary"
      step: 5
      title: "AI 直接增写招聘条件"
      evidence: "输入 3/2/1 条；输出 6/5/2 与 6/6/2，加入 CRM 等条件"
      user_impact: "改变候选人筛选门槛"
      recommendation: "保持源事实，新增内容仅作可确认的建议"
      acceptance_check: "逐条来源核对，无未经确认的硬性条件"
    - id: "M4-LIVE-03"
      severity: "P1"
      category: "clarity"
      step: 3
      title: "公开链接草稿缺独立来源标签"
      evidence: "URL 仅见于用户消息，生成卡片没有来源标签"
      user_impact: "草稿难以追溯依据"
      recommendation: "草稿与持久化对象显示来源 URL"
      acceptance_check: "Create 前后及刷新后可查看来源"
    - id: "M4-LIVE-04"
      severity: "P1"
      category: "state"
      step: 5
      title: "创建页未见 internal 文档"
      evidence: "创建后 Public 20 / Internal 0"
      user_impact: "内部招聘上下文可能没有保存"
      recommendation: "核实文档模型并生成 internal 文档"
      acceptance_check: "API/DB 和 UI 同时确认内容、类型与权限"
    - id: "M4-LIVE-06"
      severity: "P1"
      category: "ai_boundary"
      step: 6
      title: "导入内容被自动改写，未作为建议待确认"
      evidence: "Findigs 11 条职责被逐项翻译；粘贴文案两轮被扩写"
      user_impact: "无法直接保存与来源一致的职位内容"
      recommendation: "原内容进入草稿，修改建议单独显示"
      acceptance_check: "用户确认前草稿不自动翻译、改写或增写"
    - id: "M4-LIVE-07"
      severity: "P1"
      category: "recoverable"
      step: 3
      title: "可浏览的阿里巴巴职位页无法导入"
      evidence: "页面可见 AI应用算法工程师完整内容；M4 首次和 Retry 均报未读到职位内容"
      user_impact: "用户无法从该公开职位链接创建草稿"
      recommendation: "核查抓取及正文提取，并说明无法读取的具体限制"
      acceptance_check: "同一 URL 成功提取关键字段，或给出准确限制；Retry 不重复错误卡"
  usability_check:
    understandable: "fail"
    learnable: "pass"
    efficient: "pass"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "unknown"
    no_unnecessary_hops: "pass"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "未取得线上构建号、已登录 API/DB、服务端出站日志与 AiRun"
    - "无线上可控 mock 页、2MB HTML 页面、断网与 LLM 故障注入"
    - "外链抓取与保存的授权、版权边界仍待确认"
```

## 6. 剩余验证与线上数据

要补齐完整验收，应在可控且公开可达的测试夹具上验证登录跳转、404、非职位页、>2MB 页面及访问次数；用服务端日志确认私网/非 HTTP 输入没有任何出站请求；用已登录 API/DB 核对 `Core Job`、owner、internal 文档、链接读取记录和 AiRun；注入网络与 LLM 失败；补角色权限、键盘和缩放检查。PRD 的“太短”阈值及外链抓取与保存的授权、版权边界仍需产品确认；原“照搬判定阈值”已不适用。

首次测试在线上仅新增上述 **1 条** Customer Success Manager Draft。首次测试结束时列表为 All Jobs 19、My Jobs 1、Published 7、Drafts 12；公开链接及第二轮文案只生成 Copilot 草稿，未点击 Create。未执行部署、发布、外发或删除。阿里巴巴链接读取失败及 Retry 重复错误已在用户确认后提交为 [Bug Issue #64](https://github.com/TelyAgent/HireOSV2/issues/64)；其他发现尚未创建 Issue。

### 同日补测：用户提供的阿里巴巴职位页

- 输入：[阿里巴巴校园招聘职位 URL](https://campus-talent.alibaba.com/campus/position/199907740040?deptCodes=)。浏览器页面在未登录状态展示标题“AI应用算法工程师”，更新时间 2026-09-03，地点北京/广州/杭州/上海；描述包含 Prompt、RAG、微调、Agent、数据飞轮、SFT/RL 和评测等具体职责。
- 线上 M4 首次输出：`没有从这个页面读取到职位内容，请改为粘贴 JD 文案。`，保留输入并提供 Retry、Start over，没有草稿卡或 Create 按钮。
- 点击 Retry 后输出相同错误，并额外显示一张相同错误卡。未创建职位；本次会话开始时列表显示 All Jobs 24、Drafts 17，计数与之前测试期间不同，不能把差额归因于本次补测。
- 该 URL 是一条真实公开职位页，不能替代可控制 HTTP 状态、页面大小与访问日志的 mock 域名；404、登录跳转和 >2MB 的服务端断言仍需专用夹具。
- 进一步只读核查：同日直接获取该 URL 的初始响应，得到 HTTP 200、`text/html`、4,144 字节；HTML `<body>` 只有 `<div id="app"></div>`，不含“AI应用算法工程师”或职责文本。浏览器运行脚本后才显示职位。仓库 `link-extract.ts` 当前用 `fetch` 获取初始 HTML，再去除 `<script>` 等标签提取纯文本；这足以解释本地可重现的“正文为空”机制，也与线上报错一致。尚无线上抓取日志，不能断言线上收到的字节与本地响应完全相同。
