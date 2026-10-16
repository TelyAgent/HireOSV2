# W01 题库与题目版本线上测试报告（2026-10-16）

## 1. 结论与范围

**结论：不通过（fail）。** 线上题库可浏览、按现有岗位/能力/编号过滤，空结果文案正确；但版本、草稿/发布、停用和 ZIP 真正导入等 W01 核心流程没有可操作入口，详情的 Materials / Versions 缺失，Usage 把缺少外部记录显示为 `0`。按 [UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的 P0 门槛，核心任务无法完成时不能通过。本标准原适用 JD Management，本报告只复用其用户旅程、十项应用性检查、证据和严重级别方法；JD 专属字段、审批/激活检查不套用到 W01。

| 项 | 本轮记录 |
|---|---|
| 线上入口 | [Question Bank](https://hireos.aipollo.me/hireos/written/question-bank) |
| 时间/时区 | 2026-10-16 约 11:48–11:50，Asia/Shanghai |
| 角色/会话 | 页面显示登录用户「蔡敏」；账户的 W01 细粒度权限未取得 |
| 浏览器/视口 | Chrome，桌面页面约 1176×719；英文 UI |
| 规格 | 本目录 [PRD](PRD.md)、[User Cases](User_Cases.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)；上方 UX/UI 标准 v1.0 |
| 线上数据 | 加载完成后仅 `Q-0001`（设计workflow）、`Q-0002`（如何在twitter和YouTube上做增长），均显示 Published v1、单一岗位；无 FIN-001/004/009、旧邀请或 ZIP seed |
| 本地参考提交 | `c4b6105`，**不是线上构建号**；线上页面未显示构建号 |
| GitHub 对象 | 未收到关联主 Issue/PR；仓库 Issue 列表未找到 W01/题库专属 Issue。本报告是按用户指定文档开展的线上探索测试，不冒充合并后正式 QA，也不生成虚构的 `qa.json` 身份字段 |
| 数据变更 | 未创建、编辑、删除、发布、停用或邀请任何真实题目。只执行筛选、打开弹窗、空表单校验与演示解析；结束后列表仍为上述 2 条 |

本轮按页面和可访问 DOM 执行；未取得已登录 API 调试/数据库/服务端日志和候选人身份。因此 UI 观察不能证明服务端授权、保存结果、外发数据隔离或历史版本不变。未向线上注入 HTTP 500、并发或破坏性 ZIP。未执行本地 build/lint/type/unit/integration；它们不能被记为线上通过。

## 2. 测试证据索引

截图位于 [`evidence/2026-10-16/`](evidence/2026-10-16/)；文件记录实际页面状态，本文记录操作与 DOM 观察。

| 编号 | 证据 | 对应观察 |
|---|---|---|
| E01 | [题库列表](evidence/2026-10-16/01-bank.png) | 两条题目、列、筛选和主操作 |
| E02 | [空结果](evidence/2026-10-16/02-empty-filter.png) | 不存在编号返回指定文案 |
| E03 | [详情 Prompt](evidence/2026-10-16/03-detail-prompt.png) | 列表行点击进入详情；只见三 tab |
| E04 | [Rubric](evidence/2026-10-16/04-rubric.png) | Reviewer only 文案及能力占比 |
| E05 | [Usage](evidence/2026-10-16/05-usage.png) | Used in cases / Candidates 显示 0 |
| E06 | [Candidate preview](evidence/2026-10-16/06-candidate-preview.png) | 预览抽屉只呈现题干、Materials、What to submit |
| E07 | [ZIP 弹窗](evidence/2026-10-16/07-import-zip.png) | 文件选择禁用、Demo adapter |
| E08 | [演示解析](evidence/2026-10-16/08-import-demo-result.png) | 固定 Parsed toast，没有上传/分类预览 |
| E09 | [创建表单](evidence/2026-10-16/09-create-drawer.png) | 仅 Title、Role tags、Question content 与 Create question |
| E10 | [缺标题](evidence/2026-10-16/10-create-validation.png) | Enter a title first |
| E11 | [缺内容](evidence/2026-10-16/11-create-no-content.png) | Enter the question content |
| E12 | [已发布题编辑](evidence/2026-10-16/12-edit-published.png) | 只有 Save changes；未保存修改 |
| E13 | [进入详情前筛选](evidence/2026-10-16/13-filter-before-detail.png) | 岗位、能力与编号筛选同时生效 |
| E14 | [返回后筛选丢失](evidence/2026-10-16/14-filter-after-return.png) | 从详情经主导航返回列表，三个筛选回到默认 |

## 3. 14 条用例执行结果

「部分」只表示列明的子步骤经实测成立，不代表整条用例通过；「阻塞」是环境/测试数据或注入能力不足，并非自动判定产品缺陷。

| 用例 | 结果 | 操作、实际结果与证据 | 未完成条件 |
|---|---|---|---|
| UC-W01-01 列表与发布说明 | **部分/失败** | 打开题库，八个业务列及「invitations are a separate step」均可见；点击 Q-0001 行直接跳到详情，未出现要求的右侧列表预览；列表未见直接发送。E01、E03 | FR-3 的选中后右侧预览不满足。说明说的是 publishing a **case**，与题目发布概念不一致 |
| UC-W01-02 岗位/能力/编号过滤 | **部分/阻塞** | 选「高级 AI 产品经理」仅得 Q-0001；再选「Workflow设计与流程建模」仍仅 Q-0001；搜索 `Q-0001` 命中。E01、E02、E03 | 无双岗位、三能力目标数据，不能验证同一题在两个岗位出现的 AC-1；指定 FIN 数据不存在 |
| UC-W01-03 无结果 | **通过（UI）** | 搜索 `NO-SUCH-W01-20261016` 显示 `No questions match these filters.`；顶部仍有 Create question。E02 | 无 |
| UC-W01-04 五 tab / Reviewer only / Usage | **失败** | Q-0001 只有 Prompt、Rubric、Usage；Rubric 有 Reviewer only 警示；Usage 两项外部使用数均显示 `0`，无 Case / 已见候选人明细，也未显示 Unknown。E03–E05 | Materials、Versions 缺失；AC-7 不满足 |
| UC-W01-05 候选人预览隔离 | **部分/未验证安全边界** | 打开 Q-0001 预览抽屉，抽屉可见内容只有题干、Materials(None)、What to submit(None specified)，未见内部答案正文。E06 | 未取得候选人页面、预览 API 响应或服务端返回字段；不能证明 DOM/数据/API 均不含内部字段。预览说明文字本身提到 rubric/answer key，不代表泄露答案内容 |
| UC-W01-06 创建并发布 | **失败** | 创建抽屉只有 `Create question`，没有 Save draft / Publish、版本及发布历史确认。E09 | 未向生产创建题目；数据库 author/status 与计划选择器未验证。UI 已不能按指定两阶段路径执行 |
| UC-W01-07 创建/发布校验 | **部分/阻塞** | 空表单提交提示 `Enter a title first.`；只填测试标题再提交提示 `Enter the question content.`，未创建记录。E10、E11 | 编号由系统生成，无手动重复编号场景；无 Publish/Rubric 字段，无法试缺 Rubric 门禁；未直接调用认证 API 或核 DB |
| UC-W01-08 双击发布幂等 | **阻塞** | 线上没有 Publish 按钮。E09 | 无法双击发布并查版本数；不把未执行写为通过 |
| UC-W01-09 保存 500 恢复 | **阻塞** | 未注入 HTTP 500。 | 无网络故障注入/DB 会话；失败提示、保留输入和不增题数均未验证 |
| UC-W01-10 已发布编辑生新版本 | **失败/后半未验证** | Q-0001 Published v1 可打开 Edit question，但表单主按钮是 `Save changes`；详情无 Versions tab 或派生版本说明。E03、E12 | 为保护现有题和邀请，未保存变更；v2 / v1 保留及旧邀请内容未验证。现有 UI 无法按规定“编辑并发布新版本”路径操作 |
| UC-W01-11 停用与旧邀请 | **失败/后半未验证** | Q-0001 详情有 Preview、Delete、Edit，没有 Deprecated/停用操作。E03 | 不删除现有题；计划选择器和已发送邀请未验证 |
| UC-W01-12 ZIP 分类预览 | **失败** | Import ZIP 弹窗标 Demo adapter，`Choose File` 禁用；`Parse (demo)` 只给固定 toast，没有旧候选人提交分类和人工确认界面。E07、E08 | 无真实上传/入库/API 可验证；当前入口不能完成 AC-4 |
| UC-W01-13 损坏/含宏 ZIP | **阻塞** | 上传控件禁用，无法提交测试 ZIP。E07 | 解析错误、宏隔离、DB 不入库未执行；与 UC-12 共用缺失入口 |
| UC-W01-14 概念题邀请门禁 | **阻塞** | 线上只有 Q-0001/0002，没有 FIN-009。E01 | 无概念题、计划/Composer 指定入口或认证邀请 API 证据；AC-5 未验证 |

汇总：**1 通过（仅 UI）、4 部分、5 失败、4 阻塞**。此计数按整条 UC，不把部分步骤折算成通过率。

## 4. Acceptance Criteria 覆盖

| AC | 结果 | 证据或解除条件 |
|---|---|---|
| AC-1 双岗位/三能力映射 | **阻塞** | 当前两题各一个岗位；现有单岗位/能力/编号筛选可用（UC-02）。需注入双岗位、三能力题并从两个岗位检查 UI/API |
| AC-2 已发布编辑生成版本，旧邀请不变 | **失败，旧邀请未验证** | 详情无 Versions，编辑按钮仅 Save changes（E03、E12）；需版本服务与既有 v1 邀请 seed 后复测 |
| AC-3 Candidate preview/候选人 DOM 与数据隔离 | **部分，安全结论未验证** | E06 仅证明预览抽屉可见内容；需候选人会话、接口响应和 DOM 检查 |
| AC-4 ZIP 分类预览、确认前不入库 | **失败** | 文件选择禁用，Parse 为演示 toast（E07、E08）；需真实 ZIP 测试包、预览、确认前后 DB/API 证据 |
| AC-5 概念题所有邀请入口禁用 | **阻塞** | 无 FIN-009/010 seed；需计划、Composer 与邀请 API 三处复验 |
| AC-6 停用后不可新选、旧邀请不变 | **失败，旧邀请未验证** | 详情无停用入口（E03）；需有旧邀请的专用题和状态/选择器/API 证据 |
| AC-7 无外部记录显示 Unknown | **失败** | Q-0001 Usage 显示 Used in cases `0`、Candidates `0`（E05）；需区分“已确知为零”与“记录未知” |

## 5. 按用户旅程的 UX/UI 审查

目标角色：HR / Recruiter、Hiring Manager / Reviewer。登录目的：找到适用于岗位与能力的可复用题，核查内部评分标准与候选人内容，随后创建或维护精确版本供计划使用。当前线上路径为「题库 → 过滤 → 详情 → 预览/编辑」，无法继续到规范定义的草稿、版本发布与停用。

| 标准 | 结论 | 线上证据与影响 |
|---|---|---|
| U1 容易理解 | 失败 | 列表及详情能识别 Question、Published v1，但说明写 publishing a case；Edit 的 Save changes 未说明对已发布版本的影响（E01、E12） |
| U2 容易上手 | 部分 | 搜索、岗位/能力筛选与 Create question 入口明显；空表单提示明确，但创建后的状态/下一步不可预期（E01、E09–E11） |
| U3 快速完成任务 | 失败 | 浏览可完成；材料、版本、草稿、停用和 ZIP 导入任务无实际路径（E03、E07、E09） |
| U4 下一步明确 | 失败 | 已发布题未提供版本修订/停用路径；创建表单没有 Save draft 与 Publish 分层（E03、E09、E12） |
| U5 提示和按钮清楚 | 失败 | Import ZIP 实际为 Demo；点击 Parse 给出看似已解析的固定结果，未收文件（E07、E08） |
| U6 符合真实工作方式 | 失败 | 无内部答案材料分类导入、独立版本和确认前审阅流程（E03、E07） |
| U7 信息结构符合角色目标 | 失败 | 列表列有助筛题；详情无 Materials/Versions，Usage 无 Case/候选人明细（E01、E03、E05） |
| U8 减少来回跳转 | 失败 | 列表行直接去详情，没有右侧预览；从详情经主导航回列表后岗位/能力/搜索回到默认，丢失筛选上下文（E01、E03） |
| U9 可恢复和可预期 | 未验证 | 仅看到缺标题/内容校验；500、断网、并发、重复提交和权限变化未注入（E10、E11） |
| U10 可访问、可读和可操作 | 部分/未验证 | 主要控件在 DOM 中有可识别名称；编辑抽屉可用 Escape 关闭；未执行 200% 缩放、完整键盘顺序、焦点回置与对比度测量，不能宣称无障碍通过 |

### 优先处理的可复现发现

| ID / 级别 | 复现与实际结果 | 用户影响与最小修复 | 复验条件 |
|---|---|---|---|
| W01-LIVE-01 / **P0** | 以 Hiring Manager 打开 Q-0001；详情只有 Prompt/Rubric/Usage，Edit 只有 Save changes；创建只有 Create question（E03、E09、E12） | 不能按版本创建草稿、发布或追溯；实现明确的 Draft → Publish、QuestionVersion 与历史入口，防止修改已发送内容 | 创建草稿、发布 v1、派生 v2，旧邀请仍返回 v1；重复发布只生一个版本 |
| W01-LIVE-02 / **P1** | 点击 Import ZIP；Choose File 禁用，Parse (demo) 直接显示固定解析 toast（E07、E08） | 用户误以为已解析文件，无法分类确认内部答案/旧提交；提供真实上传、分类预览与确认门禁，演示入口不得伪装结果 | 合成 ZIP 显示 1 题/2 材料/1 答案/1 旧提交；确认前 DB 不变，坏包可恢复 |
| W01-LIVE-03 / **P1** | 打开 Q-0001 Usage，Used in cases 和 Candidates 均为 0（E05） | “无外部记录”被解释为“已证实为零”，影响版本曝光判断；未知来源显示 Unknown，并明确统计来源 | 无外部记录显示 Unknown；有已核实 0 时才显示 0，明细与汇总一致 |
| W01-LIVE-04 / **P1** | 已发布 Q-0001 只有 Delete/Edit，没有停用动作（E03） | 无法阻止未来选用同时保留已发邀请；提供 Deprecated 状态转换与历史 | 停用题不在新计划选择器，旧邀请仍可读取原版本 |
| W01-LIVE-05 / **P2** | 在列表点击 Q-0001 直接跳详情；回列表后原搜索/过滤被清空（E03、E13、E14） | 筛题时反复设置上下文；增加右侧预览并保留筛选/滚动 | 选题、进详情、返回后筛选和位置仍在 |
| W01-LIVE-06 / **P2** | 列表说明 `Publishing a case does not send it`，规范所说对象为 question（E01） | 发布对象不明；把文案改成题目发布与邀请分离，并在发布/计划路径保持一致 | HR 能明确区分题目、Case 与邀请的状态 |

以上 P0/P1 是本轮的 UI/业务可复现缺口；API 安全隔离、旧邀请内容、服务端持久化和并发行为仍是**待验证风险**，不把缺少证据写成已复现缺陷。P0/P1 分级沿用指定标准对核心任务与决策风险的定义。

### 标准结构化审查记录

```yaml
review:
  product: "Written Test / W01 Question Bank"
  surface: "Question Bank、Question Detail、Candidate preview、Import ZIP、Create/Edit question"
  role: "HR / Recruiter；Hiring Manager / Reviewer"
  journey_goal: "筛选可复用题目，核查候选人可见内容与评分标准，维护可追溯版本供后续计划使用"
  evidence:
    source: "线上 Chrome 页面、可访问 DOM、E01–E14 截图"
    steps_checked: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 13]
  verdict: "fail"
  findings:
    - id: "W01-LIVE-01"
      severity: "P0"
      category: "state"
      step: 8
      title: "缺少草稿发布与版本历史路径"
      evidence: "E03、E09、E12：详情只有三 tab；Create question 与 Save changes 无版本动作"
      user_impact: "无法按精确版本维护题目，也无法判断对既有邀请的影响"
      recommendation: "提供 Draft、Publish、派生版本和历史入口"
      acceptance_check: "发布 v1、派生 v2，旧邀请仍返回 v1，重复请求只生一个版本"
    - id: "W01-LIVE-02"
      severity: "P1"
      category: "clarity"
      step: 10
      title: "ZIP 导入是演示解析"
      evidence: "E07、E08：文件选择禁用，Parse (demo) 返回固定 toast"
      user_impact: "无法安全分类题目、材料、内部答案和旧提交"
      recommendation: "接入真实上传、分类预览和人工确认"
      acceptance_check: "确认前不入库，坏包可恢复，内部文件不外发"
    - id: "W01-LIVE-03"
      severity: "P1"
      category: "clarity"
      step: 5
      title: "Usage 将未知显示为零"
      evidence: "E05：Used in cases 与 Candidates 均显示 0，无外部明细"
      user_impact: "审阅者可能误判题目曝光和复用情况"
      recommendation: "按数据来源区分 Unknown 与已核实的 0"
      acceptance_check: "无外部记录显示 Unknown，已有核实记录时显示准确计数"
    - id: "W01-LIVE-04"
      severity: "P1"
      category: "next_action"
      step: 13
      title: "已发布题无停用操作"
      evidence: "E03：详情仅 Preview、Delete、Edit"
      user_impact: "无法阻止新计划继续选用题目"
      recommendation: "提供 Deprecated 状态转换及历史"
      acceptance_check: "新计划不可选用，旧邀请内容不变"
    - id: "W01-LIVE-05"
      severity: "P2"
      category: "efficiency"
      step: 2
      title: "筛选详情跳转后上下文丢失"
      evidence: "E03、E13、E14：行点击去详情；经导航返回后搜索/过滤为默认"
      user_impact: "批量筛题需重复设定过滤"
      recommendation: "提供列表内预览并保留返回状态"
      acceptance_check: "返回后过滤和位置不变"
    - id: "W01-LIVE-06"
      severity: "P2"
      category: "clarity"
      step: 1
      title: "发布说明对象写成 case"
      evidence: "E01：Publishing a case does not send it"
      user_impact: "题目发布与 Case 发布的概念可能混淆"
      recommendation: "使用 Question 发布与 Invitation 发送的明确文案"
      acceptance_check: "HR 能从文案区分题目状态与邀请状态"
  usability_check:
    understandable: "fail"
    learnable: "fail"
    efficient: "fail"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "fail"
    role_information_fit: "fail"
    no_unnecessary_hops: "fail"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "无 W01 专属 Issue/PR、线上构建号、FIN/旧邀请 seed"
    - "未取得候选人身份、认证 API/DB/服务端日志"
    - "未执行 200% 缩放、完整键盘顺序、对比度测量、故障/并发注入"
```

## 6. 复测准备与限制

1. 提供隔离的线上测试身份及 `S_bank_fin`、`S_question_published_v1`（含已发送 v1 邀请）、`S_zip_fin_pack`，按 [Written Test README](../README.md#公共约定) 每用例独立 seed；记录 seed ID 和清理策略。当前线上两条真实题不能安全替代这些前置数据。
2. 提供候选人身份、已登录 API/DB 只读观察与受控故障注入，以覆盖 AC-2/3/4/5/6 的服务端边界、UC-08/09 的幂等和失败恢复。核心权限与外发结论在完成这些检查前维持未验证。
3. 明确 PR/主 Issue 与线上构建 SHA 后，再按仓库 QA Schema 做正式验收。此次没有对象身份，因此没有伪造 `evidence/context.json` 或 `evidence/qa.json`。
4. 本轮只读/负向交互未产生待清理的测试题。UX 200% 缩放与多角色矩阵待下一轮补测。
