(() => {
  const config = window.LaborCoinConfig;
  const active = window.LaborCoinDeployment?.isActive() === true;

  function set(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function loadNetworkMetrics() {
    if (!active) {
      set("homeMemberCount", "Pending deployment");
      set("homeProposalCount", "Pending deployment");
      set("homeTreasuryDepth", "Read from existing DAO");
      set("homeTotalDistributed", "Direct DAO execution in Governance V15.1");
      return;
    }

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const registration = new ethers.Contract(
      config.addresses.registration,
      ["function totalMembers() view returns(uint256)"],
      provider
    );
    const governance = new ethers.Contract(
      config.addresses.governance,
      ["function proposalCount() view returns(uint256)"],
      provider
    );

    try {
      const [members, proposals, treasuryBalance] = await Promise.all([
        registration.totalMembers(),
        governance.proposalCount(),
        provider.getBalance(config.addresses.daoTreasury)
      ]);

      set("homeMemberCount", Number(members).toLocaleString());
      set("homeProposalCount", Number(proposals).toLocaleString());
      set(
        "homeTreasuryDepth",
        `${Number(ethers.formatEther(treasuryBalance)).toLocaleString(undefined, {
          maximumFractionDigits: 4
        })} POL`
      );
      set("homeTotalDistributed", "Recorded through Governance execution events");
    } catch (error) {
      console.error("Metrics failed", error);
      set("homeMemberCount", "Unavailable");
      set("homeProposalCount", "Unavailable");
      set("homeTreasuryDepth", "Unavailable");
      set("homeTotalDistributed", "Unavailable");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNetworkMetrics, { once: true });
  } else {
    loadNetworkMetrics();
  }
})();
