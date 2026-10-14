# HireOS Command — JD Management 闭环流程图

Doc ID：CMD-JD-FLOW-001
版本：v1.0（草稿，待评审）
日期：2026-10-14
依据：[九模块 User Journey v1.0](HireOS_Command_JD_Management_Module_User_Journeys_v1.0.md)、[测试闭环输入/输出清单 v0.1](JD_Test_Loops_IO_v0.1.md)、[PRD v1.3](HireOS_Command_JD_Management_PRD_v1.3.md)、[Interface Spec v1.3](HireOS_Command_JD_Management_Interface_Spec_v1.3.md)、[完整性标准 v0.1](HireOS_Command_JD_Completeness_Standard_v0.1.md)、Issue #9 / #15

## 怎么读这份文档

- **第 1 章 全景图**：11 个闭环（M1–M9 + 建议的 M10、M11）之间怎么衔接、传递什么数据。
- **第 2 章 状态图**：职位、文档、AI 建议、发布四类对象的状态变化。测试断言的“终态”都从这里取。
- **第 3 章 闭环泳道图**：每个闭环一张，分三条泳道：
  - **用户**：用户的操作和判断；
  - **JD 系统**：前端和 JD 后端；
  - **AI / 外部**：LLM、Core Record、文件解析、外部网页、发布渠道。
- 图中 `✔n` 是**测试断言点**，图下的表格写明每个断言点要检查什么。
- 红色虚线框是异常分支，绿色框是闭环的终态（输出）。

图例：

```mermaid
flowchart LR
  A["用户操作"] --> B{"判断"}
  B --> C["系统处理"]
  C --> D[("持久化数据")]
  C -.-> E["异常分支"]
  D --> F(["闭环终态 / 输出"])
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class E err
  class F done
```

---

## 1. 全景图：闭环之间的衔接

```mermaid
flowchart TD
  L["登录<br/>邮箱验证码 #16"] --> JL["职位列表<br/>Job Library"]
  M7["M7 角色与权限<br/>Recruiter / HM / HR Approver / Viewer"] -. "角色矩阵约束所有闭环" .-> JL

  JL --> CJ["Ask Copilot<br/>Create a Job"]
  subgraph CREATE["创建类闭环 M1–M5（共用骨架）"]
    M1["M1 Quick Start 三问"]
    M2["M2 职位名 → 三版本"]
    M3["M3 上传 JD 文件"]
    M4["M4 粘贴链接 / 文案"]
    M5["M5 手动表单"]
  end
  CJ --> M1 & M2 & M3 & M4 & M5

  M1 & M2 & M3 & M4 & M5 --> D0[("Draft 职位<br/>Owner = 创建者<br/>internal 文档")]

  D0 --> M9["M9 编辑：标题 / 字段 / Copilot 改写"]
  D0 --> M6["M6 Analyze 与 AI 修复"]
  M10["M10 JD Copilot Agent<br/>问答 / 薪资调研 / 对标"] -. "确认后写入" .-> M9
  M9 <--> M6
  M6 -->|"必填全部合格"| RDY[("可发布草稿")]
  RDY --> APV{"HR Approver 审批<br/>（见 M7）"}
  APV -->|"批准"| M8["M8 发布与版本"]
  APV -->|"退回"| M9
  M8 --> PUB[("已发布版本 vN<br/>对外只含 Public 块")]
  PUB -->|"再次修改"| M9
  PUB --> M11["M11 生命周期与清理<br/>暂停 / 关闭 / 归档 / 删除<br/>（建议新增）"]

  J10["J10 横切套件<br/>网络 / 并发 / 幂等 / 持久化 / 性能 / 可访问性"] -. "叠加到每个闭环" .-> CREATE
  J10 -.-> M6 & M8 & M9

  classDef sug stroke-dasharray:5 3
  class M11 sug
```

### 1.1 闭环之间传递的数据

| 交接 | 产物 | 说明 |
|---|---|---|
| M1–M5 → M6 / M9 | Draft 职位 + internal 文档 | Core Job `status=draft`；可能缺必填项 |
| M9 ⇄ M6 | 文档新 revision | 编辑后分析结果过期，需要重新 Analyze |
| M6 → M8 | 可发布草稿 | 必填全部 Pass，且没有 Weak 项 |
| M8 → M9 | 已发布版本 vN | 再次编辑后页头出现 Unpublished changes |
| M10 → M9 | 带来源的薪资参考 | 人工确认后才写入字段 |
| M6 → M7 | 可提交审批的草稿 | Recruiter 提交，HR Approver 审批 |
| M7 → M8 | 已批准的候选版本 | 发布引用精确的已批准版本 |
| M7 → 全部 | 角色矩阵 | 每个闭环的身份前置条件 |

> 闭环独立测试时，前置数据用 seed 一步造出，**不要**按上图把前一个闭环真跑一遍。上图只表示业务上的先后关系。

---

## 2. 状态图

### 2.1 职位状态（当前实现）

当前后端只有两态，对应 Core Record 的 `draft / open`：

```mermaid
stateDiagram-v2
  [*] --> draft: M1–M5 创建
  draft --> published: M8 Publish（门禁通过）
  published --> draft: 取消发布
  published --> published: 再次 Publish（版本 +1）
  draft --> [*]: 删除（M11）
```

### 2.2 职位状态（PRD 目标，供 M11 使用）

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> open: open（有生效版本）
  open --> paused: pause（填原因）
  paused --> open: resume
  draft --> closed: close（填原因）
  open --> closed: close
  paused --> closed: close
  closed --> open: reopen
  closed --> archived: archive
  archived --> closed: restore
```

### 2.3 文档、审批与完整性状态（M6 / M7 / M8 / M9）

```mermaid
stateDiagram-v2
  [*] --> Blocked: 有必填 Missing
  Blocked --> NeedsWork: 必填补齐，仍有 Weak
  NeedsWork --> Ready: Weak 全部修复
  Blocked --> Ready: 一次补齐且无 Weak
  Ready --> NeedsWork: 编辑引入 Weak
  Ready --> Blocked: 删除必填内容
  Ready --> Pending_approval: Recruiter 提交审批
  Pending_approval --> Approved: HR Approver 批准
  Pending_approval --> NeedsWork: 退回 / 拒绝（填理由）
  Pending_approval --> Superseded: 审批中修改内容
  Superseded --> Ready: 重新检查
  Approved --> Published: Publish
  Published --> Unpublished_changes: 编辑
  Unpublished_changes --> Pending_approval: 再次提交审批
  note right of Ready: 只有 Ready 时才能提交审批；Publish 还要求 HR Approver 已批准；服务端同样校验
```

### 2.4 AI 建议状态（M1–M4、M6、M9）

```mermaid
stateDiagram-v2
  [*] --> generating: 发起
  generating --> proposed: 生成完成
  generating --> failed: AI 失败 / 超时
  generating --> stopped: 用户停止
  failed --> generating: Retry
  proposed --> accepted: Accept / Keep
  proposed --> rejected: Reject
  accepted --> reverted: Undo
  stopped --> [*]: 半截建议不能接受
  note right of proposed: 接受前正文不变
```

### 2.5 发布状态（M8，每个渠道独立）

```mermaid
stateDiagram-v2
  [*] --> not_published
  not_published --> publishing: 确认发布
  publishing --> published: 渠道确认
  publishing --> failed: 渠道报错
  publishing --> outcome_unknown: 超时 / 无回执
  outcome_unknown --> published: 查询确认
  outcome_unknown --> failed: 查询确认失败
  failed --> publishing: 重试
  published --> withdrawal_pending: 撤回
  withdrawal_pending --> withdrawn: 渠道确认
```

---

## 3. 闭环泳道图

### 3.0 创建类公共骨架（M1–M5 共用）

```mermaid
flowchart LR
  subgraph U["用户"]
    u1["点击 Ask Copilot"] --> u2{"选择入口"}
    u5{"审阅草稿<br/>满意吗?"}
    u6["点击 Create"]
  end
  subgraph S["JD 系统"]
    s1["显示 Create a Job<br/>5 个入口 + i 说明"]
    s2["入口标题作为用户消息出现 ✔1"]
    s4["Workspace 展示草稿<br/>字段标来源 ✔2"]
    s6[("Core Job: draft<br/>Owner = 当前用户<br/>internal 文档 ✔3")]
    s7(["跳转编辑页<br/>刷新后仍在 ✔4"])
    se["错误卡片<br/>保留输入 / Retry / Start over ✔5"]
  end
  subgraph X["AI / 外部"]
    x1["LLM / 解析器生成草稿"]
  end
  u1 --> s1 --> u2 --> s2 --> x1 --> s4 --> u5
  u5 -->|"继续对话修改"| x1
  u5 -->|"是"| u6 --> s6 --> s7
  x1 -.->|"失败 / 超时"| se -.->|"Retry"| x1
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class se err
  class s7 done
```

| 断言点 | 检查什么 |
|---|---|
| ✔1 | 入口标题只出现一次；Agent 立即开始引导 |
| ✔2 | 点击 Create **之前**，Core 里没有新职位（API 计数不变） |
| ✔3 | `status=draft`；Owner = 当前用户；有 internal 文档；没有发布记录 |
| ✔4 | 刷新和返回列表后职位仍在；字段行显示 Location / Headcount / Workplace type |
| ✔5 | 错误后输入不丢；Retry 不重复创建；New conversation 清空错误状态 |

---

### 3.1 M1 Quick Start 三问创建

```mermaid
flowchart TB
  subgraph U["用户"]
    u1["点击 Quick Start"]
    u2["回答问题<br/>全部 / 部分"]
    u3["补充职位名"]
    u4{"草稿满意吗?"}
    u5["发送修改指令<br/>如 make it remote"]
    u6["Create job from this draft"]
  end
  subgraph S["JD 系统"]
    s1["一条消息列出 3 个问题 ✔1"]
    s2{"3 个问题都答了?"}
    s3["只追问未答的问题 ✔2"]
    s4{"能推断职位名?"}
    s5["追问 Job title ✔3"]
    s6["显示 正在生成<br/>Workspace 与对话并列"]
    s7["1 份草稿 ✔4"]
    s8["改动处高亮 ✔5"]
    s9(["Draft 职位 → 编辑页 ✔6"])
    se["错误卡片 Retry / Start over"]
  end
  subgraph X["AI / 外部"]
    x1["LLM requirement_discovery"]
    x2["LLM jd_generate"]
  end
  u1 --> s1 --> u2 --> x1 --> s2
  s2 -->|"否"| s3 --> u2
  s2 -->|"是"| s4
  s4 -->|"否"| s5 --> u3 --> s4
  s4 -->|"是"| s6 --> x2 --> s7 --> u4
  u4 -->|"否"| u5 --> x2 --> s8 --> u4
  u4 -->|"是"| u6 --> s9
  x1 -.-> se
  x2 -.-> se
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class se err
  class s9 done
```

| 断言点 | 检查什么 | 输入示例 |
|---|---|---|
| ✔1 | 3 个问题在**同一条**消息里 | — |
| ✔2 | 只追问第 3 个，不重复前两个 | 只答前两行 |
| ✔3 | 不使用 `New Role` 或空标题 | `Things are messy` ⏎ `Tidy them up` ⏎ … |
| ✔4 | 只有 1 份草稿；概述 2–4 句；职责 ≥3；包含回答里的硬技能；没有编造的数字 | v0.1 §3.2 三行回答 |
| ✔5 | 工作模式变为 Remote；用户消息只出现一次 | `add TikTok growth experience and make it remote` |
| ✔6 | 同 3.0 的 ✔3、✔4 | — |

---

### 3.2 M2 职位名 → 三版本

```mermaid
flowchart TB
  subgraph U["用户"]
    u1["点击 Start with a Job Title"]
    u2["输入职位名"]
    u3["切换 A / B / C 对比"]
    u4{"需要统一修改?"}
    u5["Refine 指令"]
    u6["Create job with version X"]
  end
  subgraph S["JD 系统"]
    s1["只有引导文案<br/>输入框聚焦 ✔1"]
    s2{"职位名为空?"}
    s3["提示输入职位名"]
    s4["3 张卡片 + A/B/C 页签联动 ✔2"]
    s5["三版一起更新并高亮 ✔3"]
    s6(["职位内容 = 所选版本 ✔4"])
  end
  subgraph X["AI / 外部"]
    x1["LLM title-variants"]
    x2["LLM refine-variants"]
  end
  u1 --> s1 --> u2 --> s2
  s2 -->|"是"| s3 --> u2
  s2 -->|"否"| x1 --> s4 --> u3 --> u4
  u4 -->|"是"| u5 --> x2 --> s5 --> u3
  u4 -->|"否"| u6 --> s6
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class s6 done
```

| 断言点 | 检查什么 |
|---|---|
| ✔1 | 引导消息里没有内嵌输入框和按钮 |
| ✔2 | 三版风格不同（A 最短、B 面向候选人、C 最详细）；职位名、地点、HC 等**事实字段一致** |
| ✔3 | 三版都更新；停留在当前所选版本 |
| ✔4 | 创建后的职责、要求与所选版本逐字一致 |

---

### 3.3 M3 上传 JD 文件

```mermaid
flowchart TB
  subgraph U["用户"]
    u1["点击 Upload a JD"]
    u2{"选择文件?"}
    u3["审阅草稿"]
    u4["Create job"]
    u5["换文件 / 转手动"]
  end
  subgraph S["JD 系统"]
    s1["立即弹出文件选择<br/>+ Choose file ✔1"]
    s2{"大小 ≤ 10MB 且格式支持?"}
    s3["生成 1 份草稿<br/>字段标来源 ✔3"]
    s4(["Draft 职位 ✔4"])
    se1["提示：超限 / 格式不支持 ✔2"]
    se2["提示：无法识别文字 / 空文件 ✔2"]
  end
  subgraph X["AI / 外部"]
    x1["文件解析<br/>pdf-parse / docx / txt"]
    x2{"提取到文字?"}
    x3["LLM jd_parse"]
  end
  u1 --> s1 --> u2
  u2 -->|"取消"| s1
  u2 -->|"选择"| s2
  s2 -->|"否"| se1 --> u5
  s2 -->|"是"| x1 --> x2
  x2 -->|"否：扫描件 / 空"| se2 --> u5
  x2 -->|"是"| x3 --> s3 --> u3 --> u4 --> s4
  u5 --> s1
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class se1,se2 err
  class s4 done
```

| 断言点 | 检查什么 | 输入示例 |
|---|---|---|
| ✔1 | 点击入口即弹出；取消后可再次选择且不报错 | — |
| ✔2 | 每种异常文件都有明确原因；**不生成空草稿或编造内容** | 扫描版 PDF、空 txt、>10MB、.png、.zip |
| ✔3 | 职位名 `Sales Manager`；地点 `Singapore`、`Remote` 取自文件；概述不是 “Adapted from…”；三种格式结果一致 | sales-jd.docx / .pdf / .txt |
| ✔4 | 同 3.0 的 ✔3、✔4；文件中的提示注入不改变 AI 行为 | 含注入文本的 JD |

---

### 3.4 M4 粘贴链接 / 文案

```mermaid
flowchart TB
  subgraph U["用户"]
    u1["点击 Paste a Link or Text"]
    u2["粘贴内容"]
    u3["审阅草稿"]
    u4["Create job"]
  end
  subgraph S["JD 系统"]
    s1["引导文案<br/>Paste a link or the JD text… ✔1"]
    s2{"识别类型"}
    s3["提示重新粘贴 ✔2"]
    s4{"URL 安全?<br/>非内网 / 非 file://"}
    s5["生成 1 份改写草稿<br/>来源标签 ✔4"]
    s6(["Draft 职位 ✔5"])
    se1["拒绝：不安全地址 ✔3"]
    se2["失败原因 + 手动入口 ✔3"]
  end
  subgraph X["AI / 外部"]
    x1["抓取网页 ≤ 2MB"]
    x2{"可访问且是职位页?"}
    x3["LLM 提取并改写"]
  end
  u1 --> s1 --> u2 --> s2
  s2 -->|"既不是链接也不是 JD"| s3 --> u2
  s2 -->|"链接"| s4
  s4 -->|"否"| se1 --> u2
  s4 -->|"是"| x1 --> x2
  x2 -->|"否：需登录 / 404 / 非职位页"| se2 --> u2
  x2 -->|"是"| x3
  s2 -->|"JD 文案 / 笔记"| x3
  x3 --> s5 --> u3 --> u4 --> s6
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class se1,se2 err
  class s6 done
```

| 断言点 | 检查什么 | 输入示例 |
|---|---|---|
| ✔1 | 没有内嵌输入框 | — |
| ✔2 | 停留在本步，说明怎么重新粘贴 | `not a link` |
| ✔3 | 每种失败分别给出原因，**不编造草稿**；内网地址被拒绝 | 需登录页、404、公司首页、`ftp://`、`http://127.0.0.1` |
| ✔4 | 链接只显示一次；内容与页面一致；没有大段照搬 | 公开职位链接 |
| ✔5 | `Customer Success Manager`；3 职责 / 2 要求 / 1 加分项；`Hanoi, VN`、`Hybrid` | v0.1 §3.2 粘贴文案 |

---

### 3.5 M5 手动表单

```mermaid
flowchart TB
  subgraph U["用户"]
    u1["点击 Create Manually"]
    u2["填写表单"]
    u3["点击 Save"]
  end
  subgraph S["JD 系统"]
    s1["对话内显示表单<br/>不调用 AI ✔1"]
    s2{"前端校验"}
    s3["对应字段标红<br/>不创建 ✔2"]
    s4{"服务端校验"}
    s5["返回 4xx<br/>不产生脏数据 ✔3"]
    s6(["直接创建 Draft<br/>跳转编辑页，不经过 Workspace ✔4"])
  end
  subgraph X["Core Record"]
    x1[("Core Job")]
  end
  u1 --> s1 --> u2 --> u3 --> s2
  s2 -->|"不通过"| s3 --> u2
  s2 -->|"通过"| s4
  s4 -->|"不通过"| s5 --> u2
  s4 -->|"通过"| x1 --> s6
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class s3,s5 err
  class s6 done
```

| 断言点 | 检查什么 | 输入示例 |
|---|---|---|
| ✔1 | 整个流程没有 AiRun 记录 | — |
| ✔2 | 每个必填项缺失时分别标红；HC 必须是 ≥1 的整数；薪资最大值不小于最小值 | 空表单、HC=`0`/`1.5`/`-1`、薪资 40>25、职责只填 `1.` |
| ✔3 | 绕过前端直接提交非法数据，服务端拒绝 | 直接调用接口提交 HC=0 |
| ✔4 | 薪资显示 `USD 25–40 per hour`；`3+ years in sales` 原样保留；未填的选填项不显示 | v0.1 §3.2 表单数据 |

---

### 3.6 M6 Analyze 与 AI 修复

```mermaid
flowchart TB
  subgraph U["用户"]
    u1["打开 Draft 职位"]
    u2["点击 Analyze"]
    u3{"怎么处理每一项?"}
    u4["手动 Fill in"]
    u5["AI draft / AI fix / AI fix all"]
    u6{"保留 AI 内容?"}
  end
  subgraph S["JD 系统"]
    s1["Analyze 圆标 = 待处理数<br/>Publish 灰色 + 原因 ✔1"]
    s2["缺失项红色占位块<br/>在默认章节位置 ✔2"]
    s3["Analysis 标签：结论 + 进度<br/>To complete / To revise / Suggestions / Completed ✔3"]
    s4["AI 内容带 AI draft 标签 + Undo ✔4"]
    s5["Undo：恢复原内容 ✔5"]
    s6{"必填全 Pass 且无 Weak?"}
    s7(["圆标变绿，Publish 可点 ✔6"])
    se["分析失败：保留上次结果 + 时间<br/>不显示为全部通过"]
  end
  subgraph X["AI / 外部"]
    x1["完整性规则 + LLM quality_review"]
    x2["LLM 生成修复内容"]
  end
  u1 --> s1 --> s2 --> u2 --> x1 --> s3 --> u3
  u3 -->|"自己写"| u4 --> x1
  u3 -->|"交给 AI"| u5 --> x2 --> s4 --> u6
  u6 -->|"Undo"| s5 --> u3
  u6 -->|"Keep"| x1
  s3 --> s6
  s6 -->|"否"| u3
  s6 -->|"是"| s7
  x1 -.-> se
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class se err
  class s7 done
```

| 断言点 | 检查什么 | 前置数据 / 输入 |
|---|---|---|
| ✔1 | 圆标数字等于待处理项数；悬停说明还差 N 项 | seed①缺多项必填 |
| ✔2 | 占位块位置符合默认章节顺序 | seed① |
| ✔3 | 四个分组正确；每条 Weak 规则各有一个用例落到 To revise | `Must have strong communication skills`、一句话概述、Junior 5 年+、Remote 无地区 |
| ✔4 | AI 内容可验证、没有编造的数字；滚动位置不变 | AI fix all |
| ✔5 | 内容精确恢复到处理前 | — |
| ✔6 | Publish 可点状态 = 必填全 Pass 且无 Weak；**服务端也拒绝不合格的发布请求**；刷新后状态一致 | seed③全部合格 |

---

### 3.7 M7 角色与权限（四角色）

角色定义见 [九模块 User Journey §0.1](HireOS_Command_JD_Management_Module_User_Journeys_v1.0.md)：Recruiter / TA、Hiring Manager、HR Approver、Viewer。2026-10-14 已决定恢复审批；审批流程后端尚未实现，图中虚线框节点的用例先标记为 known gap。

```mermaid
flowchart TB
  J[("职位 J：必填合格<br/>含 Confidential 和预算字段")] --> W{"当前角色"}
  subgraph R["Recruiter / TA"]
    r1["编辑、应用 AI 建议、保存草稿 ✔1"]
    r2{"阻断项为 0?"}
    r3["提交审批<br/>冻结候选版本 ✔3"]
    rx["提交审批不可用<br/>前端 + 服务端 ✔2"]
  end
  subgraph H["Hiring Manager"]
    h1{"修改的字段已授权?"}
    h2["保存，记录修改人 ✔4"]
    hx["拒绝：预算 / 敏感字段只读<br/>接口 403 ✔5"]
  end
  subgraph A["HR Approver"]
    a1["查看候选版本、差异、风险、可见范围 ✔6"]
    a2{"审批决定"}
    a3(["approved<br/>记录审批人、版本、时间 ✔8"])
    a4["退回 / 拒绝：必须填写理由 ✔7"]
    a5["旧请求作废 superseded<br/>审批人不能再决定 ✔11"]
  end
  subgraph V["Viewer"]
    v1(["只读：职位、来源、有效版本<br/>授权的 Agent 结论<br/>看不到 Confidential ✔9"])
    vx["写操作接口 403<br/>响应不含敏感正文 ✔10"]
  end
  W -->|"Recruiter"| r1 --> r2
  r2 -->|"否"| rx
  r2 -->|"是"| r3 --> a1
  W -->|"Hiring Manager"| h1
  h1 -->|"是：职责、成功标准"| h2
  h1 -->|"否：预算、敏感字段"| hx
  W -->|"HR Approver"| a1
  a1 --> a2
  a2 -->|"批准"| a3
  a2 -->|"退回 / 拒绝"| a4 --> r1
  r1 -.->|"审批进行中修改内容"| a5 --> r2
  W -->|"Viewer"| v1 --> vx
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  classDef pending stroke-dasharray:5 3
  class rx,hx,vx err
  class a3,v1 done
  class r3,a1,a2,a4,a5 pending
```

| 断言点 | 检查什么 |
|---|---|
| ✔1 | Recruiter 可编辑、可见 Confidential、可保存草稿和应用 AI 建议 |
| ✔2 | 有阻断项时提交审批不可用；直接调用接口也被拒绝 |
| ✔3 | 生成待审批的候选版本，内容被冻结；Recruiter 不能批准自己提交的版本 |
| ✔4 | Hiring Manager 修改授权字段后保存成功，记录修改人和时间 |
| ✔5 | Hiring Manager 修改预算 / 敏感字段：界面只读，接口返回 403 |
| ✔6 | 审批人看到内容、与上一版的差异、风险；无 restricted 权限时看不到 restricted 字段 |
| ✔7 | 退回或拒绝不填理由时不能提交 |
| ✔8 | 批准记录人工审批人、精确版本和时间；AI 不能作为审批人 |
| ✔9 | Viewer 只读，没有编辑类按钮，看不到 Confidential 和敏感字段 |
| ✔10 | **用 API 直接请求**：Viewer 的响应里不含 Confidential 正文；编辑、保存、提交、发布接口都返回 403 |
| ✔11 | 审批进行中修改内容：旧请求变为 superseded，必须重新提交；审批人对旧版本的决定被拒绝 |

---

### 3.8 M8 发布与版本

```mermaid
flowchart TB
  subgraph U["用户"]
    u1["点击 Publish"]
    u2["填版本说明，选测试渠道，确认"]
    u3["修改内容"]
    u4["打开 Version history 对比"]
    u5["恢复旧版本"]
  end
  subgraph S["JD 系统"]
    s0{"门禁：Ready 且已批准?<br/>前端 + 服务端"}
    s1["发布窗口：JD ID / 新版本号 / 渠道<br/>说明只有 Public 对外 ✔1"]
    s2[("不可变版本 vN<br/>活动记录 ✔2")]
    s3["页头 Unpublished changes ✔4"]
    s4["差异：新增 / 删除 / 修改 / 可见范围变化 ✔5"]
    s5(["草稿回到旧版内容<br/>历史保留 + 恢复记录 ✔6"])
    sx["拒绝发布"]
  end
  subgraph X["发布渠道（测试渠道）"]
    x1{"渠道回执"}
    x2["对外页面：只含 Public 块 ✔3"]
    x3["outcome_unknown<br/>先查询，不默认重发 ✔7"]
  end
  u1 --> s0
  s0 -->|"否"| sx
  s0 -->|"是"| s1 --> u2 --> s2 --> x1
  x1 -->|"成功"| x2
  x1 -.->|"超时 / 无回执"| x3
  x2 --> u3 --> s3 --> u1
  s2 --> u4 --> s4 --> u5 --> s5
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class sx,x3 err
  class s5 done
```

| 断言点 | 检查什么 |
|---|---|
| ✔1 | JD ID 格式 `JD-年份-编号`；第二次发布时窗口列出相对上一版的变更 |
| ✔2 | 每次发布版本号 +1；已发布版本内容不可修改；双击 Publish 只生成一个版本 |
| ✔3 | 对外页面**没有** Internal 和 Confidential 内容 |
| ✔4 | 修改后对外内容仍是旧版本 |
| ✔5 | 能对比任意两个版本 |
| ✔6 | 恢复不删除任何历史版本 |
| ✔7 | 超时后不显示成功，主操作是查询状态 |

> 线上暂无发布渠道：✔3、✔7 等渠道上线后再测；其余断言可以先测“仅生成版本”的部分。

---

### 3.9 M9 编辑：字段、标题联动与 Copilot 改写

```mermaid
flowchart TB
  subgraph U["用户"]
    u0{"要改什么?"}
    u1["改页头标题 / 文档大标题"]
    u2["改字段行<br/>清空 / Remote / Add field / ×"]
    u3["选中一段文字<br/>Copilot: Rewrite this"]
    u4{"Accept / Reject"}
  end
  subgraph S["JD 系统"]
    s1["两处标题双向同步 ✔1"]
    s2{"必填字段被清空?"}
    s3["提示并恢复原值 ✔2"]
    s4["字段更新；Analysis 实时检查 ✔3"]
    s5{"选区含 Confidential?"}
    s6["Copilot 不可用<br/>请求中没有该块正文 ✔4"]
    s7["引用标签 + 原位 diff ✔5"]
    s8["Accept：正文更新<br/>Reject：正文不变，无残留"]
    s9(["自动保存 Saving → Saved<br/>刷新后一致 ✔6"])
    se["Offline / Save failed<br/>内容不丢，可重试 ✔7"]
  end
  subgraph X["AI / 外部"]
    x1["LLM rewrite<br/>只基于选中文字"]
  end
  u0 --> u1 --> s1 --> s9
  u0 --> u2 --> s2
  s2 -->|"是"| s3
  s2 -->|"否"| s4 --> s9
  u0 --> u3 --> s5
  s5 -->|"是"| s6
  s5 -->|"否"| x1 --> s7 --> u4 --> s8 --> s9
  s9 -.->|"断网 / 500 / 409"| se
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class se,s6 err
  class s9 done
```

| 断言点 | 检查什么 | 输入示例 |
|---|---|---|
| ✔1 | 改任意一处，另一处同步；必填检查仍通过 | `[UJ-TEST] Staff Backend Engineer` |
| ✔2 | Location 不能为空，值恢复 | 清空 Location |
| ✔3 | `Remote` 触发 To revise；Add field 菜单不含已显示字段；× 隐藏后可加回；Level 设为 Not set 后不显示 | — |
| ✔4 | 网络请求里没有 Confidential 正文 | 选中 Confidential 块 |
| ✔5 | 改写只作用于选区；Accept 前正文不变 | `Rewrite this` |
| ✔6 | 刷新、返回列表后，标题、Location、HC、Workplace type 一致 | — |
| ✔7 | 保存失败时不显示 Saved；两个标签页同时编辑不静默覆盖 | 断网、两个标签页 |

---

### 3.10 M10 招聘问答与市场薪资调研（建议新增）

```mermaid
flowchart TB
  subgraph U["用户"]
    u1["不选文字，直接在 Copilot 提问"]
    u2{"采纳结果?"}
    u3["确认写入薪资字段"]
  end
  subgraph S["JD 系统"]
    s1["界面标明：问答 / 调研模式 ✔1"]
    s2{"问题与招聘相关?"}
    s3["提示超出工作区范围 ✔2"]
    s4{"有权限读内部预算?"}
    s5["结果：地区 + 来源 + 日期 ✔3"]
    s6["只显示，不写入 ✔4"]
    s7(["人工确认后写入<br/>记录来源 ✔5"])
    se["无来源：不给结论"]
  end
  subgraph X["AI / 外部"]
    x1["薪资数据源（待定）"]
    x2["LLM 汇总"]
  end
  u1 --> s1 --> s2
  s2 -->|"否，如天气"| s3
  s2 -->|"是"| s4
  s4 -->|"否：不读预算"| x1
  s4 -->|"是"| x1
  x1 --> x2 --> s5 --> s6 --> u2
  u2 -->|"是"| u3 --> s7
  x1 -.->|"无数据"| se
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class se,s3 err
  class s7 done
```

| 断言点 | 检查什么 |
|---|---|
| ✔1 | 不需要选中文字；用户能分辨当前是问答还是编辑 |
| ✔2 | 不调用无关工具 |
| ✔3 | 每个结论都有地区、来源、日期 |
| ✔4 | 未确认前薪资字段不变 |
| ✔5 | 无权用户诱导读取内部预算时拿不到值 |

> 依赖产品决策：薪资数据源；结果是否允许自动写入。

---

### 3.11 M11 生命周期与清理（建议新增）

```mermaid
flowchart TB
  subgraph U["用户（有权限者）"]
    u1{"选择操作"}
    u2["填写原因并确认"]
  end
  subgraph S["JD 系统"]
    s1{"状态迁移合法?<br/>按 2.2 状态图"}
    s2["拒绝非法迁移 ✔1"]
    s3[("新状态 + 原因 + 操作者 ✔2")]
    s4["closed / archived：禁止新招聘动作<br/>历史仍可读 ✔3"]
    s5(["渠道撤下单独跟踪<br/>不伪装成已撤下 ✔4"])
    s6{"删除：是否已发布过?"}
    s7["软删除 / 归档<br/>不破坏历史引用 ✔5"]
  end
  subgraph X["Core Record / 渠道"]
    x1["Core 状态命令"]
    x2["渠道撤下请求"]
  end
  u1 -->|"暂停 / 关闭 / 归档 / 恢复"| u2 --> s1
  s1 -->|"否"| s2
  s1 -->|"是"| x1 --> s3 --> s4
  s3 --> x2 --> s5
  u1 -->|"删除"| s6 --> s7
  classDef err stroke:#d33,stroke-dasharray:4 3,color:#d33
  classDef done fill:#e6f4ea,stroke:#1e8e3e
  class s2 err
  class s5,s7 done
```

| 断言点 | 检查什么 |
|---|---|
| ✔1 | 非法迁移（如 archived → open）被拒绝 |
| ✔2 | 暂停、关闭、归档、重开都必须填原因 |
| ✔3 | 关闭或归档后不能再发布 |
| ✔4 | 渠道撤下状态与职位状态分开记录 |
| ✔5 | 测试数据（`[UJ-TEST]`）可以被清理，且不留下孤立的版本记录 |

> 当前后端只有 `draft ↔ published`；本闭环先按 2.2 的目标状态写用例，未实现部分标记 known gap。

---

### 3.12 J10 横切套件：叠加到每个闭环

不单独成闭环。每个闭环的测试都要对下列注入点各跑一遍：

```mermaid
flowchart LR
  L["任一闭环 M1–M11"] --> P{"注入点"}
  P --> N["网络断开<br/>输入不丢，可重试"]
  P --> C["并发：双击 / 两个标签页<br/>只生效一次，不静默覆盖"]
  P --> R["刷新 / 后退<br/>不产生半成品"]
  P --> A["AI 失败 / 超时<br/>可恢复，不编造"]
  P --> PERM["换成无权身份<br/>服务端拒绝"]
  P --> PERF["性能：重复 3 次<br/>记录首个反馈和完整结果耗时"]
  P --> A11Y["键盘 / 200% 缩放 / 中英文"]
```

| 注入点 | 通过标准 | 阈值 |
|---|---|---|
| 网络断开 | 有明确失败提示和重试；已输入内容不丢 | — |
| 并发 | 双击只创建一个职位、只发布一个版本；同时编辑不静默覆盖 | — |
| 刷新 / 后退 | 不产生半成品职位，可以继续 | — |
| AI 失败 | 错误可恢复，不显示假成功 | — |
| 无权身份 | API 层拒绝，响应不含敏感正文 | — |
| 性能 | 同一输入 3 次都满足判定条件 | **待确认**（v0.1 建议首个反馈 ≤2 秒、完整结果 ≤20 秒） |
| 可访问性 | 主要流程可以只用键盘完成 | — |
