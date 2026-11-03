"""Offline checks for agent plugin pins and their update scripts.

Run with: python3 -m unittest discover -s tests
"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class AgentPluginTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.calls = self.root / "calls"
        self.env = {
            **os.environ,
            "HOME": str(self.root),
            "BUN_INSTALL": str(self.root / ".bun"),
            "PATH": f"{self.bin}{os.pathsep}{os.defpath}",
            "CALLS": str(self.calls),
            "FAIL_SPEC": "",
        }
        shutil.copy2(ROOT / "setup-omp-plugins.sh", self.root)
        self.stub(
            "omp",
            'printf "omp %s\\n" "$*" >> "$CALLS"\n'
            'if [ "$1 $2" = "plugin install" ] && [ "$3" = "$FAIL_SPEC" ]; then\n'
            "  exit 1\n"
            "fi\n"
            'if [ "$1 $2" = "plugin list" ]; then printf "● fixture@1.0.0\\n"; fi\n',
        )

    def stub(self, name, body):
        path = self.bin / name
        path.write_text("#!/bin/sh\n" + body)
        path.chmod(0o755)

    def run_script(self, script):
        return subprocess.run(
            ["bash", str(self.root / script)],
            env=self.env,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_git_refs_survive_comments_and_missing_final_newline(self):
        pin = "github:someone/plugin#" + "a" * 40
        (self.root / "omp-plugins.txt").write_text(
            "# full-line comment\n  # indented comment\n\n"
            "github:goulinkh/owned\n"
            f"  {pin} \t# inline comment\n"
            "@scope/plugin@1.2.3"
        )
        result = self.run_script("setup-omp-plugins.sh")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            self.calls.read_text().splitlines(),
            [
                "omp plugin install github:goulinkh/owned",
                f"omp plugin install {pin}",
                "omp plugin install @scope/plugin@1.2.3",
                "omp plugin list",
            ],
        )

    def test_failed_install_does_not_skip_remaining_plugins(self):
        (self.root / "omp-plugins.txt").write_text("broken@1.0.0\ngood@2.0.0\n")
        self.env["FAIL_SPEC"] = "broken@1.0.0"
        result = self.run_script("setup-omp-plugins.sh")
        self.assertEqual(result.returncode, 1)
        self.assertIn("broken@1.0.0 FAILED", result.stderr)
        self.assertIn("omp plugin install good@2.0.0", self.calls.read_text())

    def test_update_loop_reconciles_specs_instead_of_bulk_upgrading(self):
        packages = self.root / "packages"
        packages.mkdir()
        shutil.copy2(ROOT / "packages/update.sh", packages)
        shutil.copy2(ROOT / "omp-plugins.txt", self.root)
        for name in ("rex.sh", "herdr.sh", "sf-pro.sh"):
            (packages / name).write_text("#!/bin/sh\nexit 0\n")
        self.stub("uname", "echo TestOS\n")
        for name in ("mise", "bun", "pi"):
            self.stub(name, f'printf "{name} %s\\n" "$*" >> "$CALLS"\n')
        result = self.run_script("packages/update.sh")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.calls.read_text().splitlines()
        self.assertIn("omp update", calls)
        self.assertNotIn("omp update --plugins", calls)
        self.assertIn("pi update --extensions", calls)
        specs = [
            line.strip()
            for line in (ROOT / "omp-plugins.txt").read_text().splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]
        for spec in specs:
            self.assertIn(f"omp plugin install {spec}", calls)

    def test_third_party_packages_are_pinned_and_owned_projects_float(self):
        settings = json.loads((ROOT / ".pi/agent/settings.json").read_text())
        for source in settings["packages"]:
            if source.startswith("npm:"):
                self.assertRegex(source, r"@\d+\.\d+\.\d+$")
            elif source.startswith("git:github.com/goulinkh/"):
                self.assertNotIn("@", source)
            elif source.startswith("git:"):
                self.assertRegex(source, r"@[0-9a-f]{40}$")
        for line in (ROOT / "omp-plugins.txt").read_text().splitlines():
            spec = line.strip()
            if not spec or spec.startswith("#"):
                continue
            if spec.startswith("github:goulinkh/"):
                self.assertNotIn("#", spec)
            elif spec.startswith("github:"):
                self.assertRegex(spec, r"#[0-9a-f]{40}$")
            else:
                self.assertRegex(spec, r"@\d+\.\d+\.\d+$")


if __name__ == "__main__":
    unittest.main()
