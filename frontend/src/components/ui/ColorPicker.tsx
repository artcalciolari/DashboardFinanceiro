import { PRESET_COLORS } from '../../utils/formatters';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export default function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="flex flex-wrap gap-2 mt-1">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="h-7 w-7 rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            style={{
              backgroundColor: color,
              boxShadow: value === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
            }}
            onClick={() => onChange(color)}
            aria-label={`Selecionar cor ${color}`}
            aria-pressed={value === color}
          />
        ))}
      </div>
    </div>
  );
}
