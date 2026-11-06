import Icon from "./PartyIcon";

export default function GamePicker({ games, value, onChange, disabled, label }) {
  return (
    <div className="game-choice-grid" role="group" aria-label={label}>
      {games.filter((game) => game.type !== "MIXED").map((game) => {
        const selected = value === game.type;
        return (
          <button
            type="button"
            key={game.type}
            className="game-choice"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(game.type)}
          >
            <span className="game-choice-icon"><Icon name={game.icon} size={23} /></span>
            <span className="game-choice-copy">
              <strong>{game.name}</strong>
              <small>{game.subtitle}</small>
            </span>
            {selected && <Icon name="check" size={16} className="game-choice-check" />}
          </button>
        );
      })}
    </div>
  );
}
