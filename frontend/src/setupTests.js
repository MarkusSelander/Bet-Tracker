import { TextDecoder, TextEncoder } from 'util';

// jsdom in Jest 27 lacks these; React Router reads TextEncoder at import time and Recharts needs ResizeObserver.
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
