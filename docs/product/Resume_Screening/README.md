# Resume Screening 主流程产品文档

按 [功能拆分](../../../hireos-screening/docs/Resume_Screening_Feature_Breakdown.md) 的 F01～F11 主流程，每个功能一个文件夹，各放一份 `PRD.md`。格式与 [JD_Management](../JD_Management/) 下的 `Mx_*/PRD.md` 保持一致。

| 编号 | 文件夹 | 功能 |
|---|---|---|
| F01 | [F01_Intake_Import](F01_Intake_Import/PRD.md) | 资料接入与导入批次 |
| F02 | [F02_Profile_Parsing](F02_Profile_Parsing/PRD.md) | 简历解析与候选人档案 |
| F03 | [F03_Duplicate_Detection](F03_Duplicate_Detection/PRD.md) | 重复识别与身份复核 |
| F04 | [F04_Resume_Library](F04_Resume_Library/PRD.md) | 简历库 |
| F05 | [F05_Job_Criteria](F05_Job_Criteria/PRD.md) | 岗位与评分标准 |
| F06 | [F06_Job_Discovery](F06_Job_Discovery/PRD.md) | AI 岗位发现与推荐 |
| F07 | [F07_Job_Linking](F07_Job_Linking/PRD.md) | 人工岗位关联 |
| F08 | [F08_AI_Screening_Evaluation](F08_AI_Screening_Evaluation/PRD.md) | AI 岗位筛选评估 |
| F09 | [F09_Screening_Workspace_Ranking](F09_Screening_Workspace_Ranking/PRD.md) | 筛选工作台、排序与批量筛选 |
| F10 | [F10_Candidate_Comparison](F10_Candidate_Comparison/PRD.md) | 候选人对比 |
| F11 | [F11_Human_Decision](F11_Human_Decision/PRD.md) | 人工决定与例外审批 |

## 依据

- [Resume Screening PRD v1.3](../../../hireos-screening/docs/Resume_Screening_PRD_v1.3.md)：需求基线。
- [原型 v2](../../design/Resume_Screening/HireOS-Resume-Screening-Prototype-v2.html)：页面与交互。
- [用户旅程 v0.2](../user-journeys/Resume_Screening_User_Journeys_v0.2.md)：已确认的产品决定（Must-have 即硬性、移除工作授权字段和招聘预算等）以及 Patch 1 规则的转述。

## 说明

- 各文档的「实现现状」是 2026-10-14 按代码目录和接口做的初步核对，没有逐项验证 AC。
- PRD Patch 1 不在仓库中，相关规则（置信度档位、推荐五档阈值、评分维度配置）引自用户旅程文档，各 PRD 的「待确认」中已标出。
- 支撑能力（任务、通知、首页统计、偏好学习、Files & Integrations、模型配置、权限审计）是功能拆分中的 F13～F19，未在此建文件夹。
