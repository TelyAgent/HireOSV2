# I08 面后评审与 Scorecard：线上测试报告

测试日期：2026-10-15（Asia/Shanghai）  
结论：**不通过完整验收**。本轮线上验证了 Review 的轮次门槛、已完成/未完成轮次页面、无转写时 AI 起草失败提示，以及空理由评分的前端控件状态。11 条用例中没有一条取得完整的 UI、API、持久化和角色证据，因此不把局部观察计为整条用例通过。文档已列出的整体提交、修订版本、跨面试官隔离和首页计数仍是验收缺口。

## 1. 范围与方法

| 项 | 本轮事实 |
|---|---|
| 规格 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[User Cases](User_Cases.md)；UX 方法采用 [JD Management UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的通用角色、旅程、证据、应用性和分级规则。该标准原本适用于 JD Management，JD 专属审批/发布字段不直接套用到 I08。 |
| 线上环境 | [HireOS Interview](https://hireos.aipollo.me/hireos/interview/)；Chrome 桌面浏览器，现有登录会话。未取得线上构建号、独立 Interviewer/HM 账号、只读 API/DB/审计访问或 I08 专用 seed。 |
| 测试对象 | [项目 A：一轮已完成、一轮未完成](https://hireos.aipollo.me/hireos/interview/project/5f57f693-470d-4d27-96dd-592aafdd8db6/review)；[项目 B：零轮完成](https://hireos.aipollo.me/hireos/interview/project/af66de98-b3b9-4ff6-bf3a-72352129cf96/overview)；[项目 C：演示轮次未关联真实轮次](https://hireos.aipollo.me/hireos/interview/project/1cbc3fb1-48f8-4a2b-ae68-27ebcc1af804/review)。报告只用项目代号与链接，不复制候选人资料。 |
| 线上操作 | 查看页面与轮次、点击“Generate AI scores”和“Generate summary”以验证无转写错误；在一个评分项临时选择 4 分，观察空理由时保存按钮状态，立即点击 Discard。没有保存人工分、推荐或提交 Scorecard；没有创建/删除项目或修改候选人资料。 |
| 证据层级 | Chrome 页面可访问树、可见控件及页面截图的即时观察；项目链接可供人工复核。没有保存线上截图文件；没有 API 原始响应或数据库证据。第 5 节的本地代码观察单独标注，不代表线上部署版本。 |

## 2. 逐步线上证据

| 证据 | 用户操作与预期 | 实际观察 | 结论 |
|---|---|---|---|
| E-01 | 从首页查看待提交 Scorecard | 首页“Scorecards to submit”显示 **0**。当前登录身份与项目 A 的轮次面试官不同；这个数字不能用于判断他人的待提交任务。 | 只记录基线；AC-8 未验证。 |
| E-02 | 项目 B 零完成轮次进入 Review | 稳定加载后回到 Overview；Review 导航禁用，帮助文字为“Complete at least one interview round first.” | 进入门槛在 UI 生效；与 PRD 要求的页面内完整提示文案不同，API 门槛未测。 |
| E-03 | 项目 C 打开 Review | 两个轮次可切换，但显示“No real round linked.”；没有评分卡。 | 现有演示项目不能作为 I08 的真实轮次 seed。 |
| E-04 | 项目 A 打开已完成第 1 轮 | 顶部标记轮次面试官和“submitted”日期；显示“Generate AI scores”、独立推荐选项、六张能力卡。能力卡均为 Unknown，未见 AI 草稿、证据项、原始回答或追溯抽屉；摘要显示没有转写时不自动生成。 | 可见逐项人工评分界面；“submitted”属于轮次显示，不能据此认定 Scorecard 已提交。AC-2 的非零展示仅获 UI 局部证据；AC-3～5 未验证。 |
| E-05 | 项目 A 切换未完成第 2 轮 | 显示“This round hasn't been completed yet — nothing to review”；评分卡不出现；页面说明所有轮次完成后才出现“Continue to debrief”。 | 单轮门槛与后续步骤说明可见。 |
| E-06 | 项目 A 第 1 轮点击“Generate AI scores” | 显示“No real transcript yet for this round — can't generate AI scores.”；按钮恢复可用，人工评分控件仍在。 | 无转写失败有明确提示；不是 `llm_fail` 注入，也没有两次有效转写的 AI 结果，不能判 UC-I08-04/10 通过。 |
| E-07 | 同轮点击“Generate summary” | 显示“This round has no transcript — nothing to summarize.”，未出现假摘要。 | 无转写错误可理解；未检验模型超时和重试成功。 |
| E-08 | 同轮一项能力选择 4 分，理由保持空白 | 标签从 Unknown 变为 Meets bar，“Save score”立即可点击，并显示 Unsaved changes；点击 Discard 后恢复 Unknown 和禁用的保存按钮。 | **已证实前端未阻止空理由评分准备提交**；没有点击保存，因此服务端是否接受仍以代码风险和复测为准。 |
| E-09 | 检查项目 A 评审页底部 | 只有逐项“Save score”；未见整体“Submit Scorecard”或提交后修订入口。底部说明全部轮次完成后才出现“Continue to debrief”。 | 与规格 AC-6/8 所需的整体提交闭环不符；项目 A 第二轮未完成，不能测试继续到 Debrief。 |

## 3. 11 条用例执行结果

“局部观察”只表明表格所列页面断言成立；“未验证”与“已知缺口”均不计通过。

| 用例 | 结果 | 证据与缺口 |
|---|---|---|
| UC-I08-01 人工与 AI 不同需理由 | **未验证；发现相关风险** | E-08 证明没有 AI 草稿时空理由也能启用保存；缺同一项 AI=2、人工=4 的线上 seed、实际保存响应及两分独立留存证据。 |
| UC-I08-02 Unknown 不是 0 | **局部观察** | E-04 以 Unknown 显示，没有显示 0；未取得 API `score: null` 或加权计算结果，也未检验“Unknown is not a zero”说明。 |
| UC-I08-03 已评分维度有证据 | **未验证** | E-04 全部维度为 Unknown，缺已评分且有原始回答/时间码的样本；E-08 未保存。 |
| UC-I08-04 AI 引用逐字可查 | **未验证** | E-06 因无转写被拒绝；没有同一转写两次起草、引用与原文逐字对照。 |
| UC-I08-05 手工记录的证据来源 | **未验证** | 缺 `manual_round` seed；项目 A 页面未见来源条目。 |
| UC-I08-06 提交后修订生成新版本 | **已知缺口，未执行写入** | E-09 未见整体提交或修订入口；规格已标记未实现。缺版本与审计数据。 |
| UC-I08-07 未提交时他人看不到分数 | **已知缺口，未验证安全断言** | 缺独立 Interviewer A/B 身份及 API 响应。现有工作区单一登录会话不能证明服务端隔离。 |
| UC-I08-08 提交后首页计数减 1 | **已知缺口，未验证** | E-01 基线为 0；E-09 无整体提交入口；没有同一身份提交前后计数。 |
| UC-I08-09 未完成轮次不能进入 Review | **UI 局部通过** | E-02、E-05；页面内准确文案与服务端校验未完整核验。 |
| UC-I08-10 AI 起草失败不影响人工评分 | **局部观察** | E-06 无转写错误出现后评分控件仍可操作；未注入 `llm_fail`，也未验证失败后实际保存人工分。 |
| UC-I08-11 证据追溯链 | **未验证** | E-04 未见可展开证据或追溯抽屉；缺带证据的 Scorecard 与 HM 独立身份。 |

## 4. AC 结论与 UX/UI 审查

| AC | 结论 | 依据 |
|---|---|---|
| AC-1 | 未验证，有风险 | E-08；缺 AI 草稿、差异校验及保存后的双分证据。 |
| AC-2 | 部分验证 | E-04 UI 为 Unknown；API 空值和加权排除未验证。 |
| AC-3 | 未验证 | 无已评分且附可访问原始证据的线上样本。 |
| AC-4 | 未验证 | 无转写；未完成两次 AI 引用核对。 |
| AC-5 | 未验证 | 无手工记录样本。 |
| AC-6 | 已知缺口 | E-09 无独立提交/修订入口；版本审计未验证。 |
| AC-7 | 已知缺口，安全未验证 | 无独立面试官身份与 API 证据。 |
| AC-8 | 已知缺口 | E-01/E-09；无 Scorecard 提交动作和前后计数。 |

**角色与旅程**：目标角色为第 2 轮 Interviewer，目标是核对 AI 草稿与原始证据、填写有理由的人工评分、提交本轮 Scorecard，并交给 Debrief。线上现有登录会话只能观察部分页面，无法以该角色完成这条旅程。项目 A 第 1 轮页面的任务对象与轮次状态可见，但未提供足以做出有证据评分的材料。

| 应用性十项 | 结论 | 依据 |
|---|---|---|
| U1 容易理解 | 部分通过 | 项目、轮次、能力卡、Unknown 可见；“submitted”未明确说明是轮次完成还是 Scorecard 提交，易混淆。 |
| U2 容易上手 | 部分通过 | “Generate AI scores”、1–5 分与 Unknown 入口清楚；缺证据与理由规范提示。 |
| U3 快速完成任务 | 未验证 | 缺完整评分、提交样本；不能测时长与重复操作。 |
| U4 下一步明确 | 部分通过 | 未完成轮次与 Debrief 门槛说明可见；没有本轮 Scorecard 的独立提交下一步。 |
| U5 控件清楚 | 失败 | E-08 空理由时保存按钮可用，未说明评分所需证据和理由。 |
| U6 符合真实工作方式 | 未验证 | 缺真实的面试官身份、转写与手工记录。 |
| U7 信息结构符合角色目标 | 部分通过 | 推荐与逐项评分分区；证据、来源、置信度和追溯链在本次可用样本中不可见。 |
| U8 无不必要跳转 | 未验证 | 主流程无法完成。 |
| U9 失败可恢复 | 部分通过 | E-06/E-07 有明确无转写错误，E-08 可 Discard；网络失败、模型失败、重试成功未测。 |
| U10 可访问 | 未验证 | 未执行键盘、焦点、200% 缩放与读屏检查。 |

### 发现与修复验收

| ID / 级别 | 角色、步骤与可观察证据 | 用户影响 | 最小修复方向与验收方式 |
|---|---|---|---|
| I08-UX-01 / **P1** | Interviewer，评分步骤 4；E-08 选 4 分且理由为空时，“Save score”可点击。 | 容易形成没有解释的人工判断；若服务端同样接受，将违反 BR-1。 | 前后端校验已评分维度的理由与证据引用，差异评分另给明确提示。以专用合成轮次验证空理由/缺证据拒绝、补齐后成功，并核对 API 持久化。 |
| I08-UX-02 / **P1** | Interviewer，提交步骤 6～7；E-09 只有逐项保存，无整体 Scorecard 提交与修订入口。 | 无法区分草稿、提交和修订，也无法验证计数和版本审计。 | 增加明确的整体提交状态与修订原因/版本历史；用 `[UJ-TEST]` seed 验证双击幂等、首页计数和旧版本可查。 |
| I08-UX-03 / **P1** | Interviewer，步骤 2～3；E-04 已完成轮次没有转写、AI 草稿、原始证据；E-06/E-07 生成请求被明确拒绝。 | 该样本无法完成有证据的评分，现有线上数据不足以验收核心闭环。 | 准备已完成且含转写与手工记录的合成轮次；验证 AI 引用、来源、时间码和追溯链。此项目前是**测试数据限制**，未判产品缺陷。 |
| I08-UX-04 / **P2** | Interviewer，步骤 1/6；E-04 顶部“submitted”随轮次完成时间显示，E-09 没有 Scorecard 提交动作。 | 可能误以为面试轮次完成就等于评分已提交。 | 明确标注“Interview completed”和“Scorecard draft/submitted”；分别以轮次完成、Scorecard 草稿和已提交状态检查。 |
| I08-SEC-01 / **P0 验收阻塞** | Interviewer A/B，提交前查看；缺独立账号和 API 原始响应，UC-I08-07 无法执行。 | 无法证明草稿评分不会提前泄露给其他面试官。 | 以两名独立账号和同一 Workspace 专用数据，核验 UI 与 API 均拒绝读取未提交分数，再验证提交后授权可见。当前为**未验证风险**，不是线上复现的越权结论。 |

按审查标准，存在 P1 且核心安全断言未验证，不能标记“通过”或“完成”。本轮也没有证据支持发布豁免。

## 5. 本地代码观察（不作为线上复现）

- 当前工作区 `ReviewPage.tsx` 的 `ScoreCard.save` 直接 PATCH `{score, note}`；保存按钮只按 `dirty || saving` 控制，没有理由或证据校验。`setCardScoreSchema` 仅要求 `note` 为不超过 5000 字符的字符串；`RoundsService.setScore` 直接 upsert。该代码与 E-08 的 UI 行为一致，但线上部署版本未核。
- `ReviewPage.tsx` 只实现逐项 `Save score`；`Continue to debrief` 取决于全部轮次完成。它没有独立的 Scorecard 提交、提交后修订版本 UI。顶部的 `submitted` 文案来自 `round.completedAt`，并非 Scorecard 提交状态。
- 当前后端 `RoundsService.scores/setScore` 以 `workspaceId` 查找轮次，没有按轮次面试官和提交状态过滤读取/修改。这里是代码层面的权限风险，仍需用线上独立身份与 API 复现，不把本地源码当作线上越权证据。

本次只读代码检查，没有修改业务代码，也未运行 build、lint、typecheck 或 test；这些命令不属于本轮线上 UI 验收证据。

## 6. 复测条件与顺序

1. 准备 `[UJ-TEST]` 项目、`example.com` 合成候选人、已确认 Rubric、完整转写、手工记录、已完成/未完成轮次、AI=2/人工=4 差异样本，以及 `hr_a`、`hm_a`、`interviewer_a`、第二面试官的独立账号。取得可核验的线上构建号和清理方式。
2. 按 UC-I08-01～05 执行真实保存、Unknown 空值与加权、两次 AI 起草逐字引用、原始回答/时间码与 manual notes 来源检查；记录 UI、API 和 DB/审计证据。
3. 实现并按 UC-I08-06～08 复测整体提交、双击、修订版本与原因、提交前后跨面试官 API 隔离和首页计数。
4. 以 `llm_fail`、网络失败与无转写分别检查可恢复性；补键盘、焦点、200% 缩放检查。复测后按第 7 节审查门槛重新给出结论。
