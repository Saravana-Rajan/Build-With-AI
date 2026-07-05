"""
Step 4 — deduplication & unified-issue clustering.

Solves the MP's real pain: a mailbox of 500 loose complaints is unusable. Most
are duplicates ("no water in Alandurai" said 30 different ways) and some are
astro-turf: near-identical text blasted in a short burst to fake grassroots
pressure. This module collapses the noise into a short list of *real* issues.

Pipeline
--------
1. Embed every ``raw_text`` with Gemini (``gemini-embedding-001``). If that model
   is unavailable we probe the account's embedding models and use the first that
   works; if the API is unreachable entirely we fall back to TF-IDF (sklearn).
2. Bucket complaints by ``(category, place_name)`` — two complaints are only ever
   "the same issue" if they share a category and a place.
3. Within each bucket, connect any pair with cosine similarity >= ``SIM_MERGE``
   (0.85) and take connected components. Each component = one unified issue.
4. Emit one ``unified_issues`` row per component, aggregating counts, channels,
   languages and the time window. Flag ``coordinated_flag`` when a component has
   many near-identical (sim >= ``SIM_COORDINATED`` = 0.97) reports packed into a
   short time window — the signature of a coordinated/fake campaign.

The core ``deduplicate(complaints)`` function is pure and testable; the
``__main__`` block wires it to BigQuery.
"""
from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence

from dotenv import load_dotenv

load_dotenv()

# ---- tunables ---------------------------------------------------------------
SIM_MERGE = 0.85          # cosine >= this => same underlying issue
SIM_COORDINATED = 0.97    # cosine >= this => near-identical (copy/paste)
COORD_MIN_REPORTS = 4     # need at least this many near-identical reports ...
COORD_WINDOW_HOURS = 48   # ... inside this window to call it coordinated
EMBED_MODEL = "gemini-embedding-001"


# ---- embedding backends -----------------------------------------------------
def _gemini_embeddings(texts: Sequence[str]) -> Optional[List[List[float]]]:
    """Embed texts with Gemini. Returns None if unavailable (never raises).

    Tries EMBED_MODEL first; on error, lists the account's embedding models and
    uses the first that produces a vector. The API key is never printed.
    """
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    try:
        from google import genai
    except Exception:
        return None

    client = genai.Client(api_key=key)

    def _embed_all(model: str) -> List[List[float]]:
        vecs: List[List[float]] = []
        for t in texts:
            resp = client.models.embed_content(model=model, contents=t or " ")
            emb = resp.embeddings[0]
            vecs.append(list(emb.values))
        return vecs

    # Preferred model.
    try:
        return _embed_all(EMBED_MODEL)
    except Exception as exc:
        print(f"  [embed] {EMBED_MODEL} unavailable ({type(exc).__name__}); probing alternatives")

    # Probe other embedding-capable models advertised by the account.
    try:
        candidates: List[str] = []
        for m in client.models.list():
            actions = getattr(m, "supported_actions", None) or []
            if "embedContent" in actions:
                candidates.append(m.name)
        for model in candidates:
            try:
                vecs = _embed_all(model)
                print(f"  [embed] using fallback model {model}")
                return vecs
            except Exception:
                continue
    except Exception:
        pass
    return None


def _tfidf_embeddings(texts: Sequence[str]) -> List[List[float]]:
    """Deterministic offline fallback: L2-normalised TF-IDF vectors.

    Works across languages via char n-grams (handles ta/hi/en without a
    language-specific tokenizer). Returned vectors are unit length, so a plain
    dot product equals cosine similarity — same contract as the Gemini path.
    """
    from sklearn.feature_extraction.text import TfidfVectorizer

    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1)
    mat = vec.fit_transform([t or " " for t in texts])
    import numpy as np

    dense = mat.toarray().astype(float)
    norms = np.linalg.norm(dense, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return (dense / norms).tolist()


def _embed(texts: Sequence[str]) -> List[List[float]]:
    """Return one embedding per text, preferring Gemini, else TF-IDF."""
    if not texts:
        return []
    vecs = _gemini_embeddings(texts)
    if vecs is None:
        print("  [embed] Gemini unavailable; falling back to TF-IDF cosine")
        return _tfidf_embeddings(texts)
    return vecs


# ---- math helpers -----------------------------------------------------------
def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / ((na ** 0.5) * (nb ** 0.5))


def _connected_components(n: int, edges: Sequence[tuple]) -> List[List[int]]:
    """Union-find over n nodes with the given undirected edges."""
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b in edges:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    groups: Dict[int, List[int]] = defaultdict(list)
    for i in range(n):
        groups[find(i)].append(i)
    return list(groups.values())


def _parse_dt(value) -> Optional[datetime]:
    """Coerce assorted created_at shapes into an aware datetime (UTC)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    s = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        try:
            dt = datetime.fromisoformat(s[:19])
        except ValueError:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ---- core -------------------------------------------------------------------
def deduplicate(complaints: List[dict]) -> List[dict]:
    """Cluster near-duplicate complaints into unified issues.

    Pure function: give it a list of complaint dicts (id, raw_text, place_name,
    true_category, channel, language, created_at) and it returns unified_issues
    rows. No I/O beyond the embedding call inside :func:`_embed`.
    """
    if not complaints:
        return []

    texts = [str(c.get("raw_text") or "") for c in complaints]
    embeddings = _embed(texts)

    # Bucket indices by (category, place).
    buckets: Dict[tuple, List[int]] = defaultdict(list)
    for i, c in enumerate(complaints):
        cat = c.get("true_category") or c.get("category") or "uncategorized"
        place = c.get("place_name") or "unknown"
        buckets[(str(cat), str(place))].append(i)

    unified: List[dict] = []
    issue_seq = 0

    for (cat, place), idxs in sorted(buckets.items()):
        # Local edge list: connect pairs with cosine >= SIM_MERGE.
        local = {gi: li for li, gi in enumerate(idxs)}
        edges = []
        sims: Dict[tuple, float] = {}
        for a in range(len(idxs)):
            for b in range(a + 1, len(idxs)):
                s = _cosine(embeddings[idxs[a]], embeddings[idxs[b]])
                sims[(a, b)] = s
                if s >= SIM_MERGE:
                    edges.append((a, b))

        for comp in _connected_components(len(idxs), edges):
            issue_seq += 1
            members = [complaints[idxs[li]] for li in comp]
            member_idxs = [idxs[li] for li in comp]

            channels = sorted({str(m.get("channel")) for m in members if m.get("channel")})
            languages = sorted({str(m.get("language")) for m in members if m.get("language")})
            raw_ids = [str(m.get("id")) for m in members if m.get("id") is not None]

            dts = [d for d in (_parse_dt(m.get("created_at")) for m in members) if d]
            first_seen = min(dts) if dts else None
            last_seen = max(dts) if dts else None

            # Representative sample = longest text (most descriptive).
            sample_text = max((str(m.get("raw_text") or "") for m in members), key=len, default="")

            coordinated = _is_coordinated(comp, sims, dts)

            unified.append(
                {
                    "issue_id": f"UI-{issue_seq:04d}",
                    "category": cat,
                    "place_name": place,
                    "report_count": len(members),
                    "channels": channels,
                    "languages": languages,
                    "first_seen": first_seen.isoformat() if first_seen else None,
                    "last_seen": last_seen.isoformat() if last_seen else None,
                    "sample_text": sample_text,
                    "raw_ids": raw_ids,
                    "coordinated_flag": coordinated,
                }
            )

    unified.sort(key=lambda u: u["report_count"], reverse=True)
    return unified


def _is_coordinated(comp: List[int], sims: Dict[tuple, float], dts: List[datetime]) -> bool:
    """True if many near-identical reports cluster in a short time window."""
    if len(comp) < COORD_MIN_REPORTS:
        return False
    # Count near-identical (sim >= SIM_COORDINATED) pairs within the component.
    comp_set = set(comp)
    near_identical = 0
    for (a, b), s in sims.items():
        if a in comp_set and b in comp_set and s >= SIM_COORDINATED:
            near_identical += 1
    if near_identical < COORD_MIN_REPORTS - 1:
        return False
    if len(dts) >= 2:
        span_hours = (max(dts) - min(dts)).total_seconds() / 3600.0
        return span_hours <= COORD_WINDOW_HOURS
    return True


# ---- BigQuery entrypoint ----------------------------------------------------
SOURCE_TABLE = "complaints_synthetic"
TARGET_TABLE = "unified_issues"


def _main() -> int:
    from app.store import bq

    rows = bq.query(
        "SELECT id, raw_text, place_name, urban, true_category, channel, "
        f"language, created_at FROM `{bq.PROJECT_ID}.{bq.DATASET}.{SOURCE_TABLE}`"
    )
    raw_count = len(rows)
    print(f"Pulled {raw_count} raw complaints from {SOURCE_TABLE}")

    unified = deduplicate(rows)
    unified_count = len(unified)
    duplicates_removed = raw_count - unified_count

    bq.replace_table(TARGET_TABLE, unified)
    print(f"Wrote {unified_count} rows to {TARGET_TABLE}")

    print("")
    print(f"Raw complaints : {raw_count}")
    print(f"Unified issues : {unified_count}")
    print(f"Duplicates removed (collapsed): {duplicates_removed}")

    print("")
    print("Top 5 issues by report_count:")
    for u in unified[:5]:
        flag = "  [COORDINATED]" if u["coordinated_flag"] else ""
        print(
            f"  {u['issue_id']}  x{u['report_count']:>3}  {u['category']}/{u['place_name']}"
            f"  langs={','.join(u['languages'])}{flag}"
        )
        print(f"        e.g. {u['sample_text'][:80]}")

    coordinated = [u for u in unified if u["coordinated_flag"]]
    print("")
    if coordinated:
        print(f"Coordinated / fake-campaign flags: {len(coordinated)}")
        for u in coordinated:
            print(
                f"  {u['issue_id']}  x{u['report_count']}  {u['category']}/{u['place_name']}"
                f"  window {u['first_seen']} -> {u['last_seen']}"
            )
    else:
        print("Coordinated / fake-campaign flags: none")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
