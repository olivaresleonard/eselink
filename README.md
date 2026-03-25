# EseLink

Base para una plataforma omnicanal orientada a ecommerce con:

- `api`: API modular en NestJS + TypeORM + BullMQ
- `web`: Frontend en Next.js + Tailwind + TanStack Table + React Query
- `infra`: espacio para despliegues, plantillas y assets de infraestructura

## Inicio rápido

```bash
cd api && pnpm install && pnpm dev
cd web && pnpm install && pnpm dev
```

## Deploy

- `api` construye una imagen propia desde [api/Dockerfile](/Users/leonardolivares/Projects/andres/eselink/api/Dockerfile)
- `web` construye una imagen propia desde [web/Dockerfile](/Users/leonardolivares/Projects/andres/eselink/web/Dockerfile)
- el workflow de deploy vive en [.github/workflows/deploy.yml](/Users/leonardolivares/Projects/andres/eselink/.github/workflows/deploy.yml)
- el server usa [setup/docker-compose.yml](/Users/leonardolivares/Projects/andres/eselink/setup/docker-compose.yml)
- ejemplo de variables del server en [setup/.env.server.example](/Users/leonardolivares/Projects/andres/eselink/setup/.env.server.example)

## Flujo esperado

1. Conectar múltiples cuentas por workspace
2. Importar catálogos y órdenes por integración
3. Mapear SKUs internos contra SKUs externos
4. Sincronizar inventario y precios mediante colas
5. Centralizar auditoría, logs y webhooks

## Demo seed

El seed crea:

- usuario `admin@eselink.local`
- password `admin1234`
- workspace `demo-workspace`
- canales base
- una cuenta demo de Mercado Libre pendiente de OAuth

## Flujo Mercado Libre

1. Configura `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET` y `MELI_REDIRECT_URI`
2. Registra en Mercado Libre exactamente el mismo callback HTTPS que uses en `MELI_REDIRECT_URI`
3. Inicia OAuth con `POST /api/account-connections/mercadolibre/oauth/start`
4. Completa el callback en `GET /api/account-connections/mercadolibre/oauth/callback`
5. Importa publicaciones con `POST /api/accounts/:id/mercadolibre/import-listings`
6. Encola órdenes con `POST /api/accounts/:id/mercadolibre/import-orders`

Ejemplo de `MELI_REDIRECT_URI`:

```text
https://tu-dominio.com/api/account-connections/mercadolibre/oauth/callback
```

Ejemplo para iniciar OAuth:

```bash
curl -X POST http://localhost:4000/api/account-connections/mercadolibre/oauth/start \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "demo-workspace"
  }'
```

La respuesta devuelve una `url` de autorización. Mercado Libre redirige luego al callback con `?code=...&state=...`.

## Workers

Colas activas:

- `inventory-sync-queue`
- `price-sync-queue`
- `listing-sync-queue`
- `orders-import-queue`
- `webhook-processing-queue`
