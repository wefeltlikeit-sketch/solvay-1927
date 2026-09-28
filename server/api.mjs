/**
 * /api — the only server-side code.
 *
 *   GET  /api/status  → whether live rendering is configured
 *   POST /api/render  → render one archived claim as a turn of speech
 *
 * The browser never sees the API key. The model never sees anything but the
 * packet the engine prepared: one speaker, one claim, the recent transcript,
 * and the knowledge boundary. Output is validated again in the browser.
 */
import './env.mjs';
import { ROOT } from './env.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.SOLVAY_MODEL || 'claude-opus-5';
const EFFORT = process.env.SOLVAY_EFFORT || 'low';
const FALLBACKS = (process.env.SOLVAY_FALLBACKS || 'default') !== 'off';
const hasCredentials = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

function template(name) {
  return readFileSync(path.join(ROOT, 'prompts', name), 'utf8');
}

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? '').toString());
}

const SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    usedClaimIds: { type: 'array', items: { type: 'string' } },
    insufficient: { type: 'boolean' },
  },
  required: ['text', 'usedClaimIds', 'insufficient'],
  additionalProperties: false,
};

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function render(packet) {
  const system = fill(template('speaker.system.md'), packet.vars);
  const user = fill(template('speaker.user.md'), packet.vars);
  const params = {
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: SCHEMA } },
  };
  const anthropic = getClient();
  // Server-side refusal fallbacks are a Claude API beta; enabled by default for Opus/Fable models.
  const useFallbacks = FALLBACKS && /^claude-(opus|fable)/.test(MODEL);
  const response = useFallbacks
    ? await anthropic.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
    : await anthropic.messages.create(params);

  if (response.stop_reason === 'refusal') {
    return { ok: false, error: 'The model declined to render this turn.' };
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The model did not return valid JSON.' };
  }
  return { ok: true, model: response.model, ...parsed };
}

export async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/status' && req.method === 'GET') {
      return send(res, 200, { enabled: hasCredentials, provider: 'anthropic', model: MODEL, effort: EFFORT });
    }
    if (url.pathname === '/api/render' && req.method === 'POST') {
      if (!hasCredentials) return send(res, 503, { ok: false, error: 'No ANTHROPIC_API_KEY configured on the server.' });
      const packet = await readJson(req);
      return send(res, 200, await render(packet));
    }
    return send(res, 404, { ok: false, error: 'Not found' });
  } catch (err) {
    const status = err instanceof Anthropic.RateLimitError ? 429 : err instanceof Anthropic.APIError ? 502 : 500;
    return send(res, status, { ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
