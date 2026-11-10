import { Capacitor } from '@capacitor/core';
import { PRODUCTION_URL } from './appLinks.mjs';

export const isNativeApp = Capacitor.isNativePlatform();
export const publicOrigin = isNativeApp ? PRODUCTION_URL : window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');
