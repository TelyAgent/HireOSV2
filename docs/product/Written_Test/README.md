# Written Test 主流程产品文档

按 [功能拆分](Written_Test_Feature_Breakdown.md) 的 W01～W13 主流程，每个功能一个文件夹，各放一份 `PRD.md`。格式与 [Resume_Screening](../Resume_Screening/) 下的 `Fxx_*/PRD.md` 保持一致。

| 编号 | 文件夹 | 功能 |
|---|---|---|
| W01 | [W01_Question_Bank](W01_Question_Bank/PRD.md) | 题库与题目版本 |
| W02 | [W02_Builder_AI_Generation](W02_Builder_AI_Generation/PRD.md) | 组卷 Builder 与 AI 出题 |
| W03 | [W03_Project_Candidate_Linking](W03_Project_Candidate_Linking/PRD.md) | 测评项目与候选人关联 |
| W04 | [W04_Assessment_Plan](W04_Assessment_Plan/PRD.md) | 候选人测评计划 |
| W05 | [W05_Invitation_Sending](W05_Invitation_Sending/PRD.md) | 邀请与批量发送 |
| W06 | [W06_Candidate_Portal](W06_Candidate_Portal/PRD.md) | 候选人门户：验证、接受与作答 |
| W07 | [W07_Submission_Intake](W07_Submission_Intake/PRD.md) | 提交收件与 Submission Inbox |
| W08 | [W08_Evaluation_Review](W08_Evaluation_Review/PRD.md) | 评分与人工复核 |
| W09 | [W09_Result_Release](W09_Result_Release/PRD.md) | 结果发布与候选人通知 |
| W10 | [W10_Revision_Supplemental](W10_Revision_Supplemental/PRD.md) | 修订、重考与补测 |
| W11 | [W11_Next_Action_Handoff](W11_Next_Action_Handoff/PRD.md) | 下一步决定与交接 |
| W12 | [W12_Candidate_Comparison](W12_Candidate_Comparison/PRD.md) | 候选人对比 |
| W13 | [W13_My_Tasks_Statistics](W13_My_Tasks_Statistics/PRD.md) | 我的任务与首页统计 |

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

## 说明

- 各文档的「实现现状」是 2026-10-14 按代码目录和接口做的初步核对，没有逐项验证 AC。现有后端（`hireos-written-backend`）是从 Screening 交接起步的精简模型，与 Spec v1.4 的实体有多处差异，见功能拆分 §3。
- 原型与 PRD 有冲突的地方（审批、My Tasks 结构、单候选人改题等）已在各 PRD「待确认」中标出，需要用户决定后回写。
- 支撑能力（通知、Files & Integrations、AI 模型、偏好与校准、统一身份与外壳、Written Test Agent）是功能拆分中的 W14～W19，未在此建文件夹。
