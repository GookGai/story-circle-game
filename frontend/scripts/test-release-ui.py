"""Black-box checks on the minified APK, without injecting a test APK into it."""
from pathlib import Path
import subprocess
import time
import xml.etree.ElementTree as ET

OUTPUT = Path('../../artifacts/screenshots')
OUTPUT.mkdir(parents=True, exist_ok=True)
COMPONENT = 'com.storycircle.game/.MainActivity'


def adb(*args):
    return subprocess.run(['adb', *args], check=True, capture_output=True).stdout


def screen():
    adb('shell', 'uiautomator', 'dump', '/sdcard/story-circle-screen.xml')
    xml = adb('shell', 'cat', '/sdcard/story-circle-screen.xml').decode()
    root = ET.fromstring(xml)
    text = '\n'.join(n.attrib.get('text', '') + ' ' + n.attrib.get('content-desc', '') for n in root.iter('node'))
    return xml, text


def wait_for(predicate, label):
    until = time.monotonic() + 35
    last = ''
    while time.monotonic() < until:
        xml, last = screen()
        if predicate(last):
            (OUTPUT / 'release-last-screen.xml').write_text(xml, encoding='utf-8')
            return
        time.sleep(1)
    raise AssertionError(f'{label}\n{last}')


def capture(name):
    (OUTPUT / name).write_bytes(adb('exec-out', 'screencap', '-p'))


adb('shell', 'am', 'force-stop', 'com.storycircle.game')
adb('shell', 'am', 'start', '-W', '-n', COMPONENT)
wait_for(lambda t: 'สร้างวงใหม่' in t and 'Android QA' in t, 'Release app opens and preserves identity across upgrade')
capture('android-release-home.png')
for code in ['AB12CD', 'EF34GH']:
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', f'storycircle://join/{code}', '-n', COMPONENT)
    wait_for(lambda t: code in t, f'Release warm invitation {code}')
capture('android-release-invitation.png')
adb('shell', 'am', 'force-stop', 'com.storycircle.game')
adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'https://striking-sparkle-production-adf7.up.railway.app/join/JK56LM', '-n', COMPONENT)
wait_for(lambda t: 'JK56LM' in t, 'Release cold invitation')
adb('shell', 'input', 'keyevent', '4')
wait_for(lambda t: 'JK56LM' not in t and 'สร้างวงใหม่' in t, 'Release native back dismisses invitation')
print('Release APK: launch, preserved identity, two warm invitations, cold invitation and native back passed')
