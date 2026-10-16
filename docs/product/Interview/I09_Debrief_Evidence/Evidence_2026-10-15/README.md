# I09 十个 Issue 草稿的截图证据索引

截图时间：2026-10-15（Asia/Shanghai）。图片均为 `hireos.aipollo.me/hireos/interview/` 的原始 Chrome 页面截图，仅裁切掉包含候选人姓名的页头与无关区域；未改动截图内容。样本为现有已发布的两轮演示项目。截图只能证明可见 UI，不证明 API、数据库或服务端权限。

| 草稿 | 截图 / 证据 | 状态 |
|---|---|---|
| 1 跨轮意见 | [第 1 轮未达标](Draft_01_Review_Round1_Below_Bar.jpg) · [第 2 轮达标](Draft_01_Review_Round2_Meets_Bar.jpg) · [Debrief 只显示第 2 轮](Draft_01_Debrief_Round2_Only.jpg) | **线上截图可直接复现 UI 差异** |
| 2 L4/L3 不一致 | [Overview L4](Draft_02_Overview_L4.jpg) · [Debrief L3](Draft_02_Debrief_L3.jpg) | **线上截图可直接复现** |
| 3 最终加权分缺失 | [8/8 已评分但 Overall Score 仅 Pass](Draft_03_Overall_Score.jpg) | **线上截图可直接复现 UI 差异** |
| 4 补证闭环 | 无有效线上复现截图；当前样本已发布。源码 [DebriefPage.tsx](../../../../../hireos-interview/job-Interview-front/src/pages/project/DebriefPage.tsx#L184) | 待 Unknown seed 与创建流程复测 |
| 5 Candidate Evidence Map | 无有效线上复现截图；源码 [DebriefPage.tsx](../../../../../hireos-interview/job-Interview-front/src/pages/project/DebriefPage.tsx#L184) | 功能缺口，待产品确定页面形态 |
| 6 未解决问题负责人 | 无 AI 跨轮草稿样本；源码 [tasks.service.ts](../../../../../hireos-interview/job-Interview-backend/src/intake/tasks.service.ts#L145)、[DebriefPage.tsx](../../../../../hireos-interview/job-Interview-front/src/pages/project/DebriefPage.tsx#L186) | 代码依据，待线上复测 |
| 7 双追溯链 | 无 `ai_gap` 样本；源码 [DebriefPage.tsx](../../../../../hireos-interview/job-Interview-front/src/pages/project/DebriefPage.tsx#L115) | 代码依据，待线上复测 |
| 8 Unknown 决定阻断 | 无 Unknown Must-have 样本；源码 [tasks.service.ts](../../../../../hireos-interview/job-Interview-backend/src/intake/tasks.service.ts#L249) | 代码风险，待线上 UI/API 复测 |
| 9 Interviewer 权限 | I15 业务角色权限尚未实现；源码 [intake.controller.ts](../../../../../hireos-interview/job-Interview-backend/src/intake/intake.controller.ts#L75)、[workspace.guard.ts](../../../../../hireos-interview/job-Interview-backend/src/intake/workspace.guard.ts#L63) | 待实现能力，当前不做跨角色拒绝测试 |
| 10 Rubric 权重 | [已确认 Rubric 权重合计 105%](Draft_10_Rubric_105_Percent.jpg) | **线上截图可直接复现** |

草稿 4～8 没有目标状态截图，不能作为“线上已复现 Bug”提交。使用当前账号即可继续测试，但需 I09 文档所列的隔离 seed 及 AI 分歧样本。草稿 9 在 I15 权限功能实现后再验证。正式 GitHub 记录见[草稿索引](../Issue_Drafts_With_Evidence_2026-10-15.md)。原始测试结果见[测试报告](../Test_Report_2026-10-15.md)。
