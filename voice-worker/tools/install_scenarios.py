"""Put the test scenarios into your dashboard as real agents, so you can phone yourself as them.

    cd voice-worker
    uv run python tools/install_scenarios.py            # add (or refresh) the "[Test] ..." agents
    uv run python tools/install_scenarios.py --use gym_en   # point your number at that scenario's agent
    uv run python tools/install_scenarios.py --use kumudha  # point it back at the dental demo agent
    uv run python tools/install_scenarios.py --remove   # delete the test agents again

Each agent copies the voice, model and speech settings of the Kumudha demo agent (English and Hindi
scenarios use Sarvam's Priya), with the scenario's prompt, language and opening line. Then use
"Request a call" for your number. A call is placed by the agent connected to that number, so first run
--use <scenario> (or change the agent on the Numbers page). The caller notes in
tools/scenarios.py ("caller") describe what to say to exercise each one.
"""

import argparse
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parent))

from scenarios import SCENARIOS  # noqa: E402
from simulate_call import TEMPLATE_AGENT, build_agent, rest  # noqa: E402

PREFIX = "[Test] "


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--remove", action="store_true")
    ap.add_argument("--use", help="connect your number to a scenario's test agent (or 'kumudha')")
    ap.add_argument("--tts", help="voice for every agent, e.g. smallest:zariya or sarvam:pooja")
    ap.add_argument("--llm", help="model for every agent")
    args = ap.parse_args()

    org = rest(f"agents?id=eq.{TEMPLATE_AGENT}&select=org_id")[0]["org_id"]
    if args.use:
        if args.use == "kumudha":
            target = TEMPLATE_AGENT
        elif args.use in SCENARIOS:
            found = rest(f"agents?org_id=eq.{org}&name=eq.{(PREFIX + SCENARIOS[args.use]['agent_name']).replace(' ', '%20')}&select=id")
            if not found:
                sys.exit("that test agent is not installed yet; run without --use first")
            target = found[0]["id"]
        else:
            sys.exit(f"unknown scenario {args.use!r}; choose from {', '.join(SCENARIOS)} or kumudha")
        for n in rest(f"phone_numbers?org_id=eq.{org}&select=id,did_number"):
            rest(f"phone_numbers?id=eq.{n['id']}", "PATCH", {"agent_id": target})
            print(f"number {n['did_number']} now connects to {args.use}")
        return
    for row in rest(f"agents?org_id=eq.{org}&select=id,name") or []:
        if row["name"].startswith(PREFIX):
            rest(f"agents?id=eq.{row['id']}", "DELETE")
            print("removed", row["name"])
    if args.remove:
        return
    for key, scn in SCENARIOS.items():
        agent = build_agent({**scn, "key": key, "agent_name": PREFIX + scn["agent_name"]}, org, SimpleNamespace(tts=args.tts, llm=args.llm))
        print(f"added  {agent['name']:42s} {agent['language']}  {agent['tts_provider']}:{agent['tts_voice']}  {agent['llm_model']}")
    print("\nOpen the dashboard, choose 'Request a call', pick a [Test] agent and enter your number.")


if __name__ == "__main__":
    main()
