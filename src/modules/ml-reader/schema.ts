/**
 * SCHEMAS DE LA API DE MERCADO LIBRE
 * ===================================
 * Todo lo que entra de la API pasa por acá. Los campos son laxos a propósito
 * (casi todo opcional): si ML agrega o saca un campo, queremos degradar el
 * dato, no voltear la consulta del usuario.
 */
import { z } from 'zod';

export const mlAttributeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  value_name: z.string().nullish(),
  value_id: z.string().nullish(),
});

export const mlItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number().nullish(),
  currency_id: z.string().nullish(),
  permalink: z.string().optional(),
  category_id: z.string().optional(),
  condition: z.string().optional(),
  seller_id: z.number().optional(),
  official_store_id: z.number().nullish(),
  warranty: z.string().nullish(),
  attributes: z.array(mlAttributeSchema).optional(),
  pictures: z.array(z.object({ secure_url: z.string().optional() })).optional(),
  thumbnail: z.string().optional(),
  shipping: z
    .object({
      free_shipping: z.boolean().optional(),
      logistic_type: z.string().nullish(),
    })
    .optional(),
});

export type MLItemRaw = z.infer<typeof mlItemSchema>;

/**
 * Productos de catálogo (/products/{id}). Tienen otra forma: el precio vive
 * en `buy_box_winner`.
 */
export const mlProductSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  catalog_product_id: z.string().nullish(),
  category_id: z.string().optional(),
  attributes: z.array(mlAttributeSchema).optional(),
  pictures: z.array(z.object({ url: z.string().optional(), secure_url: z.string().optional() })).optional(),
  buy_box_winner: z
    .object({
      item_id: z.string().optional(),
      price: z.number().nullish(),
      currency_id: z.string().nullish(),
      seller_id: z.number().optional(),
      warranty: z.string().nullish(),
      shipping: z.object({ free_shipping: z.boolean().optional() }).optional(),
    })
    .nullish(),
});

export type MLProductRaw = z.infer<typeof mlProductSchema>;

/* ──────────────────────────────────────────────────────────────────────────
 * CATÁLOGO
 * Las formas reales están capturadas en tests/fixtures/ml-catalog-*.json.
 * ────────────────────────────────────────────────────────────────────────── */

export const mlCatalogSearchSchema = z.object({
  paging: z.object({ total: z.number() }).optional(),
  results: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      domain_id: z.string().nullish(),
      status: z.string().nullish(),
      attributes: z.array(mlAttributeSchema).optional(),
      pictures: z.array(z.object({ url: z.string().nullish(), secure_url: z.string().nullish() })).optional(),
      short_description: z.object({ content: z.string().nullish() }).nullish(),
    }),
  ),
});

export const mlCatalogProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  family_name: z.string().nullish(),
  status: z.string().nullish(),
  domain_id: z.string().nullish(),
  permalink: z.string().nullish(),
  attributes: z.array(mlAttributeSchema).optional(),
  pictures: z.array(z.object({ url: z.string().nullish(), secure_url: z.string().nullish() })).optional(),
  short_description: z.object({ content: z.string().nullish() }).nullish(),
  settings: z.record(z.string(), z.unknown()).nullish(),
});

export const mlCatalogItemsSchema = z.object({
  paging: z.object({ total: z.number() }).optional(),
  results: z.array(
    z.object({
      item_id: z.string(),
      price: z.number().nullish(),
      original_price: z.number().nullish(),
      currency_id: z.string().nullish(),
      condition: z.string().nullish(),
      warranty: z.string().nullish(),
      seller_id: z.number().nullish(),
      official_store_id: z.number().nullish(),
      category_id: z.string().nullish(),
      tags: z.array(z.string()).optional(),
      shipping: z
        .object({
          free_shipping: z.boolean().optional(),
          logistic_type: z.string().nullish(),
          mode: z.string().nullish(),
        })
        .nullish(),
      sale_terms: z.array(mlAttributeSchema).optional(),
    }),
  ),
});
