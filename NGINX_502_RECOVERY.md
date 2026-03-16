# Nginx 502 Recovery

## 为什么默认欢迎页消失后会出现 502

默认欢迎页消失说明请求已经进入了你自己的站点配置，但如果配置把首页请求错误地转发到了后端，且后端不可达或路径不匹配，就会出现 `502 Bad Gateway`。

## 为什么这通常说明代理配置有问题

在前后端同机部署中，最常见错误是把 `location /` 也反向代理到后端，导致前端首页、静态 JS/CSS 都走了 upstream。当前端资源不该由后端提供时，Nginx 就可能持续返回 502。

## 正确的路径分工

- `/`：前端静态文件（`root /var/www/student-management-frontend` + `try_files`）
- `/api/`：仅 API 请求反向代理到 `http://127.0.0.1:8080/`

## 如何验证修复成功

1. 浏览器访问 `http://3.149.1.120`，应显示前端页面。
2. `curl -I http://127.0.0.1:8080` 应有响应（状态码可为 200/301/401/404 等，关键是有响应而非连接失败）。
3. `sudo tail -f /var/log/nginx/error.log` 不应持续出现 upstream connect/timeout/refused 错误。

## 如果仍有 502，检查这些项

- `/etc/nginx/sites-available/student-management-frontend` 内容是否正确
- `/etc/nginx/sites-enabled` 是否仍存在 `default` 软链接
- `/var/www/student-management-frontend/index.html` 是否存在
- 后端 8080 是否仍在监听（如 `ss -lntp | grep 8080`）
- `proxy_pass` 是否为 `http://127.0.0.1:8080/`
