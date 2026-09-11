"""Upgrade only The-bigfish/hiking-check main, retaining history and a backup branch.

Run --plan first. Publishing requires a working `gh auth login` and the --publish flag.
No credentials are read or printed by this script; GitHub CLI owns authentication.
"""
import argparse
import base64
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = "The-bigfish/hiking-check"
EXPECTED_HOST = "hiking-check.rweb.site"
TOP_FILES = [".gitignore", "README.md", "index.html", "package.json", "package-lock.json",
             "tsconfig.json", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
SOURCE_DIRS = [".github", "public", "src", "tests", "e2e", "docs", "scripts"]


def inventory():
    files = [ROOT / name for name in TOP_FILES]
    for name in SOURCE_DIRS:
        files.extend(p for p in (ROOT / name).rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    if (ROOT / "public/CNAME").read_text().strip() != EXPECTED_HOST:
        raise RuntimeError("Domain differs from the authorized deployment target")
    return sorted(files)


def api(path, body=None, method=None):
    command = ["gh", "api", path]
    if method:
        command += ["--method", method]
    if body is not None:
        command += ["--input", "-"]
    result = subprocess.run(command, input=json.dumps(body) if body is not None else None,
                            text=True, encoding="utf-8", capture_output=True, cwd=ROOT)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout) if result.stdout.strip() else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--plan", action="store_true")
    parser.add_argument("--base-commit", help="Reviewed full SHA; defaults to last successful publication")
    args = parser.parse_args()
    files = inventory()
    target = ROOT / ".tmp/deployment-plan.json"
    target.parent.mkdir(exist_ok=True)
    receipt_path = ROOT / ".tmp/deployment-receipt.json"
    expected = args.base_commit
    if not expected and receipt_path.exists():
        expected = json.loads(receipt_path.read_text(encoding="utf-8"))["commit"]
    if not expected or len(expected) != 40 or any(c not in "0123456789abcdef" for c in expected):
        raise RuntimeError("Supply the reviewed full --base-commit SHA before preparing a release")
    plan = {"repo": REPO, "branch": "main", "baseCommit": expected,
            "domain": EXPECTED_HOST, "files": [p.relative_to(ROOT).as_posix() for p in files]}
    target.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Prepared {len(files)} files for {REPO}, based on {expected}")
    if not args.publish:
        print("Plan only. No remote changes.")
        return
    base = api(f"repos/{REPO}/git/ref/heads/main")["object"]["sha"]
    if base != expected:
        raise RuntimeError("Remote main changed since backup; inspect and re-backup before retrying")
    pages = api(f"repos/{REPO}/pages")
    if pages.get("cname") != EXPECTED_HOST or pages.get("build_type") != "workflow":
        raise RuntimeError("GitHub Pages domain or build configuration differs from the inspected target")
    backup = f"codex/backup-pre-shanxing-{base[:12]}"
    refs = api(f"repos/{REPO}/git/matching-refs/heads/{backup}")
    if not refs:
        api(f"repos/{REPO}/git/refs", {"ref": f"refs/heads/{backup}", "sha": base}, "POST")
    elif any(r["object"]["sha"] != base for r in refs):
        raise RuntimeError("Backup branch already points to another commit")
    entries = []
    for file in files:
        data = file.read_bytes()
        entry = {"path": file.relative_to(ROOT).as_posix(), "mode": "100644", "type": "blob"}
        try:
            entry["content"] = data.decode("utf-8").replace("\r\n", "\n")
        except UnicodeDecodeError:
            entry["sha"] = api(f"repos/{REPO}/git/blobs", {"content": base64.b64encode(data).decode(), "encoding": "base64"}, "POST")["sha"]
        entries.append(entry)
    # Incremental upgrade: retain remote files outside the reviewed source inventory.
    base_tree = api(f"repos/{REPO}/git/commits/{base}")["tree"]["sha"]
    tree = api(f"repos/{REPO}/git/trees", {"base_tree": base_tree, "tree": entries}, "POST")["sha"]
    commit = api(f"repos/{REPO}/git/commits", {
        "message": "Release Shanxing 1.1: editable templates, safe packing and offline data upgrades",
        "tree": tree, "parents": [base]}, "POST")["sha"]
    # A regular fast-forward update, never a force-push.
    api(f"repos/{REPO}/git/refs/heads/main", {"sha": commit, "force": False}, "PATCH")
    receipt = {"repo": REPO, "commit": commit, "previousCommit": base,
               "backupBranch": backup, "url": f"https://{EXPECTED_HOST}/#/"}
    (ROOT / ".tmp/deployment-receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(receipt, indent=2))
    print("Commit published. Verify the GitHub Actions deployment and live site before marking complete.")


if __name__ == "__main__":
    main()
