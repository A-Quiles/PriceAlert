import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import { apiConfig } from './config';

/**
 * GET /api/check-prices
 *
 * This endpoint is called by a Vercel Cron Job (configured in vercel.json).
 * It checks all tracked products for price drops and sends email alerts.
 *
 * Required environment variables:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY  (service role to bypass RLS)
 *   - CRON_SECRET                (shared secret to authenticate cron calls)
 *   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   - EMAIL_FROM                 (e.g. "PriceAlert <noreply@yourapp.com>")
 *
 * Optional:
 *   - SCRAPER_API_KEY            (ScraperAPI key for avoiding blocks)
 */

function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[€$£\s]/g, '')
    .replaceAll('.', '')
    .replace(',', '.');
  const val = Number.parseFloat(cleaned);
  return Number.isNaN(val) ? null : val;
}

async function scrapePrice(
  url: string,
): Promise<{ price: number | null; availability: string }> {
  const scraperApiKey = apiConfig.scraper.apiKey || null;
  const targetUrl = scraperApiKey
    ? `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}`
    : url;

  const { data: html } = await axios.get<string>(targetUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'es-ES,es;q=0.9',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(html);

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

  const availText = $('#availability span').text().toLowerCase();
  let availability = 'unknown';
  if (
    availText.includes('en stock') ||
    availText.includes('disponible') ||
    availText.includes('in stock')
  ) {
    availability = 'in_stock';
  } else if (
    availText.includes('agotado') ||
    availText.includes('out of stock') ||
    availText.includes('no disponible')
  ) {
    availability = 'out_of_stock';
  } else if (rawPrice) {
    availability = 'in_stock';
  }

  return { price: parsePrice(rawPrice), availability };
}

function buildAlertEmailHtml(data: {
  productTitle: string;
  productUrl: string;
  productImage: string | null;
  currentPrice: number;
  thresholdPrice: number;
  originalPrice: number | null;
  currency: string;
  userName: string;
}): string {
  const savings = data.originalPrice
    ? data.originalPrice - data.currentPrice
    : null;
  const discount = data.originalPrice
    ? Math.round(
        ((data.originalPrice - data.currentPrice) / data.originalPrice) * 100,
      )
    : null;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>¡Precio Bajado! - PriceAlert</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#2563eb;padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">
        🔔 ¡Alerta de Precio!
      </h1>
      <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">PriceAlert</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;margin:0 0 24px;">
        Hola <strong>${data.userName}</strong>, uno de tus productos ha alcanzado tu precio objetivo 🎉
      </p>

      <!-- Product card -->
      <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        ${data.productImage ? `<div style="background:#f9fafb;text-align:center;padding:16px;"><img src="${data.productImage}" alt="${data.productTitle}" style="max-height:160px;max-width:100%;object-fit:contain;" /></div>` : ''}
        <div style="padding:16px;">
          <p style="color:#111827;font-size:15px;font-weight:600;margin:0 0 12px;line-height:1.4;">
            ${data.productTitle.substring(0, 120)}${data.productTitle.length > 120 ? '...' : ''}
          </p>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span style="color:#059669;font-size:28px;font-weight:800;">${data.currentPrice.toFixed(2)} ${data.currency}</span>
            ${data.originalPrice ? `<span style="color:#9ca3af;font-size:16px;text-decoration:line-through;">${data.originalPrice.toFixed(2)} ${data.currency}</span>` : ''}
            ${discount ? `<span style="background:#dcfce7;color:#15803d;font-size:13px;font-weight:700;padding:4px 10px;border-radius:20px;">-${discount}%</span>` : ''}
          </div>
          ${savings ? `<p style="color:#6b7280;font-size:13px;margin:8px 0 0;">Ahorras <strong style="color:#059669;">${savings.toFixed(2)} ${data.currency}</strong> respecto al precio original</p>` : ''}
          <p style="color:#6b7280;font-size:13px;margin:8px 0 0;">
            Tu objetivo era: <strong>${data.thresholdPrice.toFixed(2)} ${data.currency}</strong>
          </p>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${data.productUrl}" target="_blank"
          style="display:inline-block;background:#2563eb;color:#fff;font-size:16px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none;">
          Ver oferta en Amazon →
        </a>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
        Los precios pueden cambiar en cualquier momento. ¡Date prisa! ⏱️
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        Recibes este email porque tienes configurada una alerta en <strong>PriceAlert</strong>.<br/>
        Para desactivar las notificaciones, accede a tu cuenta y desactiva la alerta.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Authenticate cron request
  const authHeader = req.headers['authorization'];
  const cronSecret = apiConfig.cron.secret;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const supabase = createClient(
    apiConfig.supabase.url,
    apiConfig.supabase.serviceRoleKey,
  );

  const mailer = nodemailer.createTransport({
    host: apiConfig.smtp.host,
    port: apiConfig.smtp.port,
    secure: apiConfig.smtp.secure,
    auth: {
      user: apiConfig.smtp.user,
      pass: apiConfig.smtp.pass,
    },
  });

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Process only products with alert enabled that were not checked in the last 24 hours.
    const { data: products, error: prodErr } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('alert_enabled', true)
      .or(`last_checked.is.null,last_checked.lt.${cutoff}`)
      .order('last_checked', { ascending: true, nullsFirst: true })
      .limit(50); // Process up to 50 per run to stay within timeout

    if (prodErr) throw prodErr;
    if (!products || products.length === 0) {
      res
        .status(200)
        .json({ message: 'No products need checking right now', checked: 0 });
      return;
    }

    const results: string[] = [];
    let alertsSent = 0;

    for (const product of products) {
      try {
        const { price, availability } = await scrapePrice(product.url);

        const shouldSaveHistory =
          price !== null &&
          (product.current_price === null ||
            product.availability !== availability ||
            Math.abs(
              (price - (product.current_price ?? 0)) /
                (product.current_price || price),
            ) > 0.02);

        // Update product price
        await supabase
          .from('tracked_products')
          .update({
            current_price: price,
            availability,
            last_checked: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (shouldSaveHistory && price !== null) {
          await supabase.from('price_history').insert({
            product_id: product.id,
            price,
            currency: product.currency,
            availability,
          });

          const { data: latestRows, error: latestError } = await supabase
            .from('price_history')
            .select('id')
            .eq('product_id', product.id)
            .order('created_at', { ascending: false })
            .limit(30);

          if (!latestError) {
            const keepIds = latestRows?.map((row) => row.id) ?? [];
            if (keepIds.length >= 30) {
              const ids = keepIds.map((id) => `'${id}'`).join(',');
              await supabase
                .from('price_history')
                .delete()
                .eq('product_id', product.id)
                .not('id', 'in', `(${ids})`);
            }
          }
        }

        // Check alert threshold
        if (
          price !== null &&
          product.alert_threshold &&
          price <= product.alert_threshold &&
          !product.alert_email_sent
        ) {
          // Obtener perfil del usuario para el email
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name, email_notifications')
            .eq('id', product.user_id)
            .single();

          if (profile?.email_notifications && profile?.email) {
            // Marcar como disparada antes de enviar (evita reenvíos si el email falla)
            await supabase
              .from('tracked_products')
              .update({
                alert_triggered: true,
                alert_triggered_at: new Date().toISOString(),
                alert_trigger_price: price,
                alert_email_sent: true,
              })
              .eq('id', product.id);

            // Send email
            const html = buildAlertEmailHtml({
              productTitle: product.title,
              productUrl: product.url,
              productImage: product.image_url,
              currentPrice: price,
              thresholdPrice: product.alert_threshold,
              originalPrice: product.original_price,
              currency: product.currency,
              userName: profile.full_name ?? profile.email.split('@')[0],
            });

            await mailer.sendMail({
              from:
                apiConfig.smtp.from ?? 'PriceAlert <noreply@pricealert.app>',
              to: profile.email,
              subject: `🔔 ¡Precio bajado! ${product.title.substring(0, 50)} — ${price.toFixed(2)} ${product.currency}`,
              html,
            });

            alertsSent++;
          }
        }

        results.push(`✓ ${product.asin}: ${price} ${product.currency}`);
      } catch (err: any) {
        results.push(`✗ ${product.asin}: ${err.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }

    res.status(200).json({
      message: 'Price check complete',
      checked: products.length,
      alertsSent,
      results,
    });
  } catch (err: any) {
    console.error('[check-prices] Error:', err);
    res.status(500).json({ message: 'Internal error', error: err.message });
  }
}
