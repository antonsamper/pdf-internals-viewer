/// <reference lib="webworker" />
import { PdfInspector } from '../lib/pdf/inspector';
import { DocumentTransfer } from '../lib/pdf/document-transfer';
import type { ParserRequest, ParserResponse } from '../lib/pdf/types';
const inspector = new PdfInspector();
let transfer: DocumentTransfer | undefined;
self.onmessage = async (event: MessageEvent<ParserRequest>) => {
  const request = event.data;
  let response: ParserResponse;
  try {
    if (request.type === 'open') {
      transfer = undefined;
      transfer = new DocumentTransfer(await inspector.open(request.bytes, request.filename, request.password));
    }
    if (request.type === 'open' || request.type === 'open-next') {
      if (!transfer) throw new Error('No document transfer is available.');
      const batch = transfer.next();
      response = { requestId: request.requestId, type: 'opened-batch', ...batch };
      if (batch.done) transfer = undefined;
    } else {
      response = { requestId: request.requestId, type: 'stream', result: inspector.readStream(request.objectId, request.mode, request.purpose) };
    }
  } catch (error) {
    transfer = undefined;
    response = { requestId: request.requestId, type: 'error', error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response);
};
