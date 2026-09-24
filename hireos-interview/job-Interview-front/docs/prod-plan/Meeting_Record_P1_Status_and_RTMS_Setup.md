# 会议记录 P1 交付与 RTMS 开通清单

日期：2026-09-11

## 本轮已交付

- 实时面试右侧保持“笔记 / 转写 / AI 建议”标签。
- 选择真实项目与轮次，打开对应的私有手工记录；重复打开同一项目/轮次复用记录。
- 笔记停止输入 800ms 后自动保存至 PostgreSQL；刷新通过 URL 中的 `recordSession` 恢复。
- 保存中、已保存、失败重试；多标签页并发冲突可比较服务器版本，再明确选择保留哪一版。
- 场次和笔记按当前开发工作区/作者校验；不使用原型里的虚构项目或候选人作为数据库标识。
- 迁移新增 InterviewSession、RecordNote，不重建已有数据库。笔记不存 localStorage。

入口：`http://localhost:5173/project/live`。在右侧选择项目、轮次并点击“打开记录”。需要先在首页创建真实项目；原型示例不会出现在该列表。

## 尚未交付的部分

用户已确认 RTMS 尚未开通，因此本轮没有采集音频、实时转写或 AI 建议。没有生成伪造转写。

当前手工记录是“项目 + 轮次 + 作者”的独立记录容器，尚未自动关联当前 Zoom 会议实例。Zoom host/start 仍保持既有行为，没有改为按场次创建会议。接入 RTMS 前必须完成 meeting UUID、账户与场次关联；不得把本轮的私有记录容器直接当成多人共享会议实例。

下阶段还需实现授权记录、RTMS 控制及 webhook/worker、转写入库、SSE、停止与封存、保留策略。当前不提供“开始转写”按钮，也没有可用于 Zoom 配置的 webhook 接口。

本轮功能仍由开发 WorkspaceGuard 保护，默认只可访问本人创建的项目。上线前须补真实登录与项目 ACL、保留/删除策略。笔记未保存时刷新/退出按钮有提示；不要依赖关闭浏览器时的异步保存。

## Zoom 开通准备

1. 在现有 General App 后台核实 RTMS 功能、Developer Pack credits 与管理员策略；费用和额度以实际账户为准。
2. 增加 `meeting:read:meeting_transcript`。RTMS 启停按应用授权类型核对 `meeting:update:participant_rtms_app_status` 或 admin 版本，不默认申请全部管理员权限。
3. 为 RTMS 功能核对应用 Client ID/Secret，并单独保存 webhook Secret Token；不能用 OAuth Public Client ID 或主持人 ZAK 代替 RTMS 握手凭据。不要将 Secret 发到聊天中。
4. 下一阶段实现仅用于 webhook 的 HTTPS 入口后，再配置 event subscriptions：`meeting.started`、`meeting.ended`、`meeting.rtms_started`、`meeting.rtms_stopped`，并完成 endpoint 验证。
5. 本地 `127.0.0.1` OAuth callback 不是公网 webhook。不能直接用隧道暴露整个带开发身份的 API。
6. 新增 scopes 后重新授权；通过双方真实中英文发言测试，确认文本、说话人、时间和停止采集行为。

参考：[RTMS 接入条件](https://developers.zoom.us/docs/rtms/meetings/add-features/)、[REST 控制与转写接收](https://developers.zoom.us/docs/rtms/meetings/quickstart-rest-api/)。

## 验证记录

- 后端 `npm test`：16 项通过，包含真实 PostgreSQL 临时 schema 的场次隔离、鉴权、笔记并发与幂等重试。测试只清理自己创建的 schema。
- 前端 `test/meeting-records.test.mjs`：模拟 API 验证保存、刷新、标签/语言切换、失败重试、冲突解决。
- 原 Zoom 浏览器回归通过；没有为测试创建真实 Zoom 会议。
- Vite 构建通过。全量前端 TypeScript 检查仍有原有 `roles.ts`、`Files.tsx`、`StoreContext.tsx`、`status.tsx` 错误，本轮未修改这些模块来清理历史错误。

```sh
# 后端目录
npm run prisma:generate
npm run prisma:migrate:deploy
npm test

# 前端目录
ZOOM_TEST_URL=http://localhost:5173 node test/meeting-records.test.mjs
ZOOM_TEST_URL=http://localhost:5173 node test/zoom-live.test.mjs
npx vite build
```
