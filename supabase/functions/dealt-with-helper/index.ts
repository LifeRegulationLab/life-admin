// Dealt With: the helper (explain, draft, call script), on the shared Life Regulation Lab server.
// The same handler as functions/src/helper.ts; only who is asking and whether they have Plus are
// answered here, from the shared sign-in and dealt_with.plans. The model key is a function secret
// (ANTHROPIC_API_KEY, the one Picture Talk uses).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleHelper } from './helper.ts';

const MODEL = 'claude-sonnet-5-5';
const DEFAULT_ORIGINS = 'https://dealt-with-lrl.web.app,https://dealt-with-lrl.firebaseapp.com,capacitor://localhost';

Deno.serve((req: Request) => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    db: { schema: 'dealt_with' },
    auth: { persistSession: false },
  });
  return handleHelper(req, {
    // On unless switched off with DEALT_WITH_HELPER_ON=false. Only people with Plus get an answer.
    on: Deno.env.get('DEALT_WITH_HELPER_ON') ?? 'true',
    origins: (Deno.env.get('DEALT_WITH_ORIGINS') ?? DEFAULT_ORIGINS).split(','),
    verifyUser: async (token) => (await admin.auth.getUser(token)).data.user?.id,
    hasPlus: async (uid) => {
      const { data } = await admin.from('plans').select('active').eq('user_id', uid).maybeSingle();
      return data?.active === true;
    },
    model: async (system, messages, maxTokens) => {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
      });
      if (!r.ok) throw new Error(`model ${r.status}`);
      const body = (await r.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
      return { refused: body.stop_reason === 'refusal', text: (body.content ?? []).map((c) => c.text ?? '').join('') };
    },
  });
});
