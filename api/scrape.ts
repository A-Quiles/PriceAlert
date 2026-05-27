import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { apiConfig } from './config';

interface ScrapeResult {
  title: string;
  price: number | null;
  original_price: number | null;
  currency: string;
  image_url: string | null;
  asin: string;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
}

/**
 * Extracts the ASIN from an Amazon URL.
 * Supports: /dp/ASIN, /gp/product/ASIN, and query string ?asin=
 */
function extractAsin(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(url);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

/**
 * Detects the currency from the Amazon domain.
 */
function detectCurrency(url: string): string {
  if (url.includes('amazon.es')) return 'EUR';
  if (url.includes('amazon.de')) return 'EUR';
  if (url.includes('amazon.fr')) return 'EUR';
  if (url.includes('amazon.it')) return 'EUR';
  if (url.includes('amazon.nl')) return 'EUR';
  if (url.includes('amazon.co.uk')) return 'GBP';
  if (url.includes('amazon.com')) return 'USD';
  if (url.includes('amazon.ca')) return 'CAD';
  return 'EUR';
}

/**
 * Parses a price string (e.g. "49,99 €", "$49.99") and returns a number.
 */
function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  // Remove currency symbols and whitespace, normalize decimal separator
  const cleaned = raw
    .replace(/[€$£CA\s]/g, '')
    .replaceAll('.', '') // Remove thousands separator (e.g. 1.299)
    .replace(',', '.'); // Normalize decimal separator
  const val = Number.parseFloat(cleaned);
  return Number.isNaN(val) ? null : val;
}

/**
 * POST /api/scrape
 * Body: { url: string }
 * Returns scraped product data or an error.
 *
 * NOTE: Amazon actively blocks automated requests.
 * For production use, configure the SCRAPER_API_KEY environment variable
 * to route requests through ScraperAPI (https://www.scraperapi.com/).
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string') {
    res.status(400).json({ message: 'URL del producto requerida' });
    return;
  }

  // Validate Amazon URL
  const amazonPattern =
    /^https?:\/\/(www\.)?amazon\.(es|com|co\.uk|de|fr|it|nl|pl|se|ca)/i;
  if (!amazonPattern.test(url)) {
    res.status(400).json({ message: 'La URL debe ser de Amazon' });
    return;
  }

  const asin = extractAsin(url);
  if (!asin) {
    res.status(400).json({
      message:
        'No se pudo extraer el ASIN de la URL. Asegúrate de usar la URL directa del producto.',
    });
    return;
  }

  const currency = detectCurrency(url);

  // Build the target URL — use ScraperAPI if key is provided
  const scraperApiKey = apiConfig.scraper.apiKey || null;
  const targetUrl = scraperApiKey
    ? `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}&render=false&country_code=es`
    : url;

  try {
    const { data: html } = await axios.get<string>(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
        Connection: 'keep-alive',
        Referer: 'https://www.amazon.es/',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(html);

    // Title
    const title =
      $('#productTitle').text().trim() ||
      $('h1.a-size-large').text().trim() ||
      $('[data-cel-widget="title"] span').text().trim() ||
      'Producto de Amazon';

    // Check for CAPTCHA / bot detection
    if (
      title === 'Producto de Amazon' &&
      $('form[action="/errors/validateCaptcha"]').length > 0
    ) {
      res.status(503).json({
        message:
          'Amazon bloqueó la solicitud (CAPTCHA). Configura SCRAPER_API_KEY para evitarlo.',
      });
      return;
    }

    // Current price — try multiple selectors
    const priceSelectors = [
      '.a-price.aok-align-center .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price .a-offscreen',
      '#price_inside_buybox',
      '.apexPriceToPay .a-offscreen',
      '#corePrice_desktop .a-price .a-offscreen',
    ];

    let rawPrice: string | undefined;
    for (const sel of priceSelectors) {
      const text = $(sel).first().text().trim();
      if (text) {
        rawPrice = text;
        break;
      }
    }

    // Original / list price — restringido al bloque de precio principal
    // para evitar capturar precios de productos relacionados en la misma página.
    const rawOriginal =
      // Precio base explícito (el más fiable)
      $('#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen')
        .first()
        .text()
        .trim() ||
      // Precio tachado dentro del bloque de precio principal
      $('#corePriceDisplay_desktop_feature_div .a-text-price .a-offscreen')
        .first()
        .text()
        .trim() ||
      // Alternativa mobile / layout antiguo
      $('#corePrice_feature_div .a-text-price .a-offscreen')
        .first()
        .text()
        .trim() ||
      $('#listPrice').text().trim() ||
      undefined;

    // Image
    const imageUrl =
      $('#landingImage').attr('data-old-hires') ||
      $('#landingImage').attr('src') ||
      $('#imgTagWrapperId img').attr('src') ||
      $('#main-image').attr('src') ||
      null;

    // Availability
    const availText = $('#availability .a-size-medium, #availability span')
      .text()
      .toLowerCase();
    let availability: ScrapeResult['availability'] = 'unknown';
    if (
      availText.includes('en stock') ||
      availText.includes('in stock') ||
      availText.includes('disponible')
    ) {
      availability = 'in_stock';
    } else if (
      availText.includes('no disponible') ||
      availText.includes('agotado') ||
      availText.includes('out of stock')
    ) {
      availability = 'out_of_stock';
    } else if (rawPrice) {
      // If we have a price but no availability text, assume in stock
      availability = 'in_stock';
    }

    const parsedPrice = parsePrice(rawPrice);
    const parsedOriginal = parsePrice(rawOriginal);

    // Sanity check: el precio original solo es válido si es mayor que el actual.
    // Si no, probablemente lo capturamos de otro producto en la misma página.
    const validatedOriginal =
      parsedOriginal !== null &&
      parsedPrice !== null &&
      parsedOriginal > parsedPrice
        ? parsedOriginal
        : null;

    const result: ScrapeResult = {
      title: title.substring(0, 500), // Limit title length
      price: parsedPrice,
      original_price: validatedOriginal,
      currency,
      image_url: imageUrl ? imageUrl.split('._')[0] + '._AC_SL500_.jpg' : null,
      asin,
      availability,
    };

    res.status(200).json(result);
  } catch (err: any) {
    console.error('[scrape] Error:', err.message);

    if (err.response?.status === 503 || err.response?.status === 403) {
      res.status(503).json({
        message:
          'Amazon bloqueó la solicitud. Considera configurar SCRAPER_API_KEY.',
      });
      return;
    }

    res
      .status(500)
      .json({ message: 'Error al analizar el producto. Verifica la URL.' });
  }
}
