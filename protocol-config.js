(() => {
  const config = {
    release: "Revision 7.1",
    status: "PREDEPLOYMENT",
    chainId: 137,
    rpcUrl: "https://polygon-bor-rpc.publicnode.com",
    ensRpcUrl: "https://ethereum-rpc.publicnode.com",
    verifierUrl: "https://laborcoin-verifier.onrender.com",
    addresses: {
      identityRegistry: "",
      labr: "",
      exchange: "",
      labrv: "",
      registration: "",
      proposalTextPolicy: "",
      governance: "",
      daoTreasury: "0x0C2e5679153593b82a84eAB5CA90895BB291Cec4"
    },
    runtimeHashes: {
      identityRegistry: "PENDING_COMPILATION",
      labr: "PENDING_COMPILATION",
      exchange: "PENDING_COMPILATION",
      labrv: "PENDING_COMPILATION",
      registration: "PENDING_COMPILATION",
      proposalTextPolicy: "PENDING_COMPILATION_RECORD",
      governance: "PENDING_FINAL_IMMUTABLE_VALUES"
    },
    limits: {
      maxWalletLabr: 10000,
      maxTradeLabr: 5000,
      tradeCooldownSeconds: 43200,
      minDividendLabr: 1,
      minRegistrationLabr: 1,
      minPassportScore: 15,
      maxProposalDescriptionBytes: 1000
    }
  };

  const requiredAddressKeys = [
    "identityRegistry",
    "labr",
    "exchange",
    "labrv",
    "registration",
    "proposalTextPolicy",
    "governance",
    "daoTreasury"
  ];

  const requiredRuntimeKeys = [
    "identityRegistry",
    "labr",
    "exchange",
    "labrv",
    "registration",
    "proposalTextPolicy",
    "governance"
  ];

  function isAddress(value) {
    return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
  }

  function isHash(value) {
    return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
  }

  function isActive() {
    return config.status === "ACTIVE"
      && requiredAddressKeys.every(key => isAddress(config.addresses[key]))
      && requiredRuntimeKeys.every(key => isHash(config.runtimeHashes[key]));
  }

  function requireActive() {
    if (!isActive()) {
      throw new Error(
        "LaborCoin Revision 7.1 is in predeployment mode. Contract interactions are disabled until all seven final addresses and runtime commitments are verified."
      );
    }
    return config;
  }

  window.LaborCoinConfig = Object.freeze(config);
  window.LaborCoinDeployment = Object.freeze({
    isActive,
    requireActive,
    isAddress,
    isHash
  });

  window.addEventListener("DOMContentLoaded", () => {
    if (isActive()) return;
    const banner = document.createElement("div");
    banner.className = "deployment-gate-banner";
    banner.setAttribute("role", "status");
    banner.textContent =
      "Revision 7.1 predeployment source candidate: interactions are disabled until the seven contracts are compiled, deployed, and runtime-verified.";
    document.body.prepend(banner);
  });
})();
