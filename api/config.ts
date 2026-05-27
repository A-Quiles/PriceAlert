/**
 * Configuración central para las funciones serverless.
 * En desarrollo los valores están aquí directamente.
 * En producción (Vercel) se leen de las variables de entorno del dashboard.
 */

const isProd = process.env['VERCEL_ENV'] === 'production';

function fromEnvOrDefault(envKey: string, devValue: string): string {
  return isProd
    ? (process.env[envKey] ?? '')
    : (process.env[envKey] ?? devValue);
}

export const apiConfig = {
  supabase: {
    url: fromEnvOrDefault(
      'SUPABASE_URL',
      'https://muwnbgnatvjjzlhnkjsq.supabase.co',
    ),
    serviceRoleKey: fromEnvOrDefault('SUPABASE_SERVICE_ROLE_KEY', ''), // ← rellena cuando lo necesites
    anonKey: fromEnvOrDefault(
      'SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d25iZ25hdHZqanpsaG5ranNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDc3MjMsImV4cCI6MjA5NTQyMzcyM30.-lhJ5tIAkGyfRxhQklnWieUGcqdYb3QW-genILQ-UYo',
    ),
  },
  cron: {
    // En dev se acepta cualquier petición (secret vacío = sin autenticación)
    secret: fromEnvOrDefault('CRON_SECRET', ''),
  },
  scraper: {
    // Vacío = scraping directo sin intermediario (puede ser bloqueado por Amazon)
    apiKey: fromEnvOrDefault('SCRAPER_API_KEY', ''),
  },
  smtp: {
    host: fromEnvOrDefault('SMTP_HOST', ''),
    port: Number(fromEnvOrDefault('SMTP_PORT', '587')),
    secure: fromEnvOrDefault('SMTP_PORT', '587') === '465',
    user: fromEnvOrDefault('SMTP_USER', ''),
    pass: fromEnvOrDefault('SMTP_PASS', ''),
    from: fromEnvOrDefault('EMAIL_FROM', 'PriceAlert <noreply@localhost>'),
  },
};
