# EseLink --- Reglas de Integraciones (INTEGRATIONS_RULES)

## Objetivo

Definir como deben implementarse todas las integraciones externas del sistema EseLink.

Estas reglas evitan inconsistencias cuando se agregan nuevos marketplaces.

Integraciones previstas:

- MercadoLibre
- Shopify
- WooCommerce
- Falabella
- Amazon (posible futuro)
- API propias de sellers

---

# 1. Principio general

Todas las integraciones externas deben vivir en:

src/integrations/

Nunca mezclar logica de integracion con la logica del dominio.

NO poner codigo de integracion dentro de:

modules/
services/
controllers/

Las integraciones deben ser una capa separada.

---

# 2. Estructura obligatoria

Cada marketplace debe tener su propia carpeta.

Ejemplo:

src/integrations/

mercadolibre/
mercadolibre.module.ts
mercadolibre.client.ts
mercadolibre.auth.service.ts
mercadolibre.orders.service.ts
mercadolibre.webhooks.service.ts
mercadolibre.mapper.ts

shopify/
shopify.module.ts
shopify.client.ts
shopify.orders.service.ts
shopify.webhooks.service.ts
shopify.mapper.ts

---

# 3. Cliente API

Cada integracion debe tener un cliente dedicado.

Ejemplo:

mercadolibre.client.ts

Responsabilidades:

- manejar llamadas HTTP
- manejar headers
- manejar tokens
- manejar retries
- manejar rate limits

El cliente NO debe contener logica de negocio.

---

# 4. Uso de MCP

Cuando exista un MCP oficial del marketplace, se debe usar.

Para MercadoLibre:

Se debe usar el MCP de MercadoLibre para:

- consultar ordenes
- consultar detalles de ordenes
- consultar publicaciones
- consultar inventario
- actualizar stock

Nunca implementar scraping ni APIs no oficiales.

---

# 5. Mapper de datos

Cada integracion debe tener un mapper.

Ejemplo:

mercadolibre.mapper.ts

Responsabilidad:

Transformar el modelo externo al modelo interno.

Ejemplo:

MercadoLibre order → EseLink Order

Esto evita que el sistema dependa del formato del marketplace.

---

# 6. Autenticacion

Cada marketplace debe tener un servicio de autenticacion.

Ejemplo:

mercadolibre.auth.service.ts

Responsabilidades:

- OAuth
- refresh tokens
- validacion de tokens
- almacenamiento de tokens

Los tokens siempre se guardan en la tabla:

accounts

---

# 7. Webhooks

Los webhooks deben manejarse en:

webhooks.service.ts

Flujo correcto:

webhook recibido
↓
guardar en webhook_events
↓
crear job async
↓
worker procesa evento

Nunca procesar logica pesada en el endpoint.

---

# 8. Importacion de ordenes

Las ordenes externas se importan usando:

orders-import.service

Flujo:

account
↓
identificar canal
↓
llamar integracion correspondiente
↓
mapear datos
↓
guardar Order
↓
guardar OrderItems
↓
crear OrderEvent

---

# 9. Sincronizacion de inventario

Las integraciones deben soportar:

- update stock
- update price
- update listing

Pero estas acciones deben ejecutarse mediante:

sync_jobs

Nunca directamente desde controllers.

---

# 10. Manejo de errores

Cada integracion debe manejar:

- rate limits
- timeouts
- token expirado
- API caida

Los errores deben registrarse en:

sync_logs

---

# 11. Reglas de codigo

Cada integracion debe cumplir:

- no logica de negocio
- solo comunicacion con APIs externas
- uso de DTOs
- uso de mappers
- manejo de errores centralizado

---

# 12. Flujo completo de integracion

Integrar cuenta
↓
guardar tokens
↓
importar ordenes
↓
mapear datos
↓
guardar ordenes
↓
descontar inventario
↓
sincronizar stock

---

# 13. Regla critica

El dominio interno nunca debe depender del formato externo.

Siempre usar:

external model → mapper → internal model
