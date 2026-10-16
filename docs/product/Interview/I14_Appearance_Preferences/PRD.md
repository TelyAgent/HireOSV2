# I14 产品文档：外观、字号与偏好

| 项 | 内容 |
|---|---|
| 模块 | I14 / 公共能力 SHARED-02、03、08（当前在 Interview 就地定义，后续统一抽取） |
| 版本 / 日期 | v1.0 / 2026-10-14（草稿，待评审） |
| 主角色 | 全部雇主端用户 |
| 原型页面 | 顶栏 `Appearance` 弹层（Theme、Accent color、Text size、Reset to defaults）；顶栏 `EN` 语言切换（[原型](../../../design/Interview/index.html)） |
| 实现现状 | 🟡 前端 `AppearanceModal`、`features/settings/AppearancePanel`、`SettingsPage` 支持 Light / Dark / Deep / System、Blue / Teal / Violet、Small / Medium / Large；偏好（含首页折叠、语言）存在浏览器 localStorage `hireos_prefs`，没有账号级同步，没有按用户 + Workspace 区分。默认强调色为 Teal（原型、实现一致），与 PRD 默认 Blue 不同。未逐项验证 AC |
| 依据 | [PRD v1.5 §8.3–8.6、§9、§6 INT-20–22、§12.1](../HireOS_Command_Interview_PRD_v1.5.md)、[UI Guidelines v0.1](../HireOS_Command_Interview_UI_Guidelines_v0.1.md) |

## 1. 背景与目标

招聘团队长时间在笔记本上使用系统，有夜间使用和大字号的需求。如果主题只改背景色、字号只放大正文，或换个设置就丢了正在填的评分，体验会很差。

**目标**：提供 Light / Dark / Deep / System 主题、有限的强调色和三档字号；三项设置互相独立、即时生效、不丢当前工作；刷新、重登后保留；在 1366 × 768、Large、200% 缩放和键盘操作下都可用。

## 2. 范围

| 包含 | 不包含 |
|---|---|
| Appearance 入口：顶栏常驻，也可从个人设置进入 | 管理员统一配置的主题 |
| Theme：Light（默认）、Dark、Deep、System | 第三方会议界面内部的主题和字体 |
| Accent color：Blue（已确认默认）、Teal、Violet | 导出文档样式（固定浅色，I11） |
| Text size：Small 14px、Medium 16px（默认）、Large 18px；标题、导航、按钮、表格、标签按比例 | |
| Reset to defaults | |
| 偏好持久化：主题 / 强调色 / 字号为账号级；首页折叠按用户 + Workspace + 模块 | |
| 可访问性：键盘、焦点可见、200% 缩放 | |

## 3. 功能需求

| ID | 需求 |
|---|---|
| FR-1 | 顶栏 `Appearance` 打开弹层，分 THEME、ACCENT COLOR、TEXT SIZE 三组；每个选项有文字标签，不能只有色块 |
| FR-2 | 切换立即作用于整个 Interview 模块（按钮、表格、卡片、弹层、评分图、表单、提示、加载 / 错误状态），不是只反转首页背景 |
| FR-3 | 切换主题或字号时保留当前页面、筛选和未提交内容（如正在写的评分理由） |
| FR-4 | System 跟随操作系统浅 / 暗偏好并随之更新；显式选择 Light / Dark / Deep 时不被系统变化覆盖 |
| FR-5 | Success / Warning / Error 语义色不被强调色覆盖，状态同时用文字或图标表达 |
| FR-6 | Dark / Deep 下证据高亮、选择态、输入焦点、禁用态都可辨认 |
| FR-7 | 字号旁边用真实预览文本即时展示；改字号后容器、按钮和表单间距随内容调整，长英文标签换行，不裁切 |
| FR-8 | Large 下首页 T1 统计完整可读，卡片换行；项目列表可减少列数 |
| FR-9 | 主题、强调色、字号、首页折叠互不重置 |
| FR-10 | 刷新、离开返回、重新登录后恢复设置；生产环境支持账号级跨设备同步 |
| FR-11 | 保存失败时界面仍可用，提示保存状态并可重试，不声称已同步 |
| FR-12 | `Reset to defaults` 恢复默认主题、强调色、字号和首页折叠；不清空业务数据、面试草稿 |
| FR-13 | 不同演示角色的个人设置互相隔离 |
| FR-14 | 键盘可以打开 Appearance、选择各项、关闭弹层；焦点可见 |

## 4. 业务规则

| ID | 规则 |
|---|---|
| BR-1 | 主题、强调色、字号属于 Account & System Configuration 的个人偏好；Interview 只提供快捷入口 |
| BR-2 | 无个人设置时默认 Light + Blue + Medium（2026-10-15 用户确认）；System 是显式选项 |
| BR-3 | 首页折叠偏好按用户 + Workspace + 模块保存，防止不同模块、不同 Workspace 互相覆盖 |
| BR-4 | 不按时间强制切换日 / 夜主题 |
| BR-5 | 共用界面设置不等于共享业务数据 |
| BR-6 | 不禁用浏览器缩放 |

## 5. 数据

| 方向 | 对象 | 关键字段 |
|---|---|---|
| 输出 | DisplayPreference | user_id、theme_mode、accent_palette、text_size、updated_at |
| 输出 | HomepagePreference | user_id、workspace_id、module_id、expanded_sections |

## 6. 权限

- 每个用户只能读写自己的偏好；不影响其他用户看到的内容和导出产物。

## 7. 非功能要求

- 推荐验证组合：Light + Medium、Dark + Large、Deep + Large，覆盖首页、评审页和决定页。
- 设计基准 1440 × 900，验证 1366 × 768。

## 8. 验收标准

| ID | 验收 | 对应 |
|---|---|---|
| AC-1 | 1366 × 768、Large、暗色下首页和决定页无文字裁切、无操作被遮挡；卡片换行，列表入口可达 | HOME-AC08 |
| AC-2 | 依次切换主题和字号并跨页：即时生效、设置独立、表单内容保留；刷新和重登后恢复 | HOME-AC09 |
| AC-3 | System 跟随系统；选择 Dark 后系统改为浅色，界面仍为 Dark | HOME-AC10 |
| AC-4 | 三种强调色与四种主题组合下，状态文字 / 图标、证据高亮、焦点、表单和弹层可辨认 | HOME-AC11 |
| AC-5 | 仅用键盘和 200% 浏览器缩放即可展开统计、调整设置、进入列表、完成主要操作 | HOME-AC12 |
| AC-6 | Reset to defaults 恢复 Light + Blue + Medium 及首页折叠默认状态；面试数据和草稿保留 | HOME-AC14 |
| AC-7 | 在 Review 页写评分理由时切换主题，已输入内容不丢失 | FR-3 |
| AC-8 | 两个演示角色各自的设置互不影响 | §8.5 |

## 9. 依赖与实现

- 前端：`components/AppearanceModal.tsx`、`features/settings/AppearancePanel.tsx`、`pages/SettingsPage.tsx`、`store/StoreContext.tsx`（localStorage）、`index.css`。
- 后端：无；账号级偏好依赖 identity 服务或 Account & System Configuration。
- 依赖：I15。被所有页面使用。

## 10. 已确认与待确认

- **已确认（2026-10-15，用户决定）**：默认强调色为 **Blue**。原型及当前实现的 Teal 默认值、Reset 结果与此不符，待修复；用户主动选择 Teal 仍应保留。
- **待确认**：原型和实现都有 EN / 中文切换，PRD 写「默认英文」。中文界面是正式范围，还是只用于内部演示？
- **待确认**：账号级偏好存储放在哪个服务（identity / Core Record / 各模块自存）。
- **待确认**：与 JD、Screening、Written Test 等模块统一设置的时间点。
