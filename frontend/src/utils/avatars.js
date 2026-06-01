export const AVATARS = [
  { id: 'cat',      emoji: '🐱', name: 'แมว',        color: '#ff9f43' },
  { id: 'dog',      emoji: '🐶', name: 'หมา',        color: '#a0522d' },
  { id: 'bear',     emoji: '🐻', name: 'หมี',        color: '#8b4513' },
  { id: 'rabbit',   emoji: '🐰', name: 'กระต่าย',     color: '#ffb3ba' },
  { id: 'fox',      emoji: '🦊', name: 'จิ้งจอก',     color: '#ff6b35' },
  { id: 'owl',      emoji: '🦉', name: 'นกฮูก',      color: '#8b6914' },
  { id: 'panda',    emoji: '🐼', name: 'แพนด้า',     color: '#2f2f2f' },
  { id: 'tiger',    emoji: '🐯', name: 'เสือ',       color: '#ff9f43' },
  { id: 'koala',    emoji: '🐨', name: 'โคอาล่า',    color: '#808080' },
  { id: 'penguin',  emoji: '🐧', name: 'เพนกวิน',    color: '#2c3e50' },
  { id: 'frog',     emoji: '🐸', name: 'กบ',        color: '#27ae60' },
  { id: 'duck',     emoji: '🦆', name: 'เป็ด',      color: '#f1c40f' },
  { id: 'lion',     emoji: '🦁', name: 'สิงโต',      color: '#e67e22' },
  { id: 'wolf',     emoji: '🐺', name: 'หมาป่า',     color: '#7f8c8d' },
  { id: 'hamster',  emoji: '🐹', name: 'แฮมสเตอร์',  color: '#e8a87c' },
];

export function getAvatar(id) {
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
}

export function getAvatarEmoji(id) {
  return getAvatar(id).emoji;
}
