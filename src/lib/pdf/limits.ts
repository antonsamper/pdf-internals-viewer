/** Limits shared by the inspector and its public reference. */
export const MAX_INPUT_BYTES = 64 * 1024 * 1024;
export const MAX_DISPLAY_BYTES = 256 * 1024;
export const MAX_OBJECTS = 100_000;
export const MAX_DECODED_BYTES = 32 * 1024 * 1024;
export const OPERATION_TIMEOUT_MS = 15_000;
/** How long page text search waits for its engine to download and start, before the search time limit begins. */
export const ENGINE_LOAD_TIMEOUT_MS = 120_000;
