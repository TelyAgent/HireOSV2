# F06 AI 岗位发现与推荐：线上测试报告

测试日期：2026-10-15（Asia/Shanghai）  
结论：**不通过**。线上用虚构候选人复现了明确的地点资格冲突仍显示 `Strong match signal` 的问题，违反 AC-4。重新匹配后旧推荐在档案列表标为 `Stale`，在推荐详情仍写“待确认”，存在决策误导。其余 AC 有部分 UI 证据，但缺 API、数据库、审计、故障注入和多角色证据，不能宣布 F06 完整验收通过。

## 1. 依据、环境与执行边界

| 项 | 内容 |
|---|---|
| 产品依据 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[Loop IO](Loop_IO.md)、[User Cases](User_Cases.md)，均为 v1.0 草稿、待评审；以 AC-1～7 和 UC-F06-01～15 为测试清单 |
| UX 依据 | [JD Management UX/UI 审查标准 v1.0](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的旅程逐步取证、U1～U10、严重度和报告结构；其 JD 专属审批/发布条款不用于 F06 |
| 环境 | [线上简历筛选](https://hireos.aipollo.me/hireos/screening/)，Chrome 已登录会话，中文界面；页面显示账号“蔡敏”，没有独立的服务端角色证明 |
| 方法 | 经线上 UI 粘贴两份纯虚构档案，观察自动发现、候选人档案、推荐详情、手动重新匹配；另用此前 F03 建立的虚构 Nina 观察无匹配状态。没有登录生产服务器、改配置或部署 |
| 数据 | 邮箱均为 `example.com`；本轮新增 2 名虚构候选人，保留供复查。未修改或删除已有候选人、岗位与标准，未点击“确认职位关联” |
| 可见性 | 页面提示“所有数据均为虚构、外发与模型调用均为模拟”；但本轮没有取得线上构建号、模型调用日志、API 原始响应、DB 或审计记录 |

本轮开始时简历库 UI 显示 61 人；新增两份档案后显示 63 人。人数只是 UI 观察，不能代替数据库计数或排除共享环境中其他会话的并发修改。

| 测试对象 | 输入与线上证据 |
|---|---|
| Lin Test | 北京、具中国工作授权、2022-01～2026-10 AI 产品经理经历、Agent/RAG/人工接管/失败兜底、模型幻觉率和延迟量化结果；[档案](https://hireos.aipollo.me/hireos/screening/candidates/50edb26a-e620-4478-a5ab-2b5f7ca67b85) · [推荐详情](https://hireos.aipollo.me/hireos/screening/candidates/50edb26a-e620-4478-a5ab-2b5f7ca67b85/jobs)；导入批次 `13d2dd6a-38a8-4c93-a359-913a81ba836c` |
| Ben Test | 与 Lin 类似的 AI 产品经历，但原文明确写 `Singapore only`、`Cannot relocate to Beijing or any other city`、只能在新加坡远程工作；[档案](https://hireos.aipollo.me/hireos/screening/candidates/e571c2d9-ce4d-42e9-b3aa-0f2d975a1d87) · [推荐详情](https://hireos.aipollo.me/hireos/screening/candidates/e571c2d9-ce4d-42e9-b3aa-0f2d975a1d87/jobs)；导入批次 `a018cc59-2fe6-4bc8-98d2-3b557ec8ffba` |
| Nina Torres | F03 已建虚构档案，SQL/Python/Data Analyst 方向；[档案](https://hireos.aipollo.me/hireos/screening/candidates/13d53ef2-ef67-4163-987a-9b44c551f537) · [无推荐详情](https://hireos.aipollo.me/hireos/screening/candidates/13d53ef2-ef67-4163-987a-9b44c551f537/jobs) |

## 2. User Journey 逐步结果

| Step | 预期 | 本轮线上实际 | 结论 |
|---|---|---|---|
| 1 无开放岗位 | `no_open_jobs`，候选人保留 | 当前有 7 个开放职位；未清空共享岗位集合。未执行该前置状态 | 未验证 |
| 2 确认标准后推荐 | 已确认标准触发推荐，只有 proposed，无 Application | 未改线上岗位标准。Lin 新简历入库后自动开始匹配，最终档案列出 3 条“待处理推荐”，未显示已关联项 | 部分通过；标准确认触发、API/DB 未验证 |
| 3 理由与置信度 | 真实证据、文字档位、无百分比 | Lin 两轮推荐均引用输入中的 Agent MVP、RAG、人工接管、幻觉率/延迟评估；显示 `Strong match signal`，未见百分比。卡片未展示逐条证据引用、输入版本 | 部分通过 |
| 4 明确不符合资格 | 推荐保留，标“不符合资格”，不显示置信度 | Ben 两条北京岗位的理由明确识别“无法搬迁、仅新加坡远程”，却均写“待确认 Strong match signal”，仍显示“确认职位关联” | **失败** |
| 5 资料不足 | `insufficient_data` 或“证据不足、无法估算置信度” | 未准备可控覆盖率样本与 API 断言；现有候选人不足以代表该门槛 | 未验证 |
| 6 无匹配 | 显示原因和恢复动作 | Nina 手动“重新匹配”后仍无推荐，显示 7 个开放职位、最近检查时间，提供“搜索职位/更新档案/重新匹配”。原因句是英文 `No current open role met the matching threshold.` | UI 部分通过；未建 Quality Engineering 测试岗位，run 状态未查 API |
| 7 AI 失败 | `failed` 与 `no_match` 区分且可重试 | 无线上故障注入条件 | 未验证 |
| 8 重复匹配去重 | 同候选人×岗位仅 1 条有效推荐和 1 个任务 | Lin 首轮产生 3 个不同岗位的待处理推荐；手动重新匹配完成后仍是每岗位 1 条待处理推荐，旧 3 条在档案列表标 `Stale`；详情页却把旧卡片也标“待确认” | UI 去重部分通过；旧卡片状态失败；任务/并发未查 |
| 9 标准 v2 | 旧推荐过期，新推荐产生，不自动关联 | 未变更共享岗位标准；第 8 步只证明手动重匹配替换旧推荐 | 未验证 |
| 10 不同岗位 | 分岗展示，不跨岗位分数混排 | Lin 的北京/上海 AI 产品经理与北京 AI 工具产品经理在详情页分卡显示，未见统一分数；档案表内同名同团队的北京/上海两行不显示地点，难以区分 | 部分通过 |
| 11 已关闭岗位 | 旧推荐可看不可确认，新匹配排除 | 未关闭共享岗位 | 未验证 |
| 12 无权 Recruiter | 不出现无权限岗位 | 无 `recruiter_other_scope` 账号和已登录 API 验证 | 未验证 |
| 13 Hiring Manager | 仅负责岗位推荐，可按权限重匹配 | 未使用独立 HM 身份或 API | 未验证 |
| 14 HR Approver | 只读 | 无独立 Approver 身份 | 未验证 |
| 15 Viewer | 只读、受限证据不下发、Match again 为 403 | 无 Viewer 身份和已登录 API 403/响应核查 | 未验证 |

## 3. 15 条用例与 AC 覆盖

| 用例 | 结果 | 证据/缺口 |
|---|---|---|
| UC-F06-01 | 未验证 | 线上已有 7 个开放职位，未造无岗位隔离 seed |
| UC-F06-02 | 部分通过 | 新简历自动触发并出现待处理推荐；标准确认触发、Application/任务 DB 未核 |
| UC-F06-03 | 部分通过 | Lin 同输入跑 2 次，已见理由与输入相符；未逐条核对原文件/证据引用和全部岗位 |
| UC-F06-04 | 部分通过 | 常规推荐为文字档位、未见百分比；资格冲突场景失败，见 UC-05 |
| UC-F06-05 | **失败** | Ben 明确不能搬迁北京，仍为 `Strong match signal`，无“不符合资格”标记 |
| UC-F06-06 | 未验证 | 缺覆盖率 0.15/0.30/0.70 的可控输入与 API |
| UC-F06-07 | 部分通过 | Nina 无匹配 UI 与重试入口；未新建指定岗位、未核 API `no_match` |
| UC-F06-08 | 未验证 | 缺 `llm_fail` 注入 |
| UC-F06-09 | 部分通过且有详情缺陷 | Lin 重匹配后每岗位 1 条待处理、旧行 `Stale`；旧详情误标待确认；未查任务表/并发 |
| UC-F06-10 | 未验证 | 未确认标准 v2 |
| UC-F06-11 | 部分通过 | 详情按岗位分卡；档案页同名岗位缺地点，跨岗位排序规则仍待产品确认 |
| UC-F06-12 | 未验证 | 未关闭共享岗位 |
| UC-F06-13 | 未验证 | 缺其他范围的 Recruiter 身份及 API |
| UC-F06-14 | 未验证 | 缺 HM 的服务端权限证据 |
| UC-F06-15 | 未验证 | 缺 Approver/Viewer 身份和 API 403/字段证据 |

| AC | 判定 | 依据 |
|---|---|---|
| AC-1 | 部分验证 | `no_match` UI 已见；`no_open_jobs`、`insufficient_data`、`failed` 及 API status 未测 |
| AC-2 | 部分验证 | Lin 3 条待处理且档案无已关联；Application 数及任务/DB 未核 |
| AC-3 | 部分验证 | 新简历自动触发；手动重匹配后的 UI 有效推荐按岗位去重；新岗位、标准更新、并发及任务未核 |
| AC-4 | **失败** | Ben 明确不能搬迁却显示 `Strong match signal`，未标不符合资格 |
| AC-5 | 部分验证 | Lin 两轮主要理由与已知合成输入一致；未检查所有推荐的原文引用与结构化 evidence |
| AC-6 | 部分验证 | 推荐详情分岗显示，无跨岗分数；档案列表中北京与上海同名同团队岗位不易区分 |
| AC-7 | 未验证 | 未关闭岗位、未试旧推荐确认 |

## 4. 发现、严重度与修复验收

| ID/级别 | 角色、旅程步骤与证据 | 影响 | 最小修复与复测 |
|---|---|---|---|
| F06-UX-01 / **P1，AC 阻断** | Recruiter，步骤 4；[Ben 推荐](https://hireos.aipollo.me/hireos/screening/candidates/e571c2d9-ce4d-42e9-b3aa-0f2d975a1d87/jobs) 的两条北京岗位理由都识别了“不能搬迁、仅新加坡远程”，却仍显示 `Strong match signal` 且没有“不符合资格” | 招聘者可能把已知硬条件冲突误读为高置信度可录用信号 | 将明确不满足的 Must-have 独立传至推荐展示；保留推荐但标“不符合资格”，隐藏置信度。用相同 Ben 输入复测两条北京岗位，且不把“缺证据”混同“明确不满足” |
| F06-UX-02 / **P1** | Recruiter，步骤 8；[Lin 档案](https://hireos.aipollo.me/hireos/screening/candidates/50edb26a-e620-4478-a5ab-2b5f7ca67b85) 把旧 3 条写 `Stale`，[推荐详情](https://hireos.aipollo.me/hireos/screening/candidates/50edb26a-e620-4478-a5ab-2b5f7ca67b85/jobs) 却把旧卡片写“待确认 Strong match signal”，只是不显示操作按钮 | 旧依据和新依据在同一页面看似同样有效，用户难以辨认当前可决策的推荐 | 详情页显示“已过期/被新运行替换”、过期原因和时间，当前推荐优先；复测档案与详情状态一致，旧项不能确认 |
| F06-UX-03 / **P1** | Recruiter，步骤 3；[Lin 推荐详情](https://hireos.aipollo.me/hireos/screening/candidates/50edb26a-e620-4478-a5ab-2b5f7ca67b85/jobs) 只有理由和差距列表，未呈现可点开的简历原文证据、资料/标准版本或运行版本 | 招聘者无法在推荐页直接核对“为什么推荐”和依据是否过期；AC-5 只能人工对照已知输入 | 每项关键理由提供来源片段/字段及资料、岗位标准版本；复测可定位原文、比较重匹配前后版本 |
| F06-UX-04 / **P2** | Recruiter，步骤 6/8；[Nina 无推荐](https://hireos.aipollo.me/hireos/screening/candidates/13d53ef2-ef67-4163-987a-9b44c551f537/jobs) 中文页出现英文原因句；[Lin 档案](https://hireos.aipollo.me/hireos/screening/candidates/50edb26a-e620-4478-a5ab-2b5f7ca67b85) 旧项直接写 `Stale` | 状态词不一致，增加理解成本 | 对动态原因与旧状态提供中文业务文案；切换语言后分别核对 |
| F06-UX-05 / **P2** | Recruiter，步骤 10；[Lin 档案](https://hireos.aipollo.me/hireos/screening/candidates/50edb26a-e620-4478-a5ab-2b5f7ca67b85) 中北京和上海的 `AI产品经理 / 产品部` 行没有地点或唯一识别信息 | 同名岗位无法在档案列表中辨认，复核入口都跳同一推荐页 | 行内显示地点、岗位标识或标准版本；复测北京/上海可一眼区分 |

本地代码核对仅作为补充线索，不等于线上构建证据：当前 `DiscoveryService` 按 `overallScore >= 35` 生成推荐，`confidenceLabel` 按 `confidence` 的 70/40 门槛给档位；本地 schema 的 `JobDiscoveryRun` 没有 PRD 要求的资料/岗位集合/模型版本字段，`DiscoveryController` 仅挂 `WorkspaceGuard`。这些与 PRD 的覆盖率门槛、版本追溯和角色范围存在待核对处。需要先确认线上构建与最终产品规则，再用已登录 API/DB 和独立角色账号验证，不能把本地代码推断写成线上实测泄露或失败。

## 5. U1～U10 应用性检查

| 项 | 判定 | 证据/限制 |
|---|---|---|
| U1 容易理解 | 部分通过 | “待确认/已关联”主概念明确；过期推荐详情误写待确认 |
| U2 容易上手 | 部分通过 | 新简历自动匹配，无需手动配置；证据入口和版本不可见 |
| U3 快速完成任务 | 部分通过 | Lin 入库自动产生推荐；完整运行耗时未精确计时，阈值未定 |
| U4 下一步明确 | 部分通过 | 有复核、搜索职位、更新档案、重新匹配；不合格推荐仍可点关联，判断边界不清 |
| U5 提示和按钮清楚 | 失败 | Ben 资格冲突却标 Strong；旧推荐详情状态误标；中英状态混杂 |
| U6 符合真实工作方式 | 部分通过 | 按岗位提出候选人，人工确认前无关联 UI；任务与 Application 持久化未核 |
| U7 信息结构符合角色 | 失败 | 推荐缺原文证据与输入版本；角色权限尚无独立身份实测 |
| U8 减少重复跳转 | 部分通过 | 档案页可直达推荐详情；同名岗位需进入详情才可辨别地点 |
| U9 可恢复和可预期 | 部分通过 | 无匹配有重试和补资料入口，运行中禁用重复点击；失败、超时、并发未实测 |
| U10 可访问、可读、可操作 | 未验证 | 未做键盘、焦点、读屏、200% 缩放与对比度检查 |

```yaml
review:
  product: "Resume Screening / F06"
  surface: "候选人档案、岗位推荐详情、岗位 AI 建议候选人"
  role: "已登录账号（页面显示蔡敏；Recruiter/TA 服务端角色未核实）"
  journey_goal: "自动发现可考虑岗位，并依据证据决定是否人工关联"
  evidence:
    source: "线上 Chrome 页面可访问树、页面状态、合成输入和可复查链接；本地代码与测试另列"
    steps_checked: [2, 3, 4, 6, 8, 10]
  verdict: "fail"
  findings:
    - {id: "F06-UX-01", severity: "P1", category: "ai_boundary", step: 4, title: "明确资格冲突仍显示 Strong", evidence: "Ben 两条北京岗位理由识别不能搬迁，但均标 Strong", user_impact: "误导人工关联决策", recommendation: "不合格标记且隐藏置信度", acceptance_check: "同一 Ben 输入两条岗位均标不合格、无置信度"}
    - {id: "F06-UX-02", severity: "P1", category: "state", step: 8, title: "旧推荐详情误标待确认", evidence: "Lin 档案旧项 Stale，详情旧卡片仍待确认", user_impact: "新旧依据混淆", recommendation: "详情显示过期状态与原因", acceptance_check: "两页面状态一致且旧项不可确认"}
    - {id: "F06-UX-03", severity: "P1", category: "ai_boundary", step: 3, title: "理由缺原文证据与输入版本", evidence: "Lin 推荐详情仅有理由与差距", user_impact: "无法直接复核依据及版本", recommendation: "展示原文片段和输入版本", acceptance_check: "逐条理由可追到简历原文与标准版本"}
  usability_check:
    understandable: "fail"
    learnable: "unknown"
    efficient: "unknown"
    next_action_clear: "fail"
    controls_clear: "fail"
    real_workflow_fit: "unknown"
    role_information_fit: "fail"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "unknown"
  limits:
    - "未取得线上构建号、原始 API、数据库、AiRun、任务及审计"
    - "缺无岗位/失败/覆盖率/关闭岗位的隔离 seed 与注入条件"
    - "缺其他范围 Recruiter、HM、Approver、Viewer 的独立测试身份"
```

## 6. 本地自动化校验与复测条件

在当前工作区实际运行（不代表线上部署版本）：

| 子项目 | 命令与结果 |
|---|---|
| screening 后端 | `npx prisma generate` 通过；`npm test`（含 build）10/10 通过；`npm run lint` 通过；`npm run typecheck` 通过。首次未 generate 时 `npm test` 因旧 Prisma Client 缺 `targetJobId` 而失败，generate 后通过 |
| screening 前端 | `npm test` 6/6 通过；`npm run build` 通过；`npm run lint` 0 error、1 warning（`src/data/api/screening.ts:101` 未用参数）；`npm run typecheck` 通过 |

现有 16 条自动测试主要覆盖健康检查、鉴权、导入处理与文件批次，**没有直接覆盖 F06 的置信度/资格、推荐替换或角色权限**。线上证据不能由这些本地通过结果替代。

复测优先顺序：先修 F06-UX-01 与 F06-UX-02；在隔离测试空间建立 `S0_empty`、已确认/关闭岗位及覆盖率边界样本，注入模型失败；取得线上构建号、只读 API/DB/AiRun/任务/审计访问和四类角色账号，再逐项关闭 AC-1～7。PRD 尚待确认覆盖率门槛、推荐排序和重匹配频率上限；这些产品决定应先落到 Issue/规格，避免按推测验收。

本次只新增此本地报告；未创建 Issue/PR、未提交或推送、未部署。其他已有未提交改动未修改。
