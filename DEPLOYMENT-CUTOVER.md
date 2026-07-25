# Revision 7 Site Cutover

1. Populate all seven addresses and runtime hashes in `protocol-config.js`.
2. Confirm `identityRegistry`, LABR, and Exchange cross-bindings on-chain.
3. Confirm verifier `/` reports the exact Registry, chain 137, and verifier address.
4. Test identity verification from a new direct wallet.
5. Test buy, equal-holder entry, claim, sell, and eligibility exit.
6. Test Registration V6 and unchanged US Letter certificate generation.
7. Test Governance V15 reads and proposal flow.
8. Run `python scripts/validate-site.py` and JavaScript syntax checks.
9. Update service-worker cache name.
10. Change status to `ACTIVE` only in the final reviewed commit.
