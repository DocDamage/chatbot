#!/usr/bin/env python3
"""Validate P00-T04 ADR structure and cross-document consistency."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

REQUIRED = [
    "## Context",
    "## Decision",
    "## Alternatives considered",
    "## Consequences",
    "## Security and data impact",
    "## Verification obligations",
    "## Unresolved assumptions",
    "## Superseded decisions",
    "## Repository evidence reviewed",
]

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--json-output")
    args = parser.parse_args()
    root = Path(args.repo_root).resolve()
    decisions = root / "docs/implementation/decisions"
    adrs = sorted(decisions.glob("ADR-*.md"))
    failures: list[str] = []
    report: dict[str, object] = {"adrCount": len(adrs), "files": {}}

    expected = [f"ADR-{n:04d}" for n in range(1, 11)]
    actual = [p.name.split("-", 2)[0] + "-" + p.name.split("-", 2)[1] for p in adrs]
    if actual != expected:
        failures.append(f"ADR sequence mismatch: expected {expected}, got {actual}")

    for path in adrs:
        text = path.read_text(encoding="utf-8")
        lines = text.splitlines()
        missing = [section for section in REQUIRED if section not in text]
        checks = {
            "accepted": "- **Status:** Accepted" in text,
            "task": "- **Authorized task:** `P00-T04`" in text,
            "baseline": "4b10a434f5b60216608da74303d4193bc289e372" in text,
            "under300Lines": len(lines) < 300,
            "missingSections": missing,
        }
        report["files"][path.name] = {"lines": len(lines), **checks}
        if not checks["accepted"]:
            failures.append(f"{path.name}: status is not Accepted")
        if not checks["task"]:
            failures.append(f"{path.name}: missing P00-T04 task metadata")
        if not checks["baseline"]:
            failures.append(f"{path.name}: missing decision baseline")
        if not checks["under300Lines"]:
            failures.append(f"{path.name}: exceeds 299 lines")
        if missing:
            failures.append(f"{path.name}: missing sections {missing}")

    readme = (decisions / "README.md").read_text(encoding="utf-8")
    for path in adrs:
        if path.name not in readme:
            failures.append(f"README missing link for {path.name}")

    deployment = (root / "docs/DEPLOYMENT_MODES.md").read_text(encoding="utf-8")
    assertions = {
        "hostedProfile": "`HOSTED`" in deployment,
        "localProfile": "`LOCAL_TRUSTED`" in deployment,
        "postgresqlHosted": "private PostgreSQL 16+" in deployment,
        "pagesStaticDemo": "optional static demonstration only" in deployment,
        "openAiOllamaTargets": "OpenAI for `HOSTED`; Ollama for `LOCAL_TRUSTED`" in deployment,
        "localExcludedFromHosted": "excluded from `HOSTED`" in deployment,
        "privacyBoundary": "Routine telemetry excludes prompt, response, file, secret, and local-command content" in deployment,
    }
    report["deploymentAssertions"] = assertions
    failures.extend([f"DEPLOYMENT_MODES missing consistency assertion: {key}" for key, ok in assertions.items() if not ok])

    report["status"] = "PASS" if not failures else "FAIL"
    report["failures"] = failures
    rendered = json.dumps(report, indent=2)
    if args.json_output:
        Path(args.json_output).write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0 if not failures else 1

if __name__ == "__main__":
    raise SystemExit(main())
