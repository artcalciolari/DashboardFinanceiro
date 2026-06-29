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
            className="w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
            style={{
              backgroundColor: color,
              boxShadow: value === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
            }}
            onClick={() => onChange(color)}
            aria-label={color}
          />
        ))}
      </div>
    </div>
  );
}
