(() => {

// ===== CONFIG =====

const RPC_URL =
  "https://polygon-bor-rpc.publicnode.com";

const metricsProvider =
  new ethers.JsonRpcProvider(
    RPC_URL
  );

const METRICS_REGISTRATION_CONTRACT =
  "0xa7D0C092C2391379046cACDc56BEbDe5A0CBD113";

const METRICS_GOVERNANCE_CONTRACT =
  "0x52419b9977f50918eb98558F39bb40AbAFb4Ed2A";

const METRICS_DAO_TREASURY =
  "0x0C2e5679153593b82a84eAB5CA90895BB291Cec4";

// ===== ABIs =====

const REGISTRATION_ABI = [
  "function totalMembers() view returns(uint256)"
];

const GOVERNANCE_ABI = [
  "function proposalCount() view returns(uint256)"
];

// ===== LOAD METRICS =====

async function loadNetworkMetrics() {

  try {

    const registration =
      new ethers.Contract(
        METRICS_REGISTRATION_CONTRACT,
        REGISTRATION_ABI,
        metricsProvider
      );

    const governance =
      new ethers.Contract(
        METRICS_GOVERNANCE_CONTRACT,
        GOVERNANCE_ABI,
        metricsProvider
      );

    const members =
      await registration.totalMembers();

    const proposals =
      await governance.proposalCount();

    const treasuryBalance =
      await metricsProvider.getBalance(
        METRICS_DAO_TREASURY
      );

    const homeMembers =
      document.getElementById(
        "homeMemberCount"
      );

    if (homeMembers) {

      homeMembers.innerText =
        Number(members).toLocaleString();

    }

    const homeProposals =
      document.getElementById(
        "homeProposalCount"
      );

    if (homeProposals) {

      homeProposals.innerText =
        Number(proposals).toLocaleString();

    }

    const homeTreasury =
      document.getElementById(
        "homeTreasuryDepth"
      );

    if (homeTreasury) {

      homeTreasury.innerText =
        Number(
          ethers.formatEther(
            treasuryBalance
          )
        ).toLocaleString() + " POL";

    }

  } catch (err) {

    console.error(
      "Metrics failed",
      err
    );
  }
}

window.addEventListener(
  "DOMContentLoaded",
  loadNetworkMetrics
);

})();