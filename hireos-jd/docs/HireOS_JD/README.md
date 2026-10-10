# HireOS Command — JD Management 交接包（2026-10-09）

## 包含内容
| 文件 | 说明 |
| --- | --- |
| `HireOS_Command_JD_Management_Prototype.html` | 可交互原型（单文件，纯 HTML/CSS/JS，无构建步骤） |
| `HireOS_Command_JD_Completeness_Standard_v0.1.md` | JD 完整性标准：必填 / 选填清单、常见缺陷、分级与合规规则，是 AI 检查的依据 |

## 本地运行
```bash
python3 -m http.server 8847
# 打开 http://localhost:8847/HireOS_Command_JD_Management_Prototype.html#/jobs/job-demo-102/document
```
字体来自 Google Fonts，离线时回退为系统字体。页面状态都在内存中，刷新即重置（仅右侧面板宽度存 localStorage：`hireos-jw-side-width`）。
示例职位：`job-demo-101`（缺很多必填项）、`job-demo-102`（基本完整，含 1 条待修改）。

## 当前功能（编辑页 `#/jobs/:id/document`）
1. **块编辑器**：章节（h2）+ 段落/要点；每块有可见范围 Public / Internal / Confidential；可拖拽排序、删除；章节默认顺序：标题概述 → Responsibilities → Requirements → Preferred → Compensation → Success in the first 90 days。
2. **标题下字段**：Location / Headcount / Level 为必填（空时红色虚线标记）；"Add field" 可按需添加选填字段（部门、团队、雇佣类型、工作方式、用人经理、招聘负责人、汇报对象、招聘原因、优先级、到岗/截止日期）。
3. **必填检查（按完整性标准）**：共 11 项必填：职位名称、级别、地点、招聘人数、职位概述、核心职责、任职要求、对外薪资范围、每块有可见范围、JD 唯一 ID、语言版本。
   - 缺失：文档内红色占位块（按章节默认顺序出现在应在的位置），提供 "AI draft" / "Fill in"。
   - **待修改（Weak）**：已填写但命中常见缺陷（营销词/内部编号、Junior 要求 5 年+、Remote 无地区、概述少于 2 句、职责少于 3 条或以 "Responsible for" 开头、要求少于 3 条/含无法验证的词如 "strong communication"/通用技能），文档内黄色提示条，提供 "AI fix"。
4. **Analyze / Analysis**：工具栏 Analyze 按钮（带状态圆标）运行分析并切到右侧 Analysis 标签：状态摘要、按"合格"计算的进度、To complete / To revise / Suggestions（选填章节建议）/ Completed。
5. **Publish 门禁**：只有 Owner/Admin 可发布，且必填全部完成、无待修改项时按钮才可点（否则灰色并有提示）。
6. **版本控制**：每份 JD 唯一 ID（JD-年份-编号）；每次 Publish 生成新版本，保留历史、可对比、可恢复。
7. **每个职位独立权限**：创建者 = Owner（最高，唯一能管理成员）；参与者角色 Admin（可编辑、发布、查看敏感信息）/ Member（可编辑、存草稿，不能发布、看不到 Confidential 块）；非参与者只读。设置入口：职位列表 → Edit job → Permissions。
8. **右侧面板**：Copilot（对话气泡、选中文字引用、底部输入卡片含语音与发送）+ Analysis；面板左边缘可拖动调宽（300px–60% 窗口宽）。
9. **Ask Copilot — Create a job**（职位列表右上角）：自然语言 / 上传模板 / 粘贴链接 / 传统表单四种创建路径，统一生成草稿；每次生成 A·Concise / B·Warm / C·Detailed 三个风格版本供选择；右侧 Workspace 预览；面板标题栏有 New chat。

## 原型中是模拟的部分（需要后端 / 真实模型实现）
- 所有 AI 能力（Copilot 改写、AI draft、AI fix、Analyze 建议、三风格版本、中文回答转英文、语音转写）都是固定规则/模板，不是真实模型调用。
- 语音输入是模拟转写（随机示例句），没有调用 Web Speech / ASR。
- 权限、版本、发布渠道、审批等数据都在内存示例数据里，无持久化与鉴权。
- 保密内容目前只在文档编辑页做了按权限隐藏；Copilot 面板、版本对比、需求抽屉里的敏感数据尚未按权限限制。

## 关键数据结构（原型内）
- `state.jobs[id]`：`owner`、`permissions: [{userId, role:'admin'|'member'}]`、`title/level/location/headcount…`
- `state.drafts['<jobId>:internal']`：`{blocks:[{id, kind:'h2'|'p'|'ul', text, level:'public'|'internal'|'confidential', aiDraft?}], saveState, revision}`
- `REQ_ITEMS`（必填项定义）、`REQ_WEAK`（待修改规则）、`REQ_SUGGEST`（选填建议）、`jobAccess(jobId)`（角色与能力）。

## 已移除 / 不在范围内
评估与证据标准、招聘流程、合规与敏感信息三组清单项；申请方式、审批、发布渠道、预算审批等必填项；Must-have/Nice-to-have 条目标签；Additional information 模块；移动端 H5 版本未随本次改动更新，未包含在本包。
