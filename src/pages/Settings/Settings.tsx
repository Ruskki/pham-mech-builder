import './Settings.css';

interface SettingsProps {
  maxPoints: number;
  onMaxPointsChange: (n: number) => void;
  statMin: number;
  onStatMinChange: (n: number) => void;
  maxStatPoints: number;
  onMaxStatPointsChange: (n: number) => void;
}

export function Settings({ maxPoints, onMaxPointsChange, statMin, onStatMinChange, maxStatPoints, onMaxStatPointsChange }: SettingsProps) {
  return (
    <div className="settings-page">
      <h2>Settings</h2>
      <label className="settings-field">
        <span>Max Points</span>
        <input
          type="number"
          min={0}
          value={maxPoints}
          onChange={e => onMaxPointsChange(Number(e.target.value) || 0)}
        />
      </label>
      <label className="settings-field">
        <span>Stat Minimum Level</span>
        <input
          type="number"
          min={0}
          value={statMin}
          onChange={e => onStatMinChange(Number(e.target.value) || 0)}
        />
      </label>
      <label className="settings-field">
        <span>Max Stat Points (cumulative)</span>
        <input
          type="number"
          min={0}
          value={maxStatPoints}
          onChange={e => onMaxStatPointsChange(Number(e.target.value) || 0)}
        />
      </label>
    </div>
  );
}
