#!/usr/bin/env python3
"""Check regex/AST TTSR fixtures with the installed OMP matcher."""

import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
RULES = ROOT / "agent" / "rules"
FIXTURES = ROOT / "rule-fixtures" / "ttsr-fixtures.json"
ENV = os.environ.copy()
ENV["PI_CODING_AGENT_DIR"] = str(ROOT / "agent")
ENV.pop("OMP_PROFILE", None)
ENV.pop("PI_PROFILE", None)


def omp_json(action, *args, snippet=None):
    result = subprocess.run(
        ["omp", "ttsr", action, "--json", *args],
        input=snippet,
        text=True,
        capture_output=True,
        cwd=ROOT,
        env=ENV,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return json.loads(result.stdout)


def main():
    fixtures = json.loads(FIXTURES.read_text())["fixtures"]
    names = {case["rule"] for case in fixtures}
    if len({case["id"] for case in fixtures}) != len(fixtures):
        raise ValueError("Duplicate fixture IDs")
    for name in names:
        kinds = {case["kind"] for case in fixtures if case["rule"] == name}
        if kinds != {"positive", "negative"}:
            raise ValueError(f"{name}: expected positive and negative fixtures")
        if not (RULES / f"{name}.md").is_file():
            raise ValueError(f"{name}: rule file does not exist")

    loaded = {
        item["name"]
        for item in omp_json("list")
        if item.get("provider") == "native"
        and not item.get("question")
        and Path(item["path"]).resolve().parent == RULES.resolve()
    }
    if loaded != names:
        raise ValueError(f"Loaded local TTSR rules {sorted(loaded)} != fixtures {sorted(names)}")

    failures = []
    for case in fixtures:
        args = ["--source", case["source"], "--path", case["path"], "--file", "-"]
        if case["source"] == "tool":
            args.extend(("--tool", case["tool"]))
        actual = {rule["name"] for rule in omp_json("test", *args, snippet=case["snippet"])["triggered"]} & loaded
        expected = {case["rule"]} if case["kind"] == "positive" else set()
        if actual != expected:
            failures.append(f"{case['id']}: expected {sorted(expected)}, got {sorted(actual)}")

    for failure in failures:
        print(f"FAIL {failure}", file=sys.stderr)
    if failures:
        return 1
    print(f"PASS {len(fixtures)} fixtures for {len(names)} local TTSR rules")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, json.JSONDecodeError, RuntimeError) as error:
        sys.exit(f"TTSR verification failed: {error}")
