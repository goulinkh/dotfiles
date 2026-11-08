"""Offline skill packaging and JavaScript syntax checks; browser checks are separate."""
from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / '.agents/skills/visual-explain'


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.inside = True

    def handle_endtag(self, tag):
        if tag == 'script':
            self.inside = False

    def handle_data(self, data):
        if self.inside:
            self.parts.append(data)


class VisualExplainTests(unittest.TestCase):
    def test_portable_frontmatter_and_bundled_resources(self):
        text = (SKILL / 'SKILL.md').read_text()
        self.assertTrue(text.startswith('---\n'))
        front = text.split('---', 2)[1]
        self.assertRegex(front, r'\nname: visual-explain\n')
        description = re.search(r'\ndescription: (.+)', front).group(1)
        self.assertLessEqual(len(description), 1024)
        for path in (
            'references/sources.md', 'references/rendering.md',
            'assets/scene.html', 'scripts/capture.mjs',
        ):
            self.assertTrue((SKILL / path).is_file(), path)

    def test_install_manifest_and_claude_alias(self):
        result = subprocess.run(
            ['bash', '-c', 'source "$1"; printf "%s\\n" "${FILES[@]}"',
             'test', str(ROOT / 'files.sh')],
            check=True, capture_output=True, text=True,
        )
        files = result.stdout.splitlines()
        for path in (
            '.agents/skills/visual-explain', '.claude/skills/visual-explain',
            '.pi/agent/prompts/visual-explain.md',
        ):
            self.assertIn(path, files)
            self.assertTrue((ROOT / path).exists())
        alias = ROOT / '.claude/skills/visual-explain'
        self.assertTrue(alias.is_symlink())
        self.assertEqual(alias.resolve(), SKILL.resolve())

    def test_prompt_dispatch_and_git_visibility(self):
        prompt = ROOT / '.pi/agent/prompts/visual-explain.md'
        text = prompt.read_text()
        self.assertIn('~/.agents/skills/visual-explain/SKILL.md', text)
        self.assertIn('${@:-', text)
        result = subprocess.run(
            ['git', 'check-ignore', str(prompt)], cwd=ROOT,
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    @unittest.skipUnless(shutil.which('node'), 'Node is needed for JS checks')
    def test_starter_and_capture_javascript_syntax(self):
        parser = Scripts()
        parser.feed((SKILL / 'assets/scene.html').read_text())
        self.assertTrue(parser.parts)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'scene.js'
            path.write_text('\n'.join(parser.parts))
            for script in (path, SKILL / 'scripts/capture.mjs'):
                result = subprocess.run(
                    ['node', '--check', str(script)], capture_output=True, text=True,
                )
                self.assertEqual(result.returncode, 0, result.stderr)

    @unittest.skipUnless(shutil.which('node'), 'Node is needed for CLI checks')
    def test_capture_usage_fails_without_installing_browser(self):
        result = subprocess.run(
            ['node', str(SKILL / 'scripts/capture.mjs')],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn('Usage:', result.stderr)


if __name__ == '__main__':
    unittest.main()
