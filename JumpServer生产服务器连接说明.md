# JumpServer 生产服务器连接说明

本文记录如何通过 JumpServer 连接 `watch.sding.me` 当前所在的生产服务器。

> 安全要求：本文和 Git 仓库中不得保存明文密码。当前本机密码来源为桌面 `ssr.rtf`，只允许在本机运行时读取；不得复制到本文、Git、终端输出、截图或聊天记录。

## 1. 连接信息

| 项目 | 值 |
| --- | --- |
| JumpServer 域名 | `jumpserver-ssh.sding.me` |
| JumpServer 公网 IP | `34.92.110.140` |
| JumpServer 端口 | `2222` |
| JumpServer 用户 | `jusunsu` |
| 生产资产 IP | `34.94.189.76` |
| JumpServer 资产名 | `SDM-Front` |
| 资产 SSH 用户 | `ubuntu` |
| 项目目录 | `/Users/qmk/work/HireOS` |
| 秘钥 ｜  `/Users/qmk/work/HireOS/miyao.txt`

## 2. 确认真实 DNS 解析

部分代理软件会将域名解析成 `198.18.0.0/15` 范围内的虚拟地址，例如 `198.18.0.36`。该地址不是堡垒机的真实公网 IP。

连接前可使用公共 DNS 确认：

```bash
dig @1.1.1.1 +short jumpserver-ssh.sding.me
dig @8.8.8.8 +short jumpserver-ssh.sding.me
```

当前预期结果：

```text
34.92.110.140
```

## 3. 通过交互菜单连接

为了避免本机代理 DNS 的影响，建议直接连接堡垒机公网 IP：

```bash
ssh -tt -p 2222 frankzhang@34.92.110.140
```

出现密码提示后，从密码管理器取得 JumpServer 密码并手动输入。

### 单次认证失败限制（必须遵守）

若本次连接出现一次 `Permission denied`、认证超时或账户锁定提示，**立即停止**，不得在同一任务中：

- 自动重试同一密码；
- 改用另一种 SSH 登录格式再次猜测；
- 依次尝试历史密码、相近密码或其他凭据。

只有负责人明确确认账号已解锁，或提供了新的可用凭据并明确要求再次连接时，才允许发起一次新的登录尝试。每次新的明确授权同样最多尝试一次。这样可避免触发堡垒机锁定和安全告警。

进入 JumpServer 后：

1. 输入 `/34.94.245.30`，按回车搜索生产资产。
2. 确认结果为 `off-web/sdktest`。
3. 输入对应资产编号，当前通常为 `1`。
4. 在协议列表中选择 `ssh`，当前通常为 `1`。
5. 系统会以 `centos@34.94.245.30` 进入服务器。

成功后应看到类似提示符：

```text
[centos@off-web ~]$
```

编号可能随 JumpServer 配置变化，应以当次菜单显示为准，不要盲目固定输入 `1`。

## 4. 使用直达资产格式

已确认资产账户后，也可以跳过交互搜索菜单：

```bash
ssh -tt \
  -p 2222 \
  -l 'frankzhang@centos@34.94.245.30' \
  34.92.110.140
```

该命令中的用户名格式为：

```text
JumpServer用户@资产SSH用户@资产IP
```

### 4.1 本机自动化连接（当前已验证）

桌面文件 `/Users/qmk/Desktop/ssr.rtf` 保存的是 JumpServer 密码，不是生产服务器系统密码。自动化检查可通过环境变量交给 `sshpass`，避免密码直接出现在命令参数和 Shell 历史中：

```bash
SSHPASS="$(textutil -convert txt -stdout /Users/qmk/Desktop/ssr.rtf)" \
sshpass -e ssh \
  -o StrictHostKeyChecking=yes \
  -o ConnectTimeout=15 \
  -p 2222 \
  -l 'frankzhang@centos@34.94.245.30' \
  34.92.110.140
```

关键点：

- `-l` 后面的直达用户名必须整体使用单引号包住。
- SSH 最后的主机是 JumpServer 公网 IP `34.92.110.140`，不是资产 IP。
- 资产 IP `34.94.245.30` 只出现在直达用户名中。
- 使用 `StrictHostKeyChecking=yes`，主机指纹不匹配时应停止并核对，不能自动接受新指纹。
- 命令不得增加 `-v`、`set -x` 或打印 `SSHPASS`，以免敏感信息进入日志。
- 认证失败一次即停止；先检查格式、DNS、账号状态和密码文件内容，不要连续重试。

## 5. 登录后的只读检查

进入服务器后先确认主机身份和服务状态：

```bash
hostname
id
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
sudo grep -n 'proxy_pass http://127.0.0.1:' /etc/nginx/conf.d/watch.sding.me.conf
curl -fsS https://watch.sding.me/health
```

健康接口正常时返回：

```json
{"ok":true}
```

公网 Nginx 的本机端口会随蓝绿发布变化，不应长期写死旧端口。先从 `watch.sding.me.conf` 读取当前目标，再检查对应端口。截至 2026-08-25，当前日报邮件校对版 v26 目标为：

```bash
curl -fsS http://127.0.0.1:38176/health
```

项目目录和基础容器：

```text
/opt/seeseeyou-migrated
seeseeyou-nginx-migrated
seeseeyou-api-migrated
seeseeyou-report-worker-migrated
seeseeyou-postgres-migrated
```

当前线上组合：

```text
seeseeyou-api-green-daily-email-proofread-v26
seeseeyou-nginx-green-daily-email-proofread-v26
seeseeyou-report-worker-daily-email-proofread-v26
seeseeyou-postgres-migrated
```

版本职责：

- `daily-email-proofread-v26`：当前 API 与静态页面；继承 Cronofy、Google 登录、账号入团、设备事实和一页式中文日报。仅在日报邮件发送前按原有事实翻译为英文，并修复纯文本标题重复与 HTML 概览提取问题。
- `daily-email-proofread-v26` worker：负责 06:00 日报、09:00 出勤群提醒和 17:00 日计划缺失提醒；使用与 v26 相同的日报邮件发送逻辑。

## 6. 退出连接

先退出目标资产：

```bash
exit
```

返回 JumpServer 菜单后输入：

```text
q
```

## 7. 常见问题

### 域名解析到 `198.18.x.x`

这是本机代理的 DNS 映射地址。使用公共 DNS 查询真实 IP，然后直接连接 `34.92.110.140`。

### 提示 `Permission denied`

本次仅记录失败并停止连接。不要在当前任务内重复尝试；待负责人确认账号状态或提供新凭据并明确要求后，才可重新发起一次连接。

后续可由负责人确认：

- JumpServer 用户是否为 `frankzhang`；
- 输入的是 JumpServer 密码，而不是服务器系统密码或应用登录密码；
- 密码是否已更新或账号是否被锁定；
- 不要连续反复尝试，避免触发安全策略。

### “我能登录，但自动连接经常错”

优先逐项检查，不要先怀疑密码：

1. 是否把堡垒机地址误写成生产资产地址；最终 SSH 主机必须是 `34.92.110.140`。
2. 是否遗漏 `-l`，或没有把 `frankzhang@centos@34.94.245.30` 作为一个完整用户名。
3. 是否使用域名并被代理 DNS 解析到 `198.18.x.x`；自动化连接优先使用公网 IP。
4. 是否把 `ssr.rtf` 当纯文本直接读取；RTF 应使用 `textutil -convert txt -stdout` 转换。
5. 是否在多行命令的反斜杠后增加了空格，导致下一行没有续接。
6. 是否触发了主机指纹变化；这时先核对 `known_hosts` 和负责人确认的指纹，不得用 `StrictHostKeyChecking=no` 绕过。

当前确认可用的直达链路为：

```text
本机 → 34.92.110.140:2222（JumpServer）
     → centos@34.94.245.30（off-web/sdktest）
```

### 找不到 `ubuntu` 用户

当前生产资产的 SSH 用户是 `centos`，不是 `ubuntu`。直达格式应包含：

```text
frankzhang@centos@34.94.245.30
```

### SCP 上传失败

当前 JumpServer 通道可能不允许标准 SCP/SFTP。不要因此修改生产 SSH 配置；优先使用受控发布流程或经批准的制品传输方式。
