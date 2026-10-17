# I05 产品文档：排期与会议邀请

| 项 | 内容 |
|---|---|
| 模块 | I05 / 主闭环第 5 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | HR / Recruiter |
| 原型页面 | 项目页 `Schedule` 标签；右侧「Schedule / Edit arrangement」抽屉（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 后端 `POST rounds/:id/schedule` 保存时间、时区标签和手工粘贴的会议链接（不连接日历、不发邀请）；`meetings/host/*` 是独立的 Zoom 主持流程（OAuth、开会、RTMS）。前端 `SchedulePage` 已接接口。邀请发送与投递状态、改期 / 取消 / 缺席、Google Meet 未实现。未逐项验证 AC |
| 依据 | [PRD v1.5 §5 阶段 4、§6 INT-04、§13](../HireOS_Command_Interview_PRD_v1.5.md) |

## 1. 背景与目标

排期涉及候选人、多名面试官、不同时区和会议工具。邀请发失败、重复建会、改期后旧会议还在，都会直接影响候选人体验。

**目标**：为每轮安排时间、面试官和会议；时区清楚；邀请状态可见，失败时说明原因并可重试；重复请求不重复建会。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 轮次排期表：Round、Date & time、Interviewer、Meeting | 计划内容编辑（I04） |
| 时区说明：按用户本地时区显示，邀请中按各参与者本地时区 | 自建视频会议 |
| 会议链接：Google Meet 优先，Zoom 可选；可手工粘贴 | 候选人自助选时间（待确认） |
| 改期、取消、缺席记录 | |
| 邀请投递状态与失败重试 | |
| 补面轮（Add make-up round） | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 未批准计划时进入排期，提示「Approve the interview plan before scheduling.」 |
| FR-2 | 表格每轮显示时间（含时区）、面试官、会议方式和状态 |
| FR-3 | 页面说明「All times shown in your local time zone (UTC+8). Participants may be in different time zones — invitations show each participant's local time.」 |
| FR-4 | 编辑抽屉填写日期时间、面试官、会议链接；缺少时间或面试官时提示「Enter a date, time and interviewer.」 |
| FR-5 | 会议链接支持 Google Meet 和 Zoom；说明原型不发送真实邀请 |
| FR-6 | 邀请投递失败（如候选人邮箱已满）时，该轮显示失败原因，并说明「No calendar hold was created」；提供 Retry |
| FR-7 | Reschedule 改期：更新时间并通知参与者，旧会议作废，不留两个有效会议 |
| FR-8 | 取消和缺席（no-show）有独立状态和原因；缺席是流程事实，不计入能力评分 |
| FR-9 | `+ Add make-up round` 新增补面轮，继承当前 Rubric 版本，只考分配给它的能力 |
| FR-10 | Interviewer 不能编辑排期，提示「Business interviewers cannot edit scheduling.」 |
| FR-11 | 排期成功后项目状态从 `Ready to schedule` 前进到 `Interview in progress`；首页相关计数刷新 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 发送个人邀请需要候选人联系方式；没有时只能保存时间，不能发邀请 |
| BR-2 | 同一轮重复提交排期只产生一个有效会议和一份邀请 |
| BR-3 | 时间以 UTC 存储，按查看者时区显示 |
| BR-4 | 权限或集成失败产生可操作的反馈，不显示「已发送」 |
| BR-5 | Google Meet 是视觉和产品偏好，实际嵌入和数据能力未验证前不宣称已集成 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | InterviewRound（已批准计划） | |
| 输出 | InterviewRound 排期字段 | scheduledAt（UTC）、timezone、meetingLink、interviewerId、version |
| 输出 | 邀请投递记录 | 收件人、渠道、状态（sent / failed）、失败原因、重试次数、幂等键 |
| 输出 | 场次状态 | scheduled / rescheduled / cancelled / no_show，及原因 |

## 6. 权限

- HR / Recruiter：排期、改期、取消、记录缺席。
- Hiring Manager：查看；是否可排期待确认。
- Interviewer：只看自己的场次时间和会议链接。

## 7. 非功能要求

- 排期和邀请发送防双击。
- 日历 / 会议供应商不可用时保留已填内容。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 未批准计划时不能排期 | 原型门槛 |
| AC-2 | 不同时区的面试官看到的时间换算正确，存储为 UTC | FR-3 |
| AC-3 | 模拟邀请投递失败：该轮显示失败原因，没有创建日历占位；Retry 成功后状态变为已发送 | 原型 |
| AC-4 | 双击保存排期只产生一个会议 | §5 阶段 4 |
| AC-5 | 改期后旧会议链接失效，参与者收到更新 | INT-04 |
| AC-6 | 记录缺席后，该轮不产生能力低分 | §10 |
| AC-7 | Interviewer 调用排期接口返回 403 | 原型 assignee |

## 9. 依赖与实现

- 后端：`intake/rounds.service.ts`（`schedule`）、`meetings/zoom-host.service.ts`、`meetings/zoom-oauth.controller.ts`。
- 前端：`pages/project/SchedulePage.tsx`。
- 依赖：I04；会议 / 日历连接器；平台邮件通知。下游 I06、I07。

## 10. 待确认

### #260 已确认的面试官补填范围（2026-10-17）

- 计划确认后，Schedule 抽屉允许为未完成且未指定面试官的轮次补充分配，与排期一起保存，不修改题目、能力等计划内容。
- 排期 API 接收可选 interviewerId；校验同 Workspace 的面试官，仅允许补填，不能用此入口更换已有面试官。已完成轮次不能补填。
- 轮次版本与补填条件共同保护并发更新；冲突后重新读取轮次，失败保留输入。面试官列表失败可重试，未选择不能提交。
- 不自动发送邀请，不新增向导，不扩展身份角色规则或面试官更换流程。

1. 会议供应商：PRD 偏好 Google Meet，现有实现只接了 Zoom。首期用哪个？
2. 邀请由 HireOS 发送（需要平台邮件服务），还是只生成链接由 HR 自己发？
3. 是否需要候选人自助选择时间段。
4. 改期 / 取消 / 缺席是否需要原因必填。
