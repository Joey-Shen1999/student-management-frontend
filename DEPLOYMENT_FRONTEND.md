# Frontend CI/CD 部署说明（GitHub Actions + AWS Ubuntu + Nginx）

本文档对应仓库 `student-management-frontend`，部署目标为单机 AWS Ubuntu，Nginx 托管前端静态文件并反向代理后端 API。

## 1. GitHub 仓库配置

### 1.1 Secrets

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions -> Secrets` 添加：

- `AWS_SSH_KEY`：用于部署的私钥全文（PEM/OpenSSH 格式，多行原样粘贴）。

### 1.2 Variables

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions -> Variables` 添加：

- `AWS_HOST`：`3.149.1.120`
- `AWS_USER`：`ubuntu`
- `AWS_PORT`：`22`
- `DEPLOY_PATH`：`/var/www/student-management-frontend`
- `NGINX_SITE_PATH`：`/etc/nginx/sites-available/student-management-frontend`
- `AUTO_BOOTSTRAP_PACKAGES`：`false`（默认建议值；若设为 `true`，部署时检测缺少 `nginx/rsync` 会自动安装）

注意：`DEPLOY_PATH` 必须是 `/var/www/student-management-frontend`。如果误配为后端目录（例如 `/home/ubuntu/student-management-server`），会覆盖后端文件并导致 API 502。

## 2. 服务器初始化（Ubuntu）

登录服务器后执行：

```bash
sudo apt update
sudo apt install -y nginx rsync
```

## 3. 创建前端发布目录

```bash
sudo mkdir -p /var/www/student-management-frontend
sudo chown -R www-data:www-data /var/www/student-management-frontend
sudo chmod -R 755 /var/www/student-management-frontend
```

## 4. 安装并启用 Nginx 配置

先把仓库中的 `student-management-frontend.nginx.conf` 放到服务器，例如仓库在：
`/home/ubuntu/student-management-frontend`

然后执行：

```bash
sudo cp /home/ubuntu/student-management-frontend/student-management-frontend.nginx.conf \
  /etc/nginx/sites-available/student-management-frontend

sudo ln -sfn /etc/nginx/sites-available/student-management-frontend \
  /etc/nginx/sites-enabled/student-management-frontend

sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx
```

## 5. 配置 ubuntu 用户的有限 sudo 权限

GitHub Actions 通过 SSH 登录 `ubuntu` 后会执行：
- `mkdir -p`
- `rsync --delete`
- `chown`
- `install`（首次自动安装 Nginx 站点配置）
- `ln -sfn`（首次自动启用 Nginx 站点）
- `nginx -t`
- `systemctl reload nginx`

建议创建最小权限 sudoers 文件：

```bash
sudo tee /etc/sudoers.d/student-management-frontend-deploy >/dev/null <<'EOF'
Cmnd_Alias FRONTEND_DEPLOY = /usr/bin/mkdir -p /var/www/student-management-frontend, /usr/bin/rsync -a --delete /tmp/student-management-frontend-build/ /var/www/student-management-frontend/, /usr/bin/chown -R www-data:www-data /var/www/student-management-frontend, /usr/bin/mkdir -p /etc/nginx/sites-available, /usr/bin/install -m 644 /tmp/student-management-frontend.nginx.conf /etc/nginx/sites-available/student-management-frontend, /usr/bin/ln -sfn /etc/nginx/sites-available/student-management-frontend /etc/nginx/sites-enabled/student-management-frontend, /usr/sbin/nginx -t, /usr/bin/nginx -t, /usr/bin/systemctl reload nginx
ubuntu ALL=(root) NOPASSWD: FRONTEND_DEPLOY
EOF

sudo chmod 440 /etc/sudoers.d/student-management-frontend-deploy
sudo visudo -cf /etc/sudoers.d/student-management-frontend-deploy
```

如果你调整了 GitHub Variable `DEPLOY_PATH` 或临时目录，请同步修改 sudoers 里的路径，确保命令仍匹配。

如果你将 `AUTO_BOOTSTRAP_PACKAGES=true` 开启自动安装环境依赖，还需要允许：

```bash
/usr/bin/apt-get update
/usr/bin/apt-get install -y nginx
/usr/bin/apt-get install -y rsync
```

出于安全考虑，生产环境更建议在服务器初始化阶段手动安装依赖，并保持 `AUTO_BOOTSTRAP_PACKAGES=false`。

## 6. 工作流触发与部署流程

已配置工作流文件：`.github/workflows/deploy.yml`

触发条件：`push` 到 `main` 分支。流程为：

1. 拉取代码
2. `npm ci`
3. `npm run build`
4. 自动识别 Angular 构建目录（`dist/browser`、`dist/<project>/browser`、`dist/<project>`、`dist`）
5. `rsync --delete` 上传到服务器 `/tmp/student-management-frontend-build/`
6. 上传 Nginx 站点模板到服务器 `/tmp/student-management-frontend.nginx.conf`
7. 远程若检测到缺少 `nginx/rsync` 且 `AUTO_BOOTSTRAP_PACKAGES=true`，自动安装缺失包
8. 远程若检测到 `NGINX_SITE_PATH` 不存在，则自动创建并启用站点配置
9. 远程 `sudo rsync --delete` 同步到 `/var/www/student-management-frontend/`
10. `nginx -t`
11. `systemctl reload nginx`

## 7. 常见故障排查

### 7.1 Actions 失败

- 检查 `AWS_SSH_KEY` 是否为完整私钥（含开头和结尾行）。
- 检查 Variables 是否全部存在且无空值。
- 查看日志里 `Detect build output directory` 步骤，确认 `dist` 结构识别成功。
- 若失败在 `npm ci`，确认 `package-lock.json` 与 `package.json` 一致。

### 7.2 SSH 失败

- 确认私钥对应的公钥已写入服务器 `~ubuntu/.ssh/authorized_keys`。
- 确认 `AWS_HOST`、`AWS_USER`、`AWS_PORT` 正确。
- 确认 AWS Security Group 放行 22 端口。
- 服务器侧可执行：`sudo systemctl status ssh`（或 `sshd`）确认 SSH 服务正常。

### 7.3 Nginx 配置失败（`nginx -t` 失败）

- 在服务器直接执行：`sudo nginx -t` 看具体报错行号。
- 检查 `/etc/nginx/sites-available/student-management-frontend` 语法是否与示例一致。
- 检查 `sites-enabled` 软链接是否存在且目标正确。

### 7.4 静态资源未更新

- 确认工作流 `rsync --delete` 两段同步均成功。
- 检查 Nginx `root` 是否指向 `/var/www/student-management-frontend`。
- 浏览器执行强制刷新（Ctrl/Cmd + Shift + R）排除缓存影响。
- 检查发布目录时间戳：`ls -lah /var/www/student-management-frontend`。

### 7.5 API 代理失败（`/api` 404/502）

- 确认后端进程在本机监听 `127.0.0.1:8080` 或 `0.0.0.0:8080`。
- 服务器本地测试：`curl -i http://127.0.0.1:8080/api/health`（按你的后端真实健康检查路径替换）。
- 查看 Nginx 错误日志：`sudo tail -f /var/log/nginx/error.log`。
- 确认前端请求路径是相对路径 `/api/...`，而不是写死外网地址。
