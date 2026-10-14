# M9 产品文档：职位编辑与 Copilot 改写

| 项 | 内容 |
|---|---|
| 模块 / 优先级 | M9 / P1 |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | Recruiter / TA；Hiring Manager 编辑授权字段 |
| 同目录文档 | [User Journey](User_Journey.md) · [输入输出闭环](Loop_IO.md) |
| 实现现状 | 🟡 后端已有职位字段更新、文档读写、rewrite、suggestions 接口；并发冲突控制未确认；线上部分验证（F-012） |
| 依据 | [测试脚本 v0.1 J9、J10](../HireOS_Command_JD_Management_User_Journeys_v0.1.md)、[PRD v1.3 §17](../HireOS_Command_JD_Management_PRD_v1.3.md)、[完整性标准 v0.1 A4、A7](../HireOS_Command_JD_Completeness_Standard_v0.1.md) |

## 1. 背景与目标

用户需要在一个页面里改好 JD 的标题、字段和正文，并让 Copilot 帮忙改写选中的段落。改动要可靠保存，AI 改写必须由用户确认。

**目标**：标题、字段、正文的编辑一致且持久；Copilot 改写只作用于选区，接受前不改正文。

本模块包含三个可独立测试的子流程：**M9a 标题联动**、**M9b 字段行**、**M9c Copilot 选区改写**，以及公共的自动保存。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| 页头标题与文档大标题双向同步 | 不选文字的招聘问答和薪资调研（建议的 M10） |
| 字段行：必填不可清空、Add field、隐藏字段 | 评论、Suggesting 协作模式 |
| 右侧面板宽度调整 | 结构化要求（JRP）同步 |
| 选区改写，原位差异，Accept / Reject | |
| 自动保存与失败恢复、中英文界面 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 修改页头标题，文档第一行大标题同步；反之亦然 |
| FR-2 | 字段行始终显示 Location、Headcount、Workplace type；必填字段清空时提示并恢复原值 |
| FR-3 | Add field 菜单不含已显示的字段和 Workplace type；添加后一直显示；点 × 隐藏，可再加回 |
| FR-4 | Level 设为 Not set 时不显示 |
| FR-5 | 右侧面板宽度可在 300px 到窗口宽度 60% 之间拖动调整，刷新后保持 |
| FR-6 | 选中文字后在 Copilot 提问，输入框上方出现引用标签 |
| FR-7 | 改写建议在文档中原位显示新增、删除、替换；Accept 后正文更新，Reject 后正文不变且无残留标记 |
| FR-8 | 选中 Confidential 块时 Copilot 输入框不可用，并提示不能读取保密内容 |
| FR-9 | 自动保存状态：Saving / Saved / Offline / Save failed |
| FR-10 | 中文界面下入口、字段、检查提示都有中文 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 改写只基于选中文字；超出选区的改动必须单独列出 |
| BR-2 | 接受前正文不变；停止生成留下的半截建议不能接受 |
| BR-3 | Confidential 内容不进入 AI 请求 |
| BR-4 | 保存失败时不显示 Saved；内容不丢，恢复后可重试 |
| BR-5 | 两个标签页同时编辑同一职位时不静默覆盖（具体行为待确认） |
| BR-6 | Location 改为 `Remote` 时触发 Weak：需写明地区或时区（完整性标准 A7） |
| BR-7 | 编辑后分析结果过期（交给 M6）；已发布职位出现 Unpublished changes（交给 M8） |
| BR-8 | Hiring Manager 只能修改授权字段；Viewer 全部只读 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输入 | 字段修改 | title、team、location、employmentType、seniority、openings |
| 输入 | 选区 + 指令 | 选中的块和文字范围、指令文本 |
| 输出 | Core Job 字段 | 同上（Core 字段名） |
| 输出 | 文档 revision | 块内容、可见范围 |
| 输出 | 建议 | 目标范围、修改前后、状态 |
| 输出 | 面板宽度 | localStorage `hireos-jw-side-width` |

## 6. 权限

| 角色 | 能做 |
|---|---|
| Recruiter / TA | 全部编辑、Copilot 改写 |
| Hiring Manager | 编辑授权字段；预算 / 敏感字段只读 |
| HR Approver | 以角色定义为准（待确认是否可编辑） |
| Viewer | 只读，没有编辑类按钮 |

## 7. 非功能要求

- 改写响应时间阈值待确认。
- 键盘可完成主要编辑操作；200% 缩放下可用。

## 8. 验收标准

| ID | 验收 | 对应闭环路径 |
|---|---|---|
| AC-1 | 两处标题双向同步，刷新后一致 | M9a-P1、P2 |
| AC-2 | 必填字段不能清空；Remote 触发 Weak | M9b-P1、P2 |
| AC-3 | Add field / × / Not set 规则正确 | M9b-P3–P5 |
| AC-4 | 改写只作用于选区；Accept / Reject 结果正确 | M9c-P1、P2 |
| AC-5 | 选中 Confidential 时 Copilot 不可用，请求中无正文 | M9c-P3 |
| AC-6 | 保存失败不显示 Saved，内容不丢 | 公共-P1 |
| AC-7 | 两个标签页同时编辑不静默覆盖 | 公共-P2 |

## 9. 依赖与实现

- 后端：`PATCH jobs/:id`（zod：title 1–200、location 必填、openings 1–10000）、`GET/PUT jobs/:jobId/documents/:audience`、`POST jobs/:jobId/documents/:audience/rewrite`、`GET/POST/PATCH jobs/:jobId/documents/:audience/suggestions`。

## 10. 待确认

1. 并发编辑的预期行为：冲突提示还是自动合并；documents 接口是否有版本校验。
2. HR Approver 能否编辑。
3. 收到 409 冲突时的界面。
