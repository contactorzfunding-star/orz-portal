import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getAccountInformation, getPositions } from '@/lib/metaapi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return new Response('unauthorized', { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { accounts: { orderBy: { createdAt: 'desc' } } },
  });
  const account = user?.accounts[0];
  if (!account?.metaapiAccountId) {
    return new Response('no account', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (data: unknown) => {
        if (!open) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const loop = async () => {
        while (open) {
          try {
            const [live, positions] = await Promise.all([
              getAccountInformation(account.metaapiAccountId!, account.metaapiRegion),
              getPositions(account.metaapiAccountId!, account.metaapiRegion),
            ]);
            send({
              balance: Number(live.balance || 0),
              equity: Number(live.equity || 0),
              initial: account.initialBalance || 0,
              positions: Array.isArray(positions) ? positions : [],
            });
          } catch {
            // sigue
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      };

      loop();

      const close = () => {
        open = false;
        try { controller.close(); } catch { /* ya cerrado */ }
      };

      // @ts-expect-error abort signal
      const signal = (globalThis as { __signal?: AbortSignal }).__signal;
      if (signal) signal.addEventListener('abort', close);
    },
    cancel() {
      // el cliente se desconectó
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
