/// <reference lib="webworker" />
import { PdfInspector } from '../lib/pdf/inspector';
import type { ParserRequest, ParserResponse } from '../lib/pdf/types';
const inspector = new PdfInspector();
self.onmessage = async (event: MessageEvent<ParserRequest>) => {
  const request = event.data;
  let response: ParserResponse;
  try {
    response = request.type === 'open'
      ? { requestId: request.requestId, type: 'opened', document: await inspector.open(request.bytes, request.filename) }
      : { requestId: request.requestId, type: 'stream', result: inspector.readStream(request.objectId, request.mode) };
  } catch (error) { response = { requestId: request.requestId, type: 'error', error: error instanceof Error ? error.message : String(error) }; }
  self.postMessage(response);
};
