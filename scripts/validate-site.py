from pathlib import Path
import re, sys, hashlib
ROOT=Path(__file__).resolve().parents[1]
failures=[]
def fail(x): failures.append(x)
config=(ROOT/'protocol-config.js').read_text()
for key in ['identityRegistry','labr','exchange','labrv','registration','proposalTextPolicy','governance']:
    if key not in config: fail(f'missing config key {key}')
if 'status: "PREDEPLOYMENT"' not in config: fail('site is not fail-closed PREDEPLOYMENT')
exchange=(ROOT/'exchange.js').read_text()
for marker in ['verifyParticipant','claimDividends','dividendEligible','eligibleDividendHolderCount']:
    if marker not in exchange: fail(f'exchange.js missing {marker}')
dao=(ROOT/'dao.js').read_text()
if 'registration.register()' not in dao: fail('dao.js does not call Registration V6 register()')
if 'identity.verifyParticipant' not in dao: fail('dao.js missing shared identity transaction')
for f in ROOT.glob('*.html'):
    text=f.read_text()
    for ref in re.findall(r'(?:src|href)="([^"#?]+)',text):
        if ref.startswith(('http://','https://','mailto:','data:')): continue
        target=(ROOT/ref.lstrip('/'))
        if not target.exists(): fail(f'{f.name}: missing local reference {ref}')
active_files=['index.html','exchange.html','dao.html','onboarding.html','faq.html','disclaimer.html','governance.html','exchange.js','dao.js','governance.js','protocol-config.js','README.md']
for name in active_files:
    t=(ROOT/name).read_text()
    for stale in ['Revision 6','Exchange V5','LaborCoin V2.1','Registration V5','LaborVote V8','Governance V14']:
        if stale in t: fail(f'{name}: stale active reference {stale}')
if failures:
    print('REVISION 7 SITE VALIDATION: FAIL')
    for x in failures: print('-',x)
    sys.exit(1)
print('REVISION 7 SITE VALIDATION: PASS')
