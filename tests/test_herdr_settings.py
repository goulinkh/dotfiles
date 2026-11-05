"""Offline checks for platform-specific Herdr settings."""

import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]


class HerdrSettingsTests(unittest.TestCase):
    def source_for(self, platform, destination):
        return subprocess.check_output(
            [
                "bash", "-c",
                'DIR="$1"; source "$DIR/files.sh"; '
                'platform="$3"; uname() { printf "%s\\n" "$platform"; }; '
                'dotfile_source "$2"',
                "test", str(ROOT), destination, platform,
            ],
            text=True,
        ).strip()

    def test_platform_fonts(self):
        for platform, font in (("Linux", "Ubuntu Sans"), ("Darwin", "SF Pro Text")):
            with self.subTest(platform=platform):
                path = self.source_for(platform, ".config/herdr-app/settings.json")
                self.assertEqual(json.loads(Path(path).read_text())["ui_font"], font)

    def test_other_files_keep_their_sources(self):
        for platform in ("Linux", "Darwin"):
            self.assertEqual(
                self.source_for(platform, ".zlogin"), str(ROOT / ".zlogin")
            )

    def test_only_ui_font_differs(self):
        directory = ROOT / ".config/herdr-app"
        default = json.loads((directory / "settings.json").read_text())
        linux = json.loads((directory / "settings.linux.json").read_text())
        default.pop("ui_font")
        linux.pop("ui_font")
        self.assertEqual(default, linux)
