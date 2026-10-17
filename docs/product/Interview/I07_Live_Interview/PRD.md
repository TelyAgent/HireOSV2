# I07 产品文档：实时面试与记录

| 项 | 内容 |
|---|---|
| 模块 | I07 / 主闭环第 7 步 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Interviewer |
| 原型页面 | 项目页 `Live Interview` 标签（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 后端：Zoom 主持流程（`meetings/host/*`）和 RTMS 实时转写（`rtms.service.ts`，写入 TranscriptLine）；`POST tasks/:id/interview-sessions`、`GET / PUT interview-sessions/:id/record/notes/me`（个人笔记）；`GET rounds/:id/transcript`；`POST rounds/:id/complete`。前端 `LivePage`、`LiveQuestionPanel`、`MeetingRecordPanel`、`ZoomMeetingPanel`。录制授权状态、AI 问题建议、证据缺口提示未实现；原型展示的是 Google Meet。未逐项验证 AC |
| 依据 | [PRD v1.5 §4 原则 8、§5 阶段 5、§6 INT-05、INT-06、INT-13（P1）](../HireOS_Command_Interview_PRD_v1.5.md) |

## 1. 背景与目标

面试官边问边记容易漏问、记录不全；录制被拒或转写失败时，如果没有替代路径，这一轮就没有证据。

**目标**：面试官按计划提问、灵活追问，并留下可追溯的问答记录；录制或转写不可用时用手工记录作为证据来源，并明确标出来源类型。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 会议区（嵌入或链接）、会议控制 | 自建视频会议基础设施 |
| 当前问题、目标能力、STAR 追问提示 | 面后评分（I08） |
| Next question / Skip / Add follow-up | 自主 AI 面试官（P2，INT-15） |
| 面试笔记，自动保存 | |
| 录制授权：开启 / 候选人拒绝 / 停止 | |
| 实时转写；转写失败与重试 | |
| AI 问题建议：Use as follow-up / Add to notes / Dismiss（P0 基础建议；实时自适应为 P1） | |
| 证据缺口提示（P1） | |
| 能力速览：要求、候选人经历、建议问题 | |
| 结束场次进入 Review | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 进入前置条件：已关联候选人、计划已批准、该轮已排期；否则提示对应原因 |
| FR-2 | 会议区显示会议（原型标注「Simulated — Google Meet」），提供静音、关摄像头、参与者、离开等控制 |
| FR-3 | 当前问题卡显示题目、目标能力、STAR 提示；`› Next question` 前进，`Skip` 跳过后该题仍显示为「未问」，`+ Add follow-up` 添加追问 |
| FR-4 | 笔记自动保存，显示保存状态；刷新或断网后不丢失已保存内容 |
| FR-5 | 录制状态：开启时显示「Recording & transcript active」；候选人拒绝录制时说明本轮证据改为面试官手工记录；停止录制后手工笔记仍可用 |
| FR-6 | 转写失败时录制不中断，提示手工记录成为本轮证据来源，并提供 `Retry transcription`；恢复后录制状态不变 |
| FR-7 | 转写标签实时显示带时间码的转写；时间码在 Review 中作为证据定位 |
| FR-8 | AI 问题建议卡标明「AI draft · suggestion only」；Use as follow-up 后作为「人选择的追问」加入当前问题；Add to notes 后在笔记中标注为 AI 输入；Dismiss 不改变任何分数或证据 |
| FR-9 | 证据缺口提示：例如候选人对连接池容量只给出定性回答，建议追问量级估算；只是提示，不自动提问 |
| FR-10 | 能力速览抽屉：当前问题背后的要求、候选人相关经历、建议问题 |
| FR-11 | `Complete session & go to Review` / `Mark round complete → Review` 结束本轮；缺席或中断时记录原因 |
| FR-12 | 已完成的轮次再进入时提示会议已结束，不能再加入 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 录制和转写按参与者的有效授权启用；授权撤回后停止后续采集 |
| BR-2 | AI 建议不会在没有人操作的情况下改变计划、问题或分数 |
| BR-3 | 实际问答按实际发生的保存，包括跳过、追问和新增问题 |
| BR-4 | 证据来源类型（transcript / manual notes）随证据保存，Review 中可见 |
| BR-5 | 候选人缺席和网络失败是流程事实，不计入能力低分 |
| BR-6 | 面试中的建议是即时建议，不是最终评价 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | InterviewRound、计划问题、Brief | |
| 输出 | InterviewSession | 轮次、开始 / 结束时间、状态（in_progress / completed / interrupted / no_show）、中断原因 |
| 输出 | RecordNote | 作者、内容、更新时间 |
| 输出 | TranscriptLine | 时间码、说话人、文本 |
| 输出 | Question / Answer 记录 | 实际问题、是否跳过、是否追问、来源（计划 / 人工新增 / AI 建议被采纳） |
| 输出 | 录制授权记录 | 状态（on / declined / stopped）、时间 |

## 6. 权限

- Interviewer：只能进入分配给自己的场次，写自己的笔记。
- HR / Recruiter、Hiring Manager：可以查看，不能代替面试官写笔记（待确认）。
- 候选人：只在会议中出现，不能访问面试工作区。

## 7. 非功能要求

- 笔记自动保存间隔和冲突处理待定；断网恢复后补存。
- 第三方会议界面不保证跟随 HireOS 的主题和字号（§8.3、§8.4）。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 候选人拒绝录制时，仍可完成本轮，证据来源标为手工记录 | §12 拒绝录制 |
| AC-2 | 模拟转写失败：录制不中断，手工记录成为证据来源；重试后转写恢复 | §12 转写失败 |
| AC-3 | 跳过的问题在记录中显示为未问，Review 中可见 | INT-06 |
| AC-4 | Dismiss AI 建议后，分数、证据和问题均无变化 | BR-2 |
| AC-5 | 采纳的 AI 建议在记录中标为「人选择的追问」 | INT-06 |
| AC-6 | 刷新页面后已保存的笔记仍在 | §4 原则 8 |
| AC-7 | 未排期时不能开始面试 | 原型门槛 |
| AC-8 | Interviewer 打开非自己负责的场次被拒绝 | §10 |

## 9. 依赖与实现

- 后端：`meetings/*`、`meeting-records/meeting-records.service.ts`、`intake/rounds.service.ts`（`complete`、`transcript`）。
- 前端：`pages/project/LivePage.tsx`、`features/live-interview/*`。
- 依赖：I04、I05、I06；会议供应商。下游 I08。

## 10. 待确认

### #335 已确认的 Skip 契约（2026-10-17）

- 以轮次和问题为唯一键保存未问状态、首次操作人、服务器时间及题目快照；重复 Skip 不覆盖首次记录，也不修改评分。
- 中间题保存成功后前进；最后一题也允许 Skip。保存失败保持当前题并显示错误。
- Live 刷新后恢复未问标记，Review 按轮次展示未问题及操作人、时间；其他轮次不继承标记。
- `POST rounds/:id/questions/:questionId/skip` 写入，`GET rounds/:id/skipped-questions` 读取。新记录要求已排期且未完成，并校验题目所属岗位和 Brief 版本；已有记录可幂等重试。
- 本项不新增追问流程、角色权限或自动评分规则。

1. 会议供应商（同 I05 待确认 1）。原型 Google Meet，实现 Zoom RTMS。
2. 录制授权由谁、在何时获取（会前邀请中 / 会议开始时）。
3. AI 问题建议首期是会后整理（P0）还是会中实时（P1）。
4. 多名面试官同场时，笔记各自独立还是共享。
