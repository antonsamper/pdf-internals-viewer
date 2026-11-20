import { afterEach, expect, it, vi } from 'vitest';
import { PdfWorkerClient } from '../src/lib/pdf/client';
import { DocumentTransfer } from '../src/lib/pdf/document-transfer';
import { OPERATION_TIMEOUT_MS } from '../src/lib/pdf/limits';
import { PdfInspector } from '../src/lib/pdf/inspector';
import type { ParserRequest, ParserResponse } from '../src/lib/pdf/types';
// @ts-expect-error shared JavaScript fixture generator
import { minimalPdf } from '../scripts/fixtures/pdf-fixtures.mjs';

class ControlledWorker {
  static instance: ControlledWorker;
  onmessage: ((event: MessageEvent<ParserResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  requests: ParserRequest[] = [];
  terminated = false;
  constructor() { ControlledWorker.instance = this; }
  postMessage(request: ParserRequest) { this.requests.push(request); }
  terminate() { this.terminated = true; }
  respond(response: ParserResponse) { this.onmessage?.({ data: structuredClone(response) } as MessageEvent<ParserResponse>); }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('pulls the next batch only after receiving the previous one and publishes a complete document', async () => {
  vi.stubGlobal('Worker', ControlledWorker);
  const document = await new PdfInspector().open(minimalPdf().bytes);
  // Enough records to require acknowledgements, independent of string size.
  document.objects = Array.from({ length: 300 }, (_, i) => ({ ...document.objects[0], id: `${i + 1} 0`, objectNumber: i + 1 }));
  const sender = new DocumentTransfer(document);
  const client = new PdfWorkerClient();
  const opening = client.open(minimalPdf().bytes, 'test.pdf');
  const worker = ControlledWorker.instance;
  let done = false;
  let received = 0;
  while (!done) {
    expect(worker.requests).toHaveLength(received + 1);
    const request = worker.requests[received];
    expect(request.type).toBe(received ? 'open-next' : 'open');
    const batch = sender.next();
    worker.respond({ requestId: request.requestId, type: 'opened-batch', ...batch });
    received++;
    done = batch.done;
    await Promise.resolve();
  }
  expect((await opening).objects).toEqual(document.objects);
  client.dispose();
});

it('cancels between batches without requesting more data or publishing a partial graph', async () => {
  vi.stubGlobal('Worker', ControlledWorker);
  const client = new PdfWorkerClient();
  const opening = client.open(new Uint8Array([1]), 'old.pdf');
  const rejected = expect(opening).rejects.toThrow('cancelled');
  const worker = ControlledWorker.instance;
  worker.respond({ requestId: worker.requests[0].requestId, type: 'opened-batch', items: [], done: false });
  client.dispose();
  await rejected;
  expect(worker.terminated).toBe(true);
  expect(worker.requests).toHaveLength(1);
});

it('rejects errors during a subsequent batch', async () => {
  vi.stubGlobal('Worker', ControlledWorker);
  const client = new PdfWorkerClient();
  const opening = client.open(new Uint8Array([1]), 'broken.pdf');
  const rejected = expect(opening).rejects.toThrow('Transfer failed');
  const worker = ControlledWorker.instance;
  worker.respond({ requestId: worker.requests[0].requestId, type: 'opened-batch', items: [], done: false });
  await Promise.resolve();
  worker.respond({ requestId: worker.requests[1].requestId, type: 'error', error: 'Transfer failed' });
  await rejected;
  client.dispose();
});

it('terminates the worker when an acknowledgement receives no response', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('Worker', ControlledWorker);
  const client = new PdfWorkerClient();
  const opening = client.open(new Uint8Array([1]), 'stalled.pdf');
  const rejected = expect(opening).rejects.toThrow('exceeded 15 seconds');
  const worker = ControlledWorker.instance;
  worker.respond({ requestId: worker.requests[0].requestId, type: 'opened-batch', items: [], done: false });
  await Promise.resolve();
  expect(worker.requests).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(OPERATION_TIMEOUT_MS);
  await rejected;
  expect(worker.terminated).toBe(true);
});
