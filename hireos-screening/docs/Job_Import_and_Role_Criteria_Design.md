# Job Import and Role Criteria Design

## 1. Purpose

岗位描述导入不是一次性的数据库 seed。它必须和 Screening 前端已有的
“Import / create job”入口共享同一套解析、标准化、版本化和幂等规则。

本设计采用以下职责边界：

- Core Record：Job 主档、RoleDefinitionVersion 和确认后的标准版本；
- JD：岗位草稿、来源字段、编辑状态和 JD 工作流；
- Screening：兼容前端的 Job 读模型、匹配和筛选消费；
- 原始 JD 文本：保留在 Screening 的 Job `jdText`，来源哈希写入 JD/Core；
- 人工确认：仍通过现有 Job Criteria 页面完成，导入不等于批准。

## 2. Reusable Flow

```text
POST /api/jobs
  with jdText
        |
        v
JobDefinitionParser
        |
        v
Core Job (draft) + local Screening projection
        |
        v
JD current draft -> Core RoleDefinitionVersion (external_import)
        |
        v
Job Criteria page confirms the version
```

批量导入复用同一条链路：

```text
POST /api/jobs/import
  { sourceFileName, sourceText }
```

本地样本命令：

```sh
npm run jobs:import:samples
```

同一 workspace 下，完全相同的 `sourceText` 会复用已有 Job，不重复创建
Core Job、RoleDefinitionVersion 或 JD draft。

## 3. Parsing Contract

当前解析器针对结构化中文 JD 文本，识别：

- 顶部元数据：职位名称、所属部门、工作地点、工作模式、汇报对象；
- 职位概述；
- 主要职责；
- 任职要求；
- 加分项；
- 我们提供。

解析结果进入 RoleDefinitionVersion：

- `roleSummary`
- `responsibilities`
- `requirements`
- `dimensions`
- `hiringContext`
- `successCriteria`
- `sourceRefs`
- `origin=external_import`

任职要求默认为 `must_have`，加分项默认为 `nice_to_have`。这是可审阅的
初始提案，不是对岗位条件合法性或候选人能力的自动判断。

## 4. Dimension Strategy

评分维度按岗位族生成，而不是所有岗位共用一套中性维度：

- AI 产品：产品策略、AI/领域深度、0→1 交付、协作、地点约束；
- AI 项目：项目交付、行业交付语境、风险与干系人、协作、地点约束；
- 产品设计：产品与交互、AI 体验、研究验证、协作、地点约束；
- 财务运营：FP&A、SaaS/AI 业务理解、流程控制、协作、地点约束；
- 全栈工程：全栈工程、产品交付与架构、质量可靠性、协作、地点约束；
- 后端工程：技术深度、相关经验、Ownership/0→1、协作、地点约束。

权重总和固定为 100%。进入正式筛选前仍由人审阅 requirement-to-dimension
映射、硬约束标记和 rubric。

## 5. Resume Detail Compatibility

简历详情页消费的是 Candidate/Profile 快照、ResumeVersion、Application 和
Recommendation。岗位导入不会把候选人直接关联到岗位，也不会创建
Application。

岗位确认后，既有匹配流程可以使用：

- 已确认的 RoleDefinitionVersion；
- Screening 本地 JobCriteriaVersion 投影；
- 候选人 Profile 与 ResumeVersion；
- 后续生成的 PreLinkMatchEvaluation。

因此“导入岗位”和“候选人进入正式筛选”仍是两个独立动作：

1. 导入岗位；
2. 人工确认岗位标准；
3. 运行岗位发现/匹配；
4. 人工确认岗位关联；
5. 创建 Application；
6. 运行正式 Screening Evaluation。

## 6. Current Limitations

- 当前解析器是确定性规则解析器，还没有接入 JD Copilot 的 AI 提取和原文
  evidence locator；
- 样本没有薪资字段，因此薪酬范围保持 unknown；
- 导入结果默认是 Job draft 和 Role draft，不自动确认、不自动开放匹配；
- 未来接入真实文件上传时，应把 `sourceRefs` 替换/补充为 Core FileVersion
  引用，而不是把文件路径暴露给前端。
