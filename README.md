# LaborCoin (LABR)

LaborCoin is a decentralized worker coordination and governance platform built on Polygon.

The project combines:

- A bonding curve token economy
- Identity-gated DAO participation
- Sybil-resistant governance
- Treasury coordination
- Worker solidarity funding mechanisms

Website:

https://laborcoin.tech

---

# Overview

LaborCoin is designed as a tool for building worker power through decentralized infrastructure.

The system currently includes:

- LABR token
- LABRV governance token
- Identity verification system
- Governance proposal/voting system
- Treasury coordination framework
- Verifier backend
- Sybil-resistant onboarding flow

---

# Core Principles

- One person should not be able to create unlimited governance identities
- Governance execution should be constrained and auditable
- Treasury actions should require collective approval
- Infrastructure should become increasingly immutable over time
- The system should resist centralized capture

---

# Stack

## Frontend

- HTML
- CSS
- Vanilla JavaScript
- ethers.js

## Backend

- Node.js
- Express
- Gitcoin Passport API

## Blockchain

- Solidity
- Polygon
- OpenZeppelin contracts

## Hosting

- Netlify (frontend)
- Render (verifier backend)

---

# Contracts

## LABR

Primary token used within the LaborCoin ecosystem.

## LABRV

Governance voting token minted after identity verification and registration.

## LaborCoinRegistration

Handles:

- identity-gated onboarding
- LABRV minting
- verifier signature validation

## LaborCoinGovernance

Handles:

- proposal creation
- voting
- treasury execution
- quorum enforcement
- verifier-gated governance participation

---

# Governance Model

Governance participation currently requires:

1. Wallet connection
2. LABRV ownership
3. Identity verification through verifier signatures
4. Proposal/voting authorization

Governance is being progressively hardened toward:

- executor-only treasury actions
- replay-safe signatures
- bounded governance permissions
- immutable execution constraints

---

# Identity Verification

LaborCoin uses Gitcoin Passport scoring to reduce:

- bots
- sybil attacks
- governance spam

The verifier backend signs authorization messages for verified wallets.

No personal identity data is stored by LaborCoin servers.

---

# Development Status

Current focus areas:

- Governance hardening
- Executor-only proposal architecture
- Replay-safe nonce signatures
- Treasury execution constraints
- Verifiable governance credentials
- Proposal transparency improvements

---

# Local Development

## Frontend

Open:

```bash
index.html
```

Or deploy through Netlify.

## Backend

Install dependencies:

```bash
npm install
```

Run verifier locally:

```bash
node server.js
```

## Environment Variables

Verifier backend requires:

```env
PRIVATE_KEY=
SCORER_ID=
SCORER_API_KEY=
GOVERNANCE_ADDRESS=
REGISTRATION_ADDRESS=
PORT=
```

Never commit `.env` files.

---

# Deployment

## Frontend

Netlify auto-deploy via GitHub.

## Backend

Render auto-deploy via GitHub.

---

# Security Notes

This project is under active development.

Governance and treasury systems are still being hardened prior to full public launch.

Current security roadmap includes:

- nonce-based replay protection
- executor-only governance
- immutable governance constraints
- bounded treasury permissions

---

# License

MIT