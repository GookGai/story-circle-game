import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as NativeApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { invitePath, PRODUCTION_URL } from '../utils/appLinks.mjs';
import { isNativeApp } from '../utils/platform';
import RoomConfirmation from './RoomConfirmation';

export default function NativeBridge() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentPath = useRef(pathname);
  const [homeConfirmation, setHomeConfirmation] = useState(false);
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => { currentPath.current = pathname; }, [pathname]);

  const retry = useCallback(async () => {
    setChecking(true);
    try {
      const result = await fetch(`${PRODUCTION_URL}/health`, { signal: AbortSignal.timeout(5000) });
      if (!result.ok) throw new Error('Unavailable');
      setOffline(false);
      window.dispatchEvent(new Event('storycircle:resume'));
    } catch {
      setOffline(true);
    } finally { setChecking(false); }
  }, []);

  useEffect(() => {
    if (!isNativeApp) return;
    let disposed = false;
    const handles = [];
    const listen = async (plugin, event, handler) => {
      const handle = await plugin.addListener(event, handler);
      if (disposed) await handle.remove();
      else handles.push(handle);
    };
    const open = (url) => {
      if (disposed) return;
      const path = invitePath(url);
      if (path && currentPath.current !== path) {
        setHomeConfirmation(false);
        navigate(path);
      }
    };
    async function start() {
      await listen(NativeApp, 'appUrlOpen', ({ url }) => open(url));
      await listen(NativeApp, 'appStateChange', ({ isActive }) => {
        if (isActive && !disposed) {
          window.dispatchEvent(new Event('storycircle:resume'));
          retry();
        }
      });
      await listen(NativeApp, 'backButton', () => {
        if (disposed) return;
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return;
        }
        if (currentPath.current.startsWith('/room/') || currentPath.current.startsWith('/game/')) {
          setHomeConfirmation(true);
        } else if (currentPath.current !== '/') navigate('/', { replace: true });
        else NativeApp.minimizeApp();
      });
      await listen(Network, 'networkStatusChange', ({ connected }) => {
        if (disposed) return;
        setOffline(!connected);
        if (connected) retry();
      });
      const status = await Network.getStatus();
      if (!disposed) {
        setOffline(!status.connected);
        if (status.connected) retry();
      }
      const launch = await NativeApp.getLaunchUrl();
      if (launch?.url) open(launch.url);
    }
    start().catch(() => { if (!disposed) setOffline(true); });
    return () => {
      disposed = true;
      handles.forEach((handle) => handle.remove());
    };
  }, [navigate, retry]);

  if (!isNativeApp) return null;
  return <>
    {offline && <aside className="native-connection" role="status">
      <span>ยังเชื่อมต่อเกมไม่ได้ · ชื่อและวงยังอยู่</span>
      <button type="button" onClick={retry} disabled={checking}>{checking ? 'กำลังเชื่อมต่อ…' : 'ลองอีกครั้ง'}</button>
    </aside>}
    {homeConfirmation && <RoomConfirmation
      title="กลับไปหน้าแรก?"
      description="วงนี้ยังอยู่ กลับเข้ามาเล่นต่อได้จากหน้าแรก"
      actionLabel="กลับหน้าแรก"
      onCancel={() => setHomeConfirmation(false)}
      onConfirm={() => { setHomeConfirmation(false); navigate('/'); }}
    />}
  </>;
}
