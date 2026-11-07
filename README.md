# ¿Conviene afuera?

Pegás el link de un producto de **Mercado Libre Uruguay** y la app te dice si conviene comprarlo acá o traerlo del exterior, con el **costo real puesto en Uruguay**: producto + envío + courier + impuestos según el régimen aduanero vigente.

> **Estado: Fase 2 completa salvo credenciales.** La app corre entera con datos mock. El motor de impuestos, el parseo de links y el matcher determinístico son reales y están testeados, y **los parámetros aduaneros están cotejados contra el Decreto N° 50/026, la Ley 20.446 y las páginas de la Dirección Nacional de Aduanas**. El cliente de la API de Mercado Libre está escrito y testeado contra fixtures: le falta sólo que le pases las credenciales. La cotización del dólar ya sale de una fuente real. Quedan eBay y Claude, que son la Fase 3.

---

## Correrlo localmente

```bash
npm install
```

```bash
npm run dev
```

Abrí http://localhost:3000 y pegá cualquier link de `mercadolibre.com.uy`. **No necesitás configurar nada**: sin credenciales la app usa datos de ejemplo y la UI lo aclara con un cartel.

Para personalizar algo:

```bash
cp .env.example .env.local
```

### Otros comandos

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

---

## Cómo está armado

El código está dividido en módulos que no se conocen entre sí: cada uno expone sólo tipos de dominio por su `index.ts`, y el único lugar donde se encadenan es `src/modules/compare`. Así cada módulo se testea sin red y se reemplaza sin tocar el resto.

```
ml-reader → foreign-search → matcher → landed-cost → advisor
                                 ↑          ↑
                                fx     config/aduana-uy.ts
```

| Módulo | Qué hace | Estado |
|---|---|---|
| `ml-reader` | Valida el link y resuelve el producto por catálogo | **Real**; cae a mock sin credenciales |
| `foreign-search` | Busca en tiendas del exterior | Provider mock (Fase 3: eBay) |
| `matcher` | Decide si es **el mismo** producto | Capa determinística real (Fase 3: Claude) |
| `landed-cost` | Costo puesto en Uruguay | **Completo y testeado** |
| `advisor` | Veredicto + guía de compra | **Completo** |
| `fx` | Cotización USD/UYU | **Real** (dolarapi, con detección de dato viejo) |

```
config/                  normativa y tarifas, versionadas
  aduana-uy.ts           ← única fuente de verdad de las reglas aduaneras
  couriers-uy.ts         ← tarifas de courier
  categorias-peso.ts     ← pesos estimados por categoría
  vendedores-eeuu.ts     ← registro de vendedores de EE.UU. de la DNA
src/
  app/                   páginas, server action y /api/compare
  components/            UI
  lib/                   money, cache, logger, rate-limit, env
  modules/               la lógica de negocio
tests/                   165 tests
```

### Decisiones que conviene conocer antes de tocar el código

**La plata vive en enteros.** Todo monto es `Money = { cents, currency }`. Nunca `number` en unidades: un `0.1 + 0.2` en un cálculo de impuestos es un bug de credibilidad. Ver `src/lib/money.ts`.

**Los umbrales del matcher son asimétricos a propósito.** El error caro no es decir "no son iguales" cuando sí lo son: es lo contrario, mostrar un iPhone de 128 GB de afuera contra uno de 256 GB de acá y prometer un ahorro que no existe. Por eso sólo se muestra como idéntico con confianza ≥ 0,90, hay una banda intermedia de "verificá la variante" entre 0,75 y 0,90, y el veredicto **nunca** compara precios contra un producto marcado como "similar".

**Las capacidades y las generaciones se deciden sin LLM.** Comparar 128 GB con 256 GB es aritmética, no juicio de lenguaje: mandarlo a un modelo sería más caro y menos confiable. El LLM sólo ve lo que la capa determinística no pudo resolver.

**`landed-cost` siempre devuelve los dos regímenes**, cada uno con un flag `applicable`. No siempre son comparables: con un producto de USD 100 desde EE.UU. la franquicia paga USD 0 y el simplificado USD 60; con el cupo agotado la franquicia no existe. Decidir qué mostrar es tarea del `advisor`.

**Cuando no sabemos algo, calculamos el escenario peor y lo decimos.** Si no podemos confirmar la residencia fiscal del vendedor, no aplicamos la exoneración de IVA y lo advertimos. Preferimos subestimar el ahorro antes que prometer uno que no se cumple.

---

## Qué nos deja hacer la API de Mercado Libre (y qué no)

Verificado contra la API real el 2026-11-07, con credenciales propias, token de aplicación **y** token de usuario:

| Endpoint | Estado | Qué da |
|---|---|---|
| `/products/search` | ✅ | Buscar en el catálogo de MLU |
| `/products/{id}` | ✅ | 76 atributos: marca, modelo, capacidad, color |
| `/products/{id}/items` | ⚠️ | Precio, **sólo si hay ganador de buy box** |
| `/items/{id}` | ❌ 403 | — |
| `/sites/MLU/search` | ❌ 403 | — |
| `/highlights/...` | ❌ 403 | — |

**ML nos deja identificar el producto pero no ver cuánto sale.** `/items/{id}` devuelve `access_denied` para publicaciones ajenas si la app no está certificada, y la búsqueda está cerrada. Probamos con token de usuario (flujo Authorization Code) y da exactamente los mismos 403: la restricción es de la aplicación, no del tipo de token. La documentación de ML todavía describe esos endpoints como públicos.

Sobre precios: `/products/{id}/items` responde `"No winners found"` salvo que algún vendedor uruguayo haya ganado el buy box de ese producto. Medido sobre 12 productos típicos (iPhone, Galaxy, PlayStation, Kindle, Nike, notebooks, electrodomésticos): **cobertura de 1 en 12**.

### Cómo lo resolvimos

1. **Identidad del producto**: del slug de la URL sale el título (`/MLU-123-apple-iphone-15-128-gb-negro-_JM` → `"apple iphone 15 128 gb negro"`). No es scraping: viene en el texto que el usuario pega. Con eso buscamos en el catálogo y **elegimos con el matcher**, que descarta por marca, capacidad y generación.
2. **Precio**: si el catálogo lo tiene, se usa. Si no, la app se lo pide a la persona, que lo está viendo en pantalla. El resultado marca cuál de los dos casos fue.

Elegir con el matcher no es opcional: buscando `"sony wh 1000xm5"` el primer resultado del catálogo es un **accesorio** para esos auriculares, no los auriculares.

---

## Credenciales de Mercado Libre

Sin credenciales la app funciona con datos mock y la UI lo avisa. Para usar datos reales:

1. Entrá a [developers.mercadolibre.com.uy](https://developers.mercadolibre.com.uy/devcenter) con tu cuenta de ML.
2. Creá una aplicación. Te da un **App ID** y un **Secret Key**.
3. Ponelos en `.env.local` como `ML_CLIENT_ID` y `ML_CLIENT_SECRET`.

Es gratis. Usamos el grant `client_credentials`, que no necesita que ningún usuario autorice nada: alcanza con esas dos claves. El token dura 6 horas y se renueva solo.

**El registro no es opcional.** Verificado el 2026-11-07: la API devuelve 403 (`PolicyAgent`) a cualquier llamada sin token, incluso a endpoints públicos como `/sites/MLU`. Las fuentes que dicen que las lecturas públicas todavía funcionan están desactualizadas.

---

## Cotización del dólar

Se usa la cotización de **venta** de [uy.dolarapi.com](https://uy.dolarapi.com/v1/cotizaciones/usd) — pública, gratis, sin key. La venta y no la compra porque el usuario está por gastar dólares: tomar la compra inflaría el ahorro que le mostramos.

El módulo calcula siempre la **antigüedad** del dato y la muestra. No es paranoia: en la verificación, dolarapi devolvió una cotización de siete semanas atrás sin ninguna señal de que estuviera vieja. Con más de 4 días, la UI lo advierte.

El BCU sería la fuente oficial, pero su servidor rechaza con 403 las IPs de datacenter (`Oracle-iPlanet-Web-Server`, "Your client is not allowed to access the requested object"). Si desplegás donde el BCU sí acepte, prendé `FX_ENABLE_BCU=true` y pasa a ser la fuente primaria — falta implementar el cliente SOAP, que está documentado en `src/modules/fx/bcu.ts`.

---

## Cómo actualizar la normativa

Toda la normativa está en **`config/aduana-uy.ts`** y en ningún otro lado. Para actualizarla:

1. Cotejá los valores contra [aduanas.gub.uy](https://www.aduanas.gub.uy/) o el Diario Oficial.
2. Editá los campos de `ADUANA_UY`.
3. Actualizá `vigenciaDesde`, `norma` y `revisadoEl`.
4. Agregá la fuente oficial a `FUENTES` con `tipo: 'oficial'`.
5. Borrá de `PENDIENTES` lo que hayas confirmado.
6. Cuando no quede nada pendiente, poné `verificadoContraFuenteOficial: true`. Eso apaga el cartel de advertencia en la UI.
7. Corré `npm test`: si un cambio de parámetro rompe un test, el test te dice qué caso cambió.

### Estado: verificado el 2026-11-07

Los parámetros fueron cotejados contra el [Decreto N° 50/026](https://www.impo.com.uy/bases/decretos/50-2026) (promulgado 12/03/2026), los [artículos 627-635 de la Ley N° 20.446](https://www.impo.com.uy/bases/leyes/20446-2025/627) y las páginas oficiales de la DNA sobre [franquicia](https://www.aduanas.gub.uy/innovaportal/v/28221/1/innova.front/) y [prestación única](https://www.aduanas.gub.uy/innovaportal/v/28222/1/innova.front/). `PENDIENTES` está vacío y `verificadoContraFuenteOficial` es `true`.

La verificación corrigió cinco cosas respecto de lo que dicen las guías de couriers:

| Lo que dicen las guías | Lo que dice la norma |
|---|---|
| Mínimo de USD 20 de IVA en franquicia | **No existe.** El mínimo de USD 20 es sólo del régimen de prestación única (Ley 20.446 art. 627, Decreto art. 2) |
| Tope de 20 kg sólo en el simplificado | Aplica a **todo** el régimen de envíos postales (Decreto art. 1), franquicia incluida |
| La base es el valor del producto | Es el **total de la factura**, incluidos todos los conceptos adicionados en ella (art. 5): el envío que cobra la tienda entra, el courier uruguayo no |
| La exención de EE.UU. es por origen del envío | Exige **residencia fiscal del vendedor**, acreditada con la factura (art. 3). Y el envío exonerado **consume cupo igual** |
| "Cambio normativo el 1/10/2026" | No existe. Lo real es el **1/2/2027**: desde esa fecha el vendedor de EE.UU. debe estar registrado ante la DNA |

Además, el régimen tiene requisitos que las guías no mencionan y que están modelados en `requisitosFranquicia`: registro previo ante la DNA por única vez, pago con tarjeta internacional, y titularidad coincidente entre tarjeta, comprador y destinatario.

---

## Cómo actualizar el listado de vendedores

`config/vendedores-eeuu.ts` tiene las 149 razones sociales que Aduanas publica como vendedores de EE.UU. registrados (listado del 04/11/2026). Desde el 1/2/2027 ese registro es obligatorio para la exoneración de IVA, y mientras tanto lo usamos como la prueba más confiable de residencia fiscal.

Para actualizarlo: bajá el [PDF de Aduanas](https://www.aduanas.gub.uy/innovaportal/file/28873/1/control.empresas.pdf), extraé las razones sociales, reemplazá el array `VENDEDORES_REGISTRADOS` y actualizá `LISTADO_FECHA`.

La comparación ignora sufijos ("Inc.", "LLC") y puntuación, pero **no hace coincidencias parciales**: un falso positivo acá significa prometerle al usuario una exoneración que después no le dan.

## Cómo actualizar las tarifas de courier

Están en **`config/couriers-uy.ts`**. **Todas las tarifas actuales son placeholders inventados**, marcados con `// TODO: verificar tarifa real`. Mientras `tarifasVerificadas` sea `false`, la UI muestra una advertencia.

Para cada courier: completá `cargoFijoUsd`, `tramos` o `usdPorKg`, `pesoMinimoFacturableKg` y `diasEstimados`; después poné `tarifasVerificadas: true`.

Couriers ya listados, a completar: **Aeropost, Miami Box, Grupo Gripper, UPS, DAC Courier**. Si falta alguno que uses, agregalo al array `COURIERS` y su id a `CourierId`.

---

## Cómo agregar un provider nuevo

Tres pasos:

**1.** Agregá el id a `ProviderId` en `src/modules/foreign-search/types.ts`.

**2.** Creá `src/modules/foreign-search/providers/tu-provider.ts` implementando la interfaz:

```ts
export class TuProvider implements ProductSearchProvider {
  readonly id = 'tu-provider' as const;
  readonly displayName = 'Tu Tienda';

  isConfigured(): boolean {
    return Boolean(env().TU_PROVIDER_KEY);
  }

  async search(query: SearchQuery): Promise<readonly ForeignOffer[]> {
    // Devolvé ForeignOffer[]. Lo importante:
    //   originCountry      → de dónde sale el paquete (define courier y plazo)
    //   merchantTaxCountry → dónde tributa el comercio (define la exención de
    //                        IVA). Si no lo sabés con certeza, dejalo
    //                        undefined: landed-cost no aplica la exención y lo
    //                        advierte, que es preferible a prometer de más.
    //   gtin               → si lo tenés, el matcher no gasta una llamada al LLM
  }
}
```

**3.** Registralo en `src/modules/foreign-search/registry.ts`, agregá su key a `src/lib/env.ts` y a `.env.example`, y activalo con `FOREIGN_SEARCH_PROVIDERS=mock,tu-provider`.

No hace falta tocar nada más: la UI, el matcher y `landed-cost` lo toman solos.

---

## Qué falta

| Fase | Qué incluye | Estado |
|---|---|---|
| 1 | Config, `landed-cost` con tests, UI con mocks | ✅ Completa |
| 1.5 | Normativa verificada contra fuente oficial · registro de vendedores de la DNA | ✅ Completa |
| 2 | `ml-reader` con OAuth · `fx` contra fuente real | ✅ Código completo; falta que cargues las credenciales de ML |
| 3 | `foreign-search` con eBay · `matcher` con Claude | Pendiente |
| 4 | Pulido de UI y deploy | Pendiente |

**Fuera de alcance del MVP:** cuentas de usuario, seguimiento persistente del cupo, extensión de navegador, AliExpress/Shein/Temu, links de afiliado (el campo `affiliateUrl` está en el tipo pero sin integrar).

---

## Deploy

**Vercel:** importá el repo y cargá las variables de `.env.example` en Settings → Environment Variables. No hace falta más configuración.

**VPS con Docker:** `npm run build` genera el build estándar de Next. Nota: el rate limiting y la caché son en memoria, así que con varias instancias cada una lleva su propia cuenta. Para algo serio, mover `CacheStore` y el rate limit a Redis.

---

## Aviso

Esta app da **estimaciones orientativas, no asesoramiento aduanero**. Verificá siempre en [aduanas.gub.uy](https://www.aduanas.gub.uy/).
