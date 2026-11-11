import type { ParserRequest, ParserResponse, PdfDocumentInfo, StreamResult } from './types';

/** One client per document. dispose() cancels parsing by terminating its worker. */
export class PdfWorkerClient {
  private worker = new Worker(new URL('../../workers/pdf.worker.ts', import.meta.url), { type: 'module' });
  private requestId = 0;
  private disposed = false;
  private pending = new Map<number, { resolve: (response: ParserResponse) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>();
  constructor() {
    this.worker.onmessage = (event: MessageEvent<ParserResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(response.requestId);
      if (response.type === 'error') pending.reject(new Error(response.error)); else pending.resolve(response);
    };
    this.worker.onerror = event => { this.dispose(new Error(event.message || 'PDF parser worker failed.')); };
  }
  private request(request: ParserRequest): Promise<ParserResponse> {
    if (this.disposed) return Promise.reject(new Error('PDF inspection was cancelled.'));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => this.dispose(new Error('PDF operation exceeded 15 seconds. Original bytes are still available; try a smaller file.')), 15_000);
      this.pending.set(request.requestId, { resolve, reject, timeout });
      this.worker.postMessage(request);
    });
  }
  async open(bytes: Uint8Array, filename: string): Promise<PdfDocumentInfo> {
    const response = await this.request({ requestId: ++this.requestId, type: 'open', bytes, filename });
    if (response.type !== 'opened') throw new Error('Unexpected parser response.');
    return response.document;
  }
  async readStream(objectId: string, mode: 'raw' | 'decoded'): Promise<StreamResult> {
    const response = await this.request({ requestId: ++this.requestId, type: 'stream', objectId, mode });
    if (response.type !== 'stream') throw new Error('Unexpected parser response.');
    return response.result;
  }
  dispose(reason = new Error('PDF inspection was cancelled.')) {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.terminate();
    for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(reason); }
    this.pending.clear();
  }
}
