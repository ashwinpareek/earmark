const usd = (n: number, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(n);

// The donor receipt: one pledge, split into what paid the hospital and what was never charged.
export default function Receipt(props: { donor: string; pledged: number; paid: number; hospital: string; patient: string; currency?: string; held?: boolean; animate?: boolean }) {
  const { pledged, paid, currency = "USD" } = props;
  const never = Math.max(0, Math.round((pledged - paid) * 100) / 100);
  const pPaid = pledged ? (paid / pledged) * 100 : 0;
  return (
    <div className="receipt" aria-label={`Receipt for ${props.donor}`}>
      <div className="who">{props.donor} pledged for {props.patient}</div>
      <div className="big num">{usd(pledged, currency)}</div>
      <div className="split" role="img" aria-label={props.held ? "Held, not charged" : `${usd(paid, currency)} paid, ${usd(never, currency)} never charged`}>
        {props.held ? <span className="held" style={{ width: "100%" }} /> : (<><span className="paid" style={{ width: `${pPaid}%` }} /><span className="never" style={{ width: `${100 - pPaid}%` }} /></>)}
      </div>
      <div className="legend">
        {props.held ? (
          <div><i style={{ background: "var(--held)" }} /><span>Held on PayPal, not charged</span><b>{usd(pledged, currency)}</b></div>
        ) : (
          <>
            <div><i style={{ background: "var(--paid)" }} /><span>Paid to {props.hospital}</span><b>{usd(paid, currency)}</b></div>
            <div><i style={{ background: "var(--never-fill)" }} /><span>Never charged</span><b>{usd(never, currency)}</b></div>
          </>
        )}
      </div>
    </div>
  );
}
