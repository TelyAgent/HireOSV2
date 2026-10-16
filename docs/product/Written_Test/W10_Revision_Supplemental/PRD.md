# W10 产品文档：修订、重考与补测

| 项 | 内容 |
|---|---|
| 模块 | W10 / 主闭环第 8 步（结果发布之后的分支） |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter、Hiring Manager；Candidate（接受新轮、提交修订） |
| 原型路由 | `#/cases/:id/revisions/:round`；Release 页 **Request revision** / **Add supplemental test**（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🔴 后端没有轮次（Round）、FeedbackPackage、Revision 实体；邀请与 Case 之间没有轮次区分。前端没有修订页。补测可通过计划页再加题（W04）近似实现，但不区分补测类型。未逐项验证 AC |
| 依据 | [PRD v1.4 §9](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §5](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §5.6、P11、P12](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md)、[Agent 对话流程 §6、§7](../../../../hireos-written/docs/Written_Test_Agent_Conversation_Flow.md) |

## 1. 背景与目标

测评不一定一次结束：可能需要用同一答案重新评分、给提示后让候选人修改、重新考一次，或者加一道题验证还没测到的能力。如果这些操作改写了原稿或旧分，或者看过答案后的修订和初稿混在一起排名，就无法判断候选人的真实能力。

**目标**：Rescore、Revision、Retake、Supplemental 四种后续各自独立记录；每次新轮独立邀请、接受、线程关联；原稿、提示和修订并列对照；没有同条件可比时不计算分差。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 四种后续：Rescore、Revision、Retake、Supplemental | 首轮邀请发送机制（W05，本功能复用） |
| FeedbackPackage：hint_only / issue_specific / worked_solution + 内部 notes | 评分细节（W08，本功能复用） |
| 发送前固定反馈内容并批准 | 下一步的其他选项（W11） |
| 新轮独立邀请、接受、线程 | |
| 修订页：Original / Feedback / Revised 对照、Compare changes | |
| 补测：按未测能力从题库选题，新建 PlanItem | |
| delta（分差）规则 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | **Request revision** 弹窗填写给候选人的反馈和新截止时间；说明「原轮次保持锁定可见，新轮次有自己的邀请和线程」 |
| FR-2 | 反馈包选择披露级别：hint_only / issue_specific / worked_solution；内部 notes 与候选人可见内容分开 |
| FR-3 | 反馈内容发送前固定，发送后不可修改 |
| FR-4 | 修订页显示轮次号和状态（如「Not yet accepted by candidate」） |
| FR-5 | 修订页 Original / Feedback / Revised 三块按 tab 切换；Compare changes 显示每个问题的已修正 / 部分修正 / 未解决，以及提示披露级别 |
| FR-6 | 没有收到修订答案或缺初稿时显示「Not comparable」，不显示分差 |
| FR-7 | **Approve revised scores** 确认修订轮的评分（评分过程沿用 W08） |
| FR-8 | **Add supplemental test** 用题库抽屉按未测能力选题，创建新的 PlanItem（类型为补证），不修改原题 |
| FR-9 | 候选人端修订入口标「Revision round 1」，显示提示和新期限；补测标「Additional assessment」；都需要明确接受新安排 |
| FR-10 | 候选人可通过邮件回复修订答案，匹配到本轮线程（如「Matched by reply thread — Round 1 revision」） |
| FR-11 | Rescore 对同一答案生成新的评价版本，不新建 Attempt |
| FR-12 | Retake 创建新 Attempt 和新邀请 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | Rescore = 同一答案新评价；Revision = 看过提示后新 Attempt；Retake = 重考新 Attempt；Supplemental = 新能力新 PlanItem |
| BR-2 | 每次新轮独立邀请、接受、线程关联；同一 hr 邮箱下旧线程不重定向到新轮 |
| BR-3 | 原稿、旧分、旧 Release 不被修改 |
| BR-4 | 没有同标准、同条件可比较时 delta = null |
| BR-5 | 不能仅凭分数提高推断学习能力 |
| BR-6 | 初稿与看过答案后的修订不混排（W12） |
| BR-7 | AI 建议的修订 / 补测只是提案，经负责人批准后才发信 |
| BR-8 | 修订或补测没有创建独立邀请时停止自动处理（Agent 规则 §12） |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Result / Release（W08、W09） | |
| 输出 | FeedbackPackage | 披露级别、候选人可见内容、内部 notes、批准人、固定时间 |
| 输出 | Round | 序号、类型（revision / retake / supplemental）、关联 FeedbackPackage |
| 输出 | Attempt（新） | 轮次、帮助条件 |
| 输出 | PlanItem（补测） | 类型 = 补证、能力、题目版本 |
| 输出 | RevisionComparison | 问题项、状态（已修正 / 部分 / 未解决）、delta（可 null） |

## 6. 权限

- 能访问该 Case 的员工可发起；反馈包是否需要他人批准见「待确认」第 1 条。
- 候选人只能看到本人的新轮次和披露给本人的反馈。

## 7. 非功能要求

- 重复点击发送修订请求只产生一轮。
- 旧轮迟到的邮件不进入新轮。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 给提示 → 新邀请 → 候选人接受 → 修订提交 → Original / Feedback / Revised 对照；旧线程的邮件不进入新轮 | C、Brief P11 |
| AC-2 | 修订轮评分后，原轮次的分数和 Release 不变 | C |
| AC-3 | 未收到修订答案时显示 Not comparable，不显示分差 | Brief §5.6 |
| AC-4 | 按未测能力选 FIN-002 / FIN-008 补测，生成新 PlanItem 和新邀请，旧分数不变 | C、Brief P12 |
| AC-5 | 反馈包发送后不能修改 | PRD §9 |

## 9. 依赖与实现

- 后端：需新建轮次与反馈模块；复用 `src/invitations`、`src/plan-items`。
- 前端：需新建修订页；复用 `PlanPage`、`ReleasePage`。
- 依赖：W04、W05、W06、W08、W09。下游 W12。

## 10. 待确认

1. PRD §12 有「反馈修订批准」「补测批准」任务，原型没有审批。反馈包和补测是否需要第二人批准？
2. 现有 `Case` 与 `Invitation` 之间没有轮次概念，需要新增 Round 实体（涉及 Prisma 迁移和 Case 状态机）。
3. Retake 在原型中没有入口，是否需要在本期提供。
