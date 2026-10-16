# I09 十个 Issue 草稿的截图证据索引

截图时间：2026-10-15（Asia/Shanghai）。图片均为 `hireos.aipollo.me/hireos/interview/` 的原始 Chrome 页面截图，仅裁切掉包含候选人姓名的页头与无关区域；未改动截图内容。样本为现有已发布的两轮演示项目。截图只能证明可见 UI，不证明 API、数据库或服务端权限。

| 草稿 | 截图 / 证据 | 状态 |
|---|---|---|
| 1 跨轮意见 | [第 1 轮未达标](Draft_01_Review_Round1_Below_Bar.jpg) · [第 2 轮达标](Draft_01_Review_Round2_Meets_Bar.jpg) · [Debrief 只显示第 2 轮](Draft_01_Debrief_Round2_Only.jpg) | **线上截图可直接复现 UI 差异** |
| 2 L4/L3 不一致 | [Overview L4](Draft_02_Overview_L4.jpg) · [Debrief L3](Draft_02_Debrief_L3.jpg) | **线上截图可直接复现** |
| 3 最终加权分缺失 | [8/8 已评分但 Overall Score 仅 Pass](Draft_03_Overall_Score.jpg) | **线上截图可直接复现 UI 差异** |
| 4 补证闭环 | 无有效线上复现截图；当前样本已发布。源码 [DebriefPage.tsx](/Users/apple/work/HireOSV2/hireos-interview/job-Interview-front/src/pages/project/DebriefPage.tsx:184) | 待 Unknown seed 与创建流程复测 |
| 5 Candidate Evidence Map | 无有效线上复现截图；源码 [DebriefPage.tsx](/Users/apple/work/HireOSV2/hireos-interview/job-Interview-front/src/pages/project/DebriefPage.tsx:184) | 功能缺口，待产品确定页面形态 |
| 6 未解决问题负责人 | 无 AI 跨轮草稿样本；源码 [tasks.service.ts](/Users/apple/work/HireOSV2/hireos-interview/job-Interview-backend/src/intake/tasks.service.ts:145)、[DebriefPage.tsx](/Users/apple/work/HireOSV2/hireos-interview/job-Interview-front/src/pages/project/DebriefPage.tsx:186) | 代码依据，待线上复测 |
| 7 双追溯链 | 无 `ai_gap` 样本；源码 [DebriefPage.tsx](/Users/apple/work/HireOSV2/hireos-interview/job-Interview-front/src/pages/project/DebriefPage.tsx:115) | 代码依据，待线上复测 |
| 8 Unknown 决定阻断 | 无 Unknown Must-have 样本；源码 [tasks.service.ts](/Users/apple/work/HireOSV2/hireos-interview/job-Interview-backend/src/intake/tasks.service.ts:249) | 代码风险，待线上 UI/API 复测 |
| 9 Interviewer 权限 | 无独立 Interviewer 身份；源码 [intake.controller.ts](/Users/apple/work/HireOSV2/hireos-interview/job-Interview-backend/src/intake/intake.controller.ts:75)、[workspace.guard.ts](/Users/apple/work/HireOSV2/hireos-interview/job-Interview-backend/src/intake/workspace.guard.ts:63) | 代码风险，待独立身份验证 |
| 10 Rubric 权重 | [已确认 Rubric 权重合计 105%](Draft_10_Rubric_105_Percent.jpg) | **线上截图可直接复现** |

草稿 4～9 没有截图，不能作为“线上已复现 Bug”提交。要补全截图，需 I09 文档所列的隔离 seed、独立角色账号及 AI 失败/分歧注入。原始测试结果见[测试报告](../Test_Report_2026-10-15.md)。
