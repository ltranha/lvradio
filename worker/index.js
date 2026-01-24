import { AwsClient } from 'aws4fetch';

export default {
  async fetch(request, env) {
    // 1. Setup CORS so your website can talk to this worker
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // Change this to your specific URL later for security
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Auth-Token, Range',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

    // 2. Security Check (The Gatekeeper)
    const authToken = request.headers.get('X-Auth-Token');
    if (!authToken || authToken !== env.AUTH_TOKEN) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // 3. Connect to Backblaze
    const s3 = new AwsClient({
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APP_KEY,
      region: env.B2_REGION,
      service: 's3',
    });

    // 4. Route the request
    const url = new URL(request.url);
    const path = url.pathname;
    let key = '';

    if (path === '/db.json' || path === '/db') key = 'db.json';
    else if (path.startsWith('/music/')) key = `music/${path.replace('/music/', '')}`;
    else if (path.startsWith('/art/')) key = `art/${path.replace('/art/', '')}`;
    else return new Response('Not found', { status: 404, headers: corsHeaders });

    // 5. Fetch file from Backblaze
    // URL Format: https://<endpoint>/<bucket>/<key>
    const b2Url = `https://${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}/${key}`;

    // Forward "Range" header (Required for scrubbing audio)
    const headers = {};
    if (request.headers.has('Range')) headers['Range'] = request.headers.get('Range');

    try {
        const response = await s3.fetch(b2Url, { headers });

        if (response.status === 404) return new Response('File not found', { status: 404, headers: corsHeaders });
        if (!response.ok) return new Response('Storage Error', { status: 502, headers: corsHeaders });

        // Return file with CORS
        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([k, v]) => newResponse.headers.set(k, v));
        return newResponse;

    } catch (e) {
        return new Response('Internal Error: ' + e.message, { status: 500, headers: corsHeaders });
    }
  },
};
