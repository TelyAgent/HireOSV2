# HireOS Command — Interview Prototype Design Brief

> 用途：在新对话中启动 Interview 模块的高保真、完整可点击原型设计。
> 本文汇总用户在 PRD 之后确认的设计决策，并补充可执行的原型范围与建议。单独阅读本文即可开始设计。

| 属性 | 内容 |
|---|---|
| 版本 | v1.0 |
| 整理日期 | 2026-09-08 |
| 产品 | HireOS Command |
| 模块 | Interview |
| 交付目标 | 英文、笔记本优先、Google Workspace 风格、完整可点击雇主端原型 |
| 当前阶段 | 产品与设计方向已明确，可进入原型制作 |
| 配套产品文档 | [Interview PRD v1.1](HireOS_Command_Interview_PRD_v1.1.md) |
| 配套接口文档 | [Interview Interface Spec v1.0](HireOS_Command_Interview_Interface_Spec_v1.0.md) |

## 1. 如何使用本文

在新对话中上传本文；如方便，同时上传 PRD 与 Interface Spec。将本文作为最新产品决策与原型设计约束，旧文件作为详细背景。

**优先级：用户后续明确指示 > 本文中的已确认决策 > 旧 PRD / Interface Spec。** 本文没有直接改写旧文件，旧文件中存在的冲突必须按第 3 节处理。

标记含义：

- **已确认**：用户明确提出或接受，设计应遵循。
- **建议默认**：为方便直接开始设计而整理，可由设计者合理调整，不应描述为用户已经逐项批准。
- **待技术验证**：影响真实集成，原型可以模拟，但不能宣称已经实现。

不需要再次询问已经确认的视觉风格、语言、主要设备、输入最低门槛、面试规划方式和最终确认权限。

## 2. 已确认决策总表

| 主题 | 已确认要求 |
|---|---|
| 模块入口 | Interview 是独立模块入口；未来再与 Job Application 入口结合 |
| 手动输入 | 用户或内部 HR 可上传简历、提供 JD |
| 文件夹输入 | 从指定文件夹自动读取材料，通常承接上一流程的输出 |
| 邮件输入 | 按约定格式和规则从电子邮件读取材料，通常承接上一流程的输出 |
| 最小输入 | **只要 JD 就可以启动面试；其他材料不是必需项** |
| 上游不完整 | 标记缺失并继续，不因没有简历、筛选或测评资料阻止启动 |
| 面试规划 | 同时支持一次规划全部轮次后排期，以及逐轮规划 |
| 会议体验 | 希望将会议嵌入面试工作台，优先考虑 Google Meet；Zoom 可作为支持嵌入的备选 |
| 会议数据 | 希望记录面试音视频和相关数据；具体采集能力与授权需验证 |
| 评分基础 | 先明确评价标准，再映射至能力维度及评分量尺，建立分数依据 |
| 跨轮评审 | 同时有单项评分和总分；允许短板，突出明确底线 |
| 例外 | 允许例外，但必须由 **HR 与 Hiring Manager 共同确认** |
| 决定页 | 使用同一独立页面，按阶段切换，处理逐轮下一步和最终结论 |
| 面试最终结论 | **HR 与 Hiring Manager 共同决定** |
| Offer 批准 | 由有权决定该 HC 预算是否给到团队的更高层负责人决定 |
| 视觉方向 | **Google Workspace 风格**；用户已否决 Attio 和 Linear 方向 |
| 设备 | 桌面 Web，优先适配笔记本，其次移动端 |
| 语言 | 默认及首选语言为 **英文** |
| 首版交付 | 完整可点击流程，不只是孤立静态页面 |

## 3. 对旧 PRD / Interface Spec 的覆盖与修正

### 3.1 独立使用不依赖完整招聘系统

旧规范将 Application、Candidate Profile、Screening、Assessment 等设为进入 Interview 的前置输入。用户后续明确：独立模块只需 JD 即可启动，以上资料均不再是独立模式的必填项。

设计不得要求用户先走完 JD Management → Resume Screening → Assessment，才允许创建或开始 Interview。缺少可选上游资料不需要额外申请“跳过测评豁免”。

**区分两种情况：**

- 没有上游资料：独立模式下允许，不自动构成门槛违反。
- 已有明确岗位底线且证据证明未满足：属于例外决策，需 HR 与 Hiring Manager 共同确认。

### 3.2 独立项目与未来关联

建议用 **Interview Project** 表示一次岗位导向的面试过程，包含计划、场次、证据、评估和决定。可仅根据 JD 建立，候选人和 Application 可稍后关联。

候选人尚未关联时，界面清楚显示 `Candidate not linked`，允许继续准备并启动适用的面试流程。发送个人邀请时取得必要联系信息，是该操作的需求，不是创建项目的通用前置门槛。

不要把“独立模式”解释为完全脱离岗位评价：JD 仍是最低输入与评价基准。

### 3.3 双方确认替换单人最终批准

旧规范中的单个授权人最终批准，应更新为 HR 与 Hiring Manager 双方确认。双方确认必须明确可见，不可由一个“Approved”标签掩盖。

底线例外同样需要双方确认并留理由，不能由单个授权人自行豁免。尚未定义单轮普通操作的权限时，采用合理默认，不把所有排期与进入下一轮都强制升级为双人审批。

### 3.4 独立版本的终点

建议首版雇主端闭环为：完成面试 → 双方确认结论 → 生成、查看和导出 Hiring Evaluation Package。

未来与 Offer 模块连接后增加发送与接收状态。首版可演示该集成的模拟状态，但不能要求真实 Offer 系统存在。面试建议推进不等于预算批准、Offer 批准或 Offer 已发送。

### 3.5 会议嵌入仍待验证

Google Workspace 视觉选择不代表 Google Meet 已确认可以完整嵌入 HireOS，也不代表自动拥有音视频、转写或实时媒体权限。会议区域可做高保真模拟，集成状态必须诚实表达。

## 4. 产品定位与基础关系

Interview 帮助雇主围绕岗位要求收集、结构化、核查候选人证据，并形成可解释的面试评估与人工结论。

完整产品架构仍是：

```text
Account & System Configuration：横向全局模块
    支撑账号、角色权限、模板、语言、时区、集成与数据策略

JD Management → Resume Screening → Assessment / Written Test → Interview → Offer
```

当前只设计 Interview 独立入口。其他模块作为未来数据来源或接收方，不必先完整设计和实现。

面试核心数据链：

```text
JD / Role Requirements
→ Competencies
→ Scoring Rubric
→ Questions
→ Answers
→ Evidence
→ Individual Scores + Overall Evaluation
→ HR & Hiring Manager Decision
→ Hiring Evaluation Package
```

## 5. 输入与创建体验

### 5.1 三种入口

| 页面入口英文 | 用户提供 | 原型应展示 |
|---|---|---|
| Upload manually | JD 文本或文件；可附简历和其他材料 | 上传/粘贴、解析预览、识别出的 JD、可选材料、继续操作 |
| Import from folder | 指定可接入的文件夹 | 连接状态、来源选择、读取结果、导入记录、重复项提示 |
| Import from email | 邮箱与匹配规则 | 连接状态、规则说明、匹配邮件、正文/附件预览、导入结果 |

建议三种来源汇入同一个 `Review imported materials` 步骤。不要为每种来源重复设计一套后续面试流程。

### 5.2 最低数据与增量价值

- 只有 JD：生成岗位能力与评分标准草稿，设计岗位导向问题，开始收集候选人证据。
- JD + Resume：增加候选人经历、Claim 与定向验证问题。
- JD + Screening / Assessment：继承已有证据，重点补足缺口。
- 后续新增材料：提示新的来源与影响，保留已完成面试和原有评估历史。

原型必须包含 **JD-only happy path**。不能把上传简历、填候选人档案或取得上游成绩作为继续按钮的强制条件。

建议 AI 起草评价标准后提供明确编辑与确认入口，鼓励面试前确定标准；不要把尚未获用户确认的复杂审批程序加到 JD-only 启动路径中。

### 5.3 导入技术待定

具体文件夹供应商、邮件系统、识别格式、自动读取频率、归组与去重算法尚未确认。可使用清楚标注的演示连接与样例规则完成交互，不把某个供应商或自动化能力描述为已定需求。

## 6. 面试计划与排期

两种模式共用同一轮次管理界面：

1. **Plan all rounds**：一次设置各轮目标、能力、面试官与顺序，再逐轮安排时间。
2. **Plan one round at a time**：先安排当前轮，根据结果决定下一轮。

建议默认：

- 允许从逐轮规划扩展为完整规划，不锁死模式。
- 每轮区分“已规划”和“已排期”。
- 未执行轮次可以修改；已执行场次保留原记录。
- 可新增补面、改期、取消；普通取消与能力不足分开表达。
- 排期显示时区；英文界面不要假定所有用户处于美国同一时区。

## 7. 面试工作台

用户期望：在一个工作台中完成会议、查看计划、提问、记录及 AI 辅助。

建议布局：

- 会议区域：视频、参与者、麦克风/摄像头、会议控制。
- 面试任务区：当前问题、能力目标、已问主题、下一题。
- 可切换辅助区：Notes / Transcript / AI Suggestions。
- 状态区域：时间、录制、转写、保存与连接状态。

笔记本上不要把视频、完整转写、问题、AI、Evidence 和所有评分同时挤成多列。通过标签、折叠和按需展开保持主要任务可读。

首版可模拟基础 AI 问题建议与数据采集；实时自适应追问、实时证据缺口为原 PRD 的 P1，不能悄然变为全部必须真实实现的首版能力。

记录不足、拒绝录制、转写失败时，展示手工问答/笔记路径。录制、转写与实时媒体是独立能力与状态。

## 8. 评价标准、单项分数与总分

### 8.1 先明确评分标准

每个能力维度建议包含：

- Competency 名称及定义。
- 关联岗位要求。
- 1–5 分各自对应的行为表现。
- 期望等级与权重。
- 是否属于明确底线及最低要求。
- 需要收集的证据类型。

`scale graph` 在此前讨论中暂按“能力图谱与评分量尺”理解；不要求必须使用雷达图或某一种图形。

### 8.2 点击分数后的核查路径

```text
Competency score
→ Required level + Rubric
→ Scoring rationale
→ Supporting evidence / Contradicting evidence
→ Original answer
→ Recording timestamp（有录制时）
```

原型至少演示一条完整可点击链路。无录制时仍可定位到转写片段或人工记录，不生成虚假的录音时间点。

### 8.3 综合评审

同时显示：

| 信息 | 目的 |
|---|---|
| Overall score + Evaluation coverage | 总体表现及信息完整度 |
| Competency scores + Required levels | 逐项优势、短板与岗位差距 |
| Minimum requirements / Exceptions | 明确底线与被批准的例外 |
| Evidence gaps / Unknowns | 区分证据不足与已证实不达标 |
| Agreement / Disagreement / Counter-evidence | 支持跨轮人工讨论，不用平均数掩盖分歧 |

允许候选人有弱项，总分不能自动抵消明确底线。证据不足用 `Unknown`，不当作 0 分。部分评估可展示覆盖情况；所有计分维度完成后才展示完整最终总分，是沿用 PRD 的建议默认规则。

AI 建议与人工评分分开记录，人工修改显示理由和来源。不要将 AI 推荐设计成自动录用或自动拒绝。

## 9. 面试结论与下一步

**已确认采用方案 A：同一独立页面，按面试阶段切换。**

建议页面英文名称：`Decision & Next Steps`。

| 行动 | 页面内容 | 后续结果 |
|---|---|---|
| Continue to next round | 下一轮目标、需验证能力、面试官 | 新建或启用下一轮 |
| Hold | 原因、负责人、复核日期 | 保留项目并创建跟进 |
| Request more evidence | 缺口、补充方式、责任人 | 创建补面或补资料任务 |
| Do not proceed | 结论理由、相关证据 | 按最终确认规则结束项目；候选人通知是单独动作 |
| Complete interview evaluation | 综合结论、可接受短板、例外、剩余问题 | 进入 HR + Hiring Manager 双方确认 |

`Continue to next round` 和最终 `Recommend for offer` 必须有不同语义，不使用含糊的单个 Proceed 按钮覆盖两者。

### 9.1 双方确认

建议状态：

```text
Draft conclusion
→ Awaiting HR confirmation / Awaiting Hiring Manager confirmation
→ Confirmed by both
→ Evaluation package ready
```

界面分别显示每个人的确认状态、意见及时间。双方意见不一致时显示需讨论/修订，不自动完成。

建议默认：实质修改结论或例外理由后，受影响确认需重新取得；已生成包不被无痕改写。若 HR 与 Hiring Manager 为同一账号是否允许确认两次尚未定义，演示原型使用两个不同账号。

### 9.2 例外

需要明确呈现：哪项底线、实际结果、为何接受例外、风险说明、HR 确认、Hiring Manager 确认。例外批准不把不达标分数改成达标，也不补造缺失证据。

### 9.3 Offer 边界

Hiring Evaluation Package 是面试模块的核心成果，供 Offer 阶段使用。

**面试双方确认 ≠ Offer 预算批准。** 有权批准该团队 HC 预算的负责人作出 Offer 阶段决定。首版无需扩展成完整薪酬/预算/Offer 审批产品。

建议预留未连接、待同步、同步成功、同步失败重试状态；不要因同步失败要求重复评分和重新作出同一决定。

## 10. 视觉方向：Google Workspace

### 10.1 已确认偏好

用户明确更喜欢 Google Workspace，不喜欢此前展示的 Attio 和 Linear。不要再次以后二者作为主方向，也不再要求用户做三种风格选择。

设计目标是高质量、国际化、易理解的招聘 SaaS 工作体验。借鉴 Google Workspace 的视觉与交互原则，形成统一 HireOS 品牌；不是复制 Google 商标、Logo 或完整界面。

### 10.2 建议视觉规范

- 明亮浅色主题，白色内容区，柔和背景，深色高可读文字。
- 蓝色作为主要操作强调色，圆角适中，边界与阴影克制。
- 字号与间距舒适，避免为塞入信息而过度压缩。
- Gmail 参考：列表、筛选、详情、批量操作与明确状态。
- Calendar 参考：轮次排期、日期时间、邀请与时区。
- Docs 参考：Brief / Debrief 阅读、评论与协作。
- Meet 参考：熟悉的会议控制与参与者表达。
- 状态必须有文字/图标，不只靠红绿颜色。
- AI 建议贴近相关任务，保留独立来源，不依赖全屏聊天完成所有操作。
- 主要操作清晰，细节按需展开，不在首页堆满无实际用途的仪表盘图表。

## 11. 设备、语言与响应式

已确认：桌面 Web，优先笔记本，其次移动端；英文为默认与首选语言。

建议验证尺寸：1440 × 900 主设计，1366 × 768 紧凑笔记本验证。大屏可扩展，但不能依赖超宽显示器才能使用。

移动端为次优先：可先支持列表、阅读、确认与跟进；完整视频面试工作台可后续优化，不把桌面多列简单缩小。

所有产品内标题、按钮、样例资料、空状态和错误提示使用自然英文。设计说明文档可中文。日期时间采用清楚的英文格式并显示必要时区，避免含糊日期。

## 12. 首版页面清单与核心操作

以下为原型执行建议，页面可合并为标签或抽屉，但关键行为必须可达。

| 页面 | 核心内容 / 可点击行为 |
|---|---|
| Interview Home | 项目列表、状态、搜索筛选、新建、待我确认 |
| Create / Import | 三种导入方式、JD-only 路径、结果预览、继续 |
| Project Overview | 岗位、可选候选人、来源材料、轮次、下一步 |
| Requirements & Rubric | 能力、等级、权重、底线、AI 草稿编辑与确认 |
| Interview Plan | 全部规划/逐轮规划、轮次新增、目标与面试官 |
| Schedule | 时间、时区、参与者、会议方式、改期与确认 |
| Interview Brief | 岗位要求、已有证据、未知、建议重点 |
| Live Interview | 模拟会议、问题切换、笔记、转写和建议 |
| Interview Review | 原始回答、Evidence、AI 草稿与人工 Scorecard |
| Cross-round Evaluation / Debrief | 总分、单项、覆盖、分歧、反证、底线与缺口 |
| Decision & Next Steps | 按阶段显示操作、双方确认、例外处理 |
| Hiring Evaluation Package | 结论、版本、证据摘要、双方确认、预览与导出 |
| Import Connections | 文件夹/邮件来源连接与规则的演示设置，可作为抽屉 |

## 13. 可点击演示场景与样例数据

设计者自行创建虚构、相互一致的英文数据，无需用户额外提供真实候选人个人信息。

建议使用同一岗位，例如 Senior Backend Engineer，两轮面试、HR 与 Hiring Manager 两个演示角色。示例能力、分值和底线仅为演示，不宣称行业标准。

### 13.1 主流程

```text
Home
→ Create with JD only
→ Review AI-generated requirements and rubric
→ Plan rounds
→ Schedule
→ Brief
→ Live Interview
→ Review answers and evidence
→ Submit scorecard
→ Continue to next round
→ Cross-round Debrief
→ Final conclusion
→ HR confirmation
→ Hiring Manager confirmation
→ Preview / Export Hiring Evaluation Package
```

建议提供角色切换以演示两个确认动作，不需真实账号系统。

### 13.2 必须覆盖的分支

1. 文件夹与邮件各有可点击的导入预览，并汇入同一项目创建流程。
2. 缺少简历/测评资料仍能继续，界面显示 Unknown 或未提供。
3. 完整规划与逐轮规划可演示。
4. 点击单项分数能到 Rubric、证据、原回答。
5. AI 与人工意见不一致时保留双方意见。
6. 必备能力证据不足，选择补充验证。
7. 明确底线未满足，HR 与 Hiring Manager 双方批准例外。
8. 最终结论等待另一方确认，双方确认后生成包。
9. Hold 和 Do not proceed 有明确结果，不是无效按钮。
10. 有录制与手工记录两种状态；会议和采集为模拟时清楚说明。
11. 若展示 Offer 集成，包含未连接/失败可重试，且不冒充真实 Offer 批准。

## 14. 完成标准

- 使用统一 Google Workspace 风格和英文界面。
- 笔记本分辨率下关键文字可读、主要操作可见，无无意横向溢出。
- 核心流程完整可点击，按钮有合理结果，返回和取消路径可用。
- 同一个项目在各页使用一致的岗位、候选人、轮次、证据、分数和决定。
- JD-only 路径不被可选输入阻塞。
- 双方确认、例外、Unknown、总分与单项分数语义准确。
- 保存、导入中、空状态、错误、等待确认等状态有清楚反馈。
- 表单有标签，键盘焦点可见，状态不单靠颜色表达。
- 真实连接与演示行为区分明确；不需要调用真实邮件、发送真实邀请、录制真实人员或批准真实 Offer。
- 交付可打开的原型及简短演示路径，说明哪些集成是模拟的。

## 15. 设计者需要补齐的材料

无需让用户从头写这些文档。根据本文与原 PRD，由设计者补齐并直接用于制作：

1. UX / IA：导航、页面结构、角色路径。
2. Screen Specifications：逐页组件、操作、状态与交互。
3. Evaluation Sample：能力、1–5 分标准、权重、底线、证据链。
4. Prototype Scenarios：虚构英文演示数据与主/分支流程。
5. Visual Components：统一色彩、排版、按钮、列表、评分和证据组件。

技术接入细节不作为高保真原型开始的前置条件。遇到日常设计选择可采用合理默认；不要重新询问已经明确的用户偏好。

## 16. 会议接入：已核查背景与待验证项

以下官方资料已在前序讨论中查阅；技术实现前应再次核实当时最新能力与适用条件。

- [Google Meet REST API overview](https://developers.google.com/workspace/meet/api/guides/overview)：会议管理、参与者及已生成的录制/转写访问；不等于完整会议 UI 嵌入。
- [Google Meet Add-ons SDK](https://developers.google.com/workspace/meet/add-ons/guides/overview)：将应用带入 Meet 的扩展形态，不能直接推导为把 Meet 嵌入 HireOS。
- [Google Meet Media API get started](https://developers.google.com/workspace/meet/media-api/guides/get-started)：此前查阅时有开发者预览接入条件，实时媒体能力需另行验证。
- [Zoom Meeting SDK for Web](https://developers.zoom.us/docs/meeting-sdk/web/)：支持网页会议嵌入；实时媒体/AI 记录需求另行涉及 RTMS。
- Google Meet REST API 文档还列有关于域内绩效追踪/用户评价的使用限制说明；招聘评估的适用范围需要确认，不把可用 API 视为已经获准的业务用途。

Google Meet 为用户偏好，Zoom 为可考虑的备选；尚未选定最终生产接入方案。原型可以先表现统一会议工作台与模拟状态。

## 17. 可直接用于新对话的启动请求

> 请依据这份 HireOS Command Interview Prototype Design Brief，制作英文、笔记本优先、Google Workspace 风格的完整可点击雇主端高保真原型。本文已确认决策优先于旧 PRD 和 Interface Spec，尤其是 JD-only 独立启动、三种输入方式、两种轮次规划方式，以及 HR 与 Hiring Manager 双方确认最终结论和例外。请自行补齐页面交互、组件和一致的虚构演示数据，覆盖创建、面试、证据评分、跨轮评审、双方确认和评估包完整流程。会议、邮件、文件夹和 Offer 可先模拟并清楚说明，不需要真实外部操作。不要再推荐 Attio/Linear 风格或重复询问已经确认的需求。

## 18. 附件索引

- [Interview PRD v1.1](HireOS_Command_Interview_PRD_v1.1.md)：原产品功能与范围背景。
- [Interview Interface Spec v1.0](HireOS_Command_Interview_Interface_Spec_v1.0.md)：对象、证据、包与交接背景；独立输入与确认规则按本文覆盖。
- [Interview 核心功能信息图](output/interview-infographic/HireOS_Command_Interview_Core_Features_v1.1.png)：早期功能概览，不能取代本文最新决策。

若新对话无法访问这些相对链接，单独上传对应文件即可。本文已包含开始设计所需的核心上下文。
