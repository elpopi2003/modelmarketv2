# Corte a v3 · ModelMarket en el VPS

Guion del paso de v2 (Supabase + Resend) a v3 (VPS Plesk: MariaDB + Postfix).
Decisiones: corte **sin pagos** (`BETA_ALL_PRO=true`: PRO gratis durante la beta), **sin
ventana de mantenimiento** (en `modelmarket.es` solo estaba la landing; nadie usa v2) y
**producción vacía** (2026-11-10): v2 solo tenía cuentas de prueba, así que no se importan; la
importación quedó ensayada en staging (A) por si algún día hiciera falta.

Rutas del VPS usadas abajo:

| Qué | Ruta |
|---|---|
| Suscripción | `/var/www/vhosts/modelmarket.es` |
| App staging | `…/staging.modelmarket.es` (rama `v3.0`) |
| App producción | `…/app` (rama `main`) |
| Fotos staging / producción | `…/uploads-staging` / `…/uploads-prod` |
| Node de Plesk | `/opt/plesk/node/22/bin` |

Todas las fechas de la app van en UTC: cualquier SQL a mano debe usar `UTC_TIMESTAMP()`.

---

## A. Ensayo en staging

El ensayo vacía los datos de prueba de staging e importa los reales de Supabase. Se puede
repetir tantas veces como haga falta (`--wipe`).

### A1. Preparar el acceso a Supabase (una vez)

1. Supabase → proyecto → **Connect** → **Session pooler** → copia la URI
   (`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`).
   Si no recuerdas la contraseña de la base de datos: *Project Settings → Database → Reset
   database password* (v2 no la usa en ningún sitio, no rompe nada).
2. *Project Settings → Database → SSL Configuration → Download certificate*. Súbelo al VPS como
   `/var/www/vhosts/modelmarket.es/supabase-ca.crt`.
3. El proyecto de Supabase se pausa tras 7 días sin uso: si está pausado, reactívalo antes.

### A2. Fichero de entorno temporal (SSH, como root)

```bash
cd /var/www/vhosts/modelmarket.es/staging.modelmarket.es
install -m 600 -o modelmarket -g psacln /dev/null server/.env
nano server/.env
```

Contenido (con los valores reales; este fichero no se sube a Git y se borra en A4):

```
DB_HOST=127.0.0.1
DB_USER=mm_staging
DB_PASSWORD=...
DB_NAME=modelmarket_staging
UPLOADS_DIR=/var/www/vhosts/modelmarket.es/uploads-staging
SUPABASE_DB_URL=postgresql://postgres.<ref>:...@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
SUPABASE_CA_FILE=/var/www/vhosts/modelmarket.es/supabase-ca.crt
```

### A3. Importar

```bash
cd /var/www/vhosts/modelmarket.es/staging.modelmarket.es
sudo -u modelmarket bash -c 'export PATH=/opt/plesk/node/22/bin:$PATH; npm run db:import-supabase -- --dry-run'
sudo -u modelmarket bash -c 'export PATH=/opt/plesk/node/22/bin:$PATH; npm run db:import-supabase -- --wipe'
```

El primero solo cuenta filas en Supabase (comprueba conexión y certificado). El segundo
importa. Si algo falla no se guarda nada.

### A4. Limpiar y comprobar

```bash
rm /var/www/vhosts/modelmarket.es/staging.modelmarket.es/server/.env
```

En *Node.js → Reiniciar aplicación*, y después en `https://staging.modelmarket.es`:

- [ ] Entrar con tu cuenta de v2 **con tu contraseña de v2**.
- [ ] Tus anuncios y peticiones, con sus fotos.
- [ ] Panel de administración (si eras admin en v2, lo sigues siendo).
- [ ] Precios muestra «Beta: PRO gratis para todos» (requiere `BETA_ALL_PRO=true` en staging).

---

## B. Producción

### B1. Código

- Fusionar `v3.0` en `main` y etiquetar `v3.0.0` (lo hace Claude cuando lo indiques).

### B2. Plesk (una vez)

1. **Base de datos**: `modelmarket_prod`, usuario `mm_prod`, sitio `modelmarket.es`.
2. **Carpeta de fotos** (SSH):
   ```bash
   mkdir -p /var/www/vhosts/modelmarket.es/uploads-prod && chown modelmarket:psacln /var/www/vhosts/modelmarket.es/uploads-prod && chmod 750 /var/www/vhosts/modelmarket.es/uploads-prod
   ```
3. **Git** en `modelmarket.es`: mismo repositorio, rama **`main`**, ruta **`/app`**, despliegue
   automático, acción:
   ```bash
   cd /var/www/vhosts/modelmarket.es/app && bash deploy/plesk-deploy.sh
   ```
   Si Plesk muestra otra clave SSH, añadirla como clave de despliegue de solo lectura.
4. **Node.js** en `modelmarket.es`: Node 22, raíz de la aplicación `/app`, raíz de documentos
   `/app/dist`, modo production, inicio `server/start.cjs`. Variables:
   ```
   NODE_ENV=production
   APP_URL=https://modelmarket.es
   STATIC_DIR=dist
   DB_HOST=127.0.0.1
   DB_USER=mm_prod
   DB_PASSWORD=(la de Plesk)
   DB_NAME=modelmarket_prod
   UPLOADS_DIR=/var/www/vhosts/modelmarket.es/uploads-prod
   MAIL_TRANSPORT=sendmail
   MAIL_LOGO_URL=https://modelmarket.es/brand/logo.png
   RECAPTCHA_SECRET=(la secreta de reCAPTCHA)
   BETA_ALL_PRO=true
   ```
   Al cambiar la raíz de documentos a `/app/dist`, la landing (`httpdocs`) deja de servirse;
   sus ficheros se quedan en disco como copia.
5. **nginx** (directivas adicionales de `modelmarket.es`): `passenger_min_instances 1;`
   (sin contraseña ni `noindex`, al contrario que staging).

### B3. Primera cuenta de administrador

Producción empieza vacía (no se importa v2). Regístrate en `https://modelmarket.es` con tu email
real, confírmalo y conviértete en admin (SSH):

```bash
mysql -u admin -p"$(cat /etc/psa/.psa.shadow)" modelmarket_prod -e "INSERT IGNORE INTO user_roles (id, user_id, role) SELECT UUID(), id, 'admin' FROM users WHERE email='TU_EMAIL';"
```

(Si algún día hubiera que importar v2: A2–A4 en `…/app` con los datos de producción y sin `--wipe`.)

### B4. Comprobaciones

- [ ] `https://modelmarket.es/api/health` → `{"ok":true,…,"version":"3.0.0"}`.
- [ ] Tu cuenta tiene el panel de administración.
- [ ] Alta nueva con un email real → llega el email de confirmación.
- [ ] Publicar un anuncio con foto; contactar y ofertar con una segunda cuenta.
- [ ] Contacto → llega a `hola@`.
- [ ] mail-tester.com con un alta: SPF, DKIM y DMARC en verde.

---

## C. Después del corte

1. **Copia de Supabase** antes de apagarlo: *Database → Backups*, o `pg_dump` con la URI del
   pooler. Guardarla fuera del VPS.
2. **Pausar el proyecto de Supabase** y borrarlo pasado un mes sin incidencias.
3. **Resend**: revocar la API key de la landing y quitar el dominio (la landing ya no se sirve).
4. **Política de privacidad**: encargados del tratamiento → quitar Supabase y Resend; añadir el
   alojamiento (Axarnet, UE). Se mantienen Google reCAPTCHA y, cuando lleguen los pagos, Stripe.
5. **CLAUDE.md**: reescribir las convenciones de v2 (Supabase, RLS, Edge Functions, Lovable)
   para la arquitectura de v3.
6. **DMARC**: tras dos semanas con SPF y DKIM en verde, pasar a `p=quarantine`.
7. **Staging**: mantenerlo para probar cada cambio antes de producción.
