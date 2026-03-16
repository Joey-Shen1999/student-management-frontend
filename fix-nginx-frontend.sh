#!/usr/bin/env bash

set -euo pipefail

FRONTEND_DIR="/var/www/student-management-frontend"
SITE_AVAILABLE="/etc/nginx/sites-available/student-management-frontend"
SITE_ENABLED="/etc/nginx/sites-enabled/student-management-frontend"
DEFAULT_SITE_LINK="/etc/nginx/sites-enabled/default"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_CONF="${SCRIPT_DIR}/student-management-frontend.nginx.conf"

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  echo "Error: frontend directory not found: ${FRONTEND_DIR}"
  exit 1
fi

if [[ ! -f "${FRONTEND_DIR}/index.html" ]]; then
  echo "Error: ${FRONTEND_DIR}/index.html not found. Deploy frontend build artifacts first."
  exit 1
fi

if [[ ! -f "${SOURCE_CONF}" ]]; then
  echo "Error: nginx source config not found: ${SOURCE_CONF}"
  exit 1
fi

sudo cp "${SOURCE_CONF}" "${SITE_AVAILABLE}"
sudo ln -sfn "${SITE_AVAILABLE}" "${SITE_ENABLED}"
sudo rm -f "${DEFAULT_SITE_LINK}"

sudo nginx -t
sudo systemctl reload nginx

echo "===== /etc/nginx/sites-enabled ====="
ls -l /etc/nginx/sites-enabled

echo "===== /var/www/student-management-frontend ====="
ls -la /var/www/student-management-frontend

echo "===== curl -I http://127.0.0.1 ====="
curl -I http://127.0.0.1

echo "===== curl -I http://127.0.0.1/api/ ====="
curl -I http://127.0.0.1/api/ || true
