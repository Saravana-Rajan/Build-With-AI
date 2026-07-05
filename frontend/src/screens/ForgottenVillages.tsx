import Page from "../components/Page";
import StateBlock from "../components/StateBlock";
import type { SilentVillage } from "../types";

// Placeholder — real data from api.silentVillages().
const DEMO: SilentVillage[] = [];

export default function ForgottenVillages() {
  const loading = DEMO.length === 0;

  return (
    <Page
      title="Forgotten Villages"
      subtitle="Areas with high estimated need but few or no petitions — the silent constituents."
    >
      {loading ? (
        <StateBlock
          variant="loading"
          title="Scanning for silent areas…"
          detail="High need + low petition volume surfaces the places going unheard."
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Area</th>
              <th className="num">Need score</th>
              <th className="num">Petitions</th>
              <th className="num">Silent score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {DEMO.map((v) => (
              <tr key={v.area_id}>
                <td>{v.place_name}</td>
                <td className="num">{v.need_score.toFixed(1)}</td>
                <td className="num">{v.petition_count}</td>
                <td className="num">{v.silent_score.toFixed(1)}</td>
                <td>
                  {v.flagged ? (
                    <span className="chip chip--critical">Flagged</span>
                  ) : (
                    <span className="chip chip--muted">Watch</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  );
}
