import type { ParserRequest, ParserResponse } from '../lib/pdf/types';

import { DocumentTransfer } from '../lib/pdf/document-transfer';
/// <reference lib="webworker" />
import { PdfInspector } from '../lib/pdf/inspector';
const inspector = new PdfInspector();
let transfer: DocumentTransfer | undefined;
self.addEventListener('message', async (event: MessageEvent<ParserRequest>) => {
  const request = event.data;
  let response: ParserResponse;
  try {
    if (request.type === 'open') {
      transfer = undefined;
      transfer = new DocumentTransfer(await inspector.open(request.bytes, request.filename, request.password));
    }
    if (request.type === 'open' || request.type === 'open-next') {
      if (!transfer) {
        throw new Error('No document transfer is available.');
      }
      const batch = transfer.next();
      response = {
        requestId: request.requestId,
        type: 'opened-batch',
        ...batch,
      };
      if (batch.done) {
        transfer = undefined;
      }
    } else {
      response = {
        requestId: request.requestId,
        result: inspector.readStream(request.objectId, request.mode, request.purpose),
        type: 'stream',
      };
    }
  } catch (error) {
    transfer = undefined;
    response = {
      error: error instanceof Error ? error.message : String(error),
      requestId: request.requestId,
      type: 'error',
    };
  }
  // Dedicated worker postMessage has no targetOrigin parameter.
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  self.postMessage(response);
});
