"""Supabase access for the worker, via PostgREST with the service-role key."""

import re
from datetime import datetime, timezone

import httpx

from .config import settings


def _candidates(*numbers: str | None) -> list[str]:
    """DID spellings to try: VoiceLink may send +91…, 0…, or bare digits."""
    out: list[str] = []
    for n in numbers:
        digits = re.sub(r"\D", "", n or "")
        if not digits:
            continue
        for c in (digits, digits[-10:]):
            if c not in out:
                out.append(c)
    return out


class Store:
    def __init__(self) -> None:
        key = settings.supabase_service_role_key
        self._http = httpx.AsyncClient(
            base_url=f"{settings.supabase_url}/rest/v1",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=10,
        )

    async def find_agent(self, to_number: str | None, from_number: str | None):
        """Returns (phone_number_row, direction) for whichever side is one of our DIDs."""
        for number, direction in ((to_number, "inbound"), (from_number, "outbound")):
            cands = _candidates(number)
            if not cands:
                continue
            r = await self._http.get(
                "/phone_numbers",
                params={
                    "did_number": f"in.({','.join(cands)})",
                    "select": "org_id,agent_id,agents(*)",
                    "limit": "1",
                },
            )
            r.raise_for_status()
            rows = r.json()
            if rows and rows[0].get("agents"):
                return rows[0], direction
        return None, None

    async def upsert_call(self, *, org_id, agent_id, call_sid, direction, from_number, to_number) -> str:
        r = await self._http.post(
            "/calls",
            params={"on_conflict": "voicelink_call_sid"},
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
            json={
                "org_id": org_id,
                "agent_id": agent_id,
                "voicelink_call_sid": call_sid,
                "direction": direction,
                "status": "answered",
                "from_number": from_number,
                "to_number": to_number,
                "started_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        r.raise_for_status()
        return r.json()[0]["id"]

    async def add_transcript(self, call_id: str, org_id: str, role: str, content: str) -> None:
        if not content.strip():
            return
        await self._http.post(
            "/call_transcripts",
            json={"call_id": call_id, "org_id": org_id, "role": role, "content": content},
        )

    async def save_cost(self, call_id: str, cost: dict) -> None:
        """Keep the per-call cost breakdown on the call, alongside anything else in metadata."""
        r = await self._http.get("/calls", params={"id": f"eq.{call_id}", "select": "metadata"})
        r.raise_for_status()
        existing = (r.json() or [{}])[0].get("metadata") or {}
        r = await self._http.patch("/calls", params={"id": f"eq.{call_id}"}, json={"metadata": {**existing, "cost": cost}})
        r.raise_for_status()

    async def save_metadata(self, call_id: str, key: str, value: dict) -> None:
        """Set one key of the call's metadata, keeping whatever else is there (cost, kind, ...)."""
        r = await self._http.get("/calls", params={"id": f"eq.{call_id}", "select": "metadata"})
        r.raise_for_status()
        existing = (r.json() or [{}])[0].get("metadata") or {}
        r = await self._http.patch("/calls", params={"id": f"eq.{call_id}"}, json={"metadata": {**existing, key: value}})
        r.raise_for_status()

    async def get_callback(self, call_row_id: str, org_id: str | None, agent_id: str | None):
        """The call row a dashboard callback created, plus its agent, or None if it doesn't check out.

        The ids arrive in the call's custom parameters, so confirm the row really belongs to
        that org and agent before trusting them.
        """
        r = await self._http.get(
            "/calls",
            params={"id": f"eq.{call_row_id}", "select": "id,org_id,agent_id,agents(*)", "limit": "1"},
        )
        r.raise_for_status()
        rows = r.json()
        if not rows or not rows[0].get("agents"):
            return None
        row = rows[0]
        if (org_id and row["org_id"] != org_id) or (agent_id and row["agent_id"] != agent_id):
            return None
        return row

    async def attach_call(self, call_row_id: str, call_sid: str) -> None:
        """Tie VoiceLink's call id to the row the dashboard created, so webhooks update the same row."""
        r = await self._http.patch(
            "/calls",
            params={"id": f"eq.{call_row_id}"},
            json={"voicelink_call_sid": call_sid, "status": "answered", "started_at": datetime.now(timezone.utc).isoformat()},
        )
        r.raise_for_status()

    async def close(self) -> None:
        await self._http.aclose()
