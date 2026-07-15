"""Wrapper for the TOON CLI."""

import os
import re
import shlex
import subprocess
from pathlib import Path
from typing import Any

from .exceptions import ToonCLIError


class ToonClient:
    def __init__(self, cli_path: str):
        self.cli_path = self._resolve_cli(cli_path)

    def _resolve_cli(self, command: str) -> str:
        parts = shlex.split(command)
        if len(parts) == 1:
            command_path = Path(parts[0])
            if command_path.exists() and not os.access(command_path, os.X_OK):
                raise ToonCLIError(f"TOON CLI is not executable: {command_path}")
        return command

    def run_cli(self, args: list[str]) -> subprocess.CompletedProcess[str]:
        argv = shlex.split(self.cli_path) + args
        try:
            return subprocess.run(argv, text=True, capture_output=True, check=False)
        except FileNotFoundError:
            raise ToonCLIError(f"TOON CLI not found: {self.cli_path}")

    def encode(
        self,
        input_path: Path,
        output_path: Path,
        delimiter: str = ",",
        count_tokens: bool = False,
    ) -> subprocess.CompletedProcess[str]:
        args = [
            "--encode",
            str(input_path),
            "--output",
            str(output_path),
            "--delimiter",
            self._format_delimiter(delimiter),
        ]
        if count_tokens:
            args.append("--stats")

        result = self.run_cli(args)
        if result.returncode != 0:
            raise ToonCLIError(f"TOON encode failed:\n{result.stderr or result.stdout}")
        return result

    def decode(self, input_path: Path, output_path: Path) -> subprocess.CompletedProcess[str]:
        args = ["--decode", str(input_path), "--output", str(output_path)]
        result = self.run_cli(args)
        if result.returncode != 0:
            raise ToonCLIError(f"TOON decode failed:\n{result.stderr or result.stdout}")
        return result

    @staticmethod
    def _format_delimiter(value: str) -> str:
        if value == "tab":
            return "\\t"
        if value == "pipe":
            return "|"
        return value

    @staticmethod
    def parse_token_stats(output: str) -> dict[str, Any]:
        token_match = re.search(r"~([0-9,]+)\s+\(JSON\)\s+→\s+~([0-9,]+)\s+\(TOON\)", output)
        saved_match = re.search(r"Saved\s+~([0-9,]+)\s+tokens\s+\((-?[0-9.]+)%\)", output)
        if not token_match:
            return {}

        json_tokens = int(token_match.group(1).replace(",", ""))
        toon_tokens = int(token_match.group(2).replace(",", ""))
        stats: dict[str, Any] = {
            "tokens_json_estimate": json_tokens,
            "tokens_toon_estimate": toon_tokens,
        }

        if saved_match:
            stats["tokens_saved_estimate"] = int(saved_match.group(1).replace(",", ""))
            stats["tokens_delta_percent_estimate"] = abs(float(saved_match.group(2)))
        elif json_tokens:
            stats["tokens_saved_estimate"] = json_tokens - toon_tokens
            stats["tokens_delta_percent_estimate"] = round(
                100 * (json_tokens - toon_tokens) / json_tokens, 1
            )

        return stats
