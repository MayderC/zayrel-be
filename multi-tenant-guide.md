# Guía para Convertir tu Aplicación NestJS a Multi-Tenant

Este documento describe los pasos y consideraciones clave para refactorizar una aplicación NestJS de un solo inquilino (single-tenant) a una arquitectura multi-inquilino (multi-tenant) segura. El objetivo es garantizar un aislamiento completo de los datos entre los diferentes clientes (tenants).

---

### Principio Fundamental del Multi-Tenancy

Cada solicitud (request) a la API debe identificar inequívocamente al tenant, y cada operación en la base de datos debe estar estrictamente filtrada por el ID de ese tenant. Nunca se debe confiar en los datos que envía el cliente (como un `tenantId` en el body) para filtrar consultas.

---

### Paso 1: Crear el Modelo de Datos del Tenant

Necesitas una forma de almacenar la información de cada cliente/tenant.

1.  **Crear un nuevo esquema en la base de datos:** `Tenant` o `Client`.
2.  **Definir sus campos:**
    *   `name`: Nombre del tenant (ej. "Mi Empresa").
    *   `apiKey`: La clave pública que usarán para autenticarse.
    *   `secretKeyHash`: Un hash de una clave secreta para operaciones más sensibles (ver seguridad).
    *   `isActive`: Un booleano para poder habilitar o deshabilitar tenants.
    *   `domains`: Un array de dominios permitidos para este tenant.

```typescript
// src/database/schemas/tenant.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Tenant extends Document {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  apiKey: string; // ¡Considera hashear esta clave!

  @Prop({ default: true })
  isActive: boolean;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
```

### Paso 2: Identificar al Tenant en Cada Solicitud con un Guard

Crea un "guard" global que intercepte todas las solicitudes, valide la API key y adjunte la información del tenant al objeto `request`.

1.  **Crea el Guard (`tenant.guard.ts`):**
    *   Extrae la API key del encabezado (ej. `X-API-Key`).
    *   Busca el tenant en la base de datos.
    *   Si es válido y activo, adjunta el tenant al `request`.
    *   Si no, lanza una excepción `UnauthorizedException`.

    ```typescript
    // src/auth/tenant.guard.ts
    import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
    import { InjectModel } from '@nestjs/mongoose';
    import { Model } from 'mongoose';
    import { Tenant } from '../database/schemas'; // Importa tu esquema

    @Injectable()
    export class TenantGuard implements CanActivate {
      constructor(@InjectModel(Tenant.name) private tenantModel: Model<Tenant>) {}

      async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-api-key'];

        if (!apiKey) {
          throw new UnauthorizedException('API Key no proporcionada');
        }

        const tenant = await this.tenantModel.findOne({ apiKey, isActive: true }).exec();

        if (!tenant) {
          throw new UnauthorizedException('API Key inválida o tenant inactivo');
        }

        request.tenant = tenant; // ¡Importante! Adjuntamos el tenant al request
        return true;
      }
    }
    ```

2.  **Registra el Guard Globalmente:** En `src/main.ts`, haz que el guard se aplique a todas las rutas.

    ```typescript
    // src/main.ts
    // ...
    import { TenantGuard } from './auth/tenant.guard';
    import { MongooseModule } from '@nestjs/mongoose'; // Asegúrate de que los módulos necesarios estén disponibles

    async function bootstrap() {
      const app = await NestFactory.create(AppModule);
      // ...
      app.useGlobalGuards(app.get(TenantGuard)); // Aplica el guard globalmente
      // ...
      await app.listen(3000);
    }
    ```
    *Nota: Para que `app.get(TenantGuard)` funcione, el `TenantGuard` y su dependencia (`TenantModel`) deben estar registrados en el `AppModule`.*

### Paso 3: Modificar los Esquemas de Datos para Incluir `tenantId`

Todos los recursos que pertenecen a un tenant deben tener una referencia a él.

1.  **Añade el campo `tenantId` a tus esquemas:** `Product`, `Order`, `User`, `Cart`, etc.
2.  Asegúrate de que el campo sea **requerido** y esté **indexado** para un rendimiento óptimo.

```typescript
// Ejemplo en product.schema.ts
@Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true })
tenantId: mongoose.Schema.Types.ObjectId;
```

### Paso 4: Aislar los Datos en la Lógica de Negocio (Servicios)

Esta es la parte más crítica para la seguridad. **Cada consulta a la base de datos debe ser filtrada por el `tenantId`**.

La mejor manera de hacer esto en NestJS es usando **proveedores con alcance de solicitud (Request-Scoped Providers)**. Esto permite que cada servicio tenga acceso al objeto `request` actual de forma segura.

1.  **Configura un Módulo para el Contexto de la Solicitud:**

    ```typescript
    // src/request-context/request-context.module.ts
    import { Module, Scope } from '@nestjs/common';
    import { REQUEST } from '@nestjs/core';

    export const TENANT_ID = 'TENANT_ID';

    @Module({
        providers: [
            {
                provide: TENANT_ID,
                scope: Scope.REQUEST,
                useFactory: (req) => req.tenant?._id, // Extrae el _id del tenant adjuntado por el guard
                inject: [REQUEST],
            },
        ],
        exports: [TENANT_ID],
    })
    export class RequestContextModule {}
    ```

2.  **Modifica tus Servicios:**
    *   Inyecta el `TENANT_ID`.
    *   Añade `tenantId` a **todas** tus consultas: `find`, `findOne`, `create`, `updateOne`, `delete`.

    **Ejemplo con `ProductsService`:**

    ```typescript
    // src/products/products.service.ts
    import { Injectable, Inject } from '@nestjs/common';
    import { Model } from 'mongoose';
    import { InjectModel } from '@nestjs/mongoose';
    import { Product, ProductDocument } from '../database/schemas';
    import { TENANT_ID } from '../request-context/request-context.module'; // Importa la constante

    @Injectable() // No necesita ser request-scoped si inyectas el valor
    export class ProductsService {
      constructor(
        @InjectModel(Product.name) private productModel: Model<ProductDocument>,
        @Inject(TENANT_ID) private readonly tenantId: string, // Inyecta el ID del tenant
      ) {}

      // EN LA CREACIÓN: Asignar siempre el tenantId
      async createProduct(dto: CreateProductDto) {
        const newProduct = new this.productModel({
          ...dto,
          tenantId: this.tenantId, // Asignación automática
        });
        return newProduct.save();
      }

      // EN LA LECTURA: Filtrar siempre por tenantId
      async listProducts() {
        return this.productModel.find({ tenantId: this.tenantId }).exec();
      }

      // EN LA ACTUALIZACIÓN/ELIMINACIÓN: Filtrar siempre por _id Y tenantId
      async editProduct(productId: string, dto: EditProductDto) {
        return this.productModel.findOneAndUpdate(
          { _id: productId, tenantId: this.tenantId },
          dto,
          { new: true },
        ).exec();
      }
    }
    ```
    *Nota: Para que la inyección funcione, los módulos correspondientes (`ProductsModule`, `RequestContextModule`) deben estar correctamente importados.*

### Paso 5: Consideraciones de Seguridad Adicionales

1.  **Hashear API Keys:** No guardes las API keys en texto plano. Usa `bcrypt` para hashearlas, igual que con las contraseñas. El `TenantGuard` debería comparar la clave recibida con el hash almacenado.
2.  **Gestión de Usuarios:** Los usuarios ahora deberían estar vinculados a un tenant (`tenantId` en el esquema `User`). Un usuario solo puede pertenecer a un tenant o tener roles específicos dentro de él.
3.  **Pruebas Rigurosas:** Crea pruebas de integración específicas para intentar romper el aislamiento. Por ejemplo, autentícate como Tenant A e intenta solicitar un recurso usando el ID de un recurso que pertenece al Tenant B. La API debe devolver un `404 Not Found`, no un `403 Forbidden`, para no filtrar información sobre la existencia de recursos.
4.  **Validación de `tenantId`:** Nunca, bajo ninguna circunstancia, aceptes un `tenantId` del body o de los parámetros de una solicitud para filtrar datos. El único `tenantId` válido es el que se obtiene de la API key validada en el `TenantGuard`.

---

Siguiendo estos pasos, transformarás tu aplicación en una plataforma multi-tenant robusta y segura, donde los datos de cada cliente están correctamente aislados.
