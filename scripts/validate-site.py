from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
failures = []

def fail(message):
    failures.append(message)

config = (ROOT / "protocol-config.js").read_text()
for key in [
    "identityRegistry", "labr", "exchange", "labrv", "registration",
    "proposalTextPolicy", "governance",
]:
    if key not in config:
        fail(f"missing config key {key}")
if 'status: "PREDEPLOYMENT"' not in config:
    fail("site is not fail-closed PREDEPLOYMENT")
if 'release: "Revision 7.1"' not in config:
    fail("protocol config is not labeled Revision 7.1")

exchange = (ROOT / "exchange.js").read_text()
for marker in ["verifyParticipant", "claimDividends", "dividendEligible", "eligibleDividendHolderCount"]:
    if marker not in exchange:
        fail(f"exchange.js missing {marker}")

dao = (ROOT / "dao.js").read_text()
if "registration.register()" not in dao:
    fail("dao.js does not call Registration V6.1 register()")
if "identity.verifyParticipant" not in dao:
    fail("dao.js missing shared identity transaction")

governance = (ROOT / "governance.js").read_text()
for marker in [
    "creationElectorateSize",
    "deadlineElectorateSize",
    "The electorate and participation target may increase",
]:
    if marker not in governance:
        fail(f"governance.js missing {marker}")

for html_file in ROOT.glob("*.html"):
    text = html_file.read_text()
    for ref in re.findall(r'(?:src|href)="([^"#?]+)', text):
        if ref.startswith(("http://", "https://", "mailto:", "data:")):
            continue
        target = ROOT / ref.lstrip("/")
        if not target.exists():
            fail(f"{html_file.name}: missing local reference {ref}")

active_files = [
    "index.html", "exchange.html", "dao.html", "onboarding.html", "faq.html",
    "disclaimer.html", "governance.html", "exchange.js", "dao.js",
    "governance.js", "protocol-config.js", "README.md",
]
for name in active_files:
    text = (ROOT / name).read_text()
    for stale in [
        "Revision 6", "Exchange V5", "LaborCoin V2.1", "Registration V5",
        "LaborVote V8", "Governance V14", "Members joining after a proposal snapshot cannot vote",
    ]:
        if stale in text:
            fail(f"{name}: stale active reference {stale}")

if failures:
    print("REVISION 7.1 SITE VALIDATION: FAIL")
    for item in failures:
        print("-", item)
    sys.exit(1)
print("REVISION 7.1 SITE VALIDATION: PASS")
