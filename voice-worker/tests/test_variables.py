"""{{name}} placeholders in prompts and greetings. Run: .venv/bin/python tests/test_variables.py"""
import os, sys
from datetime import datetime
from zoneinfo import ZoneInfo
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from worker.variables import fill_variables

NOW = datetime(2026, 11, 6, 15, 5, tzinfo=ZoneInfo("Asia/Kolkata"))

assert fill_variables("Hi from {{ clinic }}. Today is {{current_date}}.", {"clinic": "Sunrise"}, NOW) == "Hi from Sunrise. Today is Friday, 06 November 2026."
assert fill_variables("{{missing}} {{blank}}", {"blank": "  "}, NOW) == "{{missing}} {{blank}}"
assert fill_variables("{{current_date}}", {"current_date": "X"}, NOW) == "X"
assert fill_variables(None, {}, NOW) == ""
print("ok")
