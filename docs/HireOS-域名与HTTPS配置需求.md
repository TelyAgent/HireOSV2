# HireOS 域名与 HTTPS 配置需求

2026-09-28

需要运维为 HireOS 配一个 HTTPS 域名，转发到服务器 `34.94.189.76` 上已有的 HireOS 网关（`127.0.0.1:8830`）。不动防火墙，不动机器上其他站点。

## 背景

面试子系统要接 Zoom OAuth，Zoom 授权完成后会跳回我们配置的回调地址。后端代码强制要求这个地址是 `https://`，否则直接报错 `ZOOM_OAUTH_HTTPS_REDIRECT_REQUIRED`。

目前 HireOS 对外只有一个 HTTP 入口 `http://34.94.189.76/hireos/`，没有域名和证书，满足不了这个要求。开发时用的是本地 ngrok 隧道，不能用在服务器上。

## 现状

| 项目 | 值 |
| --- | --- |
| 服务器 | `34.94.189.76`（hostname `sdm-front`，GCP），经跳板机 `34.92.110.140:2222` 登录，账号 `ubuntu` |
| 80/443 | 已被机器自带的 nginx 占用，上面跑着 25 个以上其他域名的站点 |
| HireOS 网关 | Docker 容器，宿主机端口 `8830`（映射容器 80，`docker-compose.prod.yml` 里的 `"8830:80"`）。GCP 防火墙未放行 8830，外部直接访问不到，只能经本机 nginx 转发 |
| 现有转发 | `/etc/nginx/sites-available/default`（`server_name _` 兜底 server block）里的 `location /hireos/` → `127.0.0.1:8830` |
| 对外入口 | `http://34.94.189.76/hireos/`，下面是 `/interview/`、`/screening/`、`/jd/`、`/written/`、`/core-record/` |

路径前缀 `/hireos/` 已经编译进各前端的静态资源地址里。所以新域名也必须沿用 `/hireos/` 这个路径，不能挂在域名根路径 `/` 下。

## 需要运维做的事

下文用 `hireos.example.com` 指代实际域名，请替换成公司的子域名。

1. **DNS**：加一条 A 记录，`hireos.example.com` → `34.94.189.76`。
2. **证书**：用机器上现有的方式签发（其他站点如果用的是 certbot，就是 `sudo certbot --nginx -d hireos.example.com`）。需要自动续期。
3. **nginx**：新建一个独立的 server block，不要改 `default` 或其他站点的配置。转发规则抄 `default` 里现有的 `location /hireos/`：`proxy_pass` 结尾**必须带 `/`**，由 nginx 去掉 `/hireos/` 前缀后再转给网关（网关只认 `/interview/` 这类不带前缀的路径）。参考写法：

```nginx
# /etc/nginx/sites-available/hireos.example.com
server {
    listen 80;
    server_name hireos.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name hireos.example.com;

    ssl_certificate     /etc/letsencrypt/live/hireos.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hireos.example.com/privkey.pem;

    # 简历、JD 附件等上传
    client_max_body_size 50m;

    location /hireos/ {
        # 结尾的 / 不能省：去掉 /hireos/ 前缀再转发
        proxy_pass http://127.0.0.1:8830/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # JD 语音输入用 WebSocket（/hireos/jd/ws/voice-stream）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        # AI 生成是流式返回（SSE），不能缓冲
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

4. **生效**：`sudo nginx -t && sudo systemctl reload nginx`。

原来的 `http://34.94.189.76/hireos/` 入口保留不动，新域名启用期间两边都能用。

## 验收

在任意一台外网机器上执行，以下几项都符合预期就算配好了。

| 检查 | 命令 | 预期 |
| --- | --- | --- |
| 证书有效 | `curl -sI https://hireos.example.com/hireos/` | `200`，没有证书报错 |
| HTTP 跳 HTTPS | `curl -sI http://hireos.example.com/hireos/` | `301`，`Location` 是 `https://` |
| 前端页面 | `curl -sI https://hireos.example.com/hireos/interview/` | `200`，`Content-Type: text/html` |
| 面试后端 | `curl -s https://hireos.example.com/hireos/interview/api/health` | 返回 JSON，不是 HTML |
| Zoom 回调路径通 | `curl -s https://hireos.example.com/hireos/interview/api/integrations/zoom/callback` | 返回面试后端的纯文本错误提示（缺少参数），不是 nginx 的 404 页 |
| 其他站点不受影响 | 抽查机器上两个已有域名 | 和改之前一样 |

## 完成后

请运维回填以下信息：

- [ ] 最终域名
- [ ] 证书签发方式和到期/续期方式
- [ ] 新 server block 的文件路径

开发侧拿到域名后接着做：

1. 把 `hireos-interview/job-Interview-backend/.env.production` 里的 `ZOOM_OAUTH_REDIRECT_URI` 改为 `https://hireos.example.com/hireos/interview/api/integrations/zoom/callback`。
2. 在 Zoom App 后台把这个地址加进 OAuth 回调地址（Redirect URL）和允许列表（Allow List），必须和上一步完全一致。
3. `scripts/deploy/deploy.sh push-env` 上传密钥，再 `scripts/deploy/deploy.sh deploy interview` 重新部署面试子系统。
4. 在面试系统里点「连接 Zoom」，走一遍授权，确认能连上。
