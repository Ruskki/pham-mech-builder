import './Settings.css';

interface SettingsProps {
  maxPoints: number;
  onMaxPointsChange: (n: number) => void;
}

export function Settings({ maxPoints, onMaxPointsChange }: SettingsProps) {
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
    </div>
  );
}
