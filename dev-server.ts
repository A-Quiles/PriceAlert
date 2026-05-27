/**
 * Servidor Express de desarrollo local para las funciones serverless de /api.
 * Equivalente a "vercel dev" pero sin necesitar Vercel CLI ni login.
 *
 * Uso:
 *   Terminal 1: npm run api          → inicia este servidor en localhost:3000
 *   Terminal 2: npm start            → inicia Angular en localhost:4200 (con proxy)
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { config } from 'dotenv';
import { resolve } from 'path';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Carga variables de entorno desde .env.local (opcional — la config está en api/config.ts)
config({ path: resolve('.env.local') });

const app = express();
const PORT = Number(process.env['DEV_API_PORT'] ?? 3000);

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de cada petición entrante
app.use((req: Request, _res: Response, next: NextFunction) => {
  const ts = new Date().toISOString().substring(11, 23);
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ── Rutas API ───────────────────────────────────────────────────────────────

/** Envuelve un handler async de Vercel para que Express capture sus errores */
function wrapHandler(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(
      req as unknown as VercelRequest,
      res as unknown as VercelResponse,
    ).catch((err: unknown) => {
      const ts = new Date().toISOString().substring(11, 23);
      console.error(`[${ts}] Handler error:`, err);
      next(err);
    });
  };
}

// POST /api/scrape
import('./api/scrape')
  .then(({ default: scrapeHandler }) => {
    app.post('/api/scrape', wrapHandler(scrapeHandler));
    console.log('[DEV SERVER] Ruta registrada: POST /api/scrape');
  })
  .catch((err: unknown) => {
    console.error('[DEV SERVER] Error cargando api/scrape:', err);
  });

// GET /api/check-prices  (cron manual)
import('./api/check-prices')
  .then(({ default: checkHandler }) => {
    app.get('/api/check-prices', wrapHandler(checkHandler));
    console.log('[DEV SERVER] Ruta registrada: GET /api/check-prices');
  })
  .catch((err: unknown) => {
    console.error('[DEV SERVER] Error cargando api/check-prices:', err);
  });

// ── Error handler global ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  const ts = new Date().toISOString().substring(11, 23);
  console.error(`[${ts}] Unhandled error:`, err);
  res.status(500).json({ message });
});

// ── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║  PriceAlert DEV SERVER  →  http://localhost:${PORT}  ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  POST /api/scrape                            ║');
  console.log('║  GET  /api/check-prices  (cron manual)       ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Config: api/config.ts                       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
