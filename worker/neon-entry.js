import app from './index-neon.js';
import { Client } from '@neondatabase/serverless';
import { createPostgresD1Adapter } from './neon-adapter.js';

/** Cloudflare Worker entrypoint for Neon PostgreSQL. */
export default {
  async fetch(request, env, ctx) {
    // Requests for static assets are handled by Cloudflare's assets binding;
    // API requests only reach this entrypoint.
    if (!env.DATABASE_URL) return new Response(JSON.stringify({ error: 'DATABASE_URL is not configured' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    const client = new Client(env.DATABASE_URL);
    try {
      await client.connect();
      const adapted = { ...env, DB: createPostgresD1Adapter(client) };
      return await app.fetch(request, adapted, ctx);
    } catch (error) {
      console.error('Neon connection or API error', error);
      return new Response(JSON.stringify({ error: 'Server temporarily unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    } finally {
      // Avoid closing the connection before processing streaming responses.
      if (ctx?.waitUntil) ctx.waitUntil(client.end().catch(err => console.error('Neon close error', err)));
      else await client.end();
    }
  }
};
