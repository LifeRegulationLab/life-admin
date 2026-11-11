// Dealt With: read aloud in the recorded voice, on the shared Life Regulation Lab server. The same
// handler as functions/src/speech.ts; who is asking and whether they have Plus are answered here.
// The voice key is a function secret (ELEVENLABS_API_KEY, the one Picture Talk and Mull use).
// Nothing is stored.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleSpeech, VOICE_DIRECTION } from './speech.ts';

/** Alex Bennett, calm British narration. */
const VOICE_ID = 'tw43HEeA0n5kOjSqCFT9';
const SPEECH_MODEL = 'eleven_v3';
const DEFAULT_ORIGINS = 'https://dealt-with-lrl.web.app,https://dealt-with-lrl.firebaseapp.com,capacitor://localhost';

Deno.serve((req: Request) => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    db: { schema: 'dealt_with' },
    auth: { persistSession: false },
  });
  return handleSpeech(req, {
    // On unless switched off with DEALT_WITH_VOICE_ON=false. Only people with Plus get the voice.
    on: Deno.env.get('DEALT_WITH_VOICE_ON') ?? 'true',
    origins: (Deno.env.get('DEALT_WITH_ORIGINS') ?? DEFAULT_ORIGINS).split(','),
    verifyUser: async (token) => (await admin.auth.getUser(token)).data.user?.id,
    hasPlus: async (uid) => {
      const { data } = await admin.from('plans').select('active').eq('user_id', uid).maybeSingle();
      return data?.active === true;
    },
    speak: async (text) => {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: VOICE_DIRECTION + text, model_id: SPEECH_MODEL, language_code: 'en' }),
      });
      if (!r.ok) throw new Error(`speech ${r.status}`);
      return r.arrayBuffer();
    },
  });
});
