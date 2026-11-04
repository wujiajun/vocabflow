# 搬到另一台 Mac

这份文档记录 2026-11-03 把 VocabFlow 从一台 MacBook 搬到一台 Mac mini（都是 Apple 芯片）的过程：应用、数据和 Claude Code 的工作环境。以后换机器可以照着做。文档里不放任何密码、密钥或 `.env` 的内容。

约定：**旧机**是原来跑应用的电脑，**新机**是要接手的电脑。两台都装了 Tailscale，并在同一个账号下。

## 一、什么在仓库里，什么不在

| 东西 | 在哪里 | 搬法 |
|---|---|---|
| 代码、规则文档（`CLAUDE.md`、`AGENTS.md`、`HANDOFF.md`） | Git 仓库 | 克隆 |
| 数据库（词条、学习记录、阅读短文、用户） | Docker 的 MySQL 数据卷 | `scripts/backup.sh` 备份，`scripts/restore.sh` 恢复 |
| `.env`（数据库密码、`VOCABFLOW_AUTH_SECRET`、邀请码、模型密钥） | 只在旧机，不在 Git | 用 `scp`、AirDrop 或 U 盘拷，**不要发聊天或邮件** |
| Claude Code 的项目记忆 | `~/.claude/projects/-Users-<用户名>-Development-vocabflow/memory/` | 整个文件夹拷过去 |
| Claude Code 的旧对话记录 | 同目录下的 `.jsonl` 文件 | 可拷可不拷（见第四节） |
| 浏览器里的设置（读音开关、游戏音效、登录状态） | 每个浏览器自己的 `localStorage`，按网址分开存 | 搬不了，换地址后在浏览器里重新设 |

`.env` 里的 `VOCABFLOW_AUTH_SECRET` 要和旧机**保持一致**，否则所有人的登录都会失效（数据不受影响）。

## 二、哪些步骤必须本人在场

下面这些要输入密码、点同意或在浏览器里授权，Claude 不能代劳：

1. 新机上安装 Homebrew（要管理员密码）。
2. 安装 JDK 和 Docker Desktop（`brew install --cask` 的安装包要管理员密码）。
3. 第一次打开 Docker Desktop，同意协议并授权。
4. `gh auth login` 的浏览器授权。
5. 新机上登录 Claude 桌面应用，开启 Remote Control 和保持唤醒。
6. 新机的"断电后自动启动"（系统设置 → 能源）。
7. 第一次 SSH 连接时确认主机、输入密码。

其余步骤可以让旧机上的 Claude 通过 SSH 远程完成。

## 三、步骤

### 1. 新机打开"远程登录"

系统设置 → 通用 → 共享 → 打开"远程登录"，"允许访问"只留自己的账号。新机的账户名要和旧机一样（全名无所谓），这样路径相同，Claude 的记忆文件夹不用改名。

### 2. 旧机连到新机，设免密码登录

用 Tailscale 的机器名或地址，不要求在同一个路由器下。

```bash
ssh <用户名>@<新机地址>
ssh-copy-id <用户名>@<新机地址>
```

密钥如果设了口令，让系统记住它，这样 Claude 远程连接时不用再问：

```bash
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

### 3. 新机装工具

在旧机的终端里连到新机（`ssh -t`，这样能输入密码），先装 Homebrew，命令见 [brew.sh](https://brew.sh)；它会自动装 Xcode 命令行工具。装完让以后的登录找得到 brew：

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
```

其余的可以远程装：

```bash
brew install gh fnm
fnm install 24
```

JDK 21 和 Docker 的安装包要密码，在 `ssh -t` 的会话里装：

```bash
brew install --cask temurin@21
brew install --cask docker
```

Docker Desktop 装完后，在新机屏幕前打开一次，同意协议、授权，等它显示运行，并在设置里打开"开机自动启动"。Docker 设置里的"Configure shell completions"（命令补全）不用管。

项目要求 Node 24 和 JDK 21（见 `.node-version`、`backend/AGENTS.md`）。Maven 用项目自带的 `./mvnw`，不用单独装。

### 4. 克隆项目，传文件

仓库是公开的，克隆不需要登录：

```bash
mkdir -p ~/Development && cd ~/Development && git clone https://github.com/wujiajun/vocabflow.git
```

在旧机上做一次备份，然后把 `.env`、备份文件和记忆文件夹传过去：

```bash
cd ~/Development/vocabflow && ./scripts/backup.sh
scp .env <用户名>@<新机地址>:Development/vocabflow/.env
scp backups/<备份文件>.sql.gz <用户名>@<新机地址>:Development/vocabflow/backups/
scp -r ~/.claude/projects/-Users-<用户名>-Development-vocabflow/memory <用户名>@<新机地址>:.claude/projects/-Users-<用户名>-Development-vocabflow/
```

传完在新机上给 `.env` 设成只有自己能读：`chmod 600 .env`。传之前要先在新机上建好 `backups/` 和目标文件夹。

### 5. 新机启动应用

**通过 SSH 运行 Docker 会失败**：钥匙串在 SSH 会话里是锁着的，Docker 拉镜像时读它的登录凭据，报 `keychain cannot be accessed because the current session does not allow user interaction`。拉公开镜像用不着凭据，所以用一份不带凭据的配置绕过去，不改 Docker 自己的设置。在新机上建这个文件夹和环境文件：

```bash
mkdir -p ~/.docker-ssh/bin
ln -sfn ~/.docker/cli-plugins ~/.docker-ssh/cli-plugins
ln -sf /Applications/Docker.app/Contents/Resources/bin/docker ~/.docker-ssh/bin/docker
echo '{}' > ~/.docker-ssh/config.json
cat > ~/.docker-ssh/env <<'EOF'
# 通过 ssh 用 Docker，不走钥匙串里的凭据助手。
export PATH=$HOME/.docker-ssh/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
export DOCKER_CONFIG=$HOME/.docker-ssh
export DOCKER_HOST=unix://$HOME/.docker/run/docker.sock
EOF
```

关键是 `PATH` 里不能有 `~/.docker/bin`，否则 Docker 会找到那里的凭据助手。以后通过 SSH 运行 Docker 前先执行 `. ~/.docker-ssh/env`。在新机屏幕前直接用终端时不需要这个。

然后构建并启动：

```bash
. ~/.docker-ssh/env
cd ~/Development/vocabflow && docker compose up -d --build --wait
```

第一次构建要几分钟，要下载 Maven 和依赖。**全新克隆上构建后端镜像曾经会失败**，原因有两个，都已修复（PR #58）：Dockerfile 要复制没提交到 Git 的 `.mvn` 文件夹；镜像里没有 `curl`，而 `mvnw` 下载 Maven 要用它。如果用的是更早的提交，会遇到这个问题。

### 6. 恢复数据并核对

恢复会**替换新机上的整个数据库**，所以只对新建的空库做：

```bash
. ~/.docker-ssh/env
cd ~/Development/vocabflow && ./scripts/restore.sh backups/<备份文件>.sql.gz
```

它会要你输入 `RESTORE` 确认。旧机在备份之后如果还有人学习，新数据不会带过来，所以**备份要在切换前最后做一次**。

核对：在两台机器上分别数每张表的行数，应当完全一致。这次是 11 张表，例如词条 93、学习卡片 63、复习记录 188、阅读短文 2、用户 2，全部相同。

```bash
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B -e "show tables from vocabflow"'
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B -e "select count(*) from vocabflow.<表名>"'
```

### 7. 访问

应用监听 8088 端口，没有 HTTPS，但 Tailscale 里的流量本身是加密的，而且只有自己的设备能进这个网络，所以没有暴露在公网上。

- 在 Tailscale 的管理页或 `tailscale status` 里看新机的名字和地址。开了 MagicDNS 的话，`http://<机器名>:8088` 和 `http://<机器名>.<tailnet 域名>:8088` 都能用，IP 变了名字不变。
- 在外网访问：访问用的设备上要开着 Tailscale 并已连接，新机要开机、不睡眠、Tailscale 在运行。外网下用完整域名更保险。
- 浏览器提示"不安全"只是因为是 `http://`。需要 `https://` 的话，可以用 `tailscale serve` 配，这次没配。

### 8. 新机的常开设置

- 系统睡眠关掉（这次新机已经是"从不睡眠"）。
- 系统设置 → 能源：打开"断电后自动启动"。
- Docker Desktop 设成开机自动启动，容器的重启策略是 `unless-stopped`，Docker 起来后它们会自己恢复。
- 定期把 `scripts/backup.sh` 的输出拷到另一台设备，备份只在这台机器上不算备份。

### 9. 旧机收尾

确认新机一切正常之前，**不要删旧机的数据**。先只停掉服务：

```bash
cd ~/Development/vocabflow && docker compose stop
```

`stop` 不会删数据卷，容器也不会自己起来（`unless-stopped` 不会重启被手动停掉的容器）。想恢复用 `docker compose start`。确认没问题后再清理，删之前先列出要删的东西。

## 四、Claude Code 的工作环境

仓库里的规则文档克隆就有。需要手动搬的是我的项目记忆（见第三节第 4 步）；对话记录可选：

```bash
rsync -a --exclude memory ~/.claude/projects/-Users-<用户名>-Development-vocabflow/ <用户名>@<新机地址>:.claude/projects/-Users-<用户名>-Development-vocabflow/
```

要点：

1. **正在运行的会话搬不走**，它是旧机上的进程。在新机上开一个新的主会话：打开 Claude 桌面应用，用同一个账号登录，Code 标签里添加 `~/Development/vocabflow`。
2. 先问它一两个只有记忆和文档里才有的问题（比如合并 PR 的规矩、最近的标签），确认上下文生效。
3. 在会话工具栏里打开 **Remote Control**，之后可以在旧机的浏览器（`claude.ai/code`）或手机的 Claude 应用里看到并指挥新机上的会话。命令都在新机上运行，遥控端合上也不影响。
4. 在新机应用的设置里打开"保持唤醒"，并让应用开机自动启动。
5. **只在一台机器上改代码**：搬完后改代码、推分支、开 PR 只在新机的会话里做。同一个会话编号在两台机器上各有一份记录，两边同时聊，历史会各写各的，不会自动合并。旧会话只用来收尾，之后当历史看。
6. 会话的名字不用担心冲突，会话靠内部编号区分。想区分可以改名，比如旧的叫"旧电脑·收尾"，新的叫"主会话"。
7. Git 身份和 GitHub 授权也要在新机上设：`git config --global user.name`、`user.email`，以及 `gh auth login`（浏览器授权）。

## 五、踩过的坑

| 现象 | 原因 | 处理 |
|---|---|---|
| `docker compose up` 报 `keychain cannot be accessed…` | SSH 会话里钥匙串锁着，Docker 读凭据助手失败 | 用第三节第 5 步的 `~/.docker-ssh/env`，PATH 里不放 `~/.docker/bin` |
| 后端镜像构建报 `"/.mvn": not found` | Dockerfile 复制了没提交到 Git 的 `.mvn` | 去掉这行（PR #58） |
| 后端镜像构建报 `exit code: 127` | 镜像里没有 `curl`，`mvnw` 下载 Maven 要用 | Dockerfile 里 `apk add curl`（PR #58） |
| `brew install --cask temurin@21` 报 `a terminal is required to read the password` | 安装包要管理员密码，远程非交互会话没法输入 | 用 `ssh -t` 在能输入密码的会话里装 |
| 搬完后读音开关又是默认值 | 设置存在每个浏览器的 `localStorage`，按网址分开存 | 在新地址里重新设一遍（两个读音开关现在默认都是开的） |
| `git` 和 `java` 在新机上是占位程序 | 还没装 Xcode 命令行工具 | 装 Homebrew 时会自动装 |

## 六、搬完后的检查清单

- [ ] 新机上 `docker compose ps` 三个服务都是 healthy，`/api/v1/health` 返回 `UP`。
- [ ] 两台机器各表行数一致。
- [ ] 从另一台设备用机器名访问，能看到自己的词和今天的进度，能登录。
- [ ] 新机"断电后自动启动"已开，不睡眠，Docker 开机自动启动。
- [ ] 新机的 Claude 会话读得到记忆，Remote Control 和保持唤醒已开。
- [ ] 新机上 `gh auth status` 显示已登录，能推分支。
- [ ] 旧机服务已停（`docker compose stop`），数据暂时不删。
- [ ] 外网下用手机试过一次（Tailscale 已连接）。
