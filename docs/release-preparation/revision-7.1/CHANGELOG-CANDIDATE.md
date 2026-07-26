# Revision 7.1 Candidate Changelog

## Added

- Identity Registry V1 permanent score-15 verification flow
- On-chain identity enforcement for official buys and sells
- Equal-per-eligible-holder dividend status and claims on the Exchange page
- Identity, dividend eligibility, holder count, and withdrawable-POL displays
- Human Passport and MetaMask onboarding links
- Revision 7.1 whitepaper in Markdown, HTML, and US Letter PDF

## Changed

- Migrated Exchange V5 integration to Exchange V6
- Migrated LABR V2.1 integration to equal-holder LABR V3
- Migrated LaborVote V8.1 to LaborVote V9.1
- Migrated Registration V5.1 to Registration V6.1 using shared permanent identity
- Migrated Governance V14.1.4 to Governance V15.1.0
- Updated onboarding, FAQ, disclaimer, home, DAO, Exchange, and governance content
- Preserved the latest approved visual design and existing styling classes

## Preserved

- Membership-certificate generation and US Letter format
- Static attestation PDF
- Banner, logo, and favicon assets
- Existing wallet and PWA styling behavior

## Safety behavior

The candidate is fail-closed. Contract interactions remain disabled while the configuration status is `PREDEPLOYMENT`, any final address is missing, or any runtime commitment is pending.

- Updated Registration to V6.1, LaborVote to V9.1, and Governance to V15.1.
- Replaced creation-time voter exclusion with open voting until the proposal deadline and a final historical deadline electorate.
