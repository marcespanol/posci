const supabaseUrlValue = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKeyValue = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrlValue) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKeyValue) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabaseUrl = supabaseUrlValue;
export const supabaseAnonKey = supabaseAnonKeyValue;
