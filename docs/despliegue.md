# Despliegue en un VPS propio

Todo corre en un solo servidor con `compose.prod.yml`. Caddy obtiene los certificados HTTPS automaticamente.

## 1. Servidor y dominio

- VPS con Ubuntu 24.04, 2 vCPU y 4 GB de RAM como minimo (el build de Next.js consume memoria).
- Dos registros DNS tipo A apuntando a la IP del servidor: `app.midominio.com` y `api.midominio.com`.

## 2. Preparar el servidor (una sola vez)

```sh
ssh root@IP
adduser deploy && usermod -aG sudo deploy
curl -fsSL https://get.docker.com | sh && usermod -aG docker deploy
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

Entrar con `ssh deploy@IP` (ideal: clave SSH y `PasswordAuthentication no`).

## 3. Primer despliegue

```sh
sudo mkdir -p /opt/farmacia && sudo chown deploy: /opt/farmacia
git clone <url-del-repo> /opt/farmacia && cd /opt/farmacia
cp .env.production.example .env && nano .env   # dominios, correo y secretos
docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml exec api python manage.py createsuperuser
```

Opcional, datos de demostracion: `docker compose -f compose.prod.yml exec api python manage.py bootstrap_demo`.

## 4. Actualizar

```sh
cd /opt/farmacia && git pull && docker compose -f compose.prod.yml up -d --build
```

Las migraciones se aplican solas al arrancar `api`.

## 5. Respaldos

```sh
crontab -e
0 3 * * * /opt/farmacia/deploy/backup-db.sh >> /opt/farmacia/backups/backup.log 2>&1
```

Guarda 14 dias en `/opt/farmacia/backups`. Copiarlos tambien fuera del servidor (p. ej. `rclone` hacia Backblaze B2 o Google Drive): si se pierde el VPS, se pierden los respaldos locales.

## Diagnostico

```sh
docker compose -f compose.prod.yml ps
docker compose -f compose.prod.yml logs -f api caddy
curl https://api.midominio.com/health/
```
