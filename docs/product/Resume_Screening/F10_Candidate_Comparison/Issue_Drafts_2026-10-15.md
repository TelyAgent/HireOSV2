# F10 线上测试问题：GitHub Issue 草稿（待人工确认）

依据：[2026-10-15 测试报告](Test_Report_2026-10-15.md)。本文件保存**人工确认前的草稿正文**。用户已确认并于 2026-10-15 创建 7 个 GitHub Issue；提交版本中 #205、#206、#208、#209 的 `AI Ready` 为 `Yes`，#207、#210、#211 因 #21/#24 权限与身份契约未决而保持 `No`、加 `needs-triage` 并留 `[AI-QUESTION]`。下方原稿中的 `AI Ready=No` 为确认前状态，GitHub Issue 正文是提交后的权威版本。所有 Issue 的 Owner 为 `@JsonSuCoder`。报告及 F10 的部分规格仍是工作区未提交文件，GitHub 上的文件路径在入库前不可点击。

| 草稿 | 已创建 Issue | 提交时 AI Ready |
|---|---|---|
| 1 | [#205](https://github.com/TelyAgent/HireOSV2/issues/205) | Yes |
| 2 | [#206](https://github.com/TelyAgent/HireOSV2/issues/206) | Yes |
| 3 | [#207](https://github.com/TelyAgent/HireOSV2/issues/207) | No |
| 4 | [#208](https://github.com/TelyAgent/HireOSV2/issues/208) | Yes |
| 5 | [#209](https://github.com/TelyAgent/HireOSV2/issues/209) | Yes |
| 6 | [#210](https://github.com/TelyAgent/HireOSV2/issues/210) | No |
| 7 | [#211](https://github.com/TelyAgent/HireOSV2/issues/211) | No |

## 覆盖与去重

| 草稿 | 问题 | 测试依据 | 与现有 Issue 的关系 |
|---|---|---|---|
| 1 | 对比页缺逐人下一步 | UX-F10-01 / E-09 | F11 为下游，未找到覆盖 F10 提案入口的未关闭 Issue |
| 2 | v2 历轮变化误称首个快照 | UX-F10-02 / E-07 | [#27](https://github.com/TelyAgent/HireOSV2/issues/27) 已关闭，解决的是源数据变化后陈旧提示，不覆盖此文案错误 |
| 3 | 证据下钻仅有理由 | UX-F10-03 / E-02、E-05 | [#21](https://github.com/TelyAgent/HireOSV2/issues/21) 处理受限内容权限；本草稿处理授权用户的证据链完整性 |
| 4 | 中文页面残留英文 | UX-F10-04 / E-10 | [#26](https://github.com/TelyAgent/HireOSV2/issues/26) 已关闭，此为线上仍可复现的对比页残留，应作为回归关联原 Issue |
| 5 | 成员选择和面包屑缺失 | UX-F10-05 / E-01、E-02 | 尚无 F10 专项 Issue；筛选保留仍需专门数据复测 |
| 6 | 对比页缺协作批注 | E-09、UC-F10-07 的页面缺口 | HM 写入与 DB 保留未测；已确认页面没有批注入口 |
| 7 | F10 验收数据与跨层证据缺口 | 报告中 6 条未验证、7 条部分验证 | 不把未验证项写成产品 Bug；[#21](https://github.com/TelyAgent/HireOSV2/issues/21) 和 [#25](https://github.com/TelyAgent/HireOSV2/issues/25) 的已有范围不重复实现 |

---

## 草稿 1 — [Feature] F10 对比页支持逐人下一步提案与提交前清单

### Type

Feature

### Subsystem

hireos-screening

### Problem

线上对比页在矩阵后结束，没有逐人下一步动作，也没有进入 F11 的提案交接。Recruiter 可比较候选人，但不能从对比结果为各人选择笔试、面试、补资料、暂缓或不推进。测试报告 E-09、UX-F10-01；UC-F10-11 失败，PRD AC-3 的操作入口失败，AC-4 因入口缺失未能验证。页面没有发送通知的事实证据，不据此声称已经通知或没有通知。

### User Outcome

招聘人员在同一份对比中为每名成员选择下一步，提交前核对精确名单、动作、路由、未满足条件与所需批准；提交后得到可在 F11 复核的逐人提案，不会因生成对比或提案而通知候选人。

### Scope

- 在 F10 展示逐人下一步选择和可选批量设定后逐人调整。
- 提交前展示精确名单、动作、路由、前置条件和审批要求。
- 将提案关联到对比快照并交给 F11；处理必需笔试的跳过例外和过期/受限快照阻止提交。
- 为不同动作、重复提交、过期、权限和通知零发送补自动测试与可核验记录。

### Non-goals

- 不在 F10 完成 F11 的人工决定、审批或实际交接。
- 不改变 AI 评分或对比矩阵。
- 不直接发送候选人邮件或邀请。

### Acceptance Criteria

- AC-1: 给同岗位三名已关联候选人分别选择面试、笔试、暂缓时，提交前清单逐人显示姓名/稳定 ID、动作、接收路由、待满足条件和所需批准；修改其中一人的动作后清单同步，其他人不变。前端交互测试和浏览器验证覆盖。
- AC-2: 提交三人提案后，服务端恰好保存三条分别绑定当前 ComparisonSnapshot 的提案；重新打开页面可读取，重复点击/重试不产生重复提案。API/DB 测试覆盖。
- AC-3: 若岗位明确要求笔试却为成员选择直接面试，提交前显示有效例外要求；无例外时不能形成可执行推进。optional/not_required 时不虚造笔试结果。流程与服务端测试覆盖。
- AC-4: 快照过期、证据权限撤销或成员不再可见时，提交返回明确阻止结果并提示刷新/复核；只隐藏按钮不足以通过。API 测试覆盖。
- AC-5: 创建对比、导出和提交提案后，候选人通知 mock 均无新消息；提案与实际决定在 UI/数据中保持不同状态。集成测试覆盖。

### References

- `docs/product/Resume_Screening/F10_Candidate_Comparison/PRD.md` FR-14、AC-3/4/8
- `docs/product/Resume_Screening/F10_Candidate_Comparison/User_Journey.md` 步骤 11
- `docs/product/Resume_Screening/F10_Candidate_Comparison/Test_Report_2026-10-15.md` E-09、UX-F10-01
- `docs/product/Resume_Screening/F11_Human_Decision/PRD.md`

### Dependencies

F11 接收提案的契约需要与本 Issue 同步确认；当前无已知阻塞 Issue。Refs #20（必需例外/审批风险），不将其作为本功能已完成的证据。

### Risk

high

### Owner

@JsonSuCoder

### AI Ready

No

### User Flows

目标平台：桌面 Web。Recruiter 从岗位工作台进入 F10 → 对比三人 → 批量/逐人选择动作 → 查看精确清单 → 提交提案 → F11 复核。异常：必需笔试缺例外、快照过期、权限撤销、重复点击及提交失败，均需明确阻止或恢复路径。

---

## 草稿 2 — [Bug] F10 v2 的历轮变化错误显示为首个快照

### Type

Bug

### Subsystem

hireos-screening

### Problem

线上同一对比先创建 v1、刷新成 v2，快照选择器同时列出两版；选中 v2 的“自上轮以来的变化”仍显示“这是该对比集合的第一个快照”。用户无法区分“首次快照”和“有前版但没有变化”。报告 E-07、UX-F10-02，UC-F10-05 失败。此问题不同于 #27 已处理的源评估变更后的 stale 提示。

### User Outcome

用户在 v2 及后续版本看到与实际快照历史一致的变化说明；没有变化时清楚看到“与上一版相比无变化”，有变化时能看到变化原因并切回旧版。

### Scope

- 修正历轮变化按**当前选中快照**及其前版计算与展示，不把空变化数组等同于首版。
- 确保 v1/v2 切换后摘要、矩阵和变化说明对应被选中的版本。
- 覆盖相同输入刷新、源评估变化刷新和历史版本切换的自动测试。

### Non-goals

- 不改变对比评分算法或源评估内容。
- 不以此次问题推断 #27 的陈旧检测已经回归。

### Acceptance Criteria

- AC-1: 仅有 v1 时，历轮变化显示首版说明；创建 v2 且输入未变时，v2 明确显示“与上一版相比无变化”，不再声称是首版。页面测试覆盖。
- AC-2: 源评估有可追溯变化后刷新为 v3，v3 显示变化的成员、维度和原因；切回 v2 时显示 v2 当时内容，不沿用 v3。快照/API 与浏览器测试覆盖。
- AC-3: 刷新后旧快照仍可选择，旧数据和证据引用不被新快照覆盖；版本号、生成时间及新鲜度准确。持久化测试覆盖。

### References

- `docs/product/Resume_Screening/F10_Candidate_Comparison/PRD.md` FR-6/10/11、AC-5/10
- `docs/product/Resume_Screening/F10_Candidate_Comparison/Test_Report_2026-10-15.md` E-07、UX-F10-02
- `hireos-screening/hireos-screening-front/src/pages/ComparePage.tsx` 的 `RoundChanges`
- [#27](https://github.com/TelyAgent/HireOSV2/issues/27)（历史相关问题，已关闭）

### Dependencies

None；Refs #27。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

No

### Reproduction

1. 在已关联两名虚构候选人的岗位创建对比 v1。
2. 不修改源评估，点击“刷新”生成 v2。
3. 确认选择器有 v1、v2；选 v2，打开“自上轮以来的变化”。本次线上复现 1/1，见报告 E-07。

### Expected / Actual

Expected：v2 显示与 v1 相比无变化，或列出真实变化；仅 v1 可称首版。Actual：v2 仍显示“这是该对比集合的第一个快照”。

### Environment

2026-10-15，Chrome，`https://hireos.aipollo.me/hireos/screening/comparisons/7dbbd281-82a1-4d0f-94e8-1b5332ca3300`；线上构建号、浏览器版本和 OS 未读取。当前仓库 HEAD `c0e47a6` 仅为静态参考，不是线上版本。

### Severity

S2

---

## 草稿 3 — [Bug] F10 对比分数下钻缺少材料证据与版本位置

### Type

Bug

### Subsystem

hireos-screening

### Problem

线上主要差异提示“请先查看关联证据”，但差异条目不能直接下钻；点击矩阵 Skills 分数后，弹层写“需求条件 → 评分标准 → 理由 → 证据 → 原文摘录”，实际只显示理由段落。招聘人员无法追溯分数到岗位要求、材料版本和位置。报告 E-02、E-05、UX-F10-03。没有证明后端原始证据丢失，当前缺口限于用户可见的对比路径。

### User Outcome

用户可以从每条关键差异和矩阵单元格找到授权范围内的岗位要求、评分依据、支持/反证、材料版本及位置；缺证据时看到明确的缺口说明。

### Scope

- 关键差异关联相应维度与成员单元格。
- 单元格下钻显示评分标准、理由、证据引用、材料版本/位置与可比性限制。
- 受限或撤回证据按当前权限隐藏内容，保留必要的受限/不可用状态说明。
- 为有证据、无证据、受限证据和历史快照补测试。

### Non-goals

- 不修改源简历或重新评分。
- 不在本 Issue 重新定义角色权限矩阵；权限实现仍由 #21 负责。

### Acceptance Criteria

- AC-1: 用包含至少一条可引用原文的评估创建对比，点击关键差异可到对应成员/维度，单元格显示岗位要求、评分标准、理由、证据材料版本与位置；引用指向可访问的原始材料。浏览器/API 测试覆盖。
- AC-2: 某维度缺原始证据时，页面明确标“无可引用证据”及评估限制，不用无来源理由假装完整证据链。页面测试覆盖。
- AC-3: 无权查看或证据被撤回后，UI 与 API 均不暴露受限原文及定位等敏感信息；有权角色仍可按授权查看。角色/API 测试覆盖，并与 #21 权限边界一致。
- AC-4: 查看旧快照时引用绑定该快照的材料版本；源材料更新后不静默指向新版本。持久化测试覆盖。

### References

- `docs/product/Resume_Screening/F10_Candidate_Comparison/PRD.md` FR-5/8、AC-1/8
- `docs/product/Resume_Screening/F10_Candidate_Comparison/Test_Report_2026-10-15.md` E-02/E-05、UX-F10-03
- `hireos-screening/hireos-screening-front/src/pages/ComparePage.tsx` 的 `KeyDifferences`、`MatrixEvidenceDrawer`
- [#21](https://github.com/TelyAgent/HireOSV2/issues/21)（受限内容权限）

### Dependencies

Refs #21；受限字段的最终服务端裁剪契约以 #21 的人工决策为准，未授权内容不得在本 Issue 中绕过。

### Risk

high

### Owner

@JsonSuCoder

### AI Ready

No

### Reproduction

1. 打开报告中的线上双人对比，阅读“主要差异”中查看关联证据的提示。
2. 点击 Skills 行任一分数。
3. 检查弹层字段。线上复现 1/1，报告 E-05。

### Expected / Actual

Expected：能查看要求、标准、证据及材料版本/位置，或明确得知缺证据。Actual：弹层虽宣称完整链条，却只显示理由段落。

### Environment

2026-10-15，Chrome，报告中的 F10 对比 URL；线上构建号、浏览器版本和 OS 未读取。当前仓库 HEAD `c0e47a6` 不是线上版本。

### Severity

S2

---

## 草稿 4 — [Bug] F10 中文对比页仍显示英文维度和快照文案

### Type

Bug

### Subsystem

hireos-screening

### Problem

线上对比页切回中文后，矩阵维度及差异摘要仍含 `Skills`、`Relevant Experience`、`Seniority`、`Compensation & Location Fit`，快照说明显示英文 `Generated from the current screening evaluation baseline.`，副标题含 `Shortlist review`。报告 E-10、UX-F10-04，UC-F10-16 失败。已关闭的 #26 曾声称补齐对比页翻译，因此这是需关联 #26 复核的剩余/回归问题，不把 #26 的历史验收重新写成未完成。

### User Outcome

中文界面的 F10 系统文案全部为中文，英文界面对应文案为英文；候选人姓名和用户输入保持原样，不被误翻译。

### Scope

- 覆盖对比页矩阵维度、AI/规则生成的差异摘要模板、快照 note、副标题和弹层/导出提示的语言呈现。
- 检查历史快照与新快照在两种语言下的渲染。
- 为动态文本及语言切换补自动化检查，避免仅静态字面量扫描通过。

### Non-goals

- 不翻译候选人姓名、岗位名称中用户输入的原文或材料原文。
- 不改评分、快照版本或导出内容权限。

### Acceptance Criteria

- AC-1: 在中文界面打开现有 F10 快照，所有系统提供的维度、差异模板、快照 note、状态和操作提示都显示中文；用户输入内容原样保留。浏览器快照/文案测试覆盖。
- AC-2: 切换为英文后相同系统文案显示英文，再切回中文无残留；无需重新生成快照。浏览器测试覆盖。
- AC-3: 用历史快照和新建快照分别检查动态后端文本，不出现未翻译的 baseline note 或内部枚举；缺少翻译的模板在自动检查中失败。自动测试覆盖。

### References

- `docs/product/Resume_Screening/F10_Candidate_Comparison/PRD.md` 非功能要求、UC-F10-16
- `docs/product/Resume_Screening/F10_Candidate_Comparison/Test_Report_2026-10-15.md` E-10、UX-F10-04
- [#26](https://github.com/TelyAgent/HireOSV2/issues/26) 和 [PR #44](https://github.com/TelyAgent/HireOSV2/pull/44)（历史修复）

### Dependencies

None；Refs #26。

### Risk

low

### Owner

@JsonSuCoder

### AI Ready

No

### Reproduction

1. 打开报告中的线上对比页。
2. 点击 `EN / 中` 切到英文，再点击 `中 / EN` 切回中文。
3. 查看矩阵、主要差异和 v2 的历轮变化。线上复现 1/1，报告 E-10。

### Expected / Actual

Expected：系统文案随语言切换。Actual：中文界面仍显示上述英文维度、差异词和快照 note。

### Environment

2026-10-15，Chrome，报告中的 F10 对比 URL；线上构建号、浏览器版本和 OS 未读取。当前仓库 HEAD `c0e47a6` 不是线上版本。

### Severity

S3

---

## 草稿 5 — [Feature] F10 从勾选成员进入对比并保留岗位上下文

### Type

Feature

### Subsystem

hireos-screening

### Problem

F10 PRD FR-1 要求在岗位工作台勾选成员后进入对比，并保留筛选条件和 Jobs › 岗位 › Compare 面包屑。线上所测岗位只有一个“候选人对比”按钮，点击会直接把全部 2 名已关联候选人放入对比；对比页仅有“返回”按钮，没有指定面包屑。报告 E-01/E-02、UX-F10-05。因本次未使用有多于两名已关联候选人的岗位，筛选保留与选择子集的具体故障仍需复测。

### User Outcome

招聘人员能明确选择本次要比较的成员，进入对比后清楚知道所属岗位；返回工作台时保留先前筛选与位置。

### Scope

- 工作台支持勾选同岗位已关联候选人后创建对比，至少两人方可提交。
- 对比页显示岗位层级与可用面包屑，明确当前成员名单。
- 从有筛选条件的工作台进入并返回时保留筛选与列表状态。
- 覆盖勾选 2/3/更多人、未关联候选人及返回行为。

### Non-goals

- 不允许跨岗位或未关联候选人进入对比。
- 不改添加成员 API 的现有同岗位校验。
- 不重新设计全站导航。

### Acceptance Criteria

- AC-1: 同一岗位至少有 3 名已关联候选人时，只勾选其中 2 名创建对比，成员恰为所选 2 人；未勾选或只勾 1 人时有明确阻止提示。页面/API 测试覆盖。
- AC-2: 对比页显示 Jobs › 当前岗位 › Compare 路径、岗位和当前成员名单；从面包屑可回到对应岗位。浏览器测试覆盖。
- AC-3: 从设置筛选条件的工作台进入对比再返回，原筛选值与可见结果仍在；不会自动扩大为全部已关联人。浏览器测试覆盖。
- AC-4: 直接提交跨岗位或未关联 application ID 创建/加人时，服务端返回 4xx，不生成成员。API 测试覆盖。

### References

- `docs/product/Resume_Screening/F10_Candidate_Comparison/PRD.md` FR-1/2/12、AC-9
- `docs/product/Resume_Screening/F10_Candidate_Comparison/User_Journey.md` 步骤 1、6
- `docs/product/Resume_Screening/F10_Candidate_Comparison/Test_Report_2026-10-15.md` E-01/E-02、UX-F10-05
- `hireos-screening/hireos-screening-front/src/pages/ScreeningWorkspacePage.tsx`、`ComparePage.tsx`

### Dependencies

None。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

No

### User Flows

目标平台：桌面 Web。筛选岗位工作台 → 设置过滤条件 → 勾选 2/3 人 → 创建对比 → 查看成员与面包屑 → 返回并保持筛选。异常：成员不足、跨岗位、未关联、已失效成员均阻止并给出原因。

---

## 草稿 6 — [Feature] F10 支持 Hiring Manager 对快照证据添加协作批注

### Type

Feature

### Subsystem

hireos-screening

### Problem

F10 PRD FR-9、Journey 步骤 7 和 UC-F10-07 要求 HM 在对比快照中添加带作者与时间的批注，且不覆盖 AI 原文。线上 Recruiter 对比页没有批注入口，当前 `ComparePage` 也未渲染批注列表。由于没有 HM 独立会话，报告将整条 UC-F10-07 标为未验证；本 Issue 的可见事实仅是当前页面缺入口，不声称 HM 线上 API 已失败。

### User Outcome

Hiring Manager 在有权访问的岗位对比上留下可追溯批注，Recruiter 可以区分人工意见与 AI 原评价；无权角色无法写入。

### Scope

- 对比页展示批注列表与新增入口，批注指向快照、成员或单元格。
- 记录作者、时间、正文及修订历史，人工批注与 AI 内容分离。
- 按角色和岗位权限控制读取/写入，处理重复提交与旧快照批注。

### Non-goals

- 不改 AI 原文或重新生成差异摘要。
- 不把批注直接变成下一步决定或候选人通知。
- 不在本 Issue 重定角色权限矩阵；与 #21、#24 已有权限/身份工作协同。

### Acceptance Criteria

- AC-1: 有权 HM 在指定快照单元格新增一条批注后，刷新页面仍能看到正文、作者、时间、快照版本与目标位置；AI 原评价前后完全相同。UI/API/DB 测试覆盖。
- AC-2: 编辑批注保留旧正文、修改者和时间的修订历史；双击/重试不生成重复批注。持久化测试覆盖。
- AC-3: Viewer、HR Approver 等无批注权限角色看不到新增入口，直接调用写入 API 返回 403；不同岗位的非授权 HM 也不能写入。角色/API 测试覆盖。
- AC-4: 对旧快照查看批注时仍能识别其对应版本；批注不会触发候选人通知或改变评估结果。集成测试覆盖。

### References

- `docs/product/Resume_Screening/F10_Candidate_Comparison/PRD.md` FR-9、AC-8
- `docs/product/Resume_Screening/F10_Candidate_Comparison/User_Journey.md` 步骤 7
- `docs/product/Resume_Screening/F10_Candidate_Comparison/Test_Report_2026-10-15.md` E-09、UC-F10-07
- `docs/product/Resume_Screening/README.md` 角色矩阵

### Dependencies

Refs #21、#24；岗位范围和角色校验须沿用最终权限/身份契约，若未定则实现阶段先记录 [AI-QUESTION]。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

No

### User Flows

目标平台：桌面 Web。HM 打开负责岗位的对比 → 下钻证据 → 添加批注 → Recruiter 看到人工意见但 AI 内容不变。异常：无权限、重复点击、旧快照和提交失败均有明确反馈，不通知候选人。

---

## 草稿 7 — [Tech Debt] 建立 F10 隔离验收数据与跨层测试证据

### Type

Tech Debt

### Subsystem

hireos-screening

### Problem

2026-10-15 线上测试的 16 条 F10 用例中，6 条未验证、7 条仅部分验证。缺三人/混合阶段/混合币种/12 人 seed、Recruiter/HM/Approver/Viewer 独立会话、可控 `llm_fail`/撤权注入、API/DB/审计/通知 mock 与导出产物核验方式。导出界面提示“已导出”，当前代码路径返回 queued job，但本次没有线上原始响应或文件，不能据此认定线上假成功。缺证据的权限与通知项也不能被当作已发生 Bug。

### User Outcome

每条 F10 用例可在隔离环境独立复现，功能、安全与导出断言有可脱敏的 UI、API、DB、审计和外部结果；验收报告能准确判定通过、失败或阻塞。

### Scope

- 建立 F10 文档定义的 S_linked/S_compare 及混合阶段、薪资、12 人数据，保证可重置且仅使用虚构信息。
- 提供四类隔离测试身份与岗位范围；验证 UI 和直接 API 的权限边界。
- 提供模型失败、源评估更新、撤权、并发/重复操作注入点与通知 mock。
- 建立导出 job 从 queued 到终态及 PNG/PDF 内容检验，并采集审计/持久化结果。
- 将 16 条 UC、10 条 AC 的证据链接与实际结果写入复测报告；不把未执行项记为通过。

### Non-goals

- 不在本 Issue 修复 F10 产品缺陷或变更权限规则。
- 不在公开仓库提交生产数据、候选人个人信息或凭据。
- 不部署或操作生产服务器。

### Acceptance Criteria

- AC-1: 所有 F10 seed 可由受控命令创建、重置并独立运行，包含三人比较、同/异阶段、缺失及不可比薪资、12 人导出和不同岗位/未关联成员。自动化检查证明 seed 数量与关联关系。
- AC-2: Recruiter、HM、Approver、Viewer 四种身份可在隔离环境复现 UC-F10-07/12/14/15；每项同时记录 UI 与直接 API 结果，受限内容在无权响应中不可见。角色/API 检查覆盖。
- AC-3: `llm_fail`、源评估更新、撤权、重复/并发操作、通知 mock 和审计记录均可观测；每个注入点至少有一条 F10 用例实际执行记录。集成测试覆盖。
- AC-4: PNG/PDF 导出可追踪 queued、完成或失败终态，能读取产物并自动核查成员数、限制说明、联系方式/受限证据排除和 12 人分页/子集行为。导出测试覆盖。
- AC-5: 复测报告逐一映射 16 条 UC 与 AC-1～AC-10，记录命令、环境、构建号、证据及未通过原因；未执行项明确标为未验证。

### References

- `docs/product/Resume_Screening/F10_Candidate_Comparison/User_Cases.md`
- `docs/product/Resume_Screening/F10_Candidate_Comparison/Loop_IO.md`
- `docs/product/Resume_Screening/F10_Candidate_Comparison/Test_Report_2026-10-15.md`
- [#21](https://github.com/TelyAgent/HireOSV2/issues/21)（受限权限）、[#25](https://github.com/TelyAgent/HireOSV2/issues/25)（无障碍）

### Dependencies

Refs #21、#24、#25；四类测试身份及受限字段规则应采用已确认的权限契约。无生产数据依赖。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

No

### Technical Evidence

测试报告统计：0 通过、7 部分、3 失败、6 未验证。UC-F10-02 要求同输入至少两次；UC-F10-04 要求一人已测一人未测；UC-F10-10 要求 12 人导出；UC-F10-12/14/15 要求撤权与不同角色；UC-F10-13 要求模型失败注入。本次均无完整线上证据。当前后端 `comparisons.service.ts` 导出方法返回 queued processing job，线上仅观察到成功 toast。

### Compatibility / Rollback

测试夹具与生产数据隔离；不更改既有业务表结构或线上权限。测试数据可重置，任何临时注入通过测试配置关闭；若需增加测试接口，默认只在非生产环境暴露并有自动校验。

---

## 请人工确认的假设与不确定点

1. **Issue 拆分**：拟创建 7 个 Issue（3 Feature、3 Bug、1 Tech Debt），分别处理 6 个可见产品问题和 1 个验收能力缺口；未验证的权限/通知/导出内容不单独报 Bug。
2. **下一步边界**：按 F10 文档将 F10 定义为“逐人提案”，F11 负责正式决定、审批和执行。草稿 1 不让 F10 直接推进候选人。
3. **角色边界**：草稿 3/6 的受限证据和 HM 批注权限须遵循 #21/#24 的最终决定；本草稿不替用户确定 Admin 等未决权限。
4. **旧 Issue 关系**：#26/#27 已关闭；草稿 2/4 作为不同症状的新 Issue，并在 Dependencies 写 `Refs`，不重开历史 Issue。
5. **资料可引用性**：本地测试报告与 F10 的部分规格尚未进入 GitHub main。若保持现状，Issue 中的仓库路径可以供本地查看，但 GitHub 上的文件链接在文档入库前不可点击。
6. **严重度**：草稿 2/3 为 S2，草稿 4 为 S3；Feature 与 Tech Debt 模板没有 Severity 字段。用户可调整优先级和 AC。
