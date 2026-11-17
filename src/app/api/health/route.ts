import { stats } from '@/lib/materials';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = await stats();
    return Response.json({ ok: true, ...s });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 503 });
  }
}
