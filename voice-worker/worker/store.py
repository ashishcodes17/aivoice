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

    async def close(self) -> None:
        await self._http.aclose()
