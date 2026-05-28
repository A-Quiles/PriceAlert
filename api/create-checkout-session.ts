import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

/**
 * POST /api/create-checkout-session
 * Body: { email: string; userId: string }
 *
 * Crea una sesión de pago de Stripe Checkout y devuelve la URL de redirección.
 *
 * Variables de entorno necesarias:
 *   STRIPE_SECRET_KEY      — clave secreta de Stripe (sk_live_... o sk_test_...)
 *   STRIPE_PRICE_ID        — ID del precio recurrente creado en el dashboard de Stripe
 *   APP_URL                — URL base de la aplicación (ej: https://tudominio.com)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const stripeSecretKey = process.env['STRIPE_SECRET_KEY'];
  const stripePriceId = process.env['STRIPE_PRICE_ID'];
  const appUrl = process.env['APP_URL'] ?? 'http://localhost:4200';

  if (!stripeSecretKey || !stripePriceId) {
    res.status(500).json({
      message:
        'Stripe no está configurado. Añade STRIPE_SECRET_KEY y STRIPE_PRICE_ID a las variables de entorno.',
    });
    return;
  }

  const { email, userId } = req.body as { email?: string; userId?: string };

  if (!email || !userId) {
    res.status(400).json({ message: 'email y userId son obligatorios' });
    return;
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    // Buscar o crear cliente de Stripe
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customerId: string;

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: stripePriceId, quantity: 1 }],
      metadata: { supabase_user_id: userId },
      success_url: `${appUrl}/precios?success=true`,
      cancel_url: `${appUrl}/precios?canceled=true`,
      subscription_data: {
        metadata: { supabase_user_id: userId },
      },
      locale: 'es',
      allow_promotion_codes: true,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al crear la sesión de pago';
    console.error('[create-checkout-session] Error:', err);
    res.status(500).json({ message });
  }
}
