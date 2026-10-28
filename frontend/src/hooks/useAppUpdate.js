import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { App as NativeApp } from '@capacitor/app';
import { useSocket } from './useSocket';
import { isNativeApp } from '../utils/platform';
import { PRODUCTION_URL } from '../utils/appLinks.mjs';
import { canPromptUpdate, createUpdateChecker, fetchAndroidRelease, isUpdateSnoozed, readUpdateSnooze, snoozeUpdate } from '../utils/appUpdate.mjs';

const nativeInfo = () => NativeApp.getInfo();
const loadRelease = () => fetchAndroidRelease(PRODUCTION_URL);
const openRelease = (url) => window.location.assign(url); // Capacitor sends external HTTPS links to Android's browser.

export function useAppUpdate({ enabled = isNativeApp, getInfo = nativeInfo, fetchRelease = loadRelease, openDownload = openRelease } = {}) {
  const { pathname } = useLocation();
  const { connected } = useSocket();
  const [candidate, setCandidate] = useState(null);
  const [party, setParty] = useState(null);
  const [snooze, setSnooze] = useState(() => readUpdateSnooze(window.localStorage));
  const checker = useMemo(() => createUpdateChecker({ getInfo, fetchRelease }), [getInfo, fetchRelease]);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    const check = () => {
      setParty(null); // A room must sync again before an update can appear after resume.
      checker().then((release) => { if (!disposed) setCandidate({ release }); });
    };
    const phase = ({ detail }) => setParty(detail);
    window.addEventListener('storycircle:resume', check);
    window.addEventListener('storycircle:party-state', phase);
    check();
    return () => {
      disposed = true;
      window.removeEventListener('storycircle:resume', check);
      window.removeEventListener('storycircle:party-state', phase);
    };
  }, [enabled, checker]);
  useEffect(() => { setParty(null); }, [pathname]);
  useEffect(() => { if (!connected) setParty(null); }, [connected]);
  const release = candidate?.release;
  const later = useCallback(() => {
    if (release) setSnooze(snoozeUpdate(release, window.localStorage));
  }, [release]);
  const update = useCallback(() => {
    if (!release) return;
    openDownload(release.url);
    later();
  }, [release, openDownload, later]);
  return {
    release: enabled && release && !isUpdateSnoozed(release, snooze) && canPromptUpdate(pathname, party, connected) ? release : null,
    later, update,
  };
}
