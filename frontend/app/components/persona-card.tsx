interface PersonaCardProps {
  id: string;
  label: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
  icon: JSX.Element;
}

export function PersonaCard({
  id,
  label,
  description,
  isSelected,
  onClick,
  icon,
}: PersonaCardProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`w-full p-5 rounded-lg border-2 transition-all duration-200 text-left ${
        isSelected
          ? 'border-accent bg-accent/10 ring-2 ring-accent ring-offset-2'
          : 'border-border bg-card hover:border-accent hover:bg-muted'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </button>
  );
}
