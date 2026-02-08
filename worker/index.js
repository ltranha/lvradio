import { AwsClient } from 'aws4fetch';

/**
 * Cloudflare Worker - Music Proxy with Caching
 *
 * This worker proxies requests to Backblaze B2 with:
 * - Authentication via X-Auth-Token header
 * - Browser caching via Cache-Control headers (reduces B2 Class B transactions)
 * - CORS support for cross-origin requests
 * - Range request support for audio streaming/seeking
 *
 * The browser will cache responses, so subsequent requests won't hit B2
 */

// Cache durations (in seconds)
const CACHE_DURATION = {
  metadata: 5 * 24 * 60 * 60,  // 5 days for db.json
  art: 30 * 24 * 60 * 60,      // 30 days for album art
  music: 30 * 24 * 60 * 60,    // 30 days for audio files
};

export default {
  async fetch(request, env, ctx) {
    // Setup CORS to allow requests between worker and web app
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://ltranha.github.io/lvradio/', // TODO: Change this to your specific URL
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Auth-Token, Range, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Parse URL and path
    const url = new URL(request.url);
    const path = url.pathname;

    // Security Check (Check Header OR Query Param for streaming)
    const authToken = request.headers.get('X-Auth-Token') || url.searchParams.get('token');
    if (!authToken || authToken !== env.AUTH_TOKEN) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Cache Logic (Check Cloudflare Edge Cache first)
    const cache = caches.default;

    // Create a cache-safe URL by removing auth tokens before using it as a cache key
    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.delete('token');
    const cacheKey = new Request(cacheUrl.toString());

    let response = await cache.match(cacheKey);
    if (response) {
        return response;
    }

    // Connect to Backblaze
    const s3 = new AwsClient({
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APP_KEY,
      region: env.B2_REGION,
      service: 's3',
    });

    // Handle PUT for db.json upload
    if (request.method === 'PUT' && (path === '/db.json' || path === '/db')) {
      return handleDbUpload(request, env, s3, corsHeaders);
    }

    // Only allow GET for other routes
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // Determine resource type and cache duration
    let key = '';
    let cacheDuration = 0;
    let contentType = 'application/octet-stream';

    if (path === '/db.json' || path === '/db') {
      key = 'db.json';
      cacheDuration = CACHE_DURATION.metadata;
      contentType = 'application/json';
    } else if (path.startsWith('/music/')) {
      key = `music/${decodeURIComponent(path.replace('/music/', ''))}`;
      cacheDuration = CACHE_DURATION.music;
      contentType = 'audio/mpeg';
    } else if (path.startsWith('/art/')) {
      key = `art/${decodeURIComponent(path.replace('/art/', ''))}`;
      cacheDuration = CACHE_DURATION.art;
      contentType = 'image/jpeg';
    } else {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    // Fetch file from Backblaze
    // URL Format: https://<endpoint>/<bucket>/<key>
    const b2Url = `https://${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}/${key}`;

    // For music, do not forward the Range header to B2 to avoid class B transactions
    // By fetching the full file once, Cloudflare caches the whole thing and
    // handles all future "Seeking" requests itself without asking B2 again
    const fetchHeaders = {};
    if (request.headers.has('Range') && !path.startsWith('/music/')) {
      fetchHeaders['Range'] = request.headers.get('Range');
    }

    try {
      const b2Response = await s3.fetch(b2Url, { headers: fetchHeaders });

      if (b2Response.status === 404) {
        return new Response('File not found', { status: 404, headers: corsHeaders });
      }
      if (!b2Response.ok && b2Response.status !== 206) {
        return new Response('Storage Error', { status: 502, headers: corsHeaders });
      }

      // Build response with caching headers
      const responseHeaders = new Headers();
      Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v));
      responseHeaders.set('Cache-Control', `public, max-age=${cacheDuration}`);

      const headersToForward = [
        'Content-Type',
        'Content-Length',
        'Content-Range',
        'Accept-Ranges',
        'ETag',
        'Last-Modified',
      ];

      headersToForward.forEach(header => {
        const value = b2Response.headers.get(header);
        if (value) responseHeaders.set(header, value);
      });

      if (!responseHeaders.has('Content-Type')) {
        responseHeaders.set('Content-Type', contentType);
      }

      if (key.startsWith('music/') && !responseHeaders.has('Accept-Ranges')) {
        responseHeaders.set('Accept-Ranges', 'bytes');
      }

      const newResponse = new Response(b2Response.body, {
        status: b2Response.status,
        headers: responseHeaders,
      });

      // Save to Cloudflare Edge Cache
      // We use clone() because the response body can only be read once
      ctx.waitUntil(cache.put(cacheKey, newResponse.clone()));

      return newResponse;

    } catch (e) {
      return new Response('Internal Error: ' + e.message, { status: 500, headers: corsHeaders });
    }
  },
};

/**
 * Handle db.json upload
 */
async function handleDbUpload(request, env, s3, corsHeaders) {
  try {
    const body = await request.text();

    // Validate JSON
    const parsed = JSON.parse(body);
    if (!parsed.tracks || !parsed.albums) {
      return new Response(JSON.stringify({ error: 'Invalid db.json: missing tracks or albums' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload to Backblaze
    const b2Url = `https://${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}/db.json`;
    const response = await s3.fetch(b2Url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body,
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to upload to storage' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'db.json updated successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    if (e instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: 'Invalid JSON format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Upload failed: ' + e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
