import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInstallStore, installGuide, standaloneDisplay } from '../src/utils/pwaInstall.mjs';

function browser(standalone = false) {
  const win = new EventTarget();
  const media = new EventTarget(); media.matches = standalone;
  win.navigator = {}; win.matchMedia = () => media;
  return { win, media };
}
function offer(win, outcome = 'accepted', prompt = async () => {}) {
  const event = new Event('beforeinstallprompt', {cancelable:true});
  event.prompt = prompt; event.userChoice = Promise.resolve({outcome});
  win.dispatchEvent(event); return event;
}
test('manifest launches the root web app and uses real installable, maskable-sized icons', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url)));
  assert.equal(manifest.id,'/'); assert.equal(manifest.scope,'/'); assert.equal(manifest.display,'standalone');
  assert.equal(manifest.orientation,'any'); assert.equal(manifest.prefer_related_applications,false);
  assert.equal(new URL(manifest.start_url,'https://game.example').pathname,'/');
  for (const size of [192,512]) {
    const icon=manifest.icons.find((i)=>i.sizes === `${size}x${size}`);
    assert.ok(icon);
    const png=readFileSync(new URL(`../public${icon.src}`,import.meta.url));
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16),size); assert.equal(png.readUInt32BE(20),size);
  }
  assert.ok(manifest.icons.some((i)=>i.purpose.includes('maskable')));
  assert.ok(readFileSync(new URL('../index.html',import.meta.url),'utf8').includes('rel="manifest"'));
});
test('prompt captured before subscribing is retained and called inside the click; acceptance alone is not installation', async () => {
  const {win}=browser(); const store=createInstallStore(win);
  let called=false;
  const event=offer(win,'accepted',()=>{called=true;return Promise.resolve();});
  assert.equal(event.defaultPrevented,true); assert.equal(store.getSnapshot().canPrompt,true);
  const request=store.install(); assert.equal(called,true); assert.equal(store.getSnapshot().busy,true);
  assert.equal(await request,'accepted'); assert.equal(store.getSnapshot().installed,false);
  assert.equal(await store.install(),'instructions');
  win.dispatchEvent(new Event('appinstalled'));
  assert.equal(store.getSnapshot().installed,true); assert.equal(await store.install(),'installed'); store.destroy();
});
test('dismissed and unavailable prompts show instructions without claiming an installation', async () => {
  const {win}=browser(); const store=createInstallStore(win);
  assert.equal(await store.install(),'instructions');
  offer(win,'dismissed'); assert.equal(await store.install(),'dismissed');
  assert.equal(store.getSnapshot().installed,false); assert.equal(await store.install(),'instructions'); store.destroy();
});
test('concurrent clicks cannot reuse a prompt and failed prompts remain recoverable', async () => {
  const {win}=browser(); const store=createInstallStore(win);
  let resolve, calls=0;
  offer(win,'accepted',()=>{calls++;return new Promise((done)=>{resolve=done;});});
  const first=store.install(); assert.equal(await store.install(),'busy'); assert.equal(calls,1);
  resolve(); await first;
  offer(win,'accepted',()=>{throw Error('not available');});
  assert.equal(await store.install(),'instructions'); assert.equal(store.getSnapshot().busy,false);
  offer(win,'dismissed'); assert.equal(await store.install(),'dismissed'); store.destroy();
});
test('standalone display and appinstalled confirm status without a permanent stored flag', async () => {
  const {win,media}=browser(); const store=createInstallStore(win);
  assert.equal(store.getSnapshot(),store.getSnapshot());
  media.matches=true;media.dispatchEvent(new Event('change'));assert.equal(store.getSnapshot().installed,true);
  store.destroy(); media.matches=false;
  const reopened=createInstallStore(win);assert.equal(reopened.getSnapshot().installed,false);reopened.destroy();
  win.navigator.standalone=true;
  const ios=createInstallStore(win);assert.equal(ios.getSnapshot().installed,true);ios.destroy();
});
test('cleanup and unsubscription release install-event listeners', () => {
  const {win}=browser(); const store=createInstallStore(win);let calls=0;
  const unsubscribe=store.subscribe(()=>{calls++;});offer(win);assert.equal(calls,1);
  unsubscribe();offer(win);assert.equal(calls,1);
  store.destroy();win.dispatchEvent(new Event('appinstalled'));assert.equal(store.getSnapshot().installed,false);
});
test('instructions cover iPhone, desktop-mode iPad, Android and embedded browsers', () => {
  assert.ok(installGuide({userAgent:'iPhone Safari'}).steps.join(' ').includes('Open as Web App'));
  assert.ok(installGuide({platform:'MacIntel',maxTouchPoints:5}).title.includes('iPad'));
  assert.ok(installGuide({userAgent:'Android Chrome'}).title.includes('Android'));
  assert.ok(installGuide({userAgent:'iPhone Line/15.0.0'}).title.includes('เบราว์เซอร์'));
  assert.ok(installGuide({userAgent:'Android; wv) Chrome'}).title.includes('เบราว์เซอร์'));
  assert.ok(installGuide({userAgent:'Windows Edg/145'}).title.includes('คอมพิวเตอร์'));
});
test('an ordinary browser fullscreen window is not reported as an installed standalone app', () => {
  assert.equal(standaloneDisplay({ navigator: {}, matchMedia: (query) => ({ matches: query.includes('fullscreen') }) }), false);
});
