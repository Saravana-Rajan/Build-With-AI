import { useState } from "react";
import Page from "../components/Page";
import StateBlock from "../components/StateBlock";

type Tab = "A" | "B";

const MPLADS_BUDGET = 5_00_00_000; // ₹5 crore annual allocation.

export default function Act() {
  const [tab, setTab] = useState<Tab>("A");

  return (
    <Page
      title="Act"
      subtitle="Turn priorities into action: unlock entitlements (Track A) or allocate MPLADS funds (Track B)."
    >
      <div className="tabs" role="tablist" aria-label="Action track">
        <button
          role="tab"
          aria-selected={tab === "A"}
          className={tab === "A" ? "tab tab--active" : "tab"}
          onClick={() => setTab("A")}
        >
          Track A · Letters
        </button>
        <button
          role="tab"
          aria-selected={tab === "B"}
          className={tab === "B" ? "tab tab--active" : "tab"}
          onClick={() => setTab("B")}
        >
          Track B · ₹5 Cr cart
        </button>
      </div>

      {tab === "A" ? (
        <section aria-label="Track A letters">
          <p className="muted">
            Draft official letters to unlock existing entitlements (JJM, PMAY-U,
            pensions). ₹0 of MPLADS required.
          </p>
          <StateBlock
            variant="empty"
            title="No letters queued"
            detail="Selected coverage gaps will generate ready-to-sign letters here."
          />
        </section>
      ) : (
        <section aria-label="Track B cart">
          <div className="budget-bar" aria-label="MPLADS budget">
            <div className="budget-bar__meta">
              <span>MPLADS allocated</span>
              <strong>₹5.0 Cr</strong>
            </div>
            <div className="budget-bar__track">
              <div className="budget-bar__fill" style={{ width: "0%" }} />
            </div>
            <div className="budget-bar__meta">
              <span className="muted">
                ₹0 committed · ₹{MPLADS_BUDGET.toLocaleString("en-IN")} remaining
              </span>
            </div>
          </div>
          <StateBlock
            variant="empty"
            title="Cart is empty"
            detail="Add Track B projects from Priorities to allocate against the ₹5 Cr budget."
          />
        </section>
      )}
    </Page>
  );
}
