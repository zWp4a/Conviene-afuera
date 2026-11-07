/**
 * COMPARE — ORQUESTADOR
 * ======================
 * El único lugar donde los módulos se conocen entre sí. Cada uno sigue siendo
 * testeable y reemplazable por separado; acá se encadenan:
 *
 *   ml-reader → foreign-search → matcher → landed-cost → advisor
 *
 * También es donde se registra la consulta para auditar la calidad del match.
 */
import { estimarPesoPorCategoria } from '@config/categorias-peso';
import { couriersParaOrigen, type CourierId } from '@config/couriers-uy';
import { type CacheStore } from '@/lib/cache';
import { savingsPct, sub, toUnits } from '@/lib/money';
import { logConsulta, newRequestId } from '@/lib/logger';
import { construirVeredicto, type OpcionExterior, type Veredicto } from '@/modules/advisor';
import { buildQuery, searchForeign, type ForeignOffer } from '@/modules/foreign-search';
import { getCotizacion, usdToUyu, uyuToUsd, type Cotizacion } from '@/modules/fx';
import { calcularLandedCost, type EstadoFranquicia } from '@/modules/landed-cost';
import { matchAll } from '@/modules/matcher';
import { readMLProduct, type MLProduct } from '@/modules/ml-reader';

export interface CompareInput {
  readonly url: string;
  readonly franquicia?: EstadoFranquicia;
  readonly courierId?: CourierId;
}

export interface CompareResult {
  readonly requestId: string;
  readonly ml: MLProduct;
  readonly fx: Cotizacion;
  readonly opciones: readonly OpcionExterior[];
  readonly veredicto: Veredicto;
  readonly providersConsultados: readonly string[];
  readonly erroresProviders: readonly { readonly providerId: string; readonly message: string }[];
  readonly usandoDatosMock: boolean;
}

/** Peso del envío: del producto si se conoce, estimado por categoría si no. */
function resolverPeso(
  ml: MLProduct,
  offer: ForeignOffer,
): { gramos: number; esEstimado: boolean } {
  if (offer.weightGrams) return { gramos: offer.weightGrams, esEstimado: false };
  if (ml.weightGrams) return { gramos: ml.weightGrams, esEstimado: false };
  const est = estimarPesoPorCategoria(ml.categoryId);
  return { gramos: est.gramos, esEstimado: true };
}

export async function compare(
  input: CompareInput,
  opts: { cache?: CacheStore } = {},
): Promise<CompareResult> {
  const requestId = newRequestId();
  const t0 = Date.now();

  try {
    const [ml, fx] = await Promise.all([
      readMLProduct(input.url, opts.cache ? { cache: opts.cache } : {}),
      getCotizacion(opts.cache ? { cache: opts.cache } : {}),
    ]);

    const query = buildQuery({
      title: ml.title,
      ...(ml.attributes.brand ? { brand: ml.attributes.brand } : {}),
      ...(ml.attributes.model ? { model: ml.attributes.model } : {}),
      ...(ml.attributes.gtin ? { gtin: ml.attributes.gtin } : {}),
      ...(ml.attributes.capacity ? { capacity: ml.attributes.capacity } : {}),
    });

    const search = await searchForeign(query, opts.cache ? { cache: opts.cache } : {});

    const matched = await matchAll(
      {
        title: ml.title,
        ...(ml.attributes.brand ? { brand: ml.attributes.brand } : {}),
        ...(ml.attributes.model ? { model: ml.attributes.model } : {}),
        ...(ml.attributes.gtin ? { gtin: ml.attributes.gtin } : {}),
        ...(ml.attributes.capacity ? { capacity: ml.attributes.capacity } : {}),
      },
      search.offers,
    );

    const precioMlUyu = usdToUyu(ml.price, fx);

    const opciones: OpcionExterior[] = matched.map(({ candidate: offer, verdict }) => {
      const peso = resolverPeso(ml, offer);
      const courierId =
        input.courierId ?? couriersParaOrigen(offer.originCountry)[0]?.id ?? 'generico';

      const costo = calcularLandedCost({
        productPrice: offer.price,
        ...(offer.domesticShipping ? { domesticShipping: offer.domesticShipping } : {}),
        weightGrams: peso.gramos,
        weightIsEstimated: peso.esEstimado,
        originCountry: offer.originCountry,
        ...(offer.merchantTaxCountry ? { merchantTaxCountry: offer.merchantTaxCountry } : {}),
        courierId,
        ...(input.franquicia ? { franquicia: input.franquicia } : {}),
      });

      // Si ningún régimen sirve, usamos el más barato de los dos igual para
      // poder mostrar el número, con el bloqueo visible en la UI.
      const breakdown =
        costo.recomendado ??
        (costo.franquicia.totalUsd.cents <= costo.simplificado.totalUsd.cents
          ? costo.franquicia
          : costo.simplificado);

      const totalUyu = usdToUyu(breakdown.totalUsd, fx);

      return {
        offer,
        match: verdict,
        costo,
        totalUyu,
        ahorroUyu: sub(precioMlUyu, totalUyu),
        ahorroPct: savingsPct(precioMlUyu, totalUyu),
      };
    });

    const veredicto = construirVeredicto({ ml, opciones, fx });

    logConsulta({
      ts: new Date().toISOString(),
      requestId,
      mlUrl: input.url,
      mlTitulo: ml.title,
      mlPrecioUsd: toUnits(uyuToUsd(ml.price, fx)),
      ofertasEncontradas: search.offers.length,
      matches: matched.map(({ candidate, verdict }) => ({
        providerId: candidate.providerId,
        titulo: candidate.title,
        match: verdict.match,
        confidence: verdict.confidence,
        method: verdict.method,
        reason: verdict.reason,
      })),
      veredicto: veredicto.id,
      ...(veredicto.ahorroUyu ? { ahorroUyu: toUnits(veredicto.ahorroUyu) } : {}),
      durationMs: Date.now() - t0,
    });

    return {
      requestId,
      ml,
      fx,
      opciones,
      veredicto,
      providersConsultados: search.providersConsultados,
      erroresProviders: search.errores,
      usandoDatosMock: ml.source === 'mock',
    };
  } catch (error) {
    logConsulta({
      ts: new Date().toISOString(),
      requestId,
      mlUrl: input.url,
      ofertasEncontradas: 0,
      matches: [],
      durationMs: Date.now() - t0,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
