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

# Un despliegue cada vez: si Plesk lanza otro (o alguien pulsa "NPM install" en el panel)
# mientras este instala, los dos se pisarían dentro de node_modules.
mkdir -p tmp
exec 9>tmp/deploy.lock
if ! flock -n 9; then
  echo "!! Ya hay un despliegue en curso. Espera a que termine y vuelve a desplegar." >&2
  exit 1
fi

echo "== ModelMarket: despliegue $(git rev-parse --short HEAD 2>/dev/null || echo '?') con Node $(node --version)"
# npm ci también vacía node_modules, pero falla (ENOTEMPTY) si quedó a medias de una
# instalación interrumpida; rm -rf no.
rm -rf node_modules
npm ci --no-audit --no-fund
npm run build
npm run server:build
touch tmp/restart.txt
echo "== Despliegue terminado. La aplicación se reinicia en la próxima petición."
