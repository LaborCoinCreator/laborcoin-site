#!/usr/bin/env python3
from __future__ import annotations

from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "docs" / "CURRENT-SOURCE-MANIFEST.json"
failures: list[str] = []
warnings: list[str] = []

def fail(message: str) -> None:
    failures.append(message)

def warn(message: str) -> None:
    warnings.append(message)

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

class RefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[str] = []
        self.ids: list[str] = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ("src", "href"):
            value = attrs.get(key)
            if value:
                self.refs.append(value)
        if attrs.get("id"):
            self.ids.append(attrs["id"])

# 1. Manifest integrity and exact deployable inventory.
if not MANIFEST_PATH.is_file():
    fail("missing docs/CURRENT-SOURCE-MANIFEST.json")
    manifest = {"files": []}
else:
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"invalid current-source manifest: {exc}")
        manifest = {"files": []}

entries = manifest.get("files", [])
paths = [entry.get("path", "") for entry in entries]
if len(paths) != len(set(paths)):
    fail("current-source manifest contains duplicate paths")
for entry in entries:
    rel = entry.get("path", "")
    path = ROOT / rel
    if not path.is_file():
        fail(f"manifest file missing: {rel}")
        continue
    if path.stat().st_size != entry.get("size_bytes"):
        fail(f"manifest size mismatch: {rel}")
    if digest(path) != entry.get("sha256"):
        fail(f"manifest SHA-256 mismatch: {rel}")

# 2. Reject accidental backup/copy files and unexpected deployable source files.
ignored_parts = {".git", "docs", "scripts", "__pycache__"}
backup_patterns = [
    re.compile(r"(?:^|[-_. ])(?:copy|backup|old|temp|tmp)(?:[-_. ]|$)", re.I),
    re.compile(r"\(\d+\)"),
    re.compile(r"(?:\.bak|\.old|\.orig|\.tmp|~)$", re.I),
]
for path in ROOT.rglob("*"):
    if not path.is_file() or any(part in ignored_parts for part in path.parts):
        continue
    rel = path.relative_to(ROOT).as_posix()
    if any(pattern.search(path.name) for pattern in backup_patterns):
        fail(f"possible duplicate/backup file: {rel}")

expected_deployable = set(paths)
actual_deployable = {
    p.relative_to(ROOT).as_posix()
    for p in ROOT.rglob("*")
    if p.is_file()
    and not any(part in {".git", "docs", "scripts", "__pycache__"} for part in p.relative_to(ROOT).parts)
    and p.name not in {"README.md", ".gitignore"}
}
for extra in sorted(actual_deployable - expected_deployable):
    fail(f"uncommitted deployable file not in current-source manifest: {extra}")
for missing in sorted(expected_deployable - actual_deployable):
    fail(f"manifest path not present in deployable inventory: {missing}")

# 3. HTML local references, duplicate IDs, and required page wiring.
external_prefixes = ("http://", "https://", "mailto:", "tel:", "data:", "javascript:")
for html_path in sorted(ROOT.glob("*.html")):
    parser = RefParser()
    parser.feed(html_path.read_text(encoding="utf-8"))
    duplicates = [name for name, count in Counter(parser.ids).items() if count > 1]
    for duplicate in duplicates:
        fail(f"{html_path.name}: duplicate id={duplicate}")
    for ref in parser.refs:
        ref = ref.strip()
        if not ref or ref.startswith(("#",) + external_prefixes):
            continue
        clean = ref.split("#", 1)[0].split("?", 1)[0]
        if not clean:
            continue
        target = ROOT / clean.lstrip("/")
        if not target.exists():
            fail(f"{html_path.name}: missing local reference {ref}")

# 4. PWA manifest and PNG dimension consistency.
def png_dimensions(path: Path):
    raw = path.read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
        return None
    return int.from_bytes(raw[16:20], "big"), int.from_bytes(raw[20:24], "big")
try:
    web_manifest = json.loads(read("manifest.json"))
    for icon in web_manifest.get("icons", []):
        icon_path = ROOT / icon["src"].lstrip("/")
        if not icon_path.is_file():
            fail(f"manifest icon missing: {icon['src']}")
            continue
        dimensions = png_dimensions(icon_path)
        declared = icon.get("sizes", "")
        if dimensions and declared != "any":
            actual = f"{dimensions[0]}x{dimensions[1]}"
            if actual != declared:
                fail(f"manifest icon size mismatch for {icon['src']}: declared {declared}, actual {actual}")
except Exception as exc:
    fail(f"invalid manifest.json: {exc}")

service_worker = read("service-worker.js")
if "laborcoin-revision-7-1" not in service_worker:
    fail("service-worker cache name is not Revision 7.2")
for cached in re.findall(r'"(/[^"]+)"', service_worker):
    if cached == "/":
        continue
    if not (ROOT / cached.lstrip("/")).exists():
        fail(f"service-worker caches missing file: {cached}")

# 5. Protocol configuration and fail-closed behavior.
config = read("protocol-config.js")
for marker in [
    'release: "Revision 7.2"',
    "chainId: 137",
    "identityRegistry", "labr", "exchange", "labrv", "registration",
    "proposalTextPolicy", "governance", "daoTreasury",
    "maxWalletLabr: 10000", "maxTradeLabr: 5000",
    "tradeCooldownSeconds: 43200", "minPassportScore: 15",
]:
    if marker not in config:
        fail(f"protocol-config.js missing required marker: {marker}")
status_match = re.search(r'status:\s*"([A-Z]+)"', config)
status = status_match.group(1) if status_match else None
if status not in {"PREDEPLOYMENT", "ACTIVE"}:
    fail("protocol-config.js status must be PREDEPLOYMENT or ACTIVE")
address_block = re.search(r"addresses:\s*\{(.*?)\n\s*\},\n\s*runtimeHashes", config, re.S)
runtime_block = re.search(r"runtimeHashes:\s*\{(.*?)\n\s*\},\n\s*limits", config, re.S)
if not address_block or not runtime_block:
    fail("unable to parse protocol address/runtime blocks")
else:
    addresses = dict(re.findall(r'(\w+):\s*"([^"]*)"', address_block.group(1)))
    runtimes = dict(re.findall(r'(\w+):\s*"([^"]*)"', runtime_block.group(1)))
    seven = ["identityRegistry","labr","exchange","labrv","registration","proposalTextPolicy","governance"]
    if status == "PREDEPLOYMENT":
        for key in seven:
            if addresses.get(key) != "":
                fail(f"PREDEPLOYMENT address must be blank: {key}")
            if not str(runtimes.get(key, "")).startswith("PENDING_"):
                fail(f"PREDEPLOYMENT runtime must be pending: {key}")
    elif status == "ACTIVE":
        for key in seven + ["daoTreasury"]:
            if not re.fullmatch(r"0x[0-9a-fA-F]{40}", addresses.get(key, "")):
                fail(f"ACTIVE address invalid: {key}")
        for key in seven:
            if not re.fullmatch(r"0x[0-9a-fA-F]{64}", runtimes.get(key, "")):
                fail(f"ACTIVE runtime hash invalid: {key}")

# No obsolete deployed contract addresses may appear in executable JavaScript.
old_addresses = [
    "0x4Cf18cB39203B678f5C26f2338a10a79f9684749",
    "0x833242E933c675846D8f8982048FecA95B8e435A",
    "0xd1CD6C0B6f1F709A52908B40C07D3C54649e323C",
    "0x8238105d31F6Bb26897d8Ab270a0A521FEF03E8c",
]
for js_path in ROOT.glob("*.js"):
    source = js_path.read_text(encoding="utf-8")
    for address in old_addresses:
        if address.lower() in source.lower():
            fail(f"{js_path.name}: obsolete deployed address in executable code: {address}")

# 6. Revision 7.2 functional markers.
markers_by_file = {
    "exchange.js": ["verifyParticipant", "claimDividends", "dividendEligible", "eligibleDividendHolderCount"],
    "dao.js": ["registration.register()", "identity.verifyParticipant"],
    "governance.js": ["creationElectorateSize", "deadlineElectorateSize", "The electorate and participation target may increase"],
    "whitepaper.md": ["Revision 7.2", "equal-holder", "Identity Registry V1", "Governance V15.1"],
}
for filename, markers in markers_by_file.items():
    source = read(filename)
    for marker in markers:
        if marker not in source:
            fail(f"{filename}: missing current-build marker {marker}")

# 7. External JavaScript dependencies must be explicitly version-pinned.
for path in list(ROOT.glob("*.html")) + list(ROOT.glob("*.js")):
    source = path.read_text(encoding="utf-8")
    for url in re.findall(r'https://[^"\'\s<>]+', source):
        if any(host in url for host in ("esm.sh/", "cdn.jsdelivr.net/npm/", "cdnjs.cloudflare.com/ajax/libs/")):
            pinned = bool(
                re.search(r"@[0-9]+\.[0-9]+\.[0-9]+", url)
                or re.search(r"/ajax/libs/[^/]+/[0-9]+\.[0-9]+\.[0-9]+/", url)
            )
            if not pinned:
                fail(f"{path.name}: unpinned external JavaScript dependency: {url}")

# 8. Secret and accidental credential scan.
secret_patterns = [
    re.compile(r"\bPRIVATE_KEY\s*=", re.I),
    re.compile(r"\bSCORER_API_KEY\s*=", re.I),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
]
for path in ROOT.rglob("*"):
    if not path.is_file() or any(part in {".git", "docs", "scripts"} for part in path.relative_to(ROOT).parts):
        continue
    if path.suffix.lower() not in {".html", ".js", ".css", ".json", ".md", ".txt"}:
        continue
    source = path.read_text(encoding="utf-8", errors="ignore")
    for pattern in secret_patterns:
        if pattern.search(source):
            fail(f"possible secret-like material in {path.relative_to(ROOT).as_posix()}")

# 9. Optional Git hygiene when run inside the real repository.
if (ROOT / ".git").exists():
    try:
        result = subprocess.run(["git", "-C", str(ROOT), "diff", "--check"], capture_output=True, text=True)
        if result.returncode != 0:
            fail("git diff --check failed: " + (result.stdout + result.stderr).strip())
    except OSError:
        warn("git executable unavailable; skipped git diff --check")

if warnings:
    print("SITE VALIDATION WARNINGS")
    for item in warnings:
        print("-", item)
if failures:
    print("REVISION 7.2 SITE VALIDATION: FAIL")
    for item in failures:
        print("-", item)
    raise SystemExit(1)
print(f"REVISION 7.2 SITE VALIDATION: PASS ({len(entries)} deployable files verified)")
