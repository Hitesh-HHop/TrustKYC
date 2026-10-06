const NODES = ["Wallet", "Document", "AI KYC", "Hash", "Sepolia", "Verified"];

/** on = number of completed nodes; flowing = a process is running toward node `on`. */
export function Pipeline({ on, flowing }: { on: number; flowing: boolean }) {
  return (
    <ol aria-label="Verification pipeline" className="pipe-col flex flex-col items-stretch gap-0 sm:flex-row sm:items-center">
      {NODES.map((n, i) => (
        <li key={n} className="flex flex-col items-center sm:flex-1 sm:flex-row">
          <span data-on={i < on} data-final={i === NODES.length - 1}
            className="pipe-node glass whitespace-nowrap rounded-xl px-3 py-2 font-mono text-[11px] font-semibold tracking-widest text-muted-foreground"
            style={{ transitionDelay: `${i * 90}ms` }}>
            {n.toUpperCase()}
          </span>
          {i < NODES.length - 1 && (
            <span data-on={i + 1 < on} data-flow={flowing && i + 1 === on}
              className="pipe-line my-1 h-5 w-0.5 rounded-full sm:mx-1 sm:my-0 sm:h-0.5 sm:w-auto sm:flex-1" />
          )}
        </li>
      ))}
    </ol>
  );
}
