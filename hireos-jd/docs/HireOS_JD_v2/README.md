# HireOS Command — JD Management 交接包（2026-10-10）

## 包含内容
| 文件 | 说明 |
| --- | --- |
| `HireOS_Command_JD_Management_Prototype.html` | 可交互原型（单文件，纯 HTML/CSS/JS，无构建步骤），是当前已实现内容的唯一依据 |
| `HireOS_Command_JD_Copilot_Agent_PRD_v0.2.md` | JD Copilot Agent PRD：创建职位的 5 种方式、默认值、入口与侧边栏、功能需求（与 GitHub 仓库 `JD_Management/HireOS_Command_JD_Copilot_Agent_PRD_v0.1.md` 内容一致） |
| `HireOS_Command_JD_Completeness_Standard_v0.1.md` | JD 完整性标准：必填 9 项 / 选填 31 项，常见缺陷、分级与合规规则，是 AI 检查的依据 |

## 本地运行
```bash
python3 -m http.server 8847
# 打开 http://localhost:8847/HireOS_Command_JD_Management_Prototype.html#/jobs
```
字体来自 Google Fonts，离线时回退为系统字体。页面状态在内存中，刷新即重置（仅右侧面板宽度存 localStorage：`hireos-jw-side-width`；Copilot 抽屉宽度也有本地记忆）。
示例职位：`job-demo-101`（缺很多必填项）、`job-demo-102`（基本完整，含 1 条待修改项）。

## 已实现内容

### 1. 创建职位（职位列表页 → Ask Copilot）
首页 **Create a Job / Choose how you’d like to start.**，5 种并列方式，每个入口一个标题 + 一句话描述，标题右侧小 “i” 点击以提示条查看详情。点击后所选方式先作为用户消息出现，再由 Agent 对话引导。

| 入口 | 流程 | 输出 |
| --- | --- | --- |
| Quick Start | Agent 一次性发出 3 个问题（遇到的困难 / 希望候选人解决的问题 / 必备硬技能），可一次回答，缺哪个追问哪个；据回答推断职位名称，推断不出则追问 | 1 份草稿 |
| Start with a Job Title | Agent 只发引导文案，用户在底部输入框输入职位名称 | 3 份不同风格（Concise / Warm / Detailed）可对比选择 |
| Upload a JD | 点击入口直接弹出文件选择，选完直接解析 | 1 份草稿 |
| Paste a Link or Text | Agent 只发引导文案；链接按网页解析，≥60 字符或 ≥3 行按正文解析，太短则提示 | 1 份草稿 |
| Create Manually | 对话内表单；必填：职位名称、地点、招聘人数、岗位职责、岗位要求；选填：级别、工作模式、部门、汇报线、薪资范围（含 Hour/Day/Week/Month/Year）；点 Save 直接创建职位，不经 AI | 直接创建并进入编辑页 |

- 生成草稿后右侧展开 **Workspace**，与 Ask Copilot 面板左右并列；`Refine` 作用于所有版本；`Create job from this draft` 才创建职位，创建者为 Owner。
- 面板标题栏有 `新对话`（回到首页）；底部输入卡片含语音（模拟）和发送。
- AI 创建的默认值：未提供时地点 **Ho Chi Minh City, VN**、招聘人数 **1**、工作模式 **Hybrid**；Level 不设置；部门推断不出为 **Unassigned**。

### 2. 编辑页（`#/jobs/:id/document`）
1. **块编辑器**：章节 + 段落/要点，每块有可见范围 Public / Internal / Confidential；拖拽排序、删除；章节默认顺序：标题概述 → Responsibilities → Requirements → Preferred → Compensation → Success in the first 90 days。Preferred 默认 Public。
2. **职位名称**：页头标题可直接修改，与文档第一行大标题联动。
3. **字段行**：Location、Headcount（必填）和 Workplace type 始终显示；Level、Department、Team、Employment type、Hiring manager、Recruiter、Reports to、Priority 等选填项有数据才显示（系统默认值如 Full-time、normal、创建时自动填的负责人不算数据），可 `Add field` 手动加入、× 隐藏。
4. **必填检查（9 项）**：职位名称、地点、招聘人数、职位概述、核心职责、任职要求、每块有可见范围、JD 唯一 ID、语言版本。缺失项在文档内以红色占位块出现在默认章节位置，提供 `AI draft` / `Fill in`。
5. **待修改（Weak）**：职位名称含营销词/内部编号；Remote 无地区；概述少于 2 句；职责少于 3 条或以 “Responsible for” 开头；要求少于 3 条或含无法验证的说法（如 strong communication）。文档内黄色提示条，提供 `AI fix`。
6. **Analyze / Analysis**：工具栏 Analyze 按钮（带状态圆标）运行分析并切到右侧 Analysis 标签：状态摘要、按“合格”计算的进度、To complete / To revise / Suggestions（选填章节建议）/ Completed，并支持 `AI fix all`。
7. **Publish 门禁**：只有 Owner/Admin 可发布，且必填全部完成、无待修改项时按钮才可点。
8. **版本控制**：每份 JD 唯一 ID（JD-年份-编号）；每次 Publish 生成新版本，可对比、恢复。
9. **每个职位独立权限**：Owner（创建者，最高，唯一能管理成员）/ Admin（编辑、发布、查看敏感信息）/ Member（编辑、存草稿，不能发布、看不到 Confidential 块）/ 非参与者只读。入口：职位列表 → Edit job → Permissions。
10. **右侧面板**：Copilot（对话气泡、选中文字引用、底部输入卡片含语音与发送）+ Analysis；左边缘可拖宽（300px–窗口 60%）。

## 原型中是模拟的部分（需后端 / 真实模型）
- 所有 AI 能力（Copilot 改写、AI draft、AI fix、Analyze 建议、三风格版本、中文回答转英文、职位名称推断、语音转写）都是固定规则/模板，不是真实模型调用。
- 链接“解析”只按网址推断职位名称，不抓取网页；上传仅读取文本文件内容，PDF/DOCX 为模拟。
- 语音输入是模拟转写（随机示例句）。
- 权限、版本、发布渠道、审批等数据都在内存示例数据里，无持久化与鉴权。
- 保密内容目前只在文档编辑页按权限隐藏；Copilot 面板、版本对比、需求抽屉里的敏感数据尚未按权限限制。

## 关键数据结构（原型内）
- `state.jobs[id]`：`owner`、`permissions:[{userId, role:'admin'|'member'}]`、`title/location/headcount/level/workplaceType/department/reportsTo/salary`、`metaShown/metaHidden/metaAuto`（字段行显示控制）。
- `state.drafts['<jobId>:internal']`：`{blocks:[{id, kind:'h2'|'p'|'ul', text, level:'public'|'internal'|'confidential', aiDraft?}], saveState, revision}`。
- `REQ_ITEMS`（9 项必填）、`REQ_WEAK`（待修改规则）、`REQ_SUGGEST`（选填建议）、`GM_PATHS`（5 种创建方式）、`jobAccess(jobId)`（角色与能力）。

## 已移除 / 不在范围内
评估与证据标准、招聘流程、合规与敏感信息三组清单项；申请方式、审批、发布渠道、预算审批、级别等必填项（均改为选填或移除）；Must-have/Nice-to-have 条目标签；Additional information 模块；右下角浮动 Copilot 按钮。移动端 H5 版本未随这些改动更新，未包含在本包。

## 待产品确认
AI 创建的默认值是否需在界面标注为“默认”；上传 PDF/DOCX 的解析方案；粘贴文案的识别阈值；外部链接的抓取授权与版权边界；Agent 无法推断职位名称时是否一律追问。
