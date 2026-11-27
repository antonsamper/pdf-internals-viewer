export const inspectionFailure = function inspectionFailure(message?: string): {
  title: string;
  explanation: string;
  suggestion: string;
} {
  if (message?.includes('exceeded 15 seconds')) {
    return {
      explanation: 'Reading the document exceeded the 15-second processing limit.',
      suggestion: 'Try a smaller document or export only the pages you want to inspect.',
      title: 'Inspection timed out',
    };
  }
  if (message && /exceeds? .*\b(limit|budget)\b/i.test(message)) {
    return {
      explanation: 'This document exceeds a processing or memory limit in the viewer.',
      suggestion: 'Try a smaller document. The technical details below identify the limit.',
      title: 'Inspection limit reached',
    };
  }
  if (message && /worker|module|export named/i.test(message)) {
    return {
      explanation:
        'The background inspection engine could not start or stopped unexpectedly. This does not establish a problem with your PDF.',
      suggestion: 'Reload the app and reopen the file. If this persists with the bundled samples too, report the technical details below.',
      title: 'PDF inspection engine unavailable',
    };
  }
  if (message && /password required|unsupported encryption|unsupported security handler/i.test(message)) {
    return {
      explanation: 'The parser reported a password or encryption limitation.',
      suggestion: 'This encryption could not be processed. Try an unencrypted copy exported from the source application.',
      title: 'Encryption could not be opened',
    };
  }
  return {
    explanation:
      'The file may be incomplete, damaged, or use a PDF feature this viewer does not support. The parser could not determine whether it is encrypted.',
    suggestion: 'Try opening it in another PDF reader or export a fresh copy from the source application.',
    title: 'PDF structure could not be read',
  };
};
