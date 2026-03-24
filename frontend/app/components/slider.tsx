interface SliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}

export function Slider({ min, max, value, onChange, step = 1 }: SliderProps): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">Max Steps</span>
        <span className="text-2xl font-bold text-accent">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        step={step}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-accent"
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((value - min) / (max - min)) * 100}%, var(--muted) ${((value - min) / (max - min)) * 100}%, var(--muted) 100%)`,
        }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
