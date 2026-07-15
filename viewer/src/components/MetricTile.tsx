type MetricTone = "neutral" | "warning" | "danger";

type MetricTileProps = {
  label: string;
  value: number | string;
  tone?: MetricTone;
  onActivate?: () => void;
};

export function MetricTile({ label, value, tone = "neutral", onActivate }: MetricTileProps) {
  const className = `metric-tile metric-tile--${tone}${onActivate ? " metric-tile--interactive" : ""}`;
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );

  if (onActivate) {
    return (
      <button type="button" className={className} onClick={onActivate} aria-label={`View ${label}`}>
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}
