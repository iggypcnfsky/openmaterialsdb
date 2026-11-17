import type { NextRequest } from 'next/server';
import { getMaterial } from '@/lib/materials';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const m = await getMaterial(slug);
  if (!m) return Response.json({ error: 'not_found', slug }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
  return Response.json(m, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } });
}
