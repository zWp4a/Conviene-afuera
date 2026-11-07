/**
 * VENDEDORES DE EE.UU. REGISTRADOS ANTE LA DIRECCIÓN NACIONAL DE ADUANAS
 * =======================================================================
 *
 * Desde el 1 de febrero de 2027, para que un envío desde EE.UU. acceda a la
 * exoneración de IVA de hasta USD 200, el emisor de la factura debe estar
 * registrado ante la DNA. Aduanas publica el listado en PDF y lo actualiza.
 *
 * Esto resuelve el problema que teníamos en la Fase 1: antes no había forma
 * confiable de saber si un comercio tributa en EE.UU., y por las dudas no
 * aplicábamos la exoneración. Ahora hay una lista autoritativa.
 *
 * Fuente: https://www.aduanas.gub.uy/innovaportal/file/28873/1/control.empresas.pdf
 * Listado con fecha 04/11/2026, extraído el 2026-11-07.
 *
 * Cómo actualizarlo: ver README.md § "Cómo actualizar el listado de vendedores".
 */

/** Fecha que declara el PDF del que salió este listado. */
export const LISTADO_FECHA = '2026-11-04';

export const LISTADO_URL =
  'https://www.aduanas.gub.uy/innovaportal/file/28873/1/control.empresas.pdf';

/** Fecha desde la que el registro pasa a ser obligatorio para la exoneración. */
export const EXIGIBLE_DESDE = '2027-02-01';

/** Razones sociales tal como las publica Aduanas. */
export const VENDEDORES_REGISTRADOS: readonly string[] = [
  "1661, INC.",
  "ABERCROMBIE & FITCH CO.",
  "ADIDAS AMERICA, INC.",
  "ADORAMA INC.",
  "ALLIANCE ENTERTAINMENT HOLDING CORPORATION",
  "ALO, LLC",
  "AMAZON.COM, INC.",
  "AMERICAN EAGLE OUTFITTERS, INC.",
  "APPLE INC.",
  "ARITZIA, INC.",
  "ASICS AMERICA CORPORATION",
  "ASOS US SALES LLC",
  "B & H FOTO & ELECTRONICS CORP.",
  "BACKCOUNTRY.COM, LLC",
  "BAMBU LAB USA INC",
  "BASS PRO GROUP, LLC",
  "BATH & BODY WORKS, INC.",
  "BEST BUY CO., INC.",
  "BIGBADTOYSTORE, INC",
  "BIRKENSTOCK USA, LP",
  "BLUESTAR INC",
  "BSE INC DBA (DOING BUSINESS AS) COMPRENT MOTOR SPORTS",
  "CABELA S LLC",
  "CARD KINGDOM, INC.",
  "CARHARTT, INC.",
  "CARPARTS.COM, INC.",
  "CARTER S, INC.",
  "CATALYST BRANDS LLC",
  "CHEAPSPRINKLERS LLC",
  "COLUMBIA SPORTSWEAR COMPANY",
  "CORSAIR GAMING, INC.",
  "COSTCO WHOLESALE CORPORATION",
  "COULTER VENTURES, LLC",
  "CROCS, INC.",
  "DEPOP LTD.",
  "DICK S SPORTING GOODS, INC.",
  "DIGI-KEY CORPORATION",
  "DILLARD S, INC.",
  "DR. MARTENS AIRWAIR USA, LLC",
  "DYSON INC.",
  "EBAY INC.",
  "ECS TUNING LCC",
  "ECS TUNING, LLC - EIN 47-1395397",
  "ELY STAR MOTORS, INC",
  "EMPRESA EXTRANJERA EPI EXONERADOS",
  "EPAS PERFORMANCE LLC",
  "ESR PERFOMANCE CORP.",
  "ETSY, INC.",
  "EUROMARKET DESIGNS, INC",
  "EVERLANE, INC.",
  "EVIKE.COM, INC.",
  "FASHION NOVA, LLC",
  "FCP GROTON, LLC.",
  "FIGS, INC.",
  "FLUIDLOGIC INC",
  "FOOT LOCKER, INC.",
  "FUNKO, INC.",
  "GLOSSIER, INC.",
  "GOODWILL INDUSTRIES INTERNATIONAL, INC.",
  "GUITAR CENTER HOLDINGS, INC.",
  "H & M HENNES & MAURITZ, LP",
  "HMSMOTORSPORT LTD",
  "HRO, INC. (HAM RADIO OUTLET)",
  "IKEA NORTH AMERICA SERVICES, LLC",
  "INGRAM MICRO INC",
  "INTCOMEX, INC",
  "INTERAERO, INC.",
  "J. C. PENNEY CORPORATION, INC",
  "J.CREW GROUP, LLC",
  "JCAR INVESTMENTS LLC",
  "JD FINISH LINE, INC.",
  "JEGS HIGH PERFORMANCE",
  "KITH RETAIL , LLC",
  "KOHL S CORPORATION",
  "LANCASTER ARCHERY SUPPLY, INC",
  "LEGO BRAND RETAIL, INC.",
  "LENSCRAFTERS",
  "LEVI STRAUSS & CO.",
  "LOGITECH INC",
  "LOWE S COMPANIES, INC.",
  "LULULEMON ATHLETICA INC.",
  "MACY S, INC.",
  "MANGO NY INC",
  "MATTEL, INC.",
  "MICRO CENTER SALES CORPORATION",
  "MOTION RC LLC",
  "MOUSER ELECTRONICS, INC.",
  "MUSICIAN S FRIEND, INC.",
  "NEW BALANCE ATHLETICS, INC",
  "NEW BALANCE ATHLETICS, INC.",
  "NEWEGG INC.",
  "NIKE, INC.",
  "NORDSTROM, INC.",
  "PATAGONIA, INC.",
  "PAYPABLO INTERNATIONAL LLC",
  "PEDIDO.MIAMI",
  "PEGASUS AUTO RACING SUPPLIES INC.",
  "POWERSPORTS PLUS, LLC",
  "PRIME INDUSTRIAL FASTENERS",
  "PUMA NORTH AMERICA, INC.",
  "PURE FISHING, INC.",
  "PVH CORP. (DELAWARE)",
  "R.C. JENSON, INC",
  "RACEPARTS USA LTD.",
  "RALPH LAUREN CORPORATION",
  "RAZER USA LTD",
  "REI COOP (REI)",
  "ROCKAUTO",
  "SAKS GLOBAL ENTERPRISES LLC",
  "SEARS HOLDINGS CORPORATION",
  "SEPHORA USA, INC.",
  "SHEIN US SERVICES, LLC",
  "SHIMANO NORTH AMERICA HOLDING, INC",
  "SHOPSIMON, LLC",
  "SHUTTERFLY, LLC",
  "SNYDER'S ANTIQUE AUTO PARTS",
  "SPORTS WAREHOUSE, INC.",
  "SR TECHNOLOGIES, INC",
  "STANLEY BLACK & DECKER, INC.",
  "STOCKX LLC",
  "SWEETWATER SOUND, INC.",
  "TALON GRIPS, INC",
  "TARGET CORPORATION",
  "TESLA,INC.",
  "TEXAS MOUSER CORPORATION",
  "THE EASTWOOD COMPANY",
  "THE GAP, INC.",
  "THE HOME DEPOT, INC.",
  "THE TJX COMPANIES, INC.",
  "THE TOPPS COMPANY, INC.",
  "ULTA BEAUTY, INC.",
  "UMG COMMERCIAL SERVICES, INC.",
  "UNIQLO USA LLC",
  "UNITED FULFILLMENT SOLUTIONS, INC",
  "URBAN OUTFITTERS, INC.",
  "V.F. CORPORATION",
  "VICTORIA S SECRET & CO.",
  "WALMART INC.",
  "WAYFAIR INC.",
  "WHATNOT INC",
  "WHOOP, INC.",
  "WILLIAMS-SONOMA, INC.",
  "WOOWARD MACHINE CORPORATION",
  "XIPRON INC",
  "YETI HOLDINGS, INC.",
  "ZAPPOS.COM LLC",
  "ZARA USA, INC.",
  "ZINK MEDIA, INC.",
  "ZUMIEZ INC.",
];

/** Normaliza una razón social para poder compararla: sin puntuación ni sufijos. */
function normalizar(nombre: string): string {
  return nombre
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(INC|LLC|LTD|LP|CORP|CORPORATION|CO|COMPANY|HOLDINGS?|GROUP|USA|US|SALES)\b/g, ' ')
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

const INDICE = new Set(VENDEDORES_REGISTRADOS.map(normalizar));

/**
 * `true` si el comercio figura en el listado de Aduanas.
 *
 * La comparación es laxa a propósito (ignora "Inc.", "LLC", puntuación), pero
 * sigue siendo exacta sobre el núcleo del nombre: no hace coincidencias
 * parciales, porque un falso positivo acá significa prometerle al usuario una
 * exoneración de IVA que después no le van a dar.
 */
export function vendedorRegistradoEnDna(nombreComercio: string | undefined): boolean {
  if (!nombreComercio) return false;
  const n = normalizar(nombreComercio);
  return n.length >= 3 && INDICE.has(n);
}
