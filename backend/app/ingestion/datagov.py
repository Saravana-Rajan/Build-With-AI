"""data.gov.in ingestion client.

Thin, dependency-light wrapper around the data.gov.in "resource" API
(https://api.data.gov.in/resource/{resource_id}). Exposes a single
``DataGovClient`` class with helpers to fetch one page or to stream every
record for a resource via offset-based pagination.

Usage:
    from app.ingestion.datagov import DataGovClient

    client = DataGovClient()
    page = client.get_resource("<resource_id>", filters={"state_name": "Tamil Nadu"})
    for record in client.fetch_all("<resource_id>"):
        ...

The API key is read from the ``DATA_GOV_IN_API_KEY`` environment variable.
If unset, a public *sample* key is used. The sample key only returns a small
number of demo rows and is rate limited — set a real key in production.
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, Iterator, Optional

import httpx

# Public sample key published in the data.gov.in API docs. Works for a small
# number of demo rows on many resources. Do NOT rely on it in production.
SAMPLE_API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"

BASE_URL = "https://api.data.gov.in/resource"


class DataGovError(RuntimeError):
    """Base error for data.gov.in client failures."""


class DataGovAuthError(DataGovError):
    """Raised when the API key is missing/invalid (HTTP 401/403)."""


class DataGovNotFoundError(DataGovError):
    """Raised when the resource_id does not exist (HTTP 404)."""


class DataGovClient:
    """Client for the data.gov.in resource API.

    Parameters
    ----------
    api_key:
        Explicit API key. If ``None``, reads ``DATA_GOV_IN_API_KEY`` from the
        environment, falling back to the public sample key.
    timeout:
        Per-request timeout in seconds.
    max_retries:
        Number of retry attempts for transient failures (network errors and
        HTTP 429/5xx responses).
    base_url:
        Override the API base URL (useful for testing).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        base_url: str = BASE_URL,
    ) -> None:
        self.api_key = api_key or os.environ.get("DATA_GOV_IN_API_KEY") or SAMPLE_API_KEY
        self.using_sample_key = self.api_key == SAMPLE_API_KEY
        self.timeout = timeout
        self.max_retries = max_retries
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=timeout)

    # -- context manager plumbing -------------------------------------------
    def __enter__(self) -> "DataGovClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    # -- core request -------------------------------------------------------
    def get_resource(
        self,
        resource_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
        fmt: str = "json",
    ) -> Dict[str, Any]:
        """Fetch a single page of records for ``resource_id``.

        Filters are passed through as ``filters[field]=value`` query params,
        matching the data.gov.in convention.

        Returns the decoded JSON body (a dict). Raises ``DataGovAuthError`` on
        a bad key, ``DataGovNotFoundError`` on an unknown resource, and
        ``DataGovError`` on other failures.
        """
        if not resource_id:
            raise ValueError("resource_id is required")

        url = f"{self.base_url}/{resource_id}"
        params: Dict[str, Any] = {
            "api-key": self.api_key,
            "format": fmt,
            "offset": offset,
            "limit": limit,
        }
        if filters:
            for field, value in filters.items():
                params[f"filters[{field}]"] = value

        resp = self._request_with_retry(url, params)

        if fmt == "json":
            try:
                return resp.json()
            except ValueError as exc:  # pragma: no cover - defensive
                raise DataGovError(
                    f"Expected JSON but could not decode response: {resp.text[:200]}"
                ) from exc
        # Non-JSON formats (xml/csv): return the raw text wrapped in a dict.
        return {"format": fmt, "raw": resp.text}

    def _request_with_retry(self, url: str, params: Dict[str, Any]) -> httpx.Response:
        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                resp = self._client.get(url, params=params)
            except httpx.HTTPError as exc:
                last_exc = exc
                self._sleep_backoff(attempt)
                continue

            if resp.status_code in (401, 403):
                raise DataGovAuthError(
                    "data.gov.in rejected the API key (HTTP "
                    f"{resp.status_code}). Set DATA_GOV_IN_API_KEY to a valid key."
                    + (" (currently using the public sample key)" if self.using_sample_key else "")
                )
            if resp.status_code == 404:
                raise DataGovNotFoundError(
                    f"Resource not found (HTTP 404): {url}. Check the resource_id."
                )
            if resp.status_code == 429 or resp.status_code >= 500:
                # Transient: retry with backoff.
                last_exc = DataGovError(
                    f"Transient HTTP {resp.status_code} from data.gov.in"
                )
                self._sleep_backoff(attempt)
                continue

            if resp.status_code >= 400:
                raise DataGovError(
                    f"HTTP {resp.status_code} from data.gov.in: {resp.text[:200]}"
                )
            return resp

        raise DataGovError(
            f"Request failed after {self.max_retries} attempts: {last_exc}"
        )

    @staticmethod
    def _sleep_backoff(attempt: int) -> None:
        # Exponential backoff: 0.5s, 1s, 2s, ...
        time.sleep(0.5 * (2 ** (attempt - 1)))

    # -- pagination ---------------------------------------------------------
    def fetch_all(
        self,
        resource_id: str,
        filters: Optional[Dict[str, Any]] = None,
        page_size: int = 100,
    ) -> Iterator[Dict[str, Any]]:
        """Yield every record for ``resource_id``, paging by offset.

        Stops when a page returns fewer than ``page_size`` records (or none).
        """
        offset = 0
        while True:
            body = self.get_resource(
                resource_id,
                filters=filters,
                limit=page_size,
                offset=offset,
                fmt="json",
            )
            records = body.get("records") or []
            for record in records:
                yield record

            if len(records) < page_size:
                break
            offset += page_size


def _smoke_test() -> None:
    """Minimal smoke test using the public sample key.

    Run with:  python -m app.ingestion.datagov
    """
    # A commonly-available demo resource on data.gov.in. If it is retired,
    # replace it with any confirmed id from data/ingestion/resources.json.
    demo_resource_id = os.environ.get(
        "DATA_GOV_SMOKE_RESOURCE_ID",
        "9ef84268-d588-465a-a308-a864a43d0070",
    )
    print(f"Using {'SAMPLE' if DataGovClient().using_sample_key else 'ENV'} API key")
    with DataGovClient() as client:
        try:
            body = client.get_resource(demo_resource_id, limit=5)
        except DataGovError as exc:
            print(f"Smoke test request failed: {exc}")
            return

        total = body.get("total")
        records = body.get("records") or []
        print(f"resource_id : {demo_resource_id}")
        print(f"title       : {body.get('title')}")
        print(f"total rows  : {total}")
        print(f"got records : {len(records)}")
        if records:
            print("first record keys:", list(records[0].keys()))
            print("first record     :", records[0])
        else:
            print("No records returned (sample key may be rate-limited).")


if __name__ == "__main__":
    _smoke_test()
