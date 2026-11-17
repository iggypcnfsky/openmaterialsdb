import { listSources } from '@/lib/materials';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ items: await listSources() }, { headers: { 'Access-Control-Allow-Origin': '*' } });
}
