#!/usr/bin/env bash

set -euo pipefail

FRONTEND_DIR="/var/www/student-management-frontend"
FRONTEND_INDEX="${FRONTEND_DIR}/index.html"
SITE_AVAILABLE="/etc/nginx/sites-available/student-management-frontend"
SITE_ENABLED="/etc/nginx/sites-enabled/student-management-frontend"
DEFAULT_SITE_LINK="/etc/nginx/sites-enabled/default"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_CONF="${SCRIPT_DIR}/student-management-frontend.nginx.conf"

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  echo "Error: frontend directory not found: ${FRONTEND_DIR}"
  exit 1
fi

if [[ ! -f "${FRONTEND_INDEX}" ]]; then
  echo "Error: frontend entry file not found: ${FRONTEND_INDEX}"
  echo "Please deploy frontend build artifacts before fixing nginx."
  exit 1
fi

if [[ ! -f "${SOURCE_CONF}" ]]; then
  echo "Error: nginx config source file not found: ${SOURCE_CONF}"
  exit 1
fi

sudo cp "${SOURCE_CONF}" "${SITE_AVAILABLE}"
sudo ln -sfn "${SITE_AVAILABLE}" "${SITE_ENABLED}"
sudo rm -f "${DEFAULT_SITE_LINK}"

sudo nginx -t
sudo systemctl reload nginx

echo "===== enabled sites ====="
sudo ls -l /etc/nginx/sites-enabled

echo "===== frontend publish directory ====="
ls -la /var/www/student-management-frontend

echo "===== curl nginx root ====="
curl -I http://127.0.0.1

echo "===== curl backend 8080 ====="
curl -I http://127.0.0.1:8080 || true

echo "===== curl nginx /api ====="
curl -I http://127.0.0.1/api/ || true

echo "===== nginx error log ====="
sudo tail -n 50 /var/log/nginx/error.log || true
