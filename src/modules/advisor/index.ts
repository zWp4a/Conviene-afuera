/**
 * ADVISOR
 * ========
 * Toma el producto de ML, las ofertas del exterior ya matcheadas y sus costos
 * puestos en Uruguay, y arma el veredicto + la guía de compra.
 *
 * Tono: español rioplatense, claro y directo. Nada de "podría considerar".
 */
import { ADUANA_UY, DISCLAIMER, TRANSICION_2026 } from '@config/aduana-uy';
import { getCourier } from '@config/couriers-uy';
import { format, savingsPct, sub, type Money } from '@/lib/money';
import { usdToUyu, type Cotizacion } from '@/modules/fx';
import type { LandedCostResult } from '@/modules/landed-cost';
import type { MatchVerdict } from '@/modules/matcher';
import type { ForeignOffer } from '@/modules/foreign-search';
import type { MLProduct } from '@/modules/ml-reader';

export type VeredictoId = 'conviene-afuera' | 'conviene-aca' | 'empate' | 'sin-opciones';

export interface OpcionExterior {
  readonly offer: ForeignOffer;
  readonly match: MatchVerdict;
  readonly costo: LandedCostResult;
  readonly totalUyu: Money;
  /** Ahorro contra el precio de ML, en UYU. Negativo = sale más caro. */
  readonly ahorroUyu: Money;
  readonly ahorroPct: number;
}

export interface PasoGuia {
  readonly titulo: string;
  readonly detalle: string;
}

export interface Veredicto {
  readonly id: VeredictoId;
  /** Titular, en una línea. */
  readonly titular: string;
  /** Una o dos oraciones de explicación. */
  readonly detalle: string;
  readonly mejorOpcion?: OpcionExterior;
  readonly precioMlUyu: Money;
  readonly ahorroUyu?: Money;
  readonly ahorroPct?: number;
  readonly guia: readonly PasoGuia[];
  readonly perdidas: readonly string[];
  readonly disclaimer: string;
}

/** Diferencia menor a este % se considera empate: no vale la pena el trámite. */
const UMBRAL_EMPATE_PCT = 8;

export function construirVeredicto(input: {
  ml: MLProduct;
  opciones: readonly OpcionExterior[];
  fx: Cotizacion;
}): Veredicto {
  const { ml, opciones, fx } = input;
  const precioMlUyu = usdToUyu(ml.price, fx);

  // Sólo se compara contra matches confiables. Un "similar" no es el mismo
  // producto y compararlo sería exactamente el error que arruina el producto.
  const comparables = opciones
    .filter((o) => o.match.tier === 'exacto' || o.match.tier === 'verificar')
    .sort((a, b) => a.totalUyu.cents - b.totalUyu.cents);

  const mejor = comparables[0];

  if (!mejor) {
    return {
      id: 'sin-opciones',
      titular: 'No encontramos el mismo producto afuera',
      detalle:
        'Encontramos productos parecidos pero no idénticos, así que no tiene sentido comparar precios: serían cosas distintas. Comprá acá o buscá el modelo exacto a mano.',
      precioMlUyu,
      guia: [],
      perdidas: [],
      disclaimer: DISCLAIMER,
    };
  }

  const ahorroUyu = sub(precioMlUyu, mejor.totalUyu);
  const ahorroPct = savingsPct(precioMlUyu, mejor.totalUyu);

  if (Math.abs(ahorroPct) < UMBRAL_EMPATE_PCT) {
    return {
      id: 'empate',
      titular: 'Da casi lo mismo: comprá acá',
      detalle: `Traerlo de afuera sale ${format(mejor.totalUyu)} contra ${format(precioMlUyu)} acá. Una diferencia de ${Math.abs(ahorroPct)}% no paga la espera, el trámite ni perder la garantía local.`,
      mejorOpcion: mejor,
      precioMlUyu,
      ahorroUyu,
      ahorroPct,
      guia: [],
      perdidas: perdidasAlComprarAfuera(ml, mejor),
      disclaimer: DISCLAIMER,
    };
  }

  if (ahorroPct < 0) {
    return {
      id: 'conviene-aca',
      titular: `Conviene comprar acá: ahorrás ${format({ cents: -ahorroUyu.cents, currency: 'UYU' })}`,
      detalle: `Puesto en Uruguay, el de afuera sale ${format(mejor.totalUyu)} — un ${Math.abs(ahorroPct)}% más que los ${format(precioMlUyu)} de Mercado Libre. Los impuestos y el courier se comen la diferencia de precio.`,
      mejorOpcion: mejor,
      precioMlUyu,
      ahorroUyu,
      ahorroPct,
      guia: [],
      perdidas: perdidasAlComprarAfuera(ml, mejor),
      disclaimer: DISCLAIMER,
    };
  }

  return {
    id: 'conviene-afuera',
    titular: `Conviene traerlo de afuera: ahorrás ${format(ahorroUyu)}`,
    detalle: `Puesto en Uruguay sale ${format(mejor.totalUyu)} contra ${format(precioMlUyu)} acá: un ${ahorroPct}% menos. ${mejor.match.tier === 'verificar' ? 'Ojo: ' + mejor.match.reason : ''}`.trim(),
    mejorOpcion: mejor,
    precioMlUyu,
    ahorroUyu,
    ahorroPct,
    guia: construirGuia(mejor),
    perdidas: perdidasAlComprarAfuera(ml, mejor),
    disclaimer: DISCLAIMER,
  };
}

export function construirGuia(opcion: OpcionExterior): readonly PasoGuia[] {
  const breakdown = opcion.costo.recomendado;
  if (!breakdown) return [];

  const courier = opcion.costo.franquicia.courierNombre;
  const courierCfg = getCourier(
    // El nombre viene del breakdown; buscamos la config por nombre.
    (['aeropost', 'miami-box', 'gripper', 'ups', 'dac-courier', 'generico'] as const).find(
      (id) => getCourier(id).nombre === courier,
    ) ?? 'generico',
  );

  const pasos: PasoGuia[] = [];

  // El registro ante Aduanas es un requisito del Decreto 50/026 art. 4, y es
  // por única vez: va primero porque sin eso no podés usar la franquicia.
  if (breakdown.regime === 'franquicia') {
    pasos.push({
      titulo: 'Registrate una vez ante Aduanas',
      detalle:
        'Antes de usar la franquicia tenés que registrarte por única vez ante la Dirección Nacional de Aduanas, con tu cédula y el control de identidad digital. Se hace una sola vez y queda para todas tus compras.',
    });
  }

  pasos.push(
    {
      titulo: `Abrí una cuenta en ${courier}`,
      detalle: courierCfg.sitioWeb
        ? `Entrá a ${courierCfg.sitioWeb} y creá tu cuenta con tu cédula. Te dan una dirección en Miami que vas a usar como dirección de entrega en la tienda.`
        : 'Creá una cuenta en el courier que elijas. Te van a dar una dirección en Miami para usar como dirección de entrega.',
    },
    {
      titulo: 'Comprá en la tienda con la dirección de Miami',
      detalle: `Comprá en ${opcion.offer.merchantName ?? 'la tienda'} y poné la dirección de Miami que te dio el courier como dirección de envío. El producto sale ${format(opcion.offer.price)}.${
        breakdown.regime === 'franquicia'
          ? ' Importante: pagá con tarjeta de crédito o débito internacional a TU nombre. Si el titular de la tarjeta no coincide con el destinatario del envío, perdés la franquicia.'
          : ''
      }`,
    },
  );

  if (breakdown.regime === 'franquicia') {
    const consume = breakdown.consumeFranquicia;
    pasos.push({
      titulo: 'Declarala como franquicia',
      detalle: `Cuando el courier te pida declarar el envío, elegí el régimen de franquicia. ${
        breakdown.taxUsd.cents === 0
          ? 'Esta compra queda exenta de IVA, pero te consume cupo igual.'
          : `Vas a pagar ${format(breakdown.taxUsd)} de IVA.`
      }${
        consume
          ? ` Esto te consume 1 de los ${ADUANA_UY.franquicia.enviosPorAnioCalendario} envíos del año y USD ${consume.cupoUsd.toFixed(2)} de los USD ${ADUANA_UY.franquicia.cupoAnualUsd} de cupo anual.`
          : ''
      }`,
    });
  } else {
    pasos.push({
      titulo: 'Declarala por régimen simplificado',
      detalle: `Elegí el régimen simplificado: pagás ${format(breakdown.taxUsd)} (${breakdown.explicacionImpuesto}). Este régimen no consume tus 3 envíos de franquicia y no tiene límite de cantidad al año.`,
    });
  }

  pasos.push({
    titulo: 'Pagá el courier y esperá',
    detalle: `El courier te va a cobrar ${format(breakdown.courierUsd)} por el envío${
      opcion.costo.peso.esEstimado ? ' (estimado: el peso real puede cambiarlo)' : ''
    }. Llega en ${breakdown.diasEstimados.min} a ${breakdown.diasEstimados.max} días hábiles desde que el paquete entra al warehouse de Miami.`,
  });

  pasos.push({
    titulo: 'Total que vas a pagar',
    detalle: `${format(breakdown.productUsd)} producto + ${format(breakdown.courierUsd)} courier + ${format(breakdown.taxUsd)} impuestos = ${format(breakdown.totalUsd)}, o ${format(opcion.totalUyu)}.`,
  });

  return pasos;
}

export function perdidasAlComprarAfuera(
  ml: MLProduct,
  opcion: OpcionExterior,
): readonly string[] {
  const out: string[] = [];

  out.push(
    ml.warrantyText
      ? `Garantía local: en Mercado Libre tenés "${ml.warrantyText}" con respaldo en Uruguay. Comprando afuera, cualquier reclamo de garantía implica mandar el producto al exterior por tu cuenta.`
      : 'Garantía local: comprando afuera, cualquier reclamo de garantía implica mandar el producto al exterior por tu cuenta.',
  );

  if (ml.seller.esTiendaOficial) {
    out.push(
      'Es tienda oficial: estás comparando contra un vendedor oficial en Uruguay, que es lo más parecido a comprarlo en la marca.',
    );
  }

  out.push(
    'Devoluciones: si no te gusta o viene fallado, devolverlo al exterior cuesta más que el envío de ida y el reembolso puede tardar semanas.',
  );

  const dias = opcion.costo.recomendado?.diasEstimados;
  out.push(
    dias
      ? `Tiempo: ${dias.min} a ${dias.max} días hábiles contra ${ml.shipping.esFull ? '24 a 48 horas con Full' : '2 a 5 días'} comprando acá.`
      : 'Tiempo: la espera es de semanas, contra días comprando acá.',
  );

  if (opcion.costo.recomendado?.regime === 'franquicia') {
    out.push(
      `Cupo: te consume 1 de los ${ADUANA_UY.franquicia.enviosPorAnioCalendario} envíos de franquicia del año, que no podés usar para otra compra. ${TRANSICION_2026}`,
    );
    out.push(
      'Forma de pago: la franquicia te obliga a pagar con tarjeta internacional a tu nombre. No podés usar la tarjeta de otra persona ni métodos que Aduanas no pueda verificar.',
    );
  }

  if (opcion.match.tier === 'verificar') {
    out.push(`Certeza del match: ${opcion.match.reason}`);
  }

  return out;
}
