import type { DigestRow } from '../digest/types.js';

function markIf(condition: boolean, value: string) {
  return condition ? <span class="warn">{value}</span> : value;
}

export function DigestPage(props: { night: string; rows: DigestRow[]; malformedLines: number }) {
  const { night, rows, malformedLines } = props;

  return (
    <>
      <h1>digest · {night}</h1>
      {rows.length === 0 && malformedLines === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>job</th>
                <th>owner</th>
                <th>runs</th>
                <th>retries</th>
                <th>last status</th>
                <th>last error</th>
                <th>first time</th>
                <th>last time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr>
                  <td>{row.job}</td>
                  <td>{row.owner ?? '—'}</td>
                  <td>{row.runs}</td>
                  <td>{markIf(row.retries >= 3, String(row.retries))}</td>
                  <td>{markIf(row.lastStatus === 'fail', row.lastStatus)}</td>
                  <td>{row.lastError || '—'}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {malformedLines > 0 ? (
            <p class="mute">
              {malformedLines} malformed {malformedLines === 1 ? 'line' : 'lines'} counted
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
