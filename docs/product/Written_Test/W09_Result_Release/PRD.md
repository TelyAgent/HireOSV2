# W09 产品文档：结果发布与候选人通知

| 项 | 内容 |
|---|---|
| 模块 | W09 / 主闭环第 7 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter、Hiring Manager；Candidate（查看结果） |
| 原型路由 | `#/results/:id/release`、计划页 **Evaluation result** tab、`#/candidate/results/:id`（[原型](../../../design/Written_Test/hireos-assessment-prototype.html)） |
| 实现现状 | 🟡 后端 `POST cases/:caseId/result/release` 保存发布内容（`Submission.release`：overall、showScore、outcome、feedback、nextStep）并推进 Case 到 released；前端 `ReleasePage` 已接真实接口。候选人结果页、邮件通知、退信重试、纠正 / 撤回未实现。未逐项验证 AC |
| 依据 | [PRD v1.4 §8](../../../../hireos-written/docs/Assessment_Written_Test_PRD_v1.4.md)、[Spec v1.4 §5](../../../../hireos-written/docs/Assessment_Written_Test_Interface_Spec_v1.4.md)、[Brief v1.1 §5.4、§5.6、P10](../../../../hireos-written/docs/Assessment_Written_Test_Prototype_Design_Brief_v1.1.md)、[Agent 对话流程 §10](../../../../hireos-written/docs/Written_Test_Agent_Conversation_Flow.md) |

## 1. 背景与目标

候选人看到的结果必须是经过批准的内容，不能带出内部排名、评审 notes 或参考答案。邮件发出不等于候选人收到，退信不应让评分回滚；复核中的状态也不能被当成最终结果。

**目标**：候选人结果是单独的白名单投影（CandidateResultRelease），至少说明结果和下一步；内部 final 确认与发布批准可一次完成；发布后自动在 Portal 发布并发邮件通知；发布与送达分开追踪。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| Release 页：左内部参考、右候选人预览 | 评分与 Finalize（W08） |
| 披露方式：Score + summary / Summary only | 下一步决定与交接（W11） |
| Outcome、Feedback、Next step 文案 | 修订反馈包内容（W10） |
| Finalize & publish result（复核 + 披露批准） | |
| Portal 发布、邮件通知、Delivery 状态、Retry notification | |
| 未 final 时的 Under review 进度通知 | |
| 候选人结果页 | |
| 纠正 / 撤回与历史 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | Release 页左栏显示内部参考：Overall（human）、是否有覆盖、Finalized by |
| FR-2 | 右栏显示候选人预览：Outcome、Score（按披露方式）、Feedback、Next step；标注「Never includes: internal ranking, reviewer notes, or the internal answer key.」 |
| FR-3 | 可切换披露方式并即时更新预览 |
| FR-4 | **Finalize & publish result** 需同时勾选 Internal review complete 和 Disclosure content approved for release |
| FR-5 | 发布后自动创建 Portal 结果版本并发送邮件通知；页面显示 Published 和 Delivery 状态 |
| FR-6 | Delivery 失败（如退信）时结果在 Portal 仍可见，提供 **Retry notification** |
| FR-7 | 结果未 final 时不能发布；可发送「Under review」进度通知，文案明确不是最终结果 |
| FR-8 | 候选人结果页只读显示已发布 Release：Outcome、Feedback、Next step；有修订 / 补测时显示入口（W10） |
| FR-9 | 纠正或撤回已发布结果生成新版本，保留历史；页面说明无法收回已发出的邮件 |
| FR-10 | 发布后显示 Next action 区（进入 W11） |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | CandidateResultRelease 是白名单投影；默认不含内部排名、notes、参考答案、Integrity 原始信号 |
| BR-2 | 内部评分、排名、notes 完全不进入候选人页面的 DOM 和数据 |
| BR-3 | 发布 ≠ 送达；退信不回滚评分和发布 |
| BR-4 | 发布批准可与内部 final 确认一次完成 |
| BR-5 | 候选人结果通知按已批准的 Release 自动发送；读取邮件不构成发送授权 |
| BR-6 | 纠正 / 撤回留历史，不承诺收回外部邮件 |
| BR-7 | 非 final 结果不能以最终结果形式发布 |
| BR-8 | 候选人结果中包含内部信息时停止自动发布（Agent 规则 §12） |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | Result（final，W08） | |
| 输出 | CandidateResultRelease | 版本、披露方式、outcome、score（可省略）、feedback、next_step、批准人、发布时间、状态（published / corrected / withdrawn） |
| 输出 | Notification request ref | 平台通知请求、Delivery 状态、重试 |

## 6. 权限

- 发布权限见「待确认」第 1 条。
- 候选人只能看到自己已发布的 Release。

## 7. 非功能要求

- 重复点击发布只生成一个 Release 版本、一封通知。
- 通知发送结果未知时先查询状态，不直接重发。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | Finalize & publish 后，候选人结果页显示白名单内容，页面数据中没有内部 notes、排名、答案 | C、Brief P10 |
| AC-2 | 模拟退信：结果仍为 Published，Delivery 显示失败，可 Retry notification | Brief P10 |
| AC-3 | 未 final 的结果不能发布，候选人只看到 Under review | C |
| AC-4 | Summary only 时候选人看不到分数 | Brief §5.6 |
| AC-5 | 纠正已发布结果生成新版本，旧版本在历史中可查 | G |

## 9. 依赖与实现

- 后端：`src/invitations/case-result.controller.ts`（release）、`src/cases/case-lifecycle.service.ts`。
- 前端：`ReleasePage`、`PlanPage`（Evaluation result tab）。
- 依赖：W08、W14。下游 W10、W11。

## 10. 待确认

1. 发布前是否需要第二人批准（同 W08 待确认第 1 条）。
2. 现有发布记录存在 `Submission.release` JSON，没有版本，纠正 / 撤回需要独立的 Release 表。
3. 候选人结果页在统一 Identity 上线前如何访问（沿用邀请 token 还是另发链接）。
