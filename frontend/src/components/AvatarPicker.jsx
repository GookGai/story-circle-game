import { AVATARS } from '../utils/avatars';

export default function AvatarPicker({ selected, onSelect }) {
  return (
    <div className="avatar-grid">
      {AVATARS.map((avatar) => (
        <button
          key={avatar.id}
          type="button"
          className={`avatar-option ${selected === avatar.id ? 'selected' : ''}`}
          onClick={() => onSelect(avatar.id)}
          title={avatar.name}
        >
          <div className="avatar-option-emoji">{avatar.emoji}</div>
          <span className="avatar-option-name">{avatar.name}</span>
        </button>
      ))}
    </div>
  );
}
