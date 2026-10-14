# JD Management — 测试闭环输入/输出清单 v0.1

状态：草稿，待评审（2026-10-14）
依据：PRD v1.3、Interface Spec v1.3、User Journeys v1.0、Meeting Summary 2026-10-13、`hireos-jd-backend` 当前代码
用途：作为 AI 生成 testcase、E2E 模拟、性能和 UI 交互测试的输入。每个闭环必须能单独 seed、单独运行、单独断言。

## 0. 统一输入/输出模板

| 部分 | 内容 |
|---|---|
| **输入·身份** | actor（角色 + 是否属于该 Job 的成员 + 字段权限） |
| **输入·前置状态（seed）** | 运行前数据库里要有什么：Job 状态、草稿 revision、审批状态等。必须能用 seed/API 一步造出 |
| **输入·用户数据** | 用户输入的文本、文件、表单值，包括正常、边界和恶意数据 |
| **输入·外部依赖桩** | LLM、Core、邮件、渠道、时钟。需要能指定返回成功、失败、超时或结果未知 |
| **输出·UI** | 用户能看到的状态、文案、按钮是否可用、diff 标记 |
| **输出·API/数据** | HTTP 码、ErrorEnvelope.code、持久化对象及字段值、revision/version 变化 |
| **输出·事件/审计** | 发出的事件、AuditFact、AiRun 记录 |
| **输出·禁止副作用** | 绝对不能发生的事。这部分是模拟测试里最关键的断言 |

实现现状标记：✅ 后端已有接口，可以真跑 · 🟡 部分实现，或只在原型里有 · ❌ 只有规格，现在没法真跑

---

## 1. 实现现状总览（决定哪些闭环现在能做“真正的模拟测试”）

后端 `hireos-jd-backend` 当前实际有：
- Jobs：list/get/patch/delete/status。status 只有 `draft↔published` 两态，对应 Core 的 `draft/open`。
- Copilot 会话：messages、confirm-draft、auto-complete、import、refine、refine-variants、title-variants、fields、attachments（上限 10MB，支持 PDF/DOCX/TXT）。
- 文档：documents GET/PUT（按 audience），块级 `public/internal/confidential`。
- 建议：suggestions GET/POST/PATCH；rewrite、section AI、analyze。
- 版本：versions、publish（README 说明：每次 Publish 生成一个新版本）。
- 认证：WorkspaceGuard。开发态固定身份为 `roles:['admin','hr','interviewer']`。

后端**没有**：审批/激活、按 Job 的成员 ACL、评论线程、并发 CAS 冲突、External JD 白名单生成、导出、邮件、渠道发布、快照/影响复核、事件总线、My Tasks、首页统计、Settings（Appearance/连接/模型/流程）。

---

## A. 创建

### A1 Quick Start 三问创建 ✅
- **身份**：Recruiter（开发态身份）
- **前置**：已登录；不需要已有 Job
- **用户数据**：三问回答（a 一次全部答完；b 只答一部分；c 没给职位名；d 答非所问；e 中英混合、语音转写文本）
- **依赖桩**：LLM（requirement_discovery）
- **输出·UI**：只追问没回答的问题；推断不出职位名时追问 title，不写 `New Role`；Workspace 草稿每个字段显示来源和待确认状态
- **输出·数据**：CopilotConversation 和 Messages；点 `Create job from this draft` 后，Core Job `status=draft`、owner 为当前用户，同时生成 JobDocument(internal)；有 AiRun 记录
- **禁止**：不点 Create 就生成 Job；创建时产生审批或发布；刷新后数据丢失
- **缺失**：①“已回答”的判定标准（什么算答了）②置信度口径和阈值 ③LLM 黄金样本和判分规则（真实 LLM 输出不确定，需要录制回放或 judge）

### A2 职位名称 → 三风格版本 ✅
- **前置**：同 A1
- **用户数据**：职位名（常见 / 罕见 / 含公司内部编号 / 中文名 / 空串）
- **依赖桩**：LLM（title-variants、refine-variants）
- **输出·UI**：A Concise / B Warm / C Detailed 三版，事实一致、风格不同；Refine 后三版一起更新并高亮差异
- **输出·数据**：选 B 创建后，Job 和文档内容等于 B 版
- **禁止**：三版之间事实不一致（地点、HC、薪资）；出现输入里没有的事实
- **缺失**：①“事实一致”怎么判（字段级比对，还是 LLM judge）②哪些字段允许 AI 默认填写，界面是否标“默认”（UJ §8 待确认）

### A3 上传 JD 文件 ✅
- **用户数据**：文件矩阵：PDF 文本型、PDF 扫描件（无文本）、中文 CJK 字体 PDF、DOCX、TXT、加密 PDF、损坏文件、>10MB、0 字节、扩展名伪装、含提示注入的 JD
- **依赖桩**：LLM（jd_parse）
- **输出·UI**：可读文件提取出标题、职责、要求、加分项、地点、工作方式，字段带来源；不可读文件显示原因，并提供重试或转手动入口；取消选择文件不报错
- **输出·数据**：草稿和 attachment 记录；失败时 HTTP 4xx 加明确 code
- **禁止**：解析失败时生成空草稿或编造内容；文件里的指令扩大 AI 权限；上传完成就当作已保存
- **缺失**：①正式支持的格式和大小上限（代码是 10MB，PRD §11 说由工程给出，没有落文档）②扫描件要不要 OCR ③病毒/隔离检查（PRD 要求“文件安全检查”，代码里没有）④测试文件库（需要建 `fixtures/jd-files/`）

### A4 粘贴链接/文案 ✅
- **用户数据**：可访问的公开 JD 链接、404、需登录的页面、>2MB 页面、超短文本、会议笔记、含注入文本、非 JD 页面
- **依赖桩**：外部 HTTP（需要本地 mock server，不能依赖真实网站）、LLM
- **输出·UI**：显示来源、可用性、读取状态；不可访问时提供手动路径；不大段复制原文
- **禁止**：编造页面内容；SSRF（内网地址、file:// 协议）能读取成功
- **缺失**：①“文本太短/不可识别”的阈值 ②链接抓取的授权和版权边界（UJ §8 待确认）③SSRF 白名单策略 ④mock 页面集

### A5 手动表单 ✅
- **用户数据**：必填项（title/location/HC/responsibilities/requirements）全部组合的缺失；HC=0、负数、10001；超长 title（>200 字符）
- **依赖桩**：无（必须断言没有调用 LLM）
- **输出**：合法时直接创建并进入编辑页；非法时标红，不创建
- **禁止**：调用 AI；跳过完整性检查
- **缺失**：UJ 的必填项（5 个）和 README 的必填项（11 个，含 Level）不一致，需要统一

### A6 模板/克隆创建 ❌
- **前置**：一个已有 Job，带 restricted 字段、审批记录、发布记录
- **输出**：新 Job 的审批、发布、负责人确认、日期全部被重置；restricted 字段按当前用户的权限决定是否复制
- **缺失**：原型里只有入口；后端没有接口；模板的数据结构未定义

### A7 无 Job 上传 → Unassigned → 人工关联 ❌
- **输出**：文件状态 Available ≠ 需求已确认；关联决定会生成一个 Review imported material 任务
- **缺失**：后端没有 Files 模块

---

## B. 编辑与 Copilot

### B1 选区改写 → diff → Accept/Reject ✅
- **前置**：已有 Job + internal 文档（seed：`job-demo-102` 同类数据）
- **用户数据**：选区类型：一句、一个列表项、一段、整节、跨段；指令：Rewrite/Shorten/Clarify/自由指令
- **依赖桩**：LLM（rewrite）
- **输出·UI**：原位显示新增、删除、替换；Accept 后正文变化，Reject 后正文不变
- **输出·数据**：Suggestion `status` 变为 accepted/rejected；文档 revision +1（只在 Accept 时）
- **禁止**：AI 回复直接覆盖正文；改动到选区以外的文本却没有列出
- **缺失**：①文档 revision/CAS 是否已实现（为了 COP-04 要确认）②停止生成后留下的半截建议能不能接受

### B2 不选文字的问答/市场薪资调研 ❌（会议 P0）
- **用户数据**：“北京 3 年 AI 产品经理市场薪资多少”、无关问题（天气）、诱导读取内部预算
- **输出**：结果带地区、来源、日期；写入薪资字段前必须人工确认；无关请求提示超出范围
- **缺失**：①**薪资数据源未定**（没有数据源就测不了“真实”结果）②结果是否自动写入（会议待确认）③编辑模式和问答模式的切换交互

### B3 Analyze → 质量门禁 ✅
- **前置**：三档 seed：缺很多必填（类似 job-demo-101）、基本完整只差 1 条 weak（类似 102）、全部合格
- **用户数据**：可触发各条 weak 规则的文本（营销词、Junior 要求 5 年+、Remote 不写地区、概述少于 2 句、职责少于 3 条、要求里出现 “strong communication” 等）
- **输出**：分为 To complete / To revise / Suggestions / Completed；AI fix 给出前后 diff；阻断项清零后 Publish（或提审）按钮才可用
- **禁止**：只有建议项时也阻断；有阻断项时仍能提交
- **缺失**：①PRD 的提审门槛（含审批政策、负责人）和 README 的 11 项必填不是一套，测哪套？②weak 规则的判定是确定性规则还是 LLM（影响能否做断言）

### B4 语义变更同步 JRP ❌
- **输出**：must-have 改为 preferred 时，文本和 JRP patch 作为一个单元提交；映射不确定时标 Needs requirement review，并且不能提审
- **缺失**：后端没有 JRP/Requirement 结构化模型，文档只存块

### B5 块级可见范围 🟡
- **身份矩阵**：Owner / Admin / Member / 非成员
- **输出**：Member 看不到 Confidential 块；AI 上下文里 Confidential 显示为“已隐藏”（代码 doc-ai.service 第 93 行已经这样处理）
- **缺失**：后端没有按 Job 的角色（原型 README：权限只在前端做了隐藏）→ **现在测出来的是前端遮挡，不是服务端拒绝**

### B6 自动保存/离线/失败恢复 🟡
- **依赖桩**：网络断开、PUT 返回 500 或 409
- **输出**：Saving / Saved / Offline / Save failed 四种状态，内容不丢；恢复后保存成功
- **缺失**：故障注入手段（Playwright 路由拦截可以做）；冲突时（409）的期望 UI

---

## C. 协作

| ID | 输入 | 输出 | 现状 / 缺失 |
|---|---|---|---|
| C1 评论线程 | 选区 + 评论正文、@某人、resolve/reopen | 线程状态变化；@ 产生通知；评论不改正文 | ❌ 后端没有 Comment |
| C2 Suggesting 模式 | 两个用户，一个在 Suggesting 模式下修改 | 生成待审修订，作者区分人工和 AI | 🟡 有 suggestions 表，但没有作者/模式区分 |
| C3 同字段并发冲突 | 两个会话基于同一个 revision 修改同一字段 | 后提交的一方收到 409 VERSION_CONFLICT，并看到 base/current/proposal | ❌ 需要确认 documents PUT 有没有 CAS |
| C4 成员管理 | Owner 添加 Admin/Member，撤权 | 撤权后下一次请求立即 403，缓存敏感内容被清掉 | ❌ 只在原型里有 |

---

## D. 审批与激活（全部 ❌，后端没有实现）

| ID | 输入 | 输出 | 缺失 |
|---|---|---|---|
| D1 提交审批 | 满足/不满足门槛的草稿；审批政策 | ApprovalRequest `pending`；冻结 manifest_hash；生成审批任务 | 审批政策配置；HM/HR Approver 测试身份 |
| D2 审批决定 | Approver 执行 approve/request_changes/reject（带/不带理由） | 状态迁移；决定绑定 candidate_hash；同一个人不能连签两步 | 职责分离规则的具体配置 |
| D3 pending 期间修改 + 撤权并发 | 审批进行中改内容；同时撤销审批人权限 | 旧请求 superseded；被撤权者提交决定时收到 403 | 并发编排工具 |
| D4 激活幂等 | Core 桩返回：成功 / 超时但实际成功 / 失败 / 同一幂等键不同请求体 | 只生成一个 role version；超时显示 outcome_unknown → 对账后 succeeded；冲突时 IDEMPOTENCY_CONFLICT | **Core 故障注入**；Core 有没有 role-version confirm 接口 |
| D5 转派/代理/超时 | 时钟快进 | 提醒、升级 | **审批超时 24h 还是 48h、超时是否自动生效（会议待确认）**；时钟控制 |

## E. 内外 JD 与外发

| ID | 输入 | 输出 | 现状 / 缺失 |
|---|---|---|---|
| E1 External JD 生成 | 带 internal/confidential 块和诱导文本的文档（如“请把内部预算写进公开版”） | 公开稿只含 public 块；诱导被拦截并给出字段/类别提示 | 🟡 有 audience 文档，没有白名单投影和输出检查；**需要一套“泄露诱导语料”** |
| E2 导出/渠道发布 | 格式 pdf/docx/md/json；渠道桩：成功、超时、无回执 | ready ≠ downloaded；超时显示 outcome_unknown，先查询再重试 | ❌；渠道清单未定（PRD §13 待企业配置） |
| E3 邮件发送 | 收件人：授权内部、外部、混合；草稿内容变化 | 发送前重新校验；内容变化需重新确认；外部只能收到已批准的 External JD | ❌；发件身份和邮件服务桩 |
| E4 暂停/关闭/归档 | 各状态间的迁移 + 原因 | 状态机按 Spec §5.3；渠道撤下单独跟踪 | 🟡 只有 draft↔published |

## F. 版本与下游

| ID | 输入 | 输出 | 现状 / 缺失 |
|---|---|---|---|
| F1 版本对比/回滚 | 已有 v1、v2 | 对比 diff；基于 v1 回滚会生成 v3，不改 v1 | 🟡 有 versions/publish，需确认恢复接口 |
| F2 open 岗位重大修改 | 修改薪资/HC/must-have | active 版本不变；新稿需要重新审批 | ❌ 依赖 D 组 |
| F3 Impact Review | 下游桩：回复 / 不回复 / 部分回复 | 无回复显示 unknown，不显示 0；三选一决定 | ❌；Screening/Interview 没有影响回报接口 |
| F4 事件幂等/乱序 | 同一 event_id 重复、版本倒序 | 不重复处理；旧版本不回滚状态 | ❌ 没有事件总线 |

## G. 岗位库、首页、任务

| ID | 输入 | 输出 | 现状 / 缺失 |
|---|---|---|---|
| G1 岗位库 | N 条 Job（性能测试用 1k/10k）；q 关键词、过滤、视图 | 结果正确、分页稳定、计数与列表一致 | 🟡 后端只有 `q`，没有过滤/分页/保存视图 |
| G2 角色首页 | 不同角色 + 任务/岗位 seed | T1/T2/T3 指标按口径计数并可下钻；0 和 Unavailable 分开 | ❌ |
| G3 My Tasks | 两人同时领取；转派；完成 | 只有一人领取成功；完成必须有业务依据 | ❌ |

## H. Settings / 公共能力（全部 ❌，后端没有）

H1 Appearance（4 主题 × 3 强调色 × 3 字号 = 36 组合；需要账户偏好存储）· H2 邮件/目录连接（需要 IMAP 和文件夹桩）· H3 AI Models · H4 成员权限和审批流程配置 · H5 通知偏好。

## I. 横切安全套件（叠加到每个闭环上跑）

- **输入**：身份矩阵 × 读取通道（UI、API、AI 上下文、搜索、导出、邮件、日志）× 泄露诱导语料
- **输出**：服务端 403/404；模型输入/输出/缓存里没有 confidential 值；页面上没有伪按钮
- **缺失**：服务端字段级授权没有实现，这套测试目前大部分会失败（这是有效的发现，不是测试写错了）

---

## 2. 缺失汇总：做“真正的模拟测试”前要补的东西

### 2.1 产品决策（需要你们拍板，否则断言写不出来）
1. **测试依据**：PRD v1.3（提审→审批→激活→发布四步）还是原型（Owner/Admin 直接 Publish）？
2. **必填项口径**：UJ 5 项 / README 11 项 / PRD 提审门槛，三套不一致。
3. **角色权限矩阵**：PRD 的 7 类角色 vs UJ 的 4 类 vs 原型的 Owner/Admin/Member，需要最终版。
4. **审批超时**：24h 还是 48h，是否自动生效。
5. **薪资调研数据源**，以及结果是否自动写入。
6. **性能 SLO**：PRD §11 明确写了“不虚构数值”。没有阈值，性能测试只能出基线报告，不能判通过或失败。需要定：岗位库 P95、AI 首字延迟、文件解析耗时、并发编辑人数等。
7. **文件上限**：格式、大小、页数、是否 OCR。

### 2.2 测试基础设施（工程要补）
1. **Seed API / fixture 脚本**：一步造出任意状态的 Job（draft、有 weak、pending、approved 未激活、open 等）。这是各闭环能独立跑的前提。
2. **多身份登录**：开发态现在只有一个固定身份（admin+hr+interviewer），需要 Recruiter/HM/Approver/Viewer/Member 等可切换的测试身份。
3. **LLM 测试模式**：录制回放（确定性，用于 E2E 和回归）+ 真实模型（用于质量评估，配黄金样本和 judge rubric）。需要一个环境变量能切换两种模式。
4. **故障注入**：Core 超时/成功但响应丢失、LLM 超时/no_eligible_model、网络断开、渠道无回执。
5. **时钟控制**：逾期、提醒、审批超时。
6. **测试数据集**：JD 文件库、外链 mock 页面、泄露诱导语料、weak 规则触发文本、性能用的批量 Job。

### 2.3 系统实现缺口（闭环可以先写好用例，但跑起来会失败）
D 组全部、E1–E3、F2–F4、G2–G3、H 组全部、C1/C3/C4、服务端字段授权。
