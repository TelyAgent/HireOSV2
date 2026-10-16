# Written Test 主流程产品文档

按 [功能拆分](Written_Test_Feature_Breakdown.md) 的 W01～W13 主流程，每个功能一个文件夹，各含四份文档，格式与 [JD_Management](../JD_Management/README_Modules.md) 的模块文档一致：

| 文档 | 作用 | 读者 |
|---|---|---|
| `PRD.md` 产品文档 | 目标、范围、功能需求、业务规则、数据、权限、验收标准、待确认 | 产品、研发、测试 |
| `Loop_IO.md` 输入输出闭环 | 结构化流程规格（YAML）、测试数据、路径清单、流程图 | AI 生成 test case、模拟测试 |
| `User_Journey.md` 用户旅程 | 角色目的、步骤、用户判断、可见/不可见、异常恢复、交接 | 产品、设计、AI Review |
| `User_Cases.md` 用户用例 | 按 User Journey 整理的功能测试用例：前置数据、步骤、预期结果、检查位置、追溯到闭环路径和验收标准 | 测试、AI 执行测试 |

| 编号 | 文件夹 | 功能 | 文档 |
|---|---|---|---|
| W01 | [W01_Question_Bank](W01_Question_Bank/PRD.md) | 题库与题目版本 | [PRD](W01_Question_Bank/PRD.md) · [Loop_IO](W01_Question_Bank/Loop_IO.md) · [Journey](W01_Question_Bank/User_Journey.md) · [Cases](W01_Question_Bank/User_Cases.md) |
| W02 | [W02_Builder_AI_Generation](W02_Builder_AI_Generation/PRD.md) | 组卷 Builder 与 AI 出题 | [PRD](W02_Builder_AI_Generation/PRD.md) · [Loop_IO](W02_Builder_AI_Generation/Loop_IO.md) · [Journey](W02_Builder_AI_Generation/User_Journey.md) · [Cases](W02_Builder_AI_Generation/User_Cases.md) |
| W03 | [W03_Project_Candidate_Linking](W03_Project_Candidate_Linking/PRD.md) | 测评项目与候选人关联 | [PRD](W03_Project_Candidate_Linking/PRD.md) · [Loop_IO](W03_Project_Candidate_Linking/Loop_IO.md) · [Journey](W03_Project_Candidate_Linking/User_Journey.md) · [Cases](W03_Project_Candidate_Linking/User_Cases.md) |
| W04 | [W04_Assessment_Plan](W04_Assessment_Plan/PRD.md) | 候选人测评计划 | [PRD](W04_Assessment_Plan/PRD.md) · [Loop_IO](W04_Assessment_Plan/Loop_IO.md) · [Journey](W04_Assessment_Plan/User_Journey.md) · [Cases](W04_Assessment_Plan/User_Cases.md) |
| W05 | [W05_Invitation_Sending](W05_Invitation_Sending/PRD.md) | 邀请与批量发送 | [PRD](W05_Invitation_Sending/PRD.md) · [Loop_IO](W05_Invitation_Sending/Loop_IO.md) · [Journey](W05_Invitation_Sending/User_Journey.md) · [Cases](W05_Invitation_Sending/User_Cases.md) |
| W06 | [W06_Candidate_Portal](W06_Candidate_Portal/PRD.md) | 候选人门户：验证、接受与作答 | [PRD](W06_Candidate_Portal/PRD.md) · [Loop_IO](W06_Candidate_Portal/Loop_IO.md) · [Journey](W06_Candidate_Portal/User_Journey.md) · [Cases](W06_Candidate_Portal/User_Cases.md) |
| W07 | [W07_Submission_Intake](W07_Submission_Intake/PRD.md) | 提交收件与 Submission Inbox | [PRD](W07_Submission_Intake/PRD.md) · [Loop_IO](W07_Submission_Intake/Loop_IO.md) · [Journey](W07_Submission_Intake/User_Journey.md) · [Cases](W07_Submission_Intake/User_Cases.md) |
| W08 | [W08_Evaluation_Review](W08_Evaluation_Review/PRD.md) | 评分与人工复核 | [PRD](W08_Evaluation_Review/PRD.md) · [Loop_IO](W08_Evaluation_Review/Loop_IO.md) · [Journey](W08_Evaluation_Review/User_Journey.md) · [Cases](W08_Evaluation_Review/User_Cases.md) |
| W09 | [W09_Result_Release](W09_Result_Release/PRD.md) | 结果发布与候选人通知 | [PRD](W09_Result_Release/PRD.md) · [Loop_IO](W09_Result_Release/Loop_IO.md) · [Journey](W09_Result_Release/User_Journey.md) · [Cases](W09_Result_Release/User_Cases.md) |
| W10 | [W10_Revision_Supplemental](W10_Revision_Supplemental/PRD.md) | 修订、重考与补测 | [PRD](W10_Revision_Supplemental/PRD.md) · [Loop_IO](W10_Revision_Supplemental/Loop_IO.md) · [Journey](W10_Revision_Supplemental/User_Journey.md) · [Cases](W10_Revision_Supplemental/User_Cases.md) |
| W11 | [W11_Next_Action_Handoff](W11_Next_Action_Handoff/PRD.md) | 下一步决定与交接 | [PRD](W11_Next_Action_Handoff/PRD.md) · [Loop_IO](W11_Next_Action_Handoff/Loop_IO.md) · [Journey](W11_Next_Action_Handoff/User_Journey.md) · [Cases](W11_Next_Action_Handoff/User_Cases.md) |
| W12 | [W12_Candidate_Comparison](W12_Candidate_Comparison/PRD.md) | 候选人对比 | [PRD](W12_Candidate_Comparison/PRD.md) · [Loop_IO](W12_Candidate_Comparison/Loop_IO.md) · [Journey](W12_Candidate_Comparison/User_Journey.md) · [Cases](W12_Candidate_Comparison/User_Cases.md) |
| W13 | [W13_My_Tasks_Statistics](W13_My_Tasks_Statistics/PRD.md) | 我的任务与首页统计 | [PRD](W13_My_Tasks_Statistics/PRD.md) · [Loop_IO](W13_My_Tasks_Statistics/Loop_IO.md) · [Journey](W13_My_Tasks_Statistics/User_Journey.md) · [Cases](W13_My_Tasks_Statistics/User_Cases.md) |

业务顺序：W01 → W02 准备题目；W03 → W04 → W05 → W06 → W07 → W08 → W09 是单个候选人的主闭环；W09 之后进入 W10（新一轮回到 W05）或 W11。W12、W13 读取主闭环产生的结果和任务。测试时每个功能用 seed 直接造出前置数据，不依赖前一个功能真跑。

## 依据

- [Assessment PRD v1.4](../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)：需求基线。
- [Interface Spec v1.4](../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)：数据归属、实体和事件。
- [Prototype Design Brief v1.1](../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md)：页面、路由、演示场景 P01–P22 和 Foundation 场景 F01–F12。
- [原型](../../design/Written_Test/hireos-assessment-prototype.html)：页面与交互。
- [Written Test Agent 对话流程](../../../hireos-written/docs/Written_Test_Agent_Conversation_Flow.md)：Agent 的确认与停止规则。

## 公共约定

### 演示身份与 seed（Brief §7、§14）

| 身份 | 角色 | 说明 |
|---|---|---|
| Emma Wilson（user_emma） | HR | My open = 3 |
| Daniel Park（user_daniel） | Hiring Manager / Reviewer | My open = 1，Available to claim = 1 |
| Morgan Reed（user_morgan） | Admin | My open = 0 |

| Case | 候选人 | 状态 |
|---|---|---|
| case_a | Alex Morgan | FIN-001 初稿 final = 70，结果未发布 |
| case_b | Jordan Lee | 已接受，deadline-only，未提交，score = null |
| case_c | Casey Chen | 已开始，邮件缺一份必交物，score = null，问题组 open |
| case_d | Taylor Brooks | 已提交，人工复核中，AI draft = 80，非 final |
| — | Riley Stone | 只在新建候选人流程中出现，不计入基线数量 |

演示时钟固定 `2026-09-11T08:00:00Z`，时区 Asia/Shanghai；候选人邮箱用 example.com；所有发信只记录到 adapter（simulation_only）。

### 状态分离

Received / Submitted / Evaluated / Published / Delivered 是五个独立状态；打开链接 ≠ 接受 ≠ 开始；机器任务成功 ≠ 人工任务完成。各 PRD 中的状态以此为准。

### 测试身份

| 身份 | 角色 | 说明 |
|---|---|---|
| hr_emma | HR / Recruiter | 大多数雇主端用例的默认执行者 |
| hm_daniel | Hiring Manager / Reviewer | 评分复核、领取队列任务 |
| admin_morgan | Admin | 完整授权 workspace；也承担 Operations（隔离邮件、交付异常） |
| hr_restricted | HR（受限 scope） | 只能访问部分 Case，用于权限隔离用例 |
| hr_other_ws | 其他 workspace 的 HR | 跨 workspace 隔离 |
| cand_alex / cand_jordan / cand_casey / cand_taylor / cand_riley | Candidate（受限参与者） | 只访问本人任务 |
| cand_other | Candidate | 用他人链接 / 会话做越权尝试 |

开发态目前只有固定身份，多身份用例需要先补测试账号；候选人统一 Identity 尚未实现，相关用例标记为 known gap。

### Seed（前置状态）目录

| Seed | 内容 | 使用模块 |
|---|---|---|
| S0_employer | 已登录员工；Brief §7 基线（ws_demo、prj_fin、case_a–d、任务 t1–t6） | 全部 |
| S_bank_fin | 题库含已发布 FIN-001 / 002 / 004 / 008；FIN-003 为 follow-up guide；FIN-009 / 010 为概念题 | W01、W02、W04 |
| S_question_published_v1 | FIN-001 v1 已发布，且已有一份邀请使用 v1 | W01、W02 |
| S_zip_fin_pack | 合成 ZIP：1 个 prompt、2 份材料、1 份内部答案、1 份旧候选人提交 | W01 |
| S_core_candidate_unlinked | Riley 已在 Core 建 Candidate，未确认招聘关系 | W03、W05 |
| S_screened_candidates | Finance 岗位有 2 名已筛选、未进入测评的候选人 | W03 |
| S_case_plan_empty | 已确认关系的 Case，计划为空 | W04 |
| S_case_plan_ready | 计划含 FIN-001（必评）未发送 | W04、W05 |
| S_inv_sent_timed / S_inv_sent_deadline | 邀请已发送未打开（timed 90 分钟 / deadline-only） | W06 |
| S_inv_accepted_deadline | = case_b | W06、W07 |
| S_inv_started_missing | = case_c | W07 |
| S_attempt_submitted_ai_draft | = case_d | W08、W12 |
| S_result_final_unreleased | = case_a | W09、W11 |
| S_result_released | case_a 结果已发布 | W10、W11 |
| S_revision_round1_sent | case_a 修订轮 1 已发出，候选人未接受 | W10 |
| S_two_final_results | 同岗位两名候选人 final、同试卷版本 | W12 |

所有测试候选人姓名加 `[UJ-TEST]` 前缀，邮箱用 example.com，测试后清理。所有发信走 simulation adapter。

### 注入点

| 注入 | 含义 | 通过标准 |
|---|---|---|
| network_down | 断网 | 有失败提示和重试；输入不丢 |
| llm_fail | AI 失败 / 超时 | 可恢复，保留人工路径；不显示假成功 |
| double_click | 重复点击提交类按钮 | 只生效一次 |
| refresh | 中途刷新 / 后退 | 不产生半成品 |
| http_500 | 保存接口返回 500 | 不显示 Saved |
| core_unavailable | Core / Identity 不可用 | 如实阻塞依赖动作；草稿保留 |
| core_response_lost | Core 已成功但响应丢失 | 进入 Reconciling，同 request_id 恢复，不重复创建 |
| mail_bounce | 邮件退信 | 业务状态不回滚；可重试失败项 |
| bus_down | 事件总线不可用 / 重投 / 乱序 | Outbox 保留；下游去重 |
| concurrent | 两人同时操作同一对象 | 只有一人成功，另一人看到冲突提示 |

### 闭环文档格式

`Loop_IO.md` 的字段（`flow_id`、`actor`、`seed`、`entry`、`max_loop`、`external`、`nodes`、`edges`）和断言原则与 [JD_Management 闭环文档格式](../JD_Management/README_Modules.md#闭环文档格式) 相同：权限类断言必须检查 `api`；AI 输出写判定条件，同一输入至少跑 2 次；未实现的功能路径照写，执行时标记 known gap。

用例状态：✅ 可测（功能已有实现，不代表会通过）；🟡 部分可测；❌ 未实现。

## 用例统计（User_Cases.md）

| 模块 | 用例数 | ✅ 可测 | 🟡 部分可测 | ❌ 未实现 |
|---|---|---|---|---|
| W01 | 14 | 4 | 5 | 5 |
| W02 | 12 | 0 | 3 | 9 |
| W03 | 12 | 1 | 2 | 9 |
| W04 | 12 | 6 | 2 | 4 |
| W05 | 12 | 4 | 2 | 6 |
| W06 | 14 | 0 | 3 | 11 |
| W07 | 13 | 0 | 1 | 12 |
| W08 | 12 | 2 | 5 | 5 |
| W09 | 10 | 2 | 4 | 4 |
| W10 | 10 | 0 | 0 | 10 |
| W11 | 11 | 4 | 2 | 5 |
| W12 | 10 | 0 | 3 | 7 |
| W13 | 13 | 4 | 3 | 6 |
| **合计** | **155** | **27** | **35** | **93** |

“✅ 可测”表示功能已有实现、用例可以直接执行，不代表会通过。状态按 2026-10-16 对代码的初步核对标注，执行前需要再确认。

## 说明

- 各文档的「实现现状」是 2026-10-14 按代码目录和接口做的初步核对，没有逐项验证 AC。现有后端（`hireos-written-backend`）是从 Screening 交接起步的精简模型，与 Spec v1.4 的实体有多处差异，见功能拆分 §3。
- 原型与 PRD 有冲突的地方（审批、My Tasks 结构、单候选人改题等）已在各 PRD「待确认」中标出，需要用户决定后回写。
- 支撑能力（通知、Files & Integrations、AI 模型、偏好与校准、统一身份与外壳、Written Test Agent）是功能拆分中的 W14～W19，未在此建文件夹。
