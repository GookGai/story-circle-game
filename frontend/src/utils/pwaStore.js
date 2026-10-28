import { createInstallStore } from './pwaInstall.mjs';
import { isNativeApp } from './platform';

// Eager home-page import captures the event even if React is not mounted yet.
const inactive = Object.freeze({ installed: false, canPrompt: false, busy: false });
export const pwaStore = isNativeApp ? {
  getSnapshot: () => inactive, subscribe: () => () => {}, install: async () => 'instructions',
} : createInstallStore(window);
