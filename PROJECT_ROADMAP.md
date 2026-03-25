# EseLink --- Roadmap de Desarrollo

## Objetivo

Crear una plataforma omnicanal para centralizar ventas y sincronizar inventario entre multiples cuentas conectadas.

## Filosofia

Construir en bloques pequeños:
1. implementar
2. probar
3. validar
4. avanzar

Nunca avanzar sin probar.

---

# Fase 1 --- Base del sistema

Stack:

- NestJS
- TypeScript
- TypeORM
- PostgreSQL
- Redis
- BullMQ

Tareas:
- eliminar Prisma
- configurar TypeORM
- conectar PostgreSQL
- estructura de modulos
- variables de entorno

Resultado esperado:
npm run start:dev funciona.

---

# Fase 2 --- Canales y cuentas

Entidades:
- channels
- accounts

Endpoints:

GET /channels
POST /accounts
GET /accounts
GET /accounts/:id

Pruebas:
- crear canal
- crear cuenta
- listar cuentas

Resultado:
sistema reconoce multiples cuentas conectadas dentro de una misma operacion.

---

# Fase 3 --- Importacion de ordenes

Entidades:
- orders
- order_items
- order_events

Endpoints:

GET /orders
GET /orders/:id
POST /orders/import/:accountId

Reglas:
- evitar duplicados con externalOrderId
- cada orden tiene accountId

Resultado:
bandeja unificada de ordenes de todas las cuentas.

---

# Fase 4 --- Catalogo interno

Entidades:
- products
- product_variants

Endpoints:

POST /products
GET /products
POST /variants
GET /variants

Cada variante es un SKU interno.

Ese SKU interno sera la fuente comun para todas las cuentas conectadas.

---

# Fase 5 --- SKU Mapping

Entidad:
- sku_mappings

Endpoints:

POST /sku-mappings
GET /sku-mappings
GET /sku-mappings/external/:externalSku

Relaciona SKU externo con SKU interno.

El mapping depende de la cuenta conectada.

---

# Fase 6 --- Inventario central

Entidades:
- inventory_items
- inventory_movements

Endpoints:

POST /inventory
GET /inventory
POST /inventory/adjust

Reglas:
- no stock negativo
- registrar movimientos

Tipos:
sale, adjustment, sync, return

---

# Fase 7 --- Descuento automatico

Flujo:

order_item.externalSku
↓
sku_mapping
↓
product_variant
↓
inventory

Resultado:
cada orden descuenta inventario central usando el SKU interno.

---

# Fase 8 --- Motor de sincronizacion

Entidades:
- sync_jobs
- sync_logs

Infraestructura:
- BullMQ
- Redis
- Workers

Tipos de job:
sync_inventory, sync_price, import_orders, publish_listing

La ejecucion de jobs debe considerar cuenta, canal y entidad afectada.

---

# Fase 9 --- Publicaciones externas

Entidad:
- listings

Endpoints:

POST /listings/publish
GET /listings
GET /listings/:id

Un SKU interno puede tener multiples listings.

Cada listing representa una publicacion externa en una cuenta concreta.

---

# MVP minimo

Debe permitir:

- conectar cuentas
- importar ordenes
- ver bandeja unificada
- mapear SKU
- inventario central
- descuento automatico
- manejar multiples cuentas sobre el mismo catalogo interno

---

# Flujo central del sistema

orden externa
↓
external_sku
↓
sku_mapping
↓
product_variant
↓
inventario interno
↓
sincronizacion

Si este flujo funciona, el sistema esta bien diseñado.

La multi cuenta debe existir solo en cuentas, ordenes, listings y sincronizacion, no como multiempresa.
