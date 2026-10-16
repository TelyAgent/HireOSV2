# I14 外观、字号与偏好｜线上测试报告

测试时间：2026-10-15 约 18:25–18:30（Asia/Shanghai）  
结论：**不通过完整验收**。9 条用例中 0 条完整通过、6 条获得局部线上证据、3 条未验证或属于已知缺口。已证实切换即时生效、刷新后本浏览器保留设置、Review 未保存文字在切换主题后保留；账号级同步、角色隔离、系统主题跟随、200% 缩放与全部颜色组合没有足够证据。线上还发现暗色主题下 Appearance 弹层说明文字对比度约 1.36:1，以及字号选择缺少规格要求的真实预览。

**后续产品决定（2026-10-15）**：用户已明确默认强调色为 **Blue**。本报告原测试所见 Reset 为 Teal 的事实不变；原先“默认色待定”的判定更新为**线上结果不符合已确认规则**。对应 [草稿 4](GitHub_Issue_Drafts_2026-10-15.md)已改为 Blue 的具体 AC。

## 1. 范围、方法与证据边界

| 项 | 本轮事实 |
|---|---|
| 规格 | 本目录 [PRD](PRD.md)、[User Journey](User_Journey.md)、[User Cases](User_Cases.md)、[Loop IO](Loop_IO.md)；[UX/UI 审查标准](../../HireOS_Command_JD_Management_UX_UI_Review_Standard_v1.0.md) 的通用旅程、应用性 U1–U10、证据和严重级别规则。该标准的 JD 审批、发布字段不适用于 I14。 |
| 环境 | [线上 Interview](https://hireos.aipollo.me/hireos/interview/)，Chrome 桌面现有登录会话；1366×768 浏览器视口覆盖首页与决定页。实际测试使用已有登录的 HTTPS 域名。未取得线上构建号、第二账号、偏好服务/API/DB 只读权限。 |
| 测试身份 | 当前会话的账号显示为一名 Admin/HR；首页“MY WORK”仍显示演示身份 Sarah Chen。无法把该会话等同于 PRD 的 `hr_a` 或 `interviewer_a`，也不能据此证明角色隔离。报告不记录账号邮箱和候选人资料。 |
| 测试数据 | 首页已有项目仅用于观察；[既有决定页](https://hireos.aipollo.me/hireos/interview/project/1cbc3fb1-48f8-4a2b-ae68-27ebcc1af804/decision)用于 1366×768/Dark/Large 布局；[既有 Review 页](https://hireos.aipollo.me/hireos/interview/project/5f57f693-470d-4d27-96dd-592aafdd8db6/review)用于未保存合成文字保留。没有 I14 专用隔离 seed。 |
| 操作边界 | 只改变本会话外观和首页统计展开偏好；在 Review 第一项输入 `[UJ-TEST] appearance draft retention check`，切换主题后点击 **Discard**，没有点击 Save score。测试后恢复原先的 Light/Teal/Medium 与统计展开状态；没有更改面试业务数据。 |
| 证据层级 | Chrome 可访问性树、页面即时截图、只读 DOM 计算样式和路由；未保存截图文件，未取得 API 响应、DB、审计或服务端偏好记录。本地源码观察在第 6 节单列，不能直接当作线上部署版本证明。 |

判定口径：**局部验证**只覆盖列出的操作和可观察结果；未执行的子步骤、服务端持久化和权限断言均不计通过。用例文档的“✅ 可测”表示设计时的可执行性，不表示本轮通过。

## 2. 按旅程步骤的线上执行证据

| ID / Step | 用户操作与预期 | 实际观察与证据 | 结论 / 限制 |
|---|---|---|---|
| E-01 / 1 进入 | 顶栏打开 Appearance，看到主题、强调色、字号及文字标签。 | 首页顶栏有 Appearance；弹层可访问性树显示 Light/Dark/Deep/System、Blue/Teal/Violet、Small/Medium/Large 单选项和文字。设置页 `/settings/appearance` 有同组三类控件，当前选中状态与顶栏弹层一致。 | 入口和三组标签局部符合。弹层标题是 Appearance；组标签为 THEME、ACCENT、TEXT SIZE，字号旁没有真实预览文本。 |
| E-02 / 2 切换 | Dark → Violet → Large 即时生效且互不重置。 | 在首页依次点击后，三个单选组分别显示 Dark、Violet、Large 选中；页面即时变为暗色。1366×768 首页首屏统计卡片可见，文字在卡片内换行。 | 即时切换与本页独立性局部符合；没有遍历整模块所有组件。 |
| E-03 / 4 刷新、跨页 | 设置刷新、跨页后恢复。 | 刷新首页后再次打开弹层，Dark/Violet/Large 仍同时选中；进入个人设置 Appearance 页仍选中同一组合。 | **同一浏览器刷新和跨页**通过；重新登录、跨设备与账号级保存未测。 |
| E-04 / 视觉 | 1366×768、Dark、Large 下首页和决定页无裁切、主操作可达。 | 首页首屏四张 MY WORK 卡、Workspace Overview 和 More Statistics 可读；既有决定页的状态、五个决定按钮、AI 草稿均在视口内。决定页顶部项目导航最后的 Evaluation Package 文本在右缘显示不完整，导航有横向滚动条。 | 主内容局部可用；导航需横向滚动，完整可达性及其他长内容页未测。 |
| E-05 / 2 草稿 | 写评分理由时换主题不丢未提交内容。 | Review 第一项文本框输入上述 `[UJ-TEST]` 文本后出现 “Unsaved changes” 和 Discard；打开 Appearance 将 Dark 改为 Deep，关闭后文本框仍含原文且仍标记未保存；随后 Discard，输入清空。 | **本会话、这一评分框的 UI 子断言通过**；没有提交、刷新草稿、换角色或查 DB。 |
| E-06 / 5 Reset | 恢复默认且不清业务数据。 | 顶栏弹层点 Reset 后 Light/Teal/Medium 选中，提示 “Appearance reset to Light, Teal, Medium.”；此前折叠的 Workspace Overview 展开，More Statistics 变为折叠。 | 折叠状态重置有 UI 证据；**Teal 不符合随后确认的 Blue 默认值**。没有业务数据/草稿的 DB 前后对照。 |
| E-07 / 6 键盘 | 键盘操作弹层并可关闭。 | 弹层存在可访问性单选控件；按 Escape 后弹层关闭，焦点返回顶栏 Appearance。按 Tab 时焦点先进入弹层容器。 | 关闭与基础焦点恢复局部符合；未仅用键盘完成全路径、逐项焦点可见性和 200% 缩放。 |
| E-08 / 可读性 | Dark/Deep 下弹层说明、焦点和状态清楚。 | Dark 下弹层主体仍为白底。只读 DOM 样式：说明段落 `rgb(214,222,234)`、12px，最近不透明祖先背景 `rgb(255,255,255)`；按标准相对亮度公式计算对比度约 **1.36:1**。截图中说明文字极淡。 | 可读性失败，见 I14-UX-01。该证据仅对应说明文字，不推断整个界面的对比度。 |
| E-09 / 3、隔离、异常 | System 跟随系统、两个账号隔离、保存失败可恢复。 | 弹层有 System 选项；本轮未改变 OS 色彩偏好、未使用第二账号，且没有可安全注入的偏好保存失败。 | 动态跟随、角色隔离和异常恢复均未验证。 |

## 3. 用例与 AC 覆盖

| 用例 | 对应 AC | 结果 | 已有证据与缺口 |
|---|---|---|---|
| UC-I14-01 小屏大字号暗色 | AC-1 | **局部验证** | E-02/E-04：1366×768 首页和既有决定页主内容可读；顶部末项导航文本未完整显示，未检查全部交互及完整页面滚动。 |
| UC-I14-02 切换即时生效且持久 | AC-2 | **局部验证** | E-02/E-03/E-05：同页、跨页、刷新和一处未保存文字；重登和账号级持久化未测。 |
| UC-I14-03 System 跟随、显式不被覆盖 | AC-3 | **未验证** | E-09：只有 System 选项存在；没有 OS 浅/暗变化证据。 |
| UC-I14-04 12 种主题与强调色组合 | AC-4 | **局部验证** | E-02/E-04/E-08：实际观察 Dark+Violet+Large 首页、Dark+Teal+Large 决定页和 Deep+Teal+Large Review；未遍历 4×3 组合与证据高亮、焦点、语义状态。 |
| UC-I14-05 键盘与 200% 缩放 | AC-5 | **局部验证** | E-07：Escape 关闭及焦点返回；尝试浏览器放大快捷键后页面视口与设备缩放值未变化，不能声称完成 200% 验证；未跑完整键盘任务。 |
| UC-I14-06 Reset 不清业务数据 | AC-6 | **默认色断言失败，其余局部验证** | E-06：Reset 恢复 Teal，用户已确认应为 Blue；业务数据与草稿持久化缺 DB/隔离 seed。 |
| UC-I14-07 写理由时切换主题 | AC-7 | **局部验证** | E-05：合成未保存文字在 Dark→Deep 后保留并已 Discard；当前会话不是经核实的 Interviewer 身份。 |
| UC-I14-08 两角色隔离 | AC-8 | **未验证** | 只有一个登录账号，没有独立角色/账号和服务端读写证据；本地实现风险见第 6 节。 |
| UC-I14-09 保存失败可重试 | FR-11 | **已知缺口，未验证** | 没有账号级偏好 API 或可注入 `save_fail` 的线上场景；没有执行故障注入。 |

**AC 汇总：**AC-1/2/4/5/6/7 只有部分 UI 证据；AC-3/8 未验证。0 项达到完整验收。尤其账号级持久化和不同用户隔离不能从刷新成功推断。

## 4. UX/UI 发现、影响与修复验收

| ID / 级别 | 角色、步骤、证据 | 用户影响 | 最小修复方向与验收检查 |
|---|---|---|---|
| I14-UX-01 / **P1** | 全部雇主端用户，步骤 1/2；E-08：Dark 下弹层说明文字为浅灰蓝 `rgb(214,222,234)`，白底，对比度约 1.36:1。 | 用户难以读到偏好保存范围和跨设备同步说明，而这正是决定是否信任设置持久性的关键信息。 | 让弹层正文色与弹层背景匹配主题，或统一用满足普通文字至少 4.5:1 的颜色；复测 Light/Dark/Deep/System 下说明、标签、选中/禁用/焦点。 |
| I14-UX-02 / **P1，线上文案与实现风险** | 全部用户，步骤 4；E-01 弹层写“Production HireOS syncs Appearance to your account across devices.”，设置页标为“Account — personal”；本地 `StoreContext.tsx` 只读写单个 `hireos_prefs` localStorage 键。 | 用户可能相信偏好已随账号同步，换设备或换账号后却无法恢复，甚至同一浏览器不同用户共享外观。此项的**线上跨账号结果尚未实测**。 | 完成账号级服务端存储、按用户/Workspace 隔离折叠状态和失败提示，或在功能上线前修正文案；用两个真实测试账号、两个浏览器资料与只读 API/DB 验证。 |
| I14-UX-03 / **P2** | 全部用户，步骤 1/2；E-01：Small/Medium/Large 只有文字按钮，旁边没有 FR-7 要求的真实预览文本。 | 用户必须反复切换并观察其他区域，难以预估字号效果。 | 增加随选项即时变化的真实示例文本；验收时检查三档示例、长英文标签换行和键盘可读名称。 |
| I14-UX-04 / **P2，已确认缺陷** | 全部用户，步骤 5；E-06：Reset 明确恢复 Teal，PRD BR-2 写 Blue，用户随后确认 Blue 为默认值。 | Reset 后得到错误的默认强调色，提示也宣称错误结果。 | 新用户无偏好时和 Reset 后均应为 Light + Blue + Medium；提示与自动测试断言同步为 Blue，验证已有业务数据保留。 |

严重级别按审查标准：P1 影响主要理解或错误预期，P2 影响效率；没有本轮**实测**的 P0。由于 P1 未豁免且 AC 核心持久化/隔离未验证，判定不能通过。

## 5. 应用性十项与功能边界

| 项 | 判定 | 证据或限制 |
|---|---|---|
| U1 容易理解 | 部分 | Appearance 三组和选中态明确；“账号级同步”线上文案与本地实现不一致风险，Reset 的 Teal 与已确认的 Blue 默认值不符。 |
| U2 容易上手 | 部分 | 顶栏和设置页均可进入；字号缺真实预览。 |
| U3 快速完成任务 | 部分 | 单次点击即时切换；未测完整跨页任务耗时和重复设置。 |
| U4 下一步明确 | 部分 | Done、Reset 动作可见；没有保存状态/同步结果反馈。 |
| U5 控件清楚 | 部分 | 三组文字标签清楚；Reset 提示与 PRD 默认强调色冲突。 |
| U6 符合真实工作方式 | 部分 | 在 Review 写理由时切换主题没有丢当前文本；离开页面或网络失败未测。 |
| U7 信息结构符合角色目标 | 未验证 | 只有一个登录账号；首页演示身份和账号身份不同，无法验证按角色/Workspace 的设置范围。 |
| U8 减少跳转与重复 | 部分 | 顶栏快捷弹层与设置页共用状态，跨页可用。 |
| U9 可恢复和可预期 | 未验证 | 刷新可恢复同浏览器设置；保存失败、重登、跨设备和并发未测。 |
| U10 可访问、可读、可操作 | **部分失败** | Escape 与焦点返回可观察；E-08 说明文字对比度失败；完整键盘路径、焦点可见性及真实 200% 缩放未测。 |

功能与权限边界：本轮没有证据表明偏好写入服务端、按账号隔离，或导出内容保持固定浅色；也没有证据证明它们在线上一定失败。状态只读 UI 观察不能替代 API/DB 检查。I14 没有审批、发布或 AI 生成动作，审查标准中这些 JD 专属项不计入本模块通过率。

## 6. 本地代码观察（不是线上部署证明）

- `job-Interview-front/src/store/StoreContext.tsx` 使用无用户/Workspace 后缀的 `hireos_prefs` localStorage 键，读写 theme、accent、textSize、moreOpen、overviewStatsOpen、lang 等；未见调用账号偏好 API。`RESET_PREFS` 恢复 Light/Teal/Medium，并将 `moreOpen` 设为 false、`overviewStatsOpen` 设为 true。
- `job-Interview-front/src/store/initialState.ts` 的默认强调色为 Teal；`AppearanceModal.tsx` 含线上可见的跨设备同步说明；`AppearancePanel.tsx` 仅渲染文字单选按钮，没有字号预览。
- `job-Interview-front/src/index.css` 的 `.hs-tiny` 使用 `var(--ink-2)`；暗色主题变量是浅色文字，但 Ant Modal 的内容背景仍为白色，与 E-08 的线上计算样式一致。

本轮没有修改业务代码，也没有运行 build、lint、typecheck 或 test；这些命令不能替代线上 UI 验收。未创建 Issue/PR、未 push、未部署。

## 7. 复测条件与顺序

1. 默认强调色已确认 Blue；提供 I14 专用 `[UJ-TEST]` Review 草稿与首页数据、两名独立账号/Workspace、第二浏览器资料、线上构建号及只读偏好 API/DB 证据。
2. 以 Light+Medium、Dark+Large、Deep+Large 在首页、Review、决定页分别复测 1366×768、真实浏览器 200% 缩放、键盘全路径、焦点、长文本、弹层和错误/加载状态；对 4 主题×3 强调色检查语义状态、证据高亮和对比度。
3. 切换 OS 浅/暗色验证 System 跟随与显式 Dark 不被覆盖；使用两账号、两设备验证刷新、重登、跨设备、用户与 Workspace 隔离，并检查导出样式不受偏好影响。
4. 注入偏好保存失败，验证“未同步”提示、重试和实际服务端状态；Reset 前后核对面试业务数据、未提交草稿和首页折叠偏好。上述缺口补齐后再按 AC-1～8 重新判定。

```yaml
review:
  product: "HireOS Command Interview"
  surface: "I14 Appearance 弹层、个人设置、首页、Review、Decision"
  role: "全部雇主端用户；本轮线上仅一个 Admin/HR 会话，角色映射未核实"
  journey_goal: "调整外观与字号，保留当前工作，并在下次使用时恢复个人设置"
  evidence:
    source: "线上 Chrome 可访问性树、截图、只读 DOM 样式和路由；本地代码另列"
    steps_checked: [1, 2, 4, 5, 6]
  verdict: "insufficient_context"
  findings: ["I14-UX-01", "I14-UX-02", "I14-UX-03", "I14-UX-04"]
  usability_check:
    understandable: "unknown"
    learnable: "unknown"
    efficient: "unknown"
    next_action_clear: "unknown"
    controls_clear: "unknown"
    real_workflow_fit: "unknown"
    role_information_fit: "unknown"
    no_unnecessary_hops: "unknown"
    recoverable: "unknown"
    accessible: "fail"
  limits:
    - "没有第二账号、账号偏好 API/DB/审计证据或线上构建号"
    - "没有 OS 浅暗切换、真实 200% 缩放、12 种配色完整矩阵或故障注入"
    - "未进行重登、跨设备、业务数据持久化与导出样式验证"
```
