# LaborCoin Website Revision 7.2

This repository is the current predeployment LaborCoin website build for the seven-contract Revision 7.2 equal-holder architecture.

## Current authority

The root website files in this repository are the authoritative current site sources. The deployable-file hashes are recorded in `docs/CURRENT-SOURCE-MANIFEST.json`. Subsequent approved edits should be made against this build and followed by an intentional manifest update.

## Functional state

- Identity Registry V1 verification flow
- Identity-gated official buys, sells, dividend eligibility, and dividend claims
- Equal-holder dividend presentation
- Registration V6.1 using permanent Registry status
- Governance V15.1 deadline-electorate presentation
- Fail-closed `PREDEPLOYMENT` configuration until all seven final addresses and runtime hashes are recorded

## Preserved presentation

The approved visual design, HTML structure, CSS classes, typography, spacing, mobile layout, certificate generation, US Letter certificate configuration, images, and PWA behavior are preserved.

## Checks

From Windows Command Prompt:

```bat
scripts\run-checks.cmd
```

Or directly:

```bat
python scripts\validate-site.py
```

After an intentional approved edit to a deployable file:

```bat
python scripts\update-source-manifest.py
python scripts\validate-site.py
```

Do not update the manifest merely to hide an unexplained difference. Review every changed hash first.

## Deployment status

`protocol-config.js` remains `PREDEPLOYMENT`. The seven replacement addresses are blank and the runtime commitments are pending. Do not set the site to `ACTIVE` until compilation records, deployment records, runtime bytecode hashes, verifier readiness, and end-to-end tests are complete.
