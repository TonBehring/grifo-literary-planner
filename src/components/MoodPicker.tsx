const MOODS = [
  { emoji: "😍", label: "Apaixonado (a)" },
  { emoji: "🥹", label: "Emocionado (a)" },
  { emoji: "🤯", label: "Impactado (a)" },
  { emoji: "😌", label: "Sereno (a)" },
  { emoji: "😴", label: "Arrastado (a)" },
  { emoji: "😤", label: "Irritado (a)" },
];

export function MoodPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (mood: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOODS.map((m) => {
        const active = value === m.label;
        return (
          <button
            key={m.label}
            type="button"
            onClick={() => onChange(active ? null : m.label)}
            className={
              "flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all " +
              (active
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/50")
            }
          >
            <span className="text-lg leading-none">{m.emoji}</span>
            {active && <span className="whitespace-nowrap">{m.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
