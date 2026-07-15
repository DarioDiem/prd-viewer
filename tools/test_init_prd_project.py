#!/usr/bin/env python3
"""Regression tests for the PRD project bootstrap script."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / "tools" / "init_prd_project.py"
class InitPrdProjectTest(unittest.TestCase):
    def run_init(self, target_dir: Path, *extra_args: str) -> subprocess.CompletedProcess[str]:
        metrics_path = target_dir.parent / "init.metrics.jsonl"
        return subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                str(target_dir),
                "--framework-root",
                str(REPO_ROOT),
                "--metrics-log",
                str(metrics_path),
                *extra_args,
            ],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )

    def test_bootstrap_creates_schema_valid_project(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            target_dir = Path(temp_dir) / "example-project"
            result = self.run_init(target_dir, "--project-name", "Example Project")
            self.assertIn("Initialized PRD project scaffold", result.stdout)

            prd_path = target_dir / "PRD.json"
            trd_path = target_dir / "TRD.md"
            config_path = target_dir / "prd.config.json"
            agents_path = target_dir / "AGENTS.md"
            registration_path = target_dir / "docs" / "mcp-registration.md"
            workflow_path = target_dir / "docs" / "delivery-workflow.md"
            metrics_dir = target_dir / ".metrics"
            metrics_log = target_dir.parent / "init.metrics.jsonl"

            self.assertTrue(prd_path.exists())
            self.assertTrue(trd_path.exists())
            self.assertTrue(config_path.exists())
            self.assertTrue(agents_path.exists())
            self.assertTrue(registration_path.exists())
            self.assertTrue(workflow_path.exists())
            self.assertTrue((metrics_dir / ".gitkeep").exists())
            self.assertTrue(metrics_log.exists())
            self.assertTrue((target_dir / "schema.strict.json").exists())
            self.assertTrue((target_dir / "schema.json").exists())
            self.assertTrue((target_dir / "schema.versions.json").exists())
            self.assertTrue((target_dir / "tools" / "prd_metrics.py").exists())
            self.assertTrue((target_dir / "tools" / "prd_schema_compat.py").exists())
            self.assertTrue((target_dir / "tools" / "prd_extractor.py").exists())
            self.assertTrue((target_dir / "tools" / "requirements-prd-validation.txt").exists())
            self.assertFalse((target_dir / "tools" / "prd_toon_roundtrip.py").exists())
            self.assertFalse((target_dir / ".agents").exists())
            self.assertFalse((target_dir / ".codex" / "agents").exists())
            self.assertFalse((target_dir / ".gemini" / "agents").exists())

            prd = json.loads(prd_path.read_text(encoding="utf-8"))
            config = json.loads(config_path.read_text(encoding="utf-8"))

            self.assertEqual(prd["meta"]["product_name"], "Example Project")
            self.assertEqual(prd["meta"]["schema_contract"]["schema_version"], "1.2.0")
            trd = trd_path.read_text(encoding="utf-8")
            self.assertIn(f"linked_prd_id: {prd['meta']['prd_id']}", trd)
            self.assertIn("linked_req_ids:\n  - FR-001\n  - NFR-001", trd)
            self.assertIn("```mermaid", trd)
            self.assertEqual(config["project"]["id"], "example-project")
            self.assertEqual(config["mcp"]["transport"], "stdio")
            self.assertEqual(
                prd["project_tracking"]["pending_work"][1]["title"],
                "Install the PRD Context plugin for this project",
            )
            self.assertEqual(
                prd["project_tracking"]["pending_work"][0]["external_refs"],
                [],
            )
            self.assertEqual(
                prd["project_tracking"]["notes"][0]["external_refs"],
                [],
            )
            self.assertIn("search_prd", agents_path.read_text(encoding="utf-8"))
            self.assertIn("tools/prd_schema_compat.py PRD.json --stats-json", agents_path.read_text(encoding="utf-8"))
            self.assertIn("python3 -m pip install -r tools/requirements-prd-validation.txt", agents_path.read_text(encoding="utf-8"))
            self.assertIn("Specialist agent definitions are optional", agents_path.read_text(encoding="utf-8"))
            self.assertIn("codex plugin add prd-context@prd-local", registration_path.read_text(encoding="utf-8"))
            self.assertIn("FR/NFR -> PTW -> TRD when needed", workflow_path.read_text(encoding="utf-8"))
            self.assertIn("external_refs", workflow_path.read_text(encoding="utf-8"))

            compat = subprocess.run(
                [
                    "node",
                    "--input-type=module",
                    "-e",
                    (
                        "import { resolveConfig } from './mcp/dist/config.js';"
                        "import { PrdLoader } from './mcp/dist/prd-loader.js';"
                        f"const config = resolveConfig({{ ...process.env, PRD_PATH: {json.dumps(str(prd_path))} }});"
                        "const loader = new PrdLoader(config);"
                        "const { snapshot } = await loader.load();"
                        "console.log(JSON.stringify({"
                        "status: snapshot.status,"
                        "schema_valid: snapshot.validation.status === 'valid',"
                        "compatibility: snapshot.compatibility?.status ?? null"
                        "}, null, 2));"
                        "if (snapshot.status !== 'valid') process.exit(1);"
                    ),
                ],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                check=True,
            )
            stats = json.loads(compat.stdout.strip())
            self.assertTrue(stats["schema_valid"])
            self.assertEqual(stats["compatibility"], "exact")

    def test_bootstrap_records_http_preferences_when_requested(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            target_dir = Path(temp_dir) / "http-project"
            self.run_init(
                target_dir,
                "--project-name",
                "HTTP Project",
                "--transport",
                "http",
                "--http-port",
                "4111",
                "--http-path",
                "/prd",
            )

            config = json.loads((target_dir / "prd.config.json").read_text(encoding="utf-8"))
            registration = (target_dir / "docs" / "mcp-registration.md").read_text(
                encoding="utf-8"
            )

            self.assertEqual(config["mcp"]["transport"], "http")
            self.assertEqual(config["mcp"]["http"]["port"], 4111)
            self.assertEqual(config["mcp"]["http"]["path"], "/prd")
            self.assertIn("http://127.0.0.1:4111/prd", registration)

    def test_bootstrap_can_include_local_agent_assets(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            target_dir = Path(temp_dir) / "agent-project"
            result = self.run_init(
                target_dir,
                "--project-name",
                "Agent Project",
                "--include-agents",
            )

            self.assertIn("Included local agent assets", result.stdout)
            self.assertTrue((target_dir / ".agents" / "prd-authoring-agent.yaml").exists())
            self.assertTrue((target_dir / ".codex" / "agents" / "prd_authoring_agent.toml").exists())
            self.assertTrue((target_dir / ".gemini" / "agents" / "prd-authoring-agent.md").exists())
            self.assertTrue(
                (
                    target_dir
                    / ".agents"
                    / "skills"
                    / "prd-development-execution"
                    / "SKILL.md"
                ).exists()
            )

            agents_text = (target_dir / "AGENTS.md").read_text(encoding="utf-8")
            gemini_text = (
                target_dir / ".gemini" / "agents" / "prd-authoring-agent.md"
            ).read_text(encoding="utf-8")
            self.assertIn("includes a curated local copy", agents_text)
            self.assertIn("Prefer the local `.agents/`, `.codex/agents/`, `.gemini/agents/`", agents_text)
            self.assertNotIn("model: gpt-5.4", gemini_text)

    def test_upgrade_can_remove_legacy_agent_assets_without_removing_custom_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            target_dir = Path(temp_dir) / "plugin-project"
            self.run_init(
                target_dir,
                "--project-name",
                "Plugin Project",
                "--include-agents",
            )
            custom_agent = target_dir / ".agents" / "custom-agent.yaml"
            custom_agent.write_text("custom: true\n", encoding="utf-8")
            custom_skill_note = (
                target_dir
                / ".agents"
                / "skills"
                / "prd-development-execution"
                / "project-note.md"
            )
            custom_skill_note.write_text("keep me\n", encoding="utf-8")

            result = self.run_init(
                target_dir,
                "--upgrade-existing",
                "--remove-legacy-agents",
            )

            self.assertIn("Removed", result.stdout)
            self.assertFalse(
                (target_dir / ".agents" / "prd-authoring-agent.yaml").exists()
            )
            self.assertFalse((target_dir / ".codex" / "agents").exists())
            self.assertFalse((target_dir / ".gemini" / "agents").exists())
            self.assertTrue(custom_agent.exists())
            self.assertTrue(custom_skill_note.exists())
            agents_text = (target_dir / "AGENTS.md").read_text(encoding="utf-8")
            self.assertIn("installed PRD Context plugin", agents_text)

            self.run_init(target_dir, "--upgrade-existing")
            self.assertFalse(
                (target_dir / ".agents" / "prd-authoring-agent.yaml").exists()
            )
            self.assertTrue(custom_agent.exists())
            self.assertTrue(custom_skill_note.exists())

    def test_remove_legacy_agents_requires_upgrade_mode(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            target_dir = Path(temp_dir) / "plugin-project"
            with self.assertRaises(subprocess.CalledProcessError) as raised:
                self.run_init(target_dir, "--remove-legacy-agents")
            self.assertIn(
                "--remove-legacy-agents requires --upgrade-existing",
                raised.exception.stderr,
            )

    def test_upgrade_existing_refreshes_framework_bundle_without_replacing_prd(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            target_dir = Path(temp_dir) / "upgrade-project"
            self.run_init(target_dir, "--project-name", "Upgrade Project")

            prd_path = target_dir / "PRD.json"
            config_path = target_dir / "prd.config.json"
            original_prd = json.loads(prd_path.read_text(encoding="utf-8"))
            original_prd["meta"]["title"] = "Custom Project PRD"
            prd_path.write_text(json.dumps(original_prd, indent=2) + "\n", encoding="utf-8")
            trd_path = target_dir / "TRD.md"
            trd_path.write_text("custom TRD\n", encoding="utf-8")

            config = json.loads(config_path.read_text(encoding="utf-8"))
            config["mcp"]["transport"] = "http"
            config["mcp"]["http"]["port"] = 4555
            config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

            result = self.run_init(target_dir, "--upgrade-existing")

            self.assertIn("Upgraded PRD project scaffold", result.stdout)
            self.assertIn("Preserved existing PRD.json", result.stdout)

            upgraded_prd = json.loads(prd_path.read_text(encoding="utf-8"))
            upgraded_config = json.loads(config_path.read_text(encoding="utf-8"))

            self.assertEqual(upgraded_prd["meta"]["title"], "Custom Project PRD")
            self.assertEqual(trd_path.read_text(encoding="utf-8"), "custom TRD\n")
            self.assertEqual(upgraded_config["mcp"]["transport"], "http")
            self.assertEqual(upgraded_config["mcp"]["http"]["port"], 4555)
            self.assertTrue((target_dir / "schema.strict.json").exists())
            self.assertTrue((target_dir / "tools" / "requirements-prd-validation.txt").exists())


if __name__ == "__main__":
    unittest.main()
