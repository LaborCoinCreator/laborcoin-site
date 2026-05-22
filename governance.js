// ===== CONFIG =====
const GOVERNANCE_CONTRACT =
  "0xb9D1Cfb2Cf328C620579642a2CF5b427594588b7";

const LABRV_TOKEN =
  "0x113579220515cd59b884Ea2379b4C369025246e2";

const VERIFIER_URL =
  "https://laborcoin-verifier.onrender.com";

// ===== PROPOSAL TYPES =====
const TREASURY_TRANSFER = 0;
const PAUSE_TRADING = 1;
const RESUME_TRADING = 2;

// ===== ABI =====
const GOV_ABI = [

  "function proposalCount() view returns (uint256)",

  "function noncesPerAction(address,uint8) view returns (uint256)",

  "function propose(uint8,address,uint256,string,uint256,bytes) returns (uint256)",

  "function vote(uint256,bool,uint256,bytes)",

  "function execute(uint256)",

  "function aragonProposalIds(uint256) view returns (uint256)",

  "function proposals(uint256) view returns(uint8 proposalType,address recipient,uint256 amount,string description,uint256 start,uint256 end,uint256 yes,uint256 no,bool executed)"
];

const LABRV_ABI = [
  "function balanceOf(address) view returns (uint256)"
];

// ===== STATE =====
let provider;
let signer;
let userAddress;

let governance;
let labrv;

// ===== ELEMENTS =====
const govConnectBtn =
  document.getElementById("govConnectBtn");

const govVerifyBtn =
  document.getElementById("govVerifyBtn");

const govStatus =
  document.getElementById("govStatus");

const govPanel =
  document.getElementById("govPanel");

const proposalFeedSection =
  document.getElementById("proposalFeedSection");

const proposalFeed =
  document.getElementById("proposalFeed");

const recipientAddress =
  document.getElementById("recipientAddress");

const treasuryAmount =
  document.getElementById("treasuryAmount");

const proposalDescription =
  document.getElementById("proposalDescription");

const submitProposalBtn =
  document.getElementById("submitProposalBtn");

const pauseTradingBtn =
  document.getElementById("pauseTradingBtn");

const resumeTradingBtn =
  document.getElementById("resumeTradingBtn");

// ===== INITIAL UI STATE =====
govVerifyBtn.disabled = true;

// ===== HELPERS =====
function setStatus(msg, type = "") {

  govStatus.innerText = msg;

  govStatus.style.color =
    type === "error"
      ? "#ff4d4d"
      : type === "success"
      ? "#4dff88"
      : "#ccc";
}

function completeStep(id) {

  const el =
    document.getElementById(id);

  if (!el) return;

  el.classList.add("complete");
}

async function getGovernanceSignature(action) {

  const nonce =
    await governance.noncesPerAction(
      userAddress,
      action
    );

  console.log(
    "FRONTEND NONCE:",
    nonce.toString()
  );

  console.log(
    "CHAIN ID:",
    (
      await provider.getNetwork()
    ).chainId.toString()
  );

  const expiry =
    Math.floor(
      Date.now() / 1000
    ) + 300;

  console.log(
    "VERIFY PAYLOAD",
    {
      address: userAddress,
      type: "governance",
      action,
      nonce: nonce.toString(),
      expiry
    }
  );

  const response =
    await fetch(
      `${VERIFIER_URL}/verify`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          address: userAddress,
          type: "governance",
          action: Number(action),
          nonce: nonce.toString(),
          expiry
        })
      }
    );

  const data =
    await response.json();

  if (!data.success) {

    throw new Error(
      data.error ||
      "Verification failed"
    );
  }

  return {
    expiry,
    signature: data.signature
  };
}

function proposalTypeName(type) {

  if (Number(type) === 0)
    return "Treasury Transfer";

  if (Number(type) === 1)
    return "Pause Trading";

  if (Number(type) === 2)
    return "Resume Trading";

  return "Unknown";
}

// ===== CONNECT =====
govConnectBtn.onclick = async () => {

  try {

    if (!window.ethereum) {

      setStatus(
        "MetaMask not detected",
        "error"
      );

      return;
    }

    provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    await provider.send(
      "eth_requestAccounts",
      []
    );

    const network =
      await provider.getNetwork();

    if (
      Number(network.chainId) !== 137
    ) {

      try {

        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x89" }]
        });

      } catch (switchError) {

        setStatus(
          "Please switch to Polygon Mainnet",
          "error"
        );

        return;
      }
    }

    signer =
      await provider.getSigner();

    userAddress =
      await signer.getAddress();

    governance =
      new ethers.Contract(
        GOVERNANCE_CONTRACT,
        GOV_ABI,
        signer
      );

    labrv =
      new ethers.Contract(
        LABRV_TOKEN,
        LABRV_ABI,
        provider
      );

    completeStep(
      "gov-step-wallet"
    );

    const bal =
      await labrv.balanceOf(
        userAddress
      );

    if (Number(bal) <= 0) {

      setStatus(
        "No LABRV voting power",
        "error"
      );

      return;
    }

    completeStep(
      "gov-step-labrv"
    );

    govVerifyBtn.disabled = false;

    setStatus(
      "Wallet connected",
      "success"
    );

  } catch (err) {

    console.error(err);

    setStatus(
      "Connection failed",
      "error"
    );
  }
};

// ===== VERIFY =====
govVerifyBtn.onclick = async () => {

  if (!userAddress) {

    setStatus(
      "Connect wallet first",
      "error"
    );

    return;
  }

  try {

    govStatus.textContent =
      "Verifying identity...";

    const response = await fetch(
      `${VERIFIER_URL}/verify`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          address: userAddress,
          type: "governance"
        })
      }
    );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Verification failed"
      );

    }

    completeStep(
      "gov-step-identity"
    );

    govPanel.classList.remove(
      "hidden"
    );

    proposalFeedSection.classList.remove(
      "hidden"
    );

    govStatus.textContent =
      `Verified. Passport score: ${data.score}`;

    await loadProposalFeed();

  } catch (err) {

    console.error(err);

    govStatus.textContent =
      err.message ||
      "Verification failed.";

  }

};

// ===== TREASURY PROPOSAL =====
submitProposalBtn.onclick = async () => {

  try {

    const recipient =
      recipientAddress.value.trim();

    const amount =
      ethers.parseEther(
        treasuryAmount.value
      );

    const description =
      proposalDescription.value.trim();

    if (!recipient) {

      setStatus(
        "Missing recipient",
        "error"
      );

      return;
    }

    if (
      Number(treasuryAmount.value) <= 0
    ) {

      setStatus(
        "Invalid amount",
        "error"
      );

      return;
    }

    const auth =
      await getGovernanceSignature(
        TREASURY_TRANSFER
      );

    const tx =
      await governance.propose(
        TREASURY_TRANSFER,
        recipient,
        amount,
        description,
        auth.expiry,
        auth.signature
      );

    await tx.wait();

    setStatus(
      "Treasury proposal submitted",
      "success"
    );

    recipientAddress.value = "";
    treasuryAmount.value = "";
    proposalDescription.value = "";

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    setStatus(
      "Proposal failed",
      "error"
    );
  }
};

// ===== PAUSE PROPOSAL =====
pauseTradingBtn.onclick = async () => {

  try {

    const auth =
      await getGovernanceSignature(
        PAUSE_TRADING
      );

    const tx =
      await governance.propose(
        PAUSE_TRADING,
        ethers.ZeroAddress,
        0,
        "Pause LABR trading",
        auth.expiry,
        auth.signature
      );

    await tx.wait();

    setStatus(
      "Pause proposal submitted",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    setStatus(
      "Pause proposal failed",
      "error"
    );
  }
};

// ===== RESUME PROPOSAL =====
resumeTradingBtn.onclick = async () => {

  try {

    const auth =
      await getGovernanceSignature(
        RESUME_TRADING
      );

    const tx =
      await governance.propose(
        RESUME_TRADING,
        ethers.ZeroAddress,
        0,
        "Resume LABR trading",
        auth.expiry,
        auth.signature
      );

    await tx.wait();

    setStatus(
      "Resume proposal submitted",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    setStatus(
      "Resume proposal failed",
      "error"
    );
  }
};

// ===== LOAD FEED =====
async function loadProposalFeed() {

  try {

    proposalFeed.innerHTML = "";

    const total =
      Number(
        await governance.proposalCount()
      );

    if (total === 0) {

      proposalFeed.innerHTML = `
        <div class="trade-box">
          No proposals yet.
        </div>
      `;

      return;
    }

    for (
      let i = total;
      i >= 1;
      i--
    ) {

      const p =
        await governance.proposals(i);

      const aragonId =
        await governance.aragonProposalIds(i);

      const card =
        document.createElement("div");

      card.className =
        "trade-box";

      const endDate =
        new Date(
          Number(p.end) * 1000
        ).toLocaleString();

      let details = "";

      if (
        Number(p.proposalType) === 0
      ) {

        details = `
          <p>
            Recipient:<br>
            ${p.recipient}
          </p>

          <p>
            Amount:<br>
            ${ethers.formatEther(
              p.amount
            )} POL
          </p>
        `;
      }

      card.innerHTML = `

        <h3>
          Proposal #${i}
        </h3>

        <p>
          Type:<br>
          ${proposalTypeName(
            p.proposalType
          )}
        </p>

        <p>
          Description:<br>
          ${p.description}
        </p>

        ${details}

        <p>
          YES: ${p.yes}<br>
          NO: ${p.no}
        </p>

        <p>
          Ends:<br>
          ${endDate}
        </p>

        <p>
          Executed:
          ${p.executed}
        </p>

        <p>
          Aragon Proposal ID:
          ${aragonId}
        </p>

        <div class="cta-row">

          <button
            class="cta-button"
            onclick="voteProposal(${i}, true)"
          >
            Vote YES
          </button>

          <button
            class="cta-button secondary"
            onclick="voteProposal(${i}, false)"
          >
            Vote NO
          </button>

          <button
            class="cta-button"
            onclick="executeProposal(${i})"
          >
            Execute
          </button>

        </div>
      `;

      proposalFeed.appendChild(card);
    }

  } catch (err) {

    console.error(err);
  }
}

// ===== VOTE =====
window.voteProposal = async (
  id,
  support
) => {

  try {

    const auth =
      await getGovernanceSignature(99);

    const tx =
      await governance.vote(
        id,
        support,
        auth.expiry,
        auth.signature
      );

    await tx.wait();

    setStatus(
      "Vote submitted",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    setStatus(
      "Vote failed",
      "error"
    );
  }
};

// ===== EXECUTE =====
window.executeProposal = async (
  id
) => {

  try {

    const tx =
      await governance.execute(id);

    await tx.wait();

    setStatus(
      "Proposal executed",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    setStatus(
      "Execution failed",
      "error"
    );
  }
};