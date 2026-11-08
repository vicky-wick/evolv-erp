import { currencyCompact, monthLabel } from "../lib/format";

export function MonthlyChart({
  series,
}: {
  series: { month: string; income: number; expense: number }[];
}) {
  const max = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));
  return (
    <div className="chart">
      <div className="chart-legend">
        <span><i className="dot dot-income" /> Income</span>
        <span><i className="dot dot-expense" /> Expense</span>
      </div>
      <div className="chart-bars">
        {series.map((s) => (
          <div className="chart-group" key={s.month} title={`${monthLabel(s.month)} · income ${currencyCompact(s.income)} · expense ${currencyCompact(s.expense)}`}>
            <div className="chart-pair">
              <div className="chart-bar bar-income" style={{ height: `${(s.income / max) * 100}%` }} />
              <div className="chart-bar bar-expense" style={{ height: `${(s.expense / max) * 100}%` }} />
            </div>
            <span className="chart-label">{monthLabel(s.month).slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendBars({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="trend">
      {values.map((v, i) => (
        <div className="trend-col" key={i} title={labels[i]}>
          <div className="trend-bar" style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="mini-bars">
      {values.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}
