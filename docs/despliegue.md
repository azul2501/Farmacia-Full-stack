# Despliegue en un VPS propio

Todo corre en un solo servidor con `compose.prod.yml`: Caddy (HTTPS automático con Let's Encrypt), PostgreSQL, Redis, la API (Django + Gunicorn), el worker de Celery y la web (Next.js). Solo Caddy expone puertos (80 y 443).

Este flujo se probó de punta a punta con `compose.prod.yml`: login, compra, venta desde el POS, anulación, cierre de caja, respaldo y restauración de la base.

## 0. Lo que necesitas tener antes

| Qué | Para qué | Costo aproximado |
|---|---|---|
| Un VPS con Ubuntu 24.04, 2 vCPU y 4 GB de RAM (por ejemplo Hetzner Cloud, DigitalOcean o Vultr) | Donde corre todo. El build de Next.js necesita unos 2 GB de RAM. | 5 a 25 USD al mes según el proveedor |
| Un dominio (por ejemplo `miboticafarma.com`) | Las direcciones `app.` y `api.` del sistema | 10 a 15 USD al año |
| Un correo | Avisos de Let's Encrypt sobre los certificados | Gratis |
| Una cuenta de almacenamiento externo para respaldos (Backblaze B2, Google Drive o similar) | Copiar los respaldos fuera del servidor | Gratis o centavos al mes |
| Los datos de la botica: RUC, razón social, nombre comercial, dirección de la primera sucursal, y correo y nombre del dueño | Crear la empresa real en el sistema | - |

## 1. Dominio

En el panel del dominio, crear dos registros DNS tipo A apuntando a la IP pública del VPS:

- `app.midominio.com` (la aplicación)
- `api.midominio.com` (la API)

Esperar a que resuelvan (`ping app.midominio.com` debe responder con la IP del VPS) antes del primer arranque; si no, Caddy no puede obtener el certificado.

## 2. Preparar el servidor (una sola vez)

```sh
ssh root@IP
adduser deploy && usermod -aG sudo deploy
curl -fsSL https://get.docker.com | sh && usermod -aG docker deploy
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

Entrar con `ssh deploy@IP`. Recomendado: usar clave SSH y poner `PasswordAuthentication no` en `/etc/ssh/sshd_config`.

## 3. Primer despliegue

```sh
sudo mkdir -p /opt/farmacia && sudo chown deploy: /opt/farmacia
git clone https://github.com/azul2501/Farmacia-Full-stack.git /opt/farmacia && cd /opt/farmacia
cp .env.production.example .env
nano .env
```

En `.env` completar:

- `APP_DOMAIN`, `API_DOMAIN` y `JWT_COOKIE_DOMAIN` (con punto inicial, por ejemplo `.midominio.com`).
- `ACME_EMAIL`.
- `DJANGO_SECRET_KEY` y `POSTGRES_PASSWORD`, cada uno generado con `openssl rand -base64 48 | tr -d '\n/+='`.

Guardar una copia de `.env` en un lugar seguro (gestor de contraseñas). Sin `POSTGRES_PASSWORD` no se puede restaurar un respaldo en otro servidor.

Levantar todo:

```sh
docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml ps        # todos "Up"; api, db y redis "healthy"
curl https://api.midominio.com/health/       # {"status": "ok"}
```

El primer build tarda entre 5 y 10 minutos.

## 4. Crear la empresa real

```sh
docker compose -f compose.prod.yml exec api python manage.py crear_empresa \
  --ruc 20xxxxxxxxx \
  --razon-social "Mi Botica SAC" \
  --nombre-comercial "Mi Botica" \
  --sucursal "Sucursal principal" \
  --direccion "Av. Ejemplo 123, Lima" \
  --email dueno@mibotica.com \
  --nombre "Nombre del dueño"
```

Pide la contraseña del dueño dos veces (mínimo 8 caracteres, no solo números). Crea la empresa, su primera sucursal con un almacén, una caja y un terminal POS, y el usuario dueño. Con ese usuario se entra a `https://app.midominio.com` y desde la aplicación se crean los demás usuarios (cajeros, almaceneros), sucursales, cajas y productos, y se carga el stock inicial por CSV desde Inventario.

**No ejecutar `bootstrap_demo` en producción:** crea un usuario con una contraseña pública (`Demo12345!`).

## 5. Respaldos

```sh
chmod +x /opt/farmacia/deploy/backup-db.sh
crontab -e
0 3 * * * /opt/farmacia/deploy/backup-db.sh >> /opt/farmacia/backups/backup.log 2>&1
```

Guarda 14 días en `/opt/farmacia/backups` (la carpeta está fuera de git). Si se pierde el VPS se pierden también estos archivos, así que conviene copiarlos fuera del servidor, por ejemplo con `rclone` hacia Backblaze B2 o Google Drive, en otra línea del cron a las 3:30.

Probar una restauración al menos una vez, en una base aparte para no tocar la real:

```sh
docker compose -f compose.prod.yml exec -T db createdb -U boticas_user prueba_restore
gunzip -c backups/ARCHIVO.sql.gz | docker compose -f compose.prod.yml exec -T db psql -q -U boticas_user -d prueba_restore
docker compose -f compose.prod.yml exec -T db psql -U boticas_user -d prueba_restore -c "select count(*) from sales_sale;"
docker compose -f compose.prod.yml exec -T db dropdb -U boticas_user prueba_restore
```

## 6. Actualizar a una nueva versión

```sh
cd /opt/farmacia && ./deploy/backup-db.sh && git pull && docker compose -f compose.prod.yml up -d --build
```

Las migraciones se aplican solas al arrancar `api`. Conviene actualizar fuera del horario de atención: durante el build la aplicación sigue funcionando, pero hay unos segundos de corte al reiniciar los contenedores.

## Diagnóstico

```sh
docker compose -f compose.prod.yml ps
docker compose -f compose.prod.yml logs -f api caddy
docker compose -f compose.prod.yml logs --tail 100 worker
curl https://api.midominio.com/health/
```

- **El navegador dice que el certificado no es válido:** revisar que el DNS apunte a la IP correcta y que los puertos 80 y 443 estén abiertos, y ver `logs caddy`.
- **Se inicia sesión pero al recargar pide login otra vez:** `JWT_COOKIE_DOMAIN` debe ser el dominio padre con punto inicial (`.midominio.com`), y la app y la API deben estar bajo ese mismo dominio.
- **El build se corta con "killed":** falta RAM. Usar un VPS de 4 GB o agregar 2 GB de swap.
