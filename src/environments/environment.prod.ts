export const environment = {
  production: true,
  supabaseUrl: process.env['SUPABASE_URL'] ?? '',
  supabaseAnonKey: process.env['SUPABASE_ANON_KEY'] ?? '',
  apiUrl: process.env['API_URL'] ?? '',
};
