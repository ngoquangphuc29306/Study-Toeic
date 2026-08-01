/**
 * Supabase Environment Configuration
 *
 * Validates required public Supabase environment variables.
 * Throws clear errors when configuration is missing.
 *
 * Security: Only public variables - no service role keys.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SUPABASE_URL\n' +
    'Add this variable to your .env.local file.\n' +
    'Get the value from Supabase Dashboard → Project Settings → API → Project URL'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
    'Add this variable to your .env.local file.\n' +
    'Get the value from Supabase Dashboard → Project Settings → API → Project API keys → anon/public'
  );
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch {
  throw new Error(
    `Invalid NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}"\n` +
    'Must be a valid URL (e.g., https://xxxxx.supabase.co)'
  );
}

// Validate key is not placeholder
if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseUrl === 'https://your-project.supabase.co') {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL is still a placeholder.\n' +
    'Replace it with your actual Supabase project URL.'
  );
}

if (supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY' || supabaseAnonKey.startsWith('your-')) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY is still a placeholder.\n' +
    'Replace it with your actual Supabase anon key.'
  );
}

/**
 * Validated Supabase configuration.
 * Safe to use throughout the application.
 */
export const supabaseEnv = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
} as const;
