# I10 产品文档：面试阶段决定与双方确认

| 项 | 内容 |
|---|---|
| 模块 | I10 / 主闭环第 10 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter、Hiring Manager |
| 原型页面 | 项目页 `Decision & Next Steps` 标签（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 后端 `POST tasks/:id/decision-draft`（AI 起草结论段落和建议决定，引用评分原文）；`GET / PATCH tasks/:id/decision`（continue_next_round / hold / request_more_evidence / do_not_proceed / recommend_offer）；`PATCH tasks/:id/package/confirm`（`role: hr / hm`）分别记录确认时间，双方都确认后状态到 `package_published`。**不校验确认人是否真是 HR 或 HM**（代码注释：原型没有按角色登录）。底线例外、补证未完成时的阻塞未实现。前端 `DecisionPage` 已接接口。未逐项验证 AC |
| 依据 | [PRD v1.5 §3.3、§7、§6 INT-11、§12](../HireOS_Command_Interview_PRD_v1.5.md)、[任务列表 PRD §14](../HireOS_Command_Interview_Task_List_Status_and_Sorting_PRD_v1.0.md) |

## 1. 背景与目标

面试结论如果由一个人拍板，或者 AI 建议直接变成流程状态，就无法追责。底线没满足的例外推进更需要双方明确同意。

**目标**：记录面试阶段的人工决定；最终结论和底线例外由 HR 与 Hiring Manager 分别确认，只有一方确认时保持 pending；继续下一轮和推荐 Offer 是两个不同动作；面试通过不等于 Offer 获批。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| Recommended action：AI 起草的结论段落和建议决定，引用评分证据 | Offer 预算、HC、薪酬审批（Offer 模块） |
| 人工阶段决定：Continue to next round / Recommend for offer / Hold / Do not proceed / Request more evidence | 评估包生成与交接（I11） |
| 底线例外：Must-have 未满足或 Unknown 时的例外理由、风险和后续计划 | |
| HR 确认、HM 确认，各自的确认意见 | |
| 待确认横幅：谁已确认、在等谁 | |
| 门槛：补证未完成、计划轮次未完成时不能确认最终结论 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 显示 AI 起草的结论（Draft conclusion）：多少 Must-have 达标、哪些未达标、哪些未评分；每个说法有引用；标明是建议 |
| FR-2 | 决定选项和说明：Continue to next round（不是 Offer 推荐，下一轮必须有明确证据目标、负责人和时间）；Recommend for offer（表示「ready for Offer's review」，不是批准发 Offer）；Hold（保留现有证据和分数直到解除）；Do not proceed（仍需 HR 和 HM 分别确认） |
| FR-3 | 未完成计划轮次时选择 Recommend for offer，提示先完成计划轮次 |
| FR-4 | 补证轮未完成时，提示「Complete the follow-up evidence round before confirming a final conclusion.」，双方都不能确认 |
| FR-5 | 有 Must-have 为 Unknown 或未达标时，推荐 Offer 需要填写例外理由、风险和后续计划；例外同样需要 HR 和 HM 双方确认 |
| FR-6 | HR 和 HM 各有确认按钮和确认意见；一方确认后显示「HR has confirmed. Still waiting on the Hiring Manager…」；重复确认提示已确认 |
| FR-7 | 双方都确认后提示可以进入评估包；`Record decision · build package` 记录决定 |
| FR-8 | Interviewer 进入时显示「Interviewers do not confirm conclusions」，没有确认按钮 |
| FR-9 | 决定改变（例如从 Hold 改为 Recommend for offer）后，已有确认失效，需要重新确认 |
| FR-10 | 确认、改决定都写入审计；项目状态在 `Awaiting confirmation` 与 `Package published` 之间按规则变化；首页 M04 / G05 刷新 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | AI 建议（Strong Hire / Hire / Borderline / No Hire / Strong No Hire / Insufficient Evidence）与人工阶段决定不能直接互相映射成流程状态 |
| BR-2 | Proceed / Recommend for offer 不是 Offer 发放批准；Offer 最终批准由拥有该团队 HC 预算批准权的负责人在 Offer 模块决定 |
| BR-3 | 最终结论和底线例外都需要 HR 与 HM 分别确认；只有一方确认时为 pending；意见冲突进入复核，不自动完成 |
| BR-4 | 确认人必须真实具有对应角色，由服务端校验 |
| BR-5 | 同一人不能同时作为 HR 方和 HM 方确认（待确认） |
| BR-6 | Hold、Do not proceed、补证都不启动 Offer，分别保留等待、终结、补面路径 |
| BR-7 | 缺少可选资料不同于底线未满足；前者不需要例外 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Debrief、RequirementEvaluation | |
| 输出 | Decision draft | 结论段落、建议决定、引用 |
| 输出 | Human Stage Decision | 决定、理由、记录人、时间、版本 |
| 输出 | Exception | 涉及的 Must-have、理由、风险、后续计划 |
| 输出 | 确认记录 | HR 方 / HM 方、确认人、时间、意见；决定变化时失效 |

## 6. 权限

- HR / Recruiter：选择决定、HR 方确认。
- Hiring Manager：选择决定、HM 方确认。
- Interviewer：只读（原型中不可进入）。
- 确认接口必须校验角色，不能只靠前端隐藏按钮。

## 7. 非功能要求

- 确认按钮防重复提交；两人同时确认不会互相覆盖。
- 决定和确认的审计记录不可修改。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 只有 HR 确认时状态为 pending，评估包不能发布 | INT-11 |
| AC-2 | HR 已确认、HM 未确认：HR 的「待我确认」不计该项目，HM 计 1；全局「待双方确认」计 1 | HOME-AC02 |
| AC-3 | Continue to next round 与 Recommend for offer 是两个不同选项，前者不产生 Offer 推荐 | 任务列表 PRD §14 |
| AC-4 | Must-have 为 Unknown 时推荐 Offer，必须填写例外理由，且双方都确认后才生效 | §12 无证据的 Must-have |
| AC-5 | 补证轮未完成时，双方都无法确认 | 原型 |
| AC-6 | 以 Interviewer 身份调用确认接口返回 403；以 HR 身份确认 HM 方被拒绝 | BR-4 |
| AC-7 | 已确认后修改决定，原确认失效 | FR-9 |
| AC-8 | 选择 Hold 或 Do not proceed 不触发 Offer 交接 | §12 Hold / Reject |

## 9. 依赖与实现

- 后端：`intake/tasks.service.ts`（`decision`、`generateDecisionDraft`、`setDecision`、`confirmPackage`）、`rubric/decision-contracts.ts`。
- 前端：`pages/project/DecisionPage.tsx`。
- 依赖：I09、I15（角色校验）。下游 I11、I12（计数）。

## 10. 待确认

### #296 已确认的决定记录契约（2026-10-17）

- 人工理由选填（最多 4000 字符），与决定、服务端记录人、时间及独立决定版本一起保存。可单独更新理由，不需要切换决定。
- 决定记录与 Revision 审计在同一事务中写入；前端提交所读决定版本，冲突返回 409，不覆盖其他人的修改。同一人的完全相同请求重试不重复增加版本。
- 历史未保存的理由、记录人、时间、版本显示未记录，不根据当前用户或任务版本补造历史。
- AI 引用打开对应生成任务保留的评分快照，并展示生成时间及来源；不会随当前评分变化。找不到原始快照时明确显示不可用，不用最新评分替代。
- AI 输入使用能力卡各自的 JD 要求等级；缺失等级或人工分数显示未知，不默认 L3，也不以 AI 分数替代人工评分。
- 本项不代替 HR/HM 确认、不新增 Offer 接口，#319 仍待真实接口确定。

1. 确认接口目前用请求里的 `role` 字段决定确认哪一方，需要改为按登录身份的角色判断（I15）。
2. 同一人兼任 HR 和 HM 时能否两方都确认。
3. 「Request more evidence」作为决定选项，和 I09 Debrief 的补证弹窗是否是同一动作。
4. 原型确认动作挂在决定页，现有实现的确认接口叫 `package/confirm`。确认的对象是「决定」还是「评估包」？
