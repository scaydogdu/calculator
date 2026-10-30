interface DisplayProps {
  expression: string;
  entry: string;
  error: string | null;
  busy: boolean;
}

export function Display({ expression, entry, error, busy }: DisplayProps) {
  return (
    <div className="display">
      <div className="expression" aria-label="Expression">{expression}</div>
      <output className={`value${entry.length > 12 ? ' value-long' : ''}`} aria-label="Result" aria-live="polite">{entry}</output>
      <div className="display-message">
        {error && <p className="error" role="alert">{error}</p>}
        {busy && <p className="loading">Calculating…</p>}
      </div>
    </div>
  );
}
