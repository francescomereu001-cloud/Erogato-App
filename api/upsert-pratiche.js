import { createClient } from '@supabase/supabase-js';

function getEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSupabaseUrl(url) {
  if (!url) return '';
  return url
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/g, '');
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = normalizeSupabaseUrl(
    getEnv('SUPABASE_URL') ||
      getEnv('VITE_SUPABASE_URL') ||
      getEnv('NEXT_PUBLIC_SUPABASE_URL')
  );

  const serviceRoleKey =
    getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SECRET_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({
      error: 'Config server mancante',
      details:
        'Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY su Vercel.',
      debug: {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      },
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'Body JSON non valido' });
      return;
    }
  }

  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) {
    res.status(400).json({ error: 'Nessuna riga da salvare' });
    return;
  }

  const payloadMap = new Map();

  for (const row of rows) {
    const uniqueKey = String(row?.unique_key || '').trim();
    if (!uniqueKey) continue;

    payloadMap.set(uniqueKey, {
      unique_key: uniqueKey,
      data_liquidazione: row?.data_liquidazione || null,
      importo_finanziato: Number(row?.importo_finanziato || 0),
      prodotto: Number.isFinite(Number(row?.prodotto))
        ? Number(row?.prodotto)
        : null,
      dealer: String(row?.dealer || ''),
      subagente: String(row?.subagente || ''),
      provvigione: Number(row?.provvigione || 0),
      polizza: Number(row?.polizza || 0),
      cliente: String(row?.cliente || ''),
      codice_fiscale: String(row?.codice_fiscale || ''),
      tabella: String(row?.tabella || ''),
      numero_rate: Number(row?.numero_rate || 0),
      importo_rata: Number(row?.importo_rata || 0),
      source_file: String(row?.source_file || ''),
    });
  }

  const payload = Array.from(payloadMap.values());

  if (!payload.length) {
    res.status(400).json({
      error: 'Le righe inviate non hanno unique_key valida',
    });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let saved = 0;
    const chunks = chunkArray(payload, 100);

    for (const chunk of chunks) {
      const { error } = await supabase
        .from('pratiche')
        .upsert(chunk, {
          onConflict: 'unique_key',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('Errore upsert-pratiche chunk:', error);
        res.status(500).json({
          error: error.message || 'Errore Supabase',
          details: error,
        });
        return;
      }

      saved += chunk.length;
    }

    res.status(200).json({
      ok: true,
      saved,
      chunks: chunks.length,
    });
  } catch (error) {
    console.error('Errore funzione upsert-pratiche:', error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Errore server sconosciuto',
      details:
        error instanceof Error
          ? {
              name: error.name,
              stack: error.stack,
            }
          : null,
    });
  }
}
