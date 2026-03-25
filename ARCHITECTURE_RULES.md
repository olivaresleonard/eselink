# EseLink --- Reglas de Arquitectura y Desarrollo

## 1. Proposito del sistema

EseLink es una plataforma omnicanal que permite:
- conectar multiples cuentas de marketplaces
- centralizar ordenes
- mapear productos entre plataformas
- manejar inventario interno
- sincronizar stock entre cuentas
- operar desde una bandeja unificada de ordenes

## 2. Stack tecnologico

Backend:
- NestJS
- TypeScript
- TypeORM
- PostgreSQL
- Redis
- BullMQ

No usar:
- Prisma
- Sequelize

## 3. Arquitectura general

EseLink NO es multiempresa.

EseLink SI es multi cuenta.

Una misma operacion puede conectar multiples cuentas y multiples canales:
- MercadoLibre CL
- MercadoLibre AR
- Shopify
- WooCommerce

El sistema se modela como una sola operacion central que administra:
- cuentas conectadas
- catalogo interno
- inventario central
- ordenes unificadas
- sincronizacion

Modelo base:

User
↓
Accounts (cuentas conectadas)
↓
Orders (ordenes externas)
↓
OrderItems (productos de la orden)
↓
SKU Mapping
↓
ProductVariant (SKU interno)
↓
Inventory

## 4. Entidades principales

- channels
- accounts
- products
- product_variants
- listings
- sku_mappings
- inventory_items
- inventory_movements
- orders
- order_items
- order_events
- sync_jobs
- sync_logs
- webhook_events

## 5. Reglas de entidades

Todas las entidades deben incluir:

@PrimaryGeneratedColumn('uuid') id
@CreateDateColumn() createdAt
@UpdateDateColumn() updatedAt

Usar siempre decoradores TypeORM.

## 6. Reglas de modulos NestJS

Cada modulo:

module/
├ module.module.ts
├ module.controller.ts
├ module.service.ts
├ dto/
├ entities/

Repositorios con:
@InjectRepository(Entity)

Registrados con:
TypeOrmModule.forFeature([Entity])

## 7. Regla central del sistema

El SKU interno es la fuente de verdad.

Ejemplo:
SKU interno: POLERA-ROJA-M

Puede existir en:
- MercadoLibre CL
- MercadoLibre AR
- Shopify
- WooCommerce

Pero todos apuntan al mismo SKU interno.

La cuenta externa cambia.

El SKU interno no.

## 8. SKU Mapping

Tabla critica: sku_mappings

Relaciona SKU externo con SKU interno.

## 9. Flujo de ordenes

orden externa
↓
external_sku
↓
sku_mapping
↓
product_variant
↓
inventory

## 10. Inventario

Tabla: inventory_items

Campos clave:
- availableStock
- reservedStock

Movimientos: inventory_movements

Tipos:
- sale
- adjustment
- sync
- return

## 11. Importacion de ordenes

Tabla: orders

Campos:
- externalOrderId
- accountId
- status
- totalAmount
- currency
- placedAt

Evitar duplicados con externalOrderId.

Cada orden pertenece a una cuenta conectada.

## 12. Bandeja unificada

Endpoint: GET /orders

Debe consolidar ordenes de todas las cuentas conectadas en una sola vista.

Filtros:
- accountId
- status
- dateFrom
- dateTo
- search
- page
- limit

## 13. Sincronizacion

Tablas:
- sync_jobs
- sync_logs

Procesado con:
BullMQ + Workers

Tipos:
- sync_inventory
- sync_price
- import_orders
- publish_listing
- process_webhook

La sincronizacion se ejecuta por cuenta y por canal, pero siempre sobre el mismo catalogo interno.

## 14. Webhooks

Guardar primero en webhook_events. Procesar luego con queues.

Nunca procesar logica pesada en el endpoint.

## 15. Principios de desarrollo

1. No logica en controllers.
2. Logica en services.
3. Usar DTOs.
4. QueryBuilder para queries complejas.
5. Evitar joins innecesarios.

## 16. Flujo de desarrollo

1. diseñar entidad
2. crear modulo
3. crear endpoints
4. probar con datos simulados
5. validar flujo

## 17. Orden de desarrollo

Fase 1: channels, accounts, orders
Fase 2: products, product_variants
Fase 3: sku_mappings
Fase 4: inventory
Fase 5: sync_jobs + workers
Fase 6: listings

## 18. Regla clave

Nunca empezar por publicacion multicanal. Primero debe funcionar:

orden → sku mapping → inventario → sync

Luego se expande a:

catalogo interno → listings por cuenta → sync por canal

## 19. MVP minimo

- conectar cuentas
- importar ordenes
- bandeja unificada
- mapping SKU
- inventario
- descuento automatico
- multiples cuentas conectadas sobre una misma operacion

## 20. Regla final

Si se rompe el flujo:

orden → mapping → inventario → sync

la arquitectura esta mal.

Si una cuenta externa no puede mapearse al SKU interno comun, la arquitectura tambien esta mal.
