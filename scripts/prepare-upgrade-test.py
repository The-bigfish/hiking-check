"""Prepare the actual deployed 1.0 sources for a same-origin browser upgrade test.

Downloads the fixed public GitHub commit, builds it with installed workspace tools,
and writes only beneath .tmp. Does not modify the user's browser data or live site.
"""
from pathlib import Path
import io
import os
import shutil
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
COMMIT = 'ac7a342e98dd4979e74d5b9da127837be96023bd'
DEST = ROOT / '.tmp/upgrade-v1-source'
DEST.mkdir(parents=True, exist_ok=True)
request = urllib.request.Request(f'https://api.github.com/repos/The-bigfish/hiking-check/zipball/{COMMIT}', headers={'User-Agent':'Shanxing-upgrade-test'})
with urllib.request.urlopen(request, timeout=60) as response:
    archive = zipfile.ZipFile(io.BytesIO(response.read()))
for entry in archive.infolist():
    relative = Path(*Path(entry.filename).parts[1:])
    if not relative.parts or entry.is_dir():
        continue
    target = (DEST / relative).resolve()
    if not target.is_relative_to(DEST.resolve()):
        raise ValueError('Unsafe archive path')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(archive.read(entry))
# Vite resolves dependencies upward through .tmp to workspace node_modules.
subprocess.run(['node', str(ROOT/'node_modules/vite/bin/vite.js'),'build','--outDir',str(ROOT/'.tmp/upgrade-v1-dist')],cwd=DEST,check=True)
env = dict(os.environ, GITHUB_SHA='v11-update-check')
subprocess.run(['node',str(ROOT/'node_modules/vite/bin/vite.js'),'build','--outDir','.tmp/upgrade-next-dist'],cwd=ROOT,env=env,check=True)
print('Prepared actual old and second current builds for e2e/upgrade.spec.ts')
