# M9 线上问题 GitHub Issue 草稿

日期：2026-10-15。依据：[线上测试报告](Test_Report_2026-10-14.md)、[问题清单](Issue_Triage_2026-10-15.md)、[M9 PRD](PRD.md) 和 [M9 用例](User_Cases.md)。此文件仅供创建前确认；以下 Issue 尚未创建。每个草稿的 `AI Ready` 暂填 `No`，待用户确认 AC 后创建时改为 `Yes`。

## 现有 Issue #76 的补充草稿（M9-B02）

现有 [#76](https://github.com/TelyAgent/HireOSV2/issues/76) 覆盖 Workplace type 缺失和 Level 的显示稳定性，避免另开重复 Bug。建议在其 Scope 增加：M9 编辑页初始、保存、刷新后的字段行一致；Workplace type 始终显示，Add field 菜单不列出它。建议增加：

- AC-4: M9 编辑现有 Draft 时，初始、保存和刷新后的字段行均显示 Workplace type；即使值未设置也保持可见。
- AC-5: 在 M9 打开 Add field 菜单，Workplace type 不在候选列表中；已有字段不重复出现。用 UI 测试覆盖。

Level 的 `Not set` 校验与 Ready 规则由下方独立 Issue 承接，#76 仅处理字段显示稳定性。对 #76 的补充也需用户确认后才提交。

## 草稿 1：M9-B01 页头标题无法编辑

### Type

Bug

### Subsystem

hireos-jd

### Problem

M9 线上页头标题为纯文本，没有编辑入口；文档大标题可编辑，导致双向同步只有文档到页头的方向可操作。测试报告 UC-M9-01 失败。

### User Outcome

用户可以直接从页头或文档大标题修改职位名，并在保存、刷新和返回列表后看到同一标题。

### Scope

M9 页头标题编辑入口、两处标题同步与持久化；回归已有文档标题到页头路径。

### Non-goals

不改变职位列表的其他字段或创建流程。

### Acceptance Criteria

- AC-1: 从页头输入新标题并提交后，文档大标题显示同一值；刷新和职位列表也一致。UI/API 测试覆盖。
- AC-2: 从文档大标题输入新标题并提交后，页头、刷新和列表一致；失败时不显示保存成功。UI/API 测试覆盖。
- AC-3: 空标题按现有必填规则拒绝，旧标题保留；重复提交不产生两个不同标题。边界测试覆盖。

### References

`docs/product/JD_Management/M9_Edit_Copilot/PRD.md` FR-1/AC-1；`User_Cases.md` UC-M9-01/02；`Test_Report_2026-10-14.md`。

### Dependencies

Refs #57（M9 自动化测试）；无阻塞依赖。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

No（待确认 AC）

### Reproduction

打开线上已有 Draft 的职位编辑页，查看页头标题；它是纯文本，无法像文档大标题一样进入编辑状态。文档大标题改名后页头会更新。

### Expected / Actual

预期：页头和文档大标题均可编辑并双向同步。实际：页头无编辑入口。

### Environment

2026-10-14 线上 HireOS JD 页面；Codex in-app browser；构建号未知。测试用 Draft ID `d3039b95-1e58-44b0-9d20-a4b499e1856e`，不含候选人数据。

### Severity

S2

## 草稿 2：M9-B04 右侧面板无法调宽

### Type

Bug

### Subsystem

hireos-jd

### Problem

M9 线上右侧面板约 360px 固定宽度，未见拖动或键盘调整入口；窄视口下挤压文档编辑区。测试报告 UC-M9-08 失败。

### User Outcome

用户可以按工作需要调整 Copilot/分析面板宽度，并在刷新后保留选择。

### Scope

调整入口、宽度边界、刷新记忆和键盘操作；覆盖桌面、窄视口和 200% 缩放。

### Non-goals

不重做面板内容或改变 Copilot 功能。

### Acceptance Criteria

- AC-1: 桌面视口可将右侧面板调整在 300px 至窗口宽度 60% 的范围内，超界输入被限制；UI 测试覆盖。
- AC-2: 调整后刷新，面板恢复上次有效宽度；视口缩小时宽度重新限制到可用范围。UI 测试覆盖。
- AC-3: 调整控件可用键盘操作，在 200% 缩放下不遮挡文档主要编辑操作。键盘与缩放测试覆盖。

### References

`docs/product/JD_Management/M9_Edit_Copilot/PRD.md` FR-5；`User_Cases.md` UC-M9-08；`Test_Report_2026-10-14.md`。

### Dependencies

Refs #57；无阻塞依赖。

### Risk

low

### Owner

@JsonSuCoder

### AI Ready

No（待确认 AC）

### Reproduction

打开线上 Draft 编辑页，尝试在右侧面板边缘寻找可见或可访问的调宽控件；未找到，面板保持约 360px。

### Expected / Actual

预期：面板在规定范围内可调并记忆。实际：无调整入口。

### Environment

2026-10-14 线上 HireOS JD 页面；Codex in-app browser，约 660 × 694 视口；构建号未知。

### Severity

S3

## 草稿 3：M9-B05 正文编辑未自动保存

### Type

Bug

### Subsystem

hireos-jd

### Problem

线上修改 JD 正文后显示 `Unsaved changes`，必须手动点击 Save；与 M9 FR-9 和 JD 总 PRD 的自动保存规则不一致，离页存在丢失编辑内容的风险。普通保存可用；断网与服务端失败路径尚未注入测试。

### User Outcome

用户编辑正文后无需额外点击 Save 即可可靠保存，并能分辨保存中、成功及失败状态。

### Scope

正文自动保存、状态反馈、失败后的本地内容保留及恢复重试、离页保护；保持已有并发版本校验。

### Non-goals

不在此 Issue 实现冲突差异查看与人工合并；由单独 Issue 承接。

### Acceptance Criteria

- AC-1: 修改正文并停止输入后，无需点击 Save，页面进入 Saving 后显示 Saved；刷新回读最新内容。UI/API 测试覆盖。
- AC-2: 断网或 HTTP 500 时不显示 Saved，用户当前编辑保留；网络恢复后可重试并持久化。故障注入测试覆盖。
- AC-3: 保存尚未完成时离页，用户得到明确的未保存提示或系统保证内容可恢复；测试覆盖离页与刷新。
- AC-4: 遇到版本冲突时不静默覆盖远端，保留本地编辑并进入冲突处理路径。并发测试覆盖。

### References

`docs/product/JD_Management/M9_Edit_Copilot/PRD.md` FR-9/AC-6；`User_Cases.md` UC-M9-14；`docs/product/JD_Management/HireOS_Command_JD_Management_PRD_v1.3.md` §17；`Test_Report_2026-10-14.md`。

### Dependencies

Refs #57；冲突合并交互由本草稿第 6 项承接，无阻塞依赖。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

No（待确认 AC）

### Reproduction

打开线上 Draft，修改正文；页面停留在 `Unsaved changes`，需点击 Save 才出现 Saving/Saved。

### Expected / Actual

预期：正文自动保存且失败可恢复。实际：正常编辑需要手动保存；故障路径尚未验证。

### Environment

2026-10-14 线上 HireOS JD 页面；Codex in-app browser；构建号未知。仅测试专用 Draft。

### Severity

S2

## 草稿 4：M9-B06 改写前缺少选区引用

### Type

Bug

### Subsystem

hireos-jd

### Problem

选中文字后，Copilot 侧栏只显示 `Current block` 摘要，没有明确的所选文字引用或范围。用户难以确认改写将作用于哪段文字。测试报告 UC-M9-09 为部分满足。

### User Outcome

用户发送改写指令前可以核对选区和作用范围，避免误改其他段落。

### Scope

改写输入区的选中文字引用、范围提示与选区变化后的同步；回归 Accept/Reject 仍只改目标内容。

### Non-goals

不改变 AI 模型或引入无选区的通用问答能力。

### Acceptance Criteria

- AC-1: 用户选中文字后，Copilot 输入区显示可辨认的所选文本摘要和作用范围；选区变化时同步更新。UI 测试覆盖。
- AC-2: 取消选区或切换目标块时，不沿用旧引用；发起改写前可辨认当前目标。UI 测试覆盖。
- AC-3: 提交请求仅携带当前授权目标范围，Accept 只更新目标内容；网络请求和文档回读测试覆盖。

### References

`docs/product/JD_Management/M9_Edit_Copilot/PRD.md` FR-6/AC-4；`User_Cases.md` UC-M9-09；`Test_Report_2026-10-14.md`。

### Dependencies

Refs #57；无阻塞依赖。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

No（待确认 AC）

### Reproduction

在公开职责段落中选择 `Build reliable application workflows`，观察发送前侧栏：只有 `Current block`，没有独立的选区引用标签。

### Expected / Actual

预期：显示选中文字及范围。实际：只显示当前块摘要。

### Environment

2026-10-14 线上 HireOS JD 页面；Codex in-app browser；构建号未知。

### Severity

S3

## 草稿 5：M9-B07 Level 不能设为 Not set

### Type

Bug

### Subsystem

hireos-jd

### Problem

线上清空 Level 会提示“职级 为必填项，不能为空。”并恢复原值；2026-10-15 产品决定已将 Level 改为允许 Not set、完整性标准 A4 改为选填，共 10 项必填。当前编辑校验与产品规则冲突。

### User Outcome

用户可以表达尚未确定职级，且此状态不会被误判为缺少必填项或阻止 Ready。

### Scope

M9 Level 设置/清空、字段可见性、保存回读和 M6 完整性/Ready 规则同步。

### Non-goals

不改变其他必填项或自动推断 Level。

### Acceptance Criteria

- AC-1: 将现有 Level 设为 Not set 后保存并刷新，值保持未设置，字段行按 M9 规则隐藏；可通过 Add field 再设值。UI/API 测试覆盖。
- AC-2: Level 未设置不显示必填错误，不计入 Missing；其他 10 项满足且无其他阻断时允许 Ready。M6 分析测试覆盖。
- AC-3: Level 已设置时仍参与对应的条件检查；清空后相关条件检查不应因缺失 Level 而报错。规则测试覆盖。

### References

`docs/product/JD_Management/M9_Edit_Copilot/PRD.md` FR-4/AC-3；`docs/product/JD_Management/HireOS_Command_JD_Completeness_Standard_v0.1.md`（文内 v0.3）；`docs/product/JD_Management/M6_Analyze_AI_Fix/PRD.md`；`User_Cases.md` UC-M9-07；`Test_Report_2026-10-14.md`。

### Dependencies

Refs #76（字段行显示稳定性）、#57（测试）；无阻塞依赖。

### Risk

medium

### Owner

@JsonSuCoder

### AI Ready

No（待确认 AC）

### Reproduction

打开线上 Draft，将 Level 设为 Staff，清空并移焦；值恢复 Staff，提示职级必填。

### Expected / Actual

预期：允许 Not set，保存回读一致且不阻断 Ready。实际：清空被必填校验拒绝。

### Environment

2026-10-14 线上 HireOS JD 页面；Codex in-app browser；构建号未知。产品规则于 2026-10-15 确认。

### Severity

S2

## 草稿 6：M9-B08 冲突无法查看与人工确认合并

### Type

Feature

### Subsystem

hireos-jd

### Problem

双标签编辑同一 Draft 时，过期保存会显示冲突提示并保留本地未保存状态，但用户没有入口查看双方改动或完成受控合并。2026-10-15 产品决定要求点击查看冲突、人工确认合并。

### User Outcome

用户在并发编辑冲突后能看见本地与远端差异，自主决定合并结果，确认前不会覆盖他人的修改。

### Scope

冲突提示到差异查看的入口、本地和远端版本展示、人工处理重叠内容、预览、显式确认合并、取消与重试路径。

### Non-goals

不自动选择重叠内容，不引入实时多人协作编辑。

### Acceptance Criteria

- AC-1: 两个标签页编辑同一 Draft，过期保存出现冲突；用户点击后可查看本地与远端内容和差异，本地未保存编辑保留。并发 UI/API 测试覆盖。
- AC-2: 用户可人工处理重叠内容，预览最终文档；只有显式确认合并后才提交，确认前远端保持原值。并发回读测试覆盖。
- AC-3: 取消合并时远端不变，本地草稿仍可恢复；确认期间远端再次变化时不静默覆盖，而是重新提示冲突。并发测试覆盖。

### References

`docs/product/JD_Management/M9_Edit_Copilot/PRD.md` FR-11/AC-7；`User_Cases.md` UC-M9-15；`Test_Report_2026-10-14.md`。

### Dependencies

Refs #57（测试）；无阻塞依赖。

### Risk

high

### Owner

@JsonSuCoder

### AI Ready

No（待确认 AC）

### User Flows

编辑并保存 → 版本冲突 → 点击查看双方改动 → 人工处理重叠内容 → 预览 → 确认合并或取消；确认期间再冲突则重新处理。

## 暂不建 Issue：M9-B03

Recruiter 人员显示刷新后变为 Not set，但测试时没有明确选择人员。先补最小复现，再决定是否创建 Bug；现有证据不足以写成“已复现持久化缺陷”。
