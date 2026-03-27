#!/usr/bin/env python3

import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        return 0

    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        return 0

    if payload.get("type") != "agent-turn-complete":
        return 0

    cwd = payload.get("cwd")
    if not cwd:
        return 0

    repo_root = Path(__file__).resolve().parents[2]
    if Path(cwd).resolve() != repo_root:
        return 0

    subprocess.run(["pnpm", "codex:turn-check"], cwd=repo_root, check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
