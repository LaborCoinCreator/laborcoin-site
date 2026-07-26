# LaborCoin Website Revision 7.1 Candidate

This site package preserves the latest approved visual design while migrating functionality and content to the seven-contract Revision 7.1 equal-holder architecture.

## Functional changes

- Added Identity Registry V1 configuration and verification transaction.
- Required permanent identity verification for official buys and sells.
- Added equal-holder dividend eligibility, holder-count display, withdrawable amount, and claim button to Exchange.
- Updated Registration to reuse permanent Registry status and call `register()` without a second Passport signature.
- Updated contract labels and ABIs for LABR V3, Exchange V6, LaborVote V9.1.0, Registration V6.1.0, and Governance V15.1.
- Retained fail-closed predeployment behavior.

## Content changes

- Updated onboarding, FAQ, disclaimer, home page, and whitepaper.
- Added MetaMask and Human Passport links.
- Explicitly states that dividends are claimed on the Exchange page.

## Styling and layout disclosure

The latest approved replacement design and `style.css` are preserved. Exchange receives additional identity and dividend status rows and buttons using existing classes. Onboarding, FAQ, home, and disclaimer content reflects Revision 7.1. No new global visual redesign is introduced.

## Files preserved without alteration

- `attestation.pdf`
- membership-certificate generation block in `dao.js`
- certificate jsPDF configuration, including US Letter portrait
- banner, logo, favicon
- wallet and PWA interaction styling

## Status

`protocol-config.js` remains `PREDEPLOYMENT`, all seven replacement addresses are blank, and runtime hashes are pending. Do not set `ACTIVE` until deployment records and runtime hashes are independently verified.


Governance V15.1.0 allows every member registered before an active proposal deadline to vote. The interface displays the creation count, current provisional electorate, final deadline electorate, and participation target.
