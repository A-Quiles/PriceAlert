import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

/** Tipos locales para los objetos del webhook de Stripe */
interface StripeCheckoutSession {
  customer: string | null;
  subscription: string | null;
  metadata: Record<string, string> | null;
}

interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  metadata: Record<string, string> | null;
}

type StripeWebhookEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

/**
 * POST /api/stripe-webhook
 *
 * Recibe eventos de Stripe y actualiza el plan del usuario en Supabase.
 *
 * Eventos manejados:
 *   - checkout.session.completed    → activa plan premium
 *   - customer.subscription.deleted → degrada a plan gratuito
 *   - invoice.payment_failed        → (opcional) notifica al usuario
 *
 * Variables de entorno necesarias:
 *   STRIPE_SECRET_KEY        — clave secreta de Stripe
 *   STRIPE_WEBHOOK_SECRET    — signing secret del webhook (whsec_...)
 *   SUPABASE_URL             — URL del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — clave de servicio de Supabase (bypassa RLS)
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
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('[stripe-webhook] Faltan variables de entorno');
    res.status(500).json({ message: 'Configuración incompleta' });
    return;
  }

  const stripe = new Stripe(stripeSecretKey);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verificar firma del webhook
  const signature = req.headers['stripe-signature'];
  if (!signature) {
    res.status(400).json({ message: 'Falta firma de Stripe' });
    return;
  }

  let event: StripeWebhookEvent;
  try {
    // req.body llega como Buffer cuando el middleware de Vercel no lo parsea
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret) as unknown as StripeWebhookEvent;
  } catch (err) {
    console.error('[stripe-webhook] Firma inválida:', err);
    res.status(400).json({ message: 'Firma de webhook inválida' });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as unknown as StripeCheckoutSession;
        const userId = session.metadata?.['supabase_user_id'];

        if (userId && session.subscription) {
          await supabase
            .from('profiles')
            .update({
              plan: 'premium',
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
            })
            .eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as unknown as StripeSubscription;
        const userId = subscription.metadata?.['supabase_user_id'];

        if (userId) {
          await supabase
            .from('profiles')
            .update({
              plan: 'free',
              stripe_subscription_id: null,
            })
            .eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as unknown as StripeSubscription;
        const userId = subscription.metadata?.['supabase_user_id'];

        if (userId) {
          const isActive = ['active', 'trialing'].includes(subscription.status);
          await supabase
            .from('profiles')
            .update({ plan: isActive ? 'premium' : 'free' })
            .eq('id', userId);
        }
        break;
      }

      default:
        // Eventos no manejados — respondemos 200 igualmente
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] Error procesando evento:', err);
    res.status(500).json({ message: 'Error interno' });
  }
}
