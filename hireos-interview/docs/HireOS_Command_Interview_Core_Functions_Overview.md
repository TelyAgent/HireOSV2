# HireOS Command Interview 核心功能全景

> 围绕岗位要求，将面试转化为可追溯的证据与评估

## 全局支撑

**Account & System Configuration · 横向全局支撑**

- 账号与权限
- 流程与评分模板
- 语言与时区
- 数据与录制策略

## 业务流程

```text
JD Management
    → Resume Screening
    → Assessment / Written Test
    → Interview
    → Offer
```

## Interview 核心阶段

### 01 面试前 · 准备

- 上下文接入：岗位、简历、筛选与测评
- Interview Brief：已知、未知与矛盾
- AI 面试计划：轮次、能力与问题
- 人工确认计划与面试排期

**输出：** `Interview Plan + Brief`

### 02 面试中 · 执行

- 面试工作台：计划、问题与笔记
- AI 问题建议，面试官自主追问
- 经许可录制与转写
- 支持结构化手工回答记录

**输出：** `Interview Record`

### 03 面试后 · 评估

- 证据提取与岗位能力映射
- AI Scorecard 草稿
- 人工独立评分与来源复核
- 跨轮证据汇总与分歧识别

**输出：** `Evidence + Scorecards`

### 04 决策交接 · 推进

- Candidate Debrief：结论与缺口
- 人工决定：推进 / 暂缓 / 拒绝 / 补证
- 人工复核后发布评估包
- Offer 接收确认与独立审批

**核心输出：** `Hiring Evaluation Package`

评估包交付至 **Offer Module**。

## 评估链路

```text
岗位要求
    → 能力
    → 问题
    → 回答
    → 证据
    → 评估
    → 人工决定
```

## 核心原则

- **AI 建议 ≠ 人工决定**
- **Unknown ≠ 低分**
- **Offer 接收 ≠ Offer 获批**

## 优先级

| 优先级 | 范围 |
|---|---|
| **P0** | 核心闭环：准备 · 执行 · 证据 · 评估 · 交接 |
| **P1** | 实时自适应追问 · 证据缺口提醒 · 面试质量分析 |
| **P2** | 自主 AI 面试官 |

---

依据 `Interview PRD v1.1` · 产品定义 / 待评审
