import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PdfDocumentInfo } from '@/lib/pdf/types';

import { PdfWorkerClient } from '@/lib/pdf/client';
import { diagnosticIssue, documentIssues, type PdfIssue } from '@/lib/pdf/issues';
import { MAX_INPUT_BYTES } from '@/lib/pdf/limits';

import { EMPTY } from './types';

interface LoaderDeps {
  /** Reset every other part of the workspace; the loader resets its own state itself. */
  closeAll: () => void;
  goHome: () => void;
  loadBookmarks: (original: Uint8Array<ArrayBuffer>, isCurrent: () => boolean) => Promise<boolean>;
  setNotice: (notice: string | null) => void;
}

/** Opening, unlocking and reading from one PDF through a parser worker. */
export const useDocumentLoader = ({ closeAll, goHome, loadBookmarks, setNotice }: LoaderDeps) => {
  const client = useRef<PdfWorkerClient | null>(null);
  const requestId = useRef(0);
  const [bytes, setBytes] = useState(EMPTY);
  const [filename, setFilename] = useState('');
  const [document, setDocument] = useState<PdfDocumentInfo | null>(null);
  const [observedIssues, setObservedIssues] = useState<PdfIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [previewPassword, setPreviewPassword] = useState<string | undefined>();
  const issues = useMemo(() => [...(document ? documentIssues(document) : []), ...observedIssues], [document, observedIssues]);
  const issueSeverity: 'error' | 'warning' | undefined = issues.some((issue) => issue.severity === 'error')
    ? 'error'
    : issues.some((issue) => issue.severity === 'warning')
      ? 'warning'
      : undefined;
  useEffect(
    () => () => {
      client.current?.dispose();
    },
    []
  );

  const closeDocument = useCallback(() => {
    requestId.current++;
    client.current?.dispose();
    client.current = null;
    setBytes(EMPTY);
    setFilename('');
    setUnlocking(false);
    setUnlockError(null);
    setPreviewPassword(undefined);
    setDocument(null);
    setObservedIssues([]);
    setBusy(false);
    setError(null);
    setInspectionError(null);
  }, []);

  const readStream = useCallback(async (id: string, mode: 'raw' | 'decoded') => {
    if (!client.current) return Promise.reject(new Error('Open a PDF before reading a stream.'));
    const activeClient = client.current;
    const result = await activeClient.readStream(id, mode);
    if (result.error && activeClient === client.current) {
      const issue = diagnosticIssue(result.error, id);
      if (issue.severity === 'warning') {
        issue.title = 'Stream could not be read';
        issue.explanation =
          'The viewer could not read this stream. Inspect its dictionary and original bytes; a decoding failure alone does not establish a PDF defect.';
      }
      setObservedIssues((current) => (current.some((item) => item.id === issue.id) ? current : [...current, issue]));
    }
    return result;
  }, []);
  const extractStream = useCallback((id: string, purpose: 'download' | 'size' = 'download') => {
    if (!client.current) return Promise.reject(new Error('Open a PDF before downloading a file.'));
    return client.current.readStream(id, 'decoded', purpose);
  }, []);
  const extractImage = useCallback((id: string) => {
    if (!client.current) return Promise.reject(new Error('Open a PDF before downloading an image.'));
    return client.current.readStream(id, 'decoded', 'image');
  }, []);

  const open = async (file: File) => {
    goHome();
    closeAll();
    const token = requestId.current;
    if (file.size > MAX_INPUT_BYTES) {
      setError('This file exceeds the current 64 MiB limit. Choose a smaller PDF.');
      return;
    }
    if (!file.size) {
      setError('This file is empty. Choose a PDF with content.');
      return;
    }
    setBusy(true);
    setFilename(file.name);
    try {
      const original = new Uint8Array(await file.arrayBuffer());
      if (token !== requestId.current) return;
      setBytes(original);
      if (!(await loadBookmarks(original, () => token === requestId.current))) return;
      const worker = new PdfWorkerClient();
      client.current = worker;
      const parsed = await worker.open(original, file.name);
      if (token !== requestId.current) return;
      setDocument(parsed);
      setBusy(false);
    } catch (reason) {
      if (token !== requestId.current) return;
      const message = reason instanceof Error ? reason.message : 'Could not inspect this file. Choose another PDF.';
      setError(message);
      setInspectionError(message);
      setBusy(false);
    }
  };

  const unlock = async (password: string) => {
    if (unlocking) return;
    const token = ++requestId.current;
    setUnlocking(true);
    setUnlockError(null);
    client.current?.dispose();
    const worker = new PdfWorkerClient();
    client.current = worker;
    try {
      const parsed = await worker.open(bytes, filename, password);
      if (token !== requestId.current) return;
      setDocument(parsed);
      if (parsed.locked) setUnlockError(parsed.encryptionError ?? 'That password did not unlock this PDF. Try again.');
      else {
        setPreviewPassword(password);
        setNotice('PDF unlocked. Structure inspection is available.');
      }
    } catch (reason) {
      if (token !== requestId.current) return;
      setUnlockError(reason instanceof Error ? reason.message : 'Could not unlock this PDF.');
    } finally {
      if (token === requestId.current) setUnlocking(false);
    }
  };

  const sample = async (file: string) => {
    closeAll();
    const token = requestId.current;
    setBusy(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}samples/${file}`);
      if (!response.ok) throw new Error('The sample could not be loaded. Try opening a local PDF.');
      const data = await response.arrayBuffer();
      if (token !== requestId.current) return;
      await open(new File([data], file, { type: 'application/pdf' }));
    } catch (reason) {
      if (token === requestId.current) setError(reason instanceof Error ? reason.message : 'Could not open sample.');
    } finally {
      // oxlint-disable-next-line react-doctor/no-loading-flag-reset-outside-finally -- only the request that is still current may clear the flag; a newer open owns it otherwise.
      if (token === requestId.current) setBusy(false);
    }
  };

  return {
    busy,
    bytes,
    closeDocument,
    document,
    error,
    extractImage,
    extractStream,
    filename,
    inspectionError,
    issueSeverity,
    issues,
    open,
    previewPassword,
    readStream,
    sample,
    setError,
    unlock,
    unlockError,
    unlocking,
  };
};
