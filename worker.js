/**
 * Pods fetch relay — Cloudflare Worker
 * Lets the Site Map Analysis tool crawl domains other than the one hosting it.
 *
 * Deploy: dash.cloudflare.com > Workers & Pages > Create Worker > paste this
 * > Deploy. Copy the worker URL and enter it in the tool's Advanced field as:
 *   https://YOUR-WORKER.workers.dev/?url=
 *
 * Free tier: 100,000 requests/day, far beyond what polite Pods use.
 */

const ALLOWED_ORIGINS = [
  'https://planetsocialmarketing.com',
  'https://www.planetsocialmarketing.com',
];

const MAX_BYTES = 1024 * 1024; // 1 MB per page is plenty for HTML

export default {
  async fetch(request) {
    const reqOrigin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const target = new URL(request.url).searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url=', { status: 400, headers: corsHeaders });
    }
    let t;
    try {
      t = new URL(target);
    } catch (e) {
      return new Response('Invalid URL', { status: 400, headers: corsHeaders });
    }
    if (t.protocol !== 'https:' && t.protocol !== 'http:') {
      return new Response('Only http(s)', { status: 400, headers: corsHeaders });
    }
    // Block internal/private targets
    if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|\[)/.test(t.hostname)) {
      return new Response('Blocked target', { status: 403, headers: corsHeaders });
    }

    try {
      const upstream = await fetch(t.href, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'PlanetSocial-Pods/1.0 (+https://planetsocialmarketing.com/site-map-analysis)',
          'Accept': 'text/html,application/xml',
        },
      });
      const body = (await upstream.arrayBuffer()).slice(0, MAX_BYTES);
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          'Content-Type': upstream.headers.get('Content-Type') || 'text/html',
          'Cache-Control': 'no-store',
        },
      });
    } catch (e) {
      return new Response('Fetch failed', { status: 502, headers: corsHeaders });
    }
  },
};
