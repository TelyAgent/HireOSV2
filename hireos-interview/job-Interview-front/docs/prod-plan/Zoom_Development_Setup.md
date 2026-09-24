# Zoom 开发联调

## 当前范围

已实现 P1 开发会议入口；不包含主持人授权、项目/轮次绑定、持久化笔记、录制、转写、AI 或评审联调。页面上的笔记仅存在当前页面内存中，离开或刷新会丢失。

SDK 固定为 6.2.0。该 npm 版本声明 React 18.2 peer dependency，而主项目使用 React 19，因此采用同源 iframe 隔离运行时，按需加载 Zoom 官方 CDN 的 React、Redux 和 Embedded SDK。没有降级主项目 React，也没有强制绕过 peer dependencies。

会议区外保留原有布局；SDK 内部采用 Zoom 原生 UI。官方参考：[Web 安装](https://developers.zoom.us/docs/meeting-sdk/web/get-started/)、[Component View](https://developers.zoom.us/docs/meeting-sdk/web/component-view/)、[授权](https://developers.zoom.us/docs/meeting-sdk/auth/)。

## 配置

在后端 `.env` 设置以下值，真实密钥不要提交或放入前端：

```dotenv
NODE_ENV=development
DEV_AUTH_ENABLED=true
ZOOM_DEV_ENABLED=true
ZOOM_MEETING_SDK_CLIENT_ID=<Meeting SDK app client ID>
ZOOM_MEETING_SDK_CLIENT_SECRET=<Meeting SDK app client secret>
ZOOM_DEV_MEETING_NUMBER=<9-11 digits, without spaces>
ZOOM_DEV_MEETING_PASSWORD=<meeting passcode>
```

使用开发者账户所属会议；主持人在 Zoom 客户端启动，必要时从等待室放行。候选人通过主持人提供的 Zoom 邀请链接加入，不需要进入 HireOS。

后端修改配置后需重启。默认 Vite 代理 `/api` 到 `http://127.0.0.1:3001`；测试使用其他后端端口时，可设置 `API_PROXY_TARGET`，不影响默认配置。

打开 `/project/live`，点击加入会议。桌面浏览器、localhost 或 HTTPS 环境使用内嵌会议；移动/触控设备首期提示使用外部邀请链接。

## 安全与限制

- `/api/meetings/dev/join-config` 只对开发身份开放；生产环境关闭，不能据此上线公网产品。
- 服务端只签发配置会议的 attendee JWT，不接受客户端指定角色或会议号；每个服务实例每分钟最多发放 10 次。
- 签名响应设置 `Cache-Control: no-store`；凭证不进入 URL、日志和浏览器持久存储。
- iframe 消息同时检查 origin 和 source；iframe 隔离的是依赖，不是针对同源恶意脚本的安全沙箱。
- 同源 iframe 使用官方 CDN 脚本，部署时需评估供应链和 CSP；有严格策略时必须放行必要 Zoom 资源及媒体连接，不建议使用通配 CSP。
- 浏览器卸载/历史导航会销毁 iframe 并释放其媒体上下文；应用导航和刷新给出离开提示。实际双端断线/离会仍需真人验收。
- 修改 HireOS 语言立即更新外部 UI，已加入会议的 SDK 内部语言在下次加入时更新。
- 不自动开启录制；Zoom 主持人在外部客户端发起的录制由 Zoom 告知与控制，不由 HireOS 当前状态代表。

## 验证

后端：`npm run build` 后运行 `node --test test/meetings.test.cjs`。

前端：`npx vite build`；浏览器回归使用 `ZOOM_TEST_URL=http://127.0.0.1:5175 node test/zoom-live.test.mjs`。测试使用 mock 会议接口和 SDK，不能替代真人通话验收。

完整前端 TypeScript 构建存在接入前已有的 Babel 类型缺失及其他页面类型错误，不在本次范围内修复。

页面初始化现在从 URL 读取 screen，避免开发模式下直接打开实时面试链接被送回首页。没有改变路由路径和业务跳转规则。

移动端只验证会议区域不溢出及外部参会提示；现有全站顶栏在窄屏仍有横向溢出，本次未扩大范围重做顶栏。

真实验收仍需提供有效凭据和测试会议，使用两台设备验证音视频、共享屏幕、等待室、权限拒绝、断网及退出。未完成这些验证时，不应标为“Zoom 联调完成”。

## 本次验证记录

- NestJS 构建通过，新增 4 项 Zoom 后端测试通过。
- Vite 生产打包通过；浏览器 mock 回归通过。
- 真实官方 CDN SDK 在隔离页初始化成功，确认其 React 版本为 18.2.0；未加入真实会议。
- 原有 intake 集成测试在当前执行环境无法连接 `127.0.0.1:55432`，全量后端测试未通过。
- 原问题区保留为禁用操作的示例展示，不与测试会议或真实面试证据关联。
