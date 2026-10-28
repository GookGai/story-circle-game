export function standaloneDisplay(win) {
  return win.navigator?.standalone === true || win.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches;
}

export function installGuide(nav = {}) {
  const ua = nav.userAgent || '';
  if (/FBAN|FBAV|Instagram|Line\/|; wv\)/i.test(ua)) return {
    title: 'เปิดในเบราว์เซอร์ก่อนติดตั้ง',
    steps: ['เปิดเมนูของแอปนี้ แล้วเลือกเปิดลิงก์ในเบราว์เซอร์', 'ใช้ Safari บน iPhone หรือ Chrome / Edge บน Android', 'กลับมากด “ติดตั้งเว็บแอป” อีกครั้ง'],
  };
  if (/iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return {
    title: 'เพิ่มลงหน้าจอโฮมบน iPhone / iPad',
    steps: ['เปิดหน้านี้ใน Safari แล้วแตะ แชร์ (Share)', 'เลือก เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)', 'เปิด Open as Web App ถ้ามีตัวเลือกนี้ แล้วแตะ เพิ่ม (Add)'],
  };
  if (/Android/i.test(ua)) return {
    title: 'ติดตั้งบน Android',
    steps: ['เปิดเว็บนี้ใน Chrome หรือ Edge', 'แตะเมนู ⋮ หรือ ⋯ แล้วเลือก ติดตั้งแอป หรือ เพิ่มลงในหน้าจอหลัก', 'ยืนยันติดตั้ง แล้วเปิด Story Circle จากไอคอนบนเครื่อง'],
  };
  return {
    title: 'ติดตั้งบนคอมพิวเตอร์',
    steps: ['เปิดเว็บนี้ใน Chrome หรือ Edge', 'กดไอคอนติดตั้งในแถบที่อยู่ หรือเปิดเมนูเบราว์เซอร์แล้วเลือก ติดตั้ง / Install', 'กดยืนยันเพื่อเปิด Story Circle เป็นหน้าต่างแอป'],
  };
}

export function createInstallStore(win) {
  const media = win.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)');
  let deferred = null;
  let snapshot = { installed: standaloneDisplay(win), canPrompt: false, busy: false };
  const listeners = new Set();
  const emit = (change) => { snapshot = { ...snapshot, ...change }; for (const fn of listeners) fn(); };
  const before = (event) => {
    if (snapshot.installed) return;
    event.preventDefault();
    deferred = event;
    emit({ canPrompt: true });
  };
  const installed = () => { deferred = null; emit({ installed: true, canPrompt: false }); };
  const display = () => { if (standaloneDisplay(win)) installed(); };
  win.addEventListener('beforeinstallprompt', before);
  win.addEventListener('appinstalled', installed);
  media.addEventListener('change', display);
  return {
    getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async install() {
      if (snapshot.installed) return 'installed';
      if (snapshot.busy) return 'busy';
      if (!deferred) return 'instructions';
      const event = deferred;
      deferred = null;
      emit({ busy: true, canPrompt: false });
      try {
        // Must happen in the click's activation, before awaiting any other work.
        await event.prompt();
        const choice = await event.userChoice;
        return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
      } catch { return 'instructions'; }
      finally { emit({ busy: false }); }
    },
    destroy() {
      win.removeEventListener('beforeinstallprompt', before);
      win.removeEventListener('appinstalled', installed);
      media.removeEventListener('change', display);
      listeners.clear();
    },
  };
}
