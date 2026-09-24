# Zoom 本地主持人联调

## 当前入口

打开 `http://localhost:5173/project/live`，点击“连接 Zoom”，在新标签页登录并授权。授权成功后关闭该标签页回到 HireOS，页面会自动更新账户状态。

点击“创建 / 进入主持会议”，后端在授权用户账户下创建会议，获取 ZAK，并以 `role=1` 加入。无需提前在 Zoom 客户端开会，也不使用固定的 `ZOOM_DEV_MEETING_NUMBER/PASSWORD`。

候选人使用“复制邀请链接”得到的 Zoom 链接参会。网页提供“离开会议”和“结束所有人的会议”，后者需要再次确认。

## Zoom 应用设置

- General App 开启 Meeting SDK、Public Client OAuth。
- Redirect URL 与 Allow List 均为 `http://127.0.0.1:50590/api/integrations/zoom/callback`，Strict Mode 开启。
- 本地授权使用固定 loopback 端口 `50590`；如端口被占用，修改后端 `ZOOM_OAUTH_CALLBACK_PORT`，并同步修改 Zoom Marketplace 中的 Redirect URL 与 OAuth Allow List。
- Scopes：`user:read:user`、`user:read:zak`、`meeting:write:meeting`。
- SDK Client ID/Secret 与 OAuth Public Client ID 分别配置，必须从后台对应字段核对；勿把 SDK Secret 当 OAuth verifier。

后端环境变量：

```dotenv
NODE_ENV=development
DEV_AUTH_ENABLED=true
ZOOM_DEV_ENABLED=true
ZOOM_OAUTH_PUBLIC_CLIENT_ID=<Public Client ID>
ZOOM_MEETING_SDK_CLIENT_ID=<SDK Client ID>
ZOOM_MEETING_SDK_CLIENT_SECRET=<SDK Client Secret>
```

环境修改后重启后端。允许浏览器弹窗；授权应在运行本地后端的同一台电脑完成。

## 本地数据和边界

- 本版本仅限单进程本地开发，不开放生产环境。HireOS 身份仍是 `WorkspaceGuard` 的开发身份，不是正式登录用户体系。
- 令牌按工作区和用户隔离，用 AES-256-GCM 加密保存至后端 `.local/zoom/`。本地密钥文件权限为 0600；目录与全部内容均不得提交。
- 本地密钥与密文位于同机，不能代替生产密钥管理。正式上线须迁移到真实鉴权、数据库及独立密钥管理。
- access/refresh token 不返回浏览器，ZAK 按需获取，不持久化，不写日志。状态接口仅返回显示名和候选人邀请链接。
- PKCE 使用 S256、随机 verifier 和一次性 state；临时回调服务只绑定回环地址，授权完成或五分钟超时后关闭。
- 修改 API 需要自定义请求头；仍应保持后端仅监听回环地址并配置严格 CORS，不能通过隧道暴露整个开发后端。
- 同一开发用户的创建操作串行执行，已经创建的会议在刷新、重试时复用。
- 创建请求结果不确定时禁止自动再次创建。先在 Zoom 核对旧会议，必要时点击“准备新会议”明确清除本地关联，再创建；该按钮不会结束或删除旧会议。
- 结束后需要新的一场会议，同样先确认旧会议已结束，再点击“准备新会议”。
- 未增加真实项目/轮次关联，不接入录制、RTMS、转写、AI 和评审，现有笔记仍是临时草稿。

## 接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/meetings/host/status` | 当前开发用户连接状态 |
| POST | `/api/meetings/host/authorize` | 启动临时 loopback listener，返回 OAuth 地址 |
| POST | `/api/meetings/host/start` | 创建或复用会议，获取主持人签名和 ZAK |
| POST | `/api/meetings/host/reset-meeting` | 用户确认后清除当前本地会议关联 |

POST 需 `x-hireos-zoom: 1`。回调不在主 Nest 端口监听，而在每次授权的临时端口监听，因此直接访问 3001 的 callback 路径返回 404 是正常的。

## 验证

会议 iframe 的 HTML 响应需要 `Document-Isolation-Policy: isolate-and-credentialless`（Chrome/Edge 137+），以启用 SharedArrayBuffer 多视频能力。Vite 开发和预览已配置；生产静态服务器须为 `/zoom-meeting/index.html` 配置同名响应头。不要用 meta 标签替代，也不要改动主页面 OAuth 窗口策略。不支持该策略的浏览器保留 SDK 受限视频模式和窄幅尺寸。

真实会议需双端验收：双方进入同一会议、主持人准入等待室参与者、双方开启视频，并确认两端均看到远端画面。模拟测试不验证媒体接收。

后端：`npm run build` 后运行 `node --test test/meetings.test.cjs test/zoom-host.test.cjs`。

前端：`node --test test/zoom-runtime.test.mjs`、`ZOOM_TEST_URL=http://localhost:5173 node test/zoom-live.test.mjs` 和 `npx vite build`。

这些测试使用模拟 OAuth/Zoom 服务，覆盖 PKCE、隔离、加密、重复创建、主持人签名、ZAK 传递和页面生命周期。真实授权、账户权限、创建会议与主持人通话需要在 Zoom 中人工授权后验收，不因测试通过而视为已经完成。

官方参考：[PKCE 与 loopback](https://developers.zoom.us/docs/integrations/oauth/)、[SDK 主持人授权](https://developers.zoom.us/docs/meeting-sdk/auth/)、[用户 ZAK API](https://developers.zoom.us/docs/api/users/)。
