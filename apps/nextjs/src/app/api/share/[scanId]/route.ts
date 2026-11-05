import { report } from '@/lib/reports';
import { errorResponse } from '@/lib/api';
export async function GET(
  _: Request,
  c: { params: Promise<{ scanId: string }> },
) {
  try {
    return Response.json(await report({ shareToken: (await c.params).scanId }));
  } catch (e) {
    return errorResponse(e);
  }
}
