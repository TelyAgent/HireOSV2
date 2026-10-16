# Interview：Zoom 状态卷（迁移、备份与恢复）

关联：#117。适用于 `interview-backend` 的 Zoom OAuth 模式；S2S 模式见文末。

## 存了什么

`interview-backend` 把以下文件写在容器内的 `/app/.local/zoom`（`src/meetings/zoom-host.service.ts`）：

| 文件 | 内容 |
|---|---|
| `encryption.key` | 32 字节随机密钥，首次使用时生成 |
| `<owner 哈希>` | 每个 HR/面试官的 Zoom OAuth 账号（access/refresh token、各轮会议映射），AES-256-GCM 加密 |
| `s2s`（仅 S2S 模式） | S2S 主持人账号与会议映射 |

密钥和密文必须放在一起：只恢复密文而丢了 `encryption.key`，所有账号都无法解密，只能重新连接。

`docker-compose.yml` 把这个目录挂到命名卷 `interview_zoom_state`（实际卷名带 Compose 项目前缀，例如 `hireos_interview_zoom_state`，用 `docker volume ls | grep zoom` 确认）。目录权限 `0700`，文件 `0600`，容器以 root 运行，无需额外 chown。

## 首次上线：把旧容器的状态迁移到卷上

**必须在部署这次改动之前做第 1 步。** 带卷的新容器一创建，旧容器（及其内部的状态）就被替换了。

1. 部署前，在服务器的发布目录备份旧容器里的状态：

   ```bash
   docker compose ps interview-backend            # 记下容器名
   docker cp <旧容器名>:/app/.local/zoom ./zoom-state-backup
   ls -la ./zoom-state-backup                     # 应看到 encryption.key 和若干账号文件
   (cd ./zoom-state-backup && sha256sum * > ../zoom-state-backup.sha256)
   ```

   如果 `docker cp` 报路径不存在：旧容器里没有状态（从未连接或早已丢失），跳过迁移，上线后由用户重新连接 Zoom。

2. 部署（`interview-backend` 会以空卷重新创建）。

3. 把备份放回卷里并修正权限，然后重启：

   ```bash
   docker cp ./zoom-state-backup/. <新容器名>:/app/.local/zoom/
   docker compose exec interview-backend sh -c 'chmod 700 /app/.local/zoom && chmod 600 /app/.local/zoom/*'
   docker compose restart interview-backend
   ```

4. 校验：

   ```bash
   docker compose exec interview-backend sh -c 'cd /app/.local/zoom && sha256sum *' | diff - zoom-state-backup.sha256
   ```

   没有差异即一致。再让一位已连接过的 HR 打开 Interview 的 Zoom 设置，状态应为"已连接"，已排期轮次的会议链接不变。

5. 确认无误后删除服务器上的 `./zoom-state-backup` 与校验文件（其中包含密钥和密文，按凭据处理）。

## 日常备份

```bash
docker run --rm -v hireos_interview_zoom_state:/data -v "$PWD":/backup alpine \
  tar czf /backup/zoom-state-$(date +%Y%m%d).tgz -C /data .
```

备份同时包含密钥与密文，等同于凭据：存放位置需限制访问，不要放进代码仓库、工单或日志。

## 恢复

```bash
docker compose stop interview-backend
docker run --rm -v hireos_interview_zoom_state:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/zoom-state-YYYYMMDD.tgz -C /data && chmod 700 /data && chmod 600 /data/*'
docker compose start interview-backend
```

恢复演练：在非生产环境用合成账号走一遍"备份 → 删除卷内文件 → 恢复 → 状态仍为已连接"。仓库内的自动测试
`hireos-interview/job-Interview-backend/test/zoom-state-volume.test.cjs` 覆盖同一目录上的新实例能解密回读、空目录显示需要重新连接，以及文件权限和密文中不出现明文 token。

## 状态丢失时

没有可恢复的备份时，不要伪造连接状态：Zoom 设置页会显示"未连接"，HR 重新连接即可；已有轮次的会议需要重新生成链接。

## 回滚

回滚 `docker-compose.yml` 的这次改动后，容器不再挂载卷，又回到写在容器层（重建即丢）。卷本身和其中的数据不会被删除；需要时可按"恢复"步骤把数据拷回。

## S2S 模式

S2S（`ZOOM_AUTH_MODE=s2s`）的凭据来自环境变量，不依赖这个目录；目录里只存主持人账号与会议映射。卷丢失时 S2S 仍能重新取得 token，但已建会议的映射会丢失。同一个卷对两种模式都适用。

部署和迁移由人执行；本手册不授权自动操作共享部署。
