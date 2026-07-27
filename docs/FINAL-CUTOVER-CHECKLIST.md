# Final Site Cutover Checklist

- [ ] All seven final contracts are compiled, recorded, deployed, and verified.
- [ ] Final addresses in `protocol-config.js` match deployment records exactly.
- [ ] Runtime hashes match independently read deployed runtime bytecode.
- [ ] `daoTreasury` remains the intended Aragon DAO address.
- [ ] The verifier URL reports chain 137, the exact Identity Registry, the intended verifier wallet, and the required score.
- [ ] Identity verification works from the production site.
- [ ] Buy, sell, equal-holder eligibility, dividend claim, registration, proposal creation, voting, and execution paths pass end to end.
- [ ] Wallet limit, trade limit, cooldown, identity gates, and fail-closed behavior are tested.
- [ ] `protocol-config.js` is changed from `PREDEPLOYMENT` to `ACTIVE` only after every address and runtime hash is final.
- [ ] The service-worker cache name is bumped for the activation commit so clients receive the final files.
- [ ] `python scripts\update-source-manifest.py` is run after the final approved configuration edit.
- [ ] `scripts\run-checks.cmd` passes.
- [ ] No `.env`, private key, API key, backup file, or local build artifact is committed.
- [ ] Git working tree is clean and the final commit hash is recorded.
- [ ] Netlify production deployment is tied to that exact final commit.
