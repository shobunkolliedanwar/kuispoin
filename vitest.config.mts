import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  process.env.NEXT_PUBLIC_SUPABASE_URL ||=
    env.NEXT_PUBLIC_SUPABASE_URL;

  process.env.SUPABASE_SERVICE_ROLE_KEY ||=
    env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    test: {
      environment: 'node',
    },
  };
});