import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env } from '@/lib/env';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

export const createClient = (cookieStore: ReadonlyRequestCookies) => {
  return createServerClient(
    env.SUPABASE_URL!,
    env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // This hook is called inside of the setter when cookies need to be set
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // This hook is called inside of the remove function when cookies need to be removed
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}; 