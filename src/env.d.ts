/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Supabase project URL, e.g. https://abcd1234.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Public "anon"/"publishable" key. Never put a service_role/secret key here. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
