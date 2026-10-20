export function LogPanel({ log, players }) {
  const colors = Object.fromEntries(players.map((p) => [p.id, p.color]));
  return (
    <ol className="log" aria-live="polite">
      {[...log].reverse().map((l) => (
        <li key={l.id} className={`log-item tone-${l.tone}`}>
          <span className="dot" style={{ background: colors[l.playerId] || '#cbd5e1' }} />
          <span className="log-text">{l.text}</span>
          <span className="log-round">สัปดาห์ {l.week}</span>
        </li>
      ))}
    </ol>
  );
}
