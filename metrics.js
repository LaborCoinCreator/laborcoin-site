(() => {

// ===== CONFIG =====

const RPC_URL =
  "https://polygon-bor-rpc.publicnode.com";

const metricsProvider =
  new ethers.JsonRpcProvider(
    RPC_URL
  );

const METRICS_REGISTRATION_CONTRACT =
  "0xd1CD6C0B6f1F709A52908B40C07D3C54649e323C";

const METRICS_GOVERNANCE_CONTRACT =
  "0x8238105d31F6Bb26897d8Ab270a0A521FEF03E8c";

const METRICS_DAO_TREASURY =
  "0x0C2e5679153593b82a84eAB5CA90895BB291Cec4";

const METRICS_TREASURY_MODULE =
  "0x10F2798ef055950B897AF4B3A8ae90dE34f6C56C";

// ===== ABIs =====

const REGISTRATION_ABI = [
  "function totalMembers() view returns(uint256)"
];

const GOVERNANCE_ABI = [
  "function proposalCount() view returns(uint256)"
];

const TREASURY_ABI = [
  "function totalDistributed() view returns(uint256)"
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

    const treasuryModule =
      new ethers.Contract(
        METRICS_TREASURY_MODULE,
        TREASURY_ABI,
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

    const totalDistributed =
      await treasuryModule.totalDistributed();

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

  const homeDistributed =
    document.getElementById(
      "homeTotalDistributed"
    );

  if (homeDistributed) {

    homeDistributed.innerText =
      Number(
        ethers.formatEther(
          totalDistributed
        )
      ).toLocaleString()
      + " POL";
  }

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