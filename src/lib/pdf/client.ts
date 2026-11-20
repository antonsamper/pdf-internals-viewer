import type { ParserRequest, ParserResponse, PdfDocumentInfo, StreamResult } from './types';

import { DocumentReceiver } from './document-transfer';
import { OPERATION_TIMEOUT_MS } from './limits';

/** One client per document. dispose() cancels parsing by terminating its worker. */
export class PdfWorkerClient {
  private worker = new Worker(new URL('../../workers/pdf.worker.ts', import.meta.url), { type: 'module' });
  private requestId = 0;
  private disposed = false;
  private pending = new Map<
    number,
    {
      resolve: (response: ParserResponse) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  constructor() {
    this.worker.addEventListener('message', (event: MessageEvent<ParserResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(response.requestId);
      if (response.type === 'error') pending.reject(new Error(response.error));
      else pending.resolve(response);
    });
    this.worker.addEventListener('error', (event) => {
      this.dispose(new Error(event.message || 'PDF parser worker failed.'));
    });
  }
  private request(request: ParserRequest): Promise<ParserResponse> {
    if (this.disposed) return Promise.reject(new Error('PDF inspection was cancelled.'));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => this.dispose(new Error('PDF operation exceeded 15 seconds. Original bytes are still available; try a smaller file.')),
        OPERATION_TIMEOUT_MS
      );
      this.pending.set(request.requestId, { reject, resolve, timeout });
      // Dedicated worker postMessage has no targetOrigin parameter.
      // oxlint-disable-next-line unicorn/require-post-message-target-origin
      this.worker.postMessage(request);
    });
  }
  async open(bytes: Uint8Array, filename: string, password?: string): Promise<PdfDocumentInfo> {
    const receiver = new DocumentReceiver();
    let response = await this.request({
      bytes,
      filename,
      password,
      requestId: ++this.requestId,
      type: 'open',
    });
    while (response.type === 'opened-batch') {
      receiver.accept(response.items);
      if (response.done) return receiver.finish();
      response = await this.request({
        requestId: ++this.requestId,
        type: 'open-next',
      });
    }
    throw new Error('Unexpected parser response.');
  }
  async readStream(
    objectId: string,
    mode: 'raw' | 'decoded',
    purpose: 'preview' | 'download' | 'image' | 'size' = 'preview'
  ): Promise<StreamResult> {
    const response = await this.request({
      mode,
      objectId,
      purpose,
      requestId: ++this.requestId,
      type: 'stream',
    });
    if (response.type !== 'stream') throw new Error('Unexpected parser response.');
    return response.result;
  }
  dispose(reason = new Error('PDF inspection was cancelled.')) {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.terminate();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(reason);
    }
    this.pending.clear();
  }
}
