#!/usr/bin/env bash
# Despliegue en Plesk: lo ejecuta la extensión Git ("Acciones de despliegue adicionales")
# después de cada `git pull`, dentro de la raíz de la aplicación.
#
#   bash deploy/plesk-deploy.sh
#
# 1. Instala dependencias exactas (package-lock.json).
# 2. Compila el frontend (dist/) y el servidor (server-dist/).
# 3. Reinicia la aplicación Node (Passenger vigila tmp/restart.txt). Las migraciones de
#    base de datos se aplican solas al arrancar.
set -euo pipefail

NODE_DIR=/opt/plesk/node/22/bin
if [ -x "$NODE_DIR/node" ]; then export PATH="$NODE_DIR:$PATH"; fi

echo "== ModelMarket: despliegue $(git rev-parse --short HEAD 2>/dev/null || echo '?') con Node $(node --version)"
npm ci --no-audit --no-fund
npm run build
npm run server:build
mkdir -p tmp
touch tmp/restart.txt
echo "== Despliegue terminado. La aplicación se reinicia en la próxima petición."
