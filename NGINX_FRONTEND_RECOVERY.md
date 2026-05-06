# Nginx Frontend Recovery

## 为什么会看到 Welcome to nginx 页面

出现 Welcome 页面通常是因为 Nginx 仍在使用默认站点（`/etc/nginx/sites-enabled/default`），而不是你的前端站点配置。此时请求 `http://3.149.1.120` 会命中默认 root（常见是 `/var/www/html`）。

## 为什么删除 /etc/nginx/sites-enabled/default 可以解决

`sites-enabled/default` 是默认虚拟主机入口。删除它可以避免默认站点抢占 80 端口请求，使你的 `student-management-frontend` 站点成为主处理配置。

## 为什么必须确保 student-management-frontend 站点配置已启用

仅在 `sites-available` 放配置不生效，必须在 `sites-enabled` 存在软链接：

`/etc/nginx/sites-enabled/student-management-frontend -> /etc/nginx/sites-available/student-management-frontend`

Nginx 只加载启用目录中的站点配置。

## 如何验证默认站点已切换成功

1. 执行：`ls -l /etc/nginx/sites-enabled`，确认：
   - 有 `student-management-frontend` 软链接
   - 没有 `default` 软链接
2. 执行：`sudo nginx -t`，确认语法通过。
3. 执行：`sudo systemctl reload nginx`，确认成功。
4. 执行：`curl -I http://127.0.0.1`，应返回前端站点响应（非 welcome 页）。
5. 浏览器访问 `http://3.149.1.120`，应加载前端应用。

## 仍显示默认页时应检查

- `sites-enabled` 里是否仍存在 `default`
- `/var/www/student-management-frontend` 是否有 `index.html`
- `sudo nginx -t` 是否通过
- `sudo systemctl reload nginx` 是否成功
