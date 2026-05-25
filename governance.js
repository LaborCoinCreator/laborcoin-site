// ===== CONFIG =====
const GOVERNANCE_CONTRACT =
  "0x1daF4d6867a85506c020ad1F13CcE517f3cB62cC";

const LABRV_TOKEN =
  "0x113579220515cd59b884Ea2379b4C369025246e2";

const VERIFIER_URL =
  "https://laborcoin-verifier.onrender.com";

const DAO_TREASURY =
  "0x0C2e5679153593b82a84eAB5CA90895BB291Cec4";

// ===== PROPOSAL TYPES =====
const TREASURY_TRANSFER = 0;
const PAUSE_TRADING = 1;
const RESUME_TRADING = 2;

// ===== ABI =====
const GOV_ABI = [

  "function proposalCount() view returns (uint256)",

  "function getProposalState(uint256) view returns(uint8)",

  "function noncesPerAction(address,uint8) view returns (uint256)",

  "function createProposal(uint8,address,uint256,string,uint256,bytes)",

  "function vote(uint256,bool,uint256,bytes)",

  "function canExecute(uint256) view returns(bool)",

  "function executeProposal(uint256)",

  "function aragonProposalIds(uint256) view returns (uint256)",

  "function proposals(uint256) view returns(uint8 proposalType,address proposer,address recipient,uint256 amount,string description,uint256 start,uint256 end,uint256 yes,uint256 no,bool executed)"
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

const loadingOverlay =
  document.getElementById(
    "loadingOverlay"
  );

const loadingText =
  document.getElementById(
    "loadingText"
  );

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

function showLoading(text) {

  if (!loadingOverlay || !loadingText) {
    console.error(
      "Loading overlay missing"
    );
    return;
  }

  loadingText.innerText = text;

  loadingOverlay.classList.remove(
    "hidden"
  );
}

function hideLoading() {

  if (!loadingOverlay) {
    return;
  }

  loadingOverlay.classList.add(
    "hidden"
  );
}

async function displayName(address) {

  try {

    const ens =
      await provider.lookupAddress(
        address
      );

    if (ens) {
      return ens;
    }

  } catch {

    console.log(
      "ENS lookup failed"
    );
  }

  return (
    address.slice(0, 6)
    +
    "..."
    +
    address.slice(-4)
  );
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
          method:
            "wallet_switchEthereumChain",

          params: [
            { chainId: "0x89" }
          ]
        });

      } catch {

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

    govVerifyBtn.disabled = true;

    showLoading(
      "Verifying identity..."
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

    setStatus(
      `Verified. Passport score: ${data.score}`,
      "success"
    );

    hideLoading();

    await loadProposalFeed();

  } catch (err) {

    console.error(err);

    hideLoading();

    govVerifyBtn.disabled = false;

    setStatus(
      err.message ||
      "Verification failed",
      "error"
    );
  }
};

// ===== TREASURY PROPOSAL =====
submitProposalBtn.onclick =
async () => {

  try {

    showLoading(
      "Submitting proposal..."
    );

    submitProposalBtn.disabled =
      true;

    const recipient =
      recipientAddress.value.trim();

    const amount =
      ethers.parseEther(
        treasuryAmount.value
      );

    const description =
      proposalDescription.value.trim();

    if (!recipient) {

      throw new Error(
        "Missing recipient"
      );
    }

    if (
      Number(
        treasuryAmount.value
      ) <= 0
    ) {

      throw new Error(
        "Invalid amount"
      );
    }

    const auth =
      await getGovernanceSignature(
        TREASURY_TRANSFER
      );

    const tx =
      await governance.createProposal(
        TREASURY_TRANSFER,
        recipient,
        amount,
        description,
        auth.expiry,
        auth.signature
      );

    await tx.wait();

    recipientAddress.value = "";
    treasuryAmount.value = "";
    proposalDescription.value = "";

    hideLoading();

    submitProposalBtn.disabled =
      false;

    setStatus(
      "Treasury proposal submitted",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    hideLoading();

    submitProposalBtn.disabled =
      false;

    setStatus(
      err.reason ||
      err.message ||
      "Proposal failed",
      "error"
    );
  }
};

// ===== PAUSE PROPOSAL =====
pauseTradingBtn.onclick =
async () => {

  try {

    showLoading(
      "Submitting pause proposal..."
    );

    pauseTradingBtn.disabled =
      true;

    const auth =
      await getGovernanceSignature(
        PAUSE_TRADING
      );

    const tx =
      await governance.createProposal(
        PAUSE_TRADING,
        ethers.ZeroAddress,
        0,
        "Pause LABR trading",
        auth.expiry,
        auth.signature
      );

    await tx.wait();

    hideLoading();

    pauseTradingBtn.disabled =
      false;

    setStatus(
      "Pause proposal submitted",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    hideLoading();

    pauseTradingBtn.disabled =
      false;

    setStatus(
      err.reason ||
      err.message ||
      "Pause proposal failed",
      "error"
    );
  }
};

// ===== RESUME PROPOSAL =====
resumeTradingBtn.onclick =
async () => {

  try {

    showLoading(
      "Submitting resume proposal..."
    );

    resumeTradingBtn.disabled =
      true;

    const auth =
      await getGovernanceSignature(
        RESUME_TRADING
      );

    const tx =
      await governance.createProposal(
        RESUME_TRADING,
        ethers.ZeroAddress,
        0,
        "Resume LABR trading",
        auth.expiry,
        auth.signature
      );

    await tx.wait();

    hideLoading();

    resumeTradingBtn.disabled =
      false;

    setStatus(
      "Resume proposal submitted",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    hideLoading();

    resumeTradingBtn.disabled =
      false;

    setStatus(
      err.reason ||
      err.message ||
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
      let i = total - 1;
      i >= 0;
      i--
    ) {

      const p =
        await governance.proposals(i);

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
            ${await displayName(
              p.recipient
            )}
          </p>

          <p>
            Amount:<br>
            ${ethers.formatEther(
              p.amount
            )} POL
          </p>
        `;
      }

      const now =
        Math.floor(
          Date.now() / 1000
        );

      const state =
        Number(
          await governance.getProposalState(i)
        );

      let status = "ACTIVE";

      if (state === 1)
        status = "PASSED";

      if (state === 2)
        status = "FAILED";

      if (state === 3)
        status = "EXECUTED";

      if (state === 4)
        status = "EXPIRED";

      const remaining =
        Number(p.end) - now;

      let remainingText =
        "Ended";

      if (remaining > 0) {

        const days =
          Math.floor(
            remaining / 86400
          );

        const hours =
          Math.floor(
            (remaining % 86400)
            / 3600
          );

        remainingText =
          `${days}d ${hours}h remaining`;
      }

      card.innerHTML = `

        <h3>
          Proposal #${i}
        </h3>

        <p>
          Status:
          ${status}
        </p>

        <p>
          Proposer:<br>
          ${await displayName(
            p.proposer
          )}
        </p>

        <p>
          Remaining:<br>
          ${remainingText}
        </p>

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
          YES:
          ${ethers.formatEther(
            p.yes
          )}

          <br>

          NO:
          ${ethers.formatEther(
            p.no
          )}
        </p>

        <p>
          Ends:<br>
          ${endDate}
        </p>

        <p>
          Executed:
          ${p.executed}
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

          ${
            await governance.canExecute(i)
            ? `
              <button
                class="cta-button"
                onclick="executeProposal(${i})"
              >
                Execute
              </button>
            `
            : ""
          }

        </div>
      `;

      proposalFeed.appendChild(
        card
      );
    }

  } catch (err) {

    console.error(err);
  }
}

// ===== VOTE =====
window.voteProposal =
async (
  id,
  support
) => {

  try {

    showLoading(
      "Submitting vote..."
    );

    const auth =
      await getGovernanceSignature(
        99
      );

    const tx =
      await governance.vote(
        id,
        support,
        auth.expiry,
        auth.signature
      );

    await tx.wait();

    hideLoading();

    setStatus(
      "Vote submitted",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    hideLoading();

    setStatus(
      err.reason ||
      err.message ||
      "Vote failed",
      "error"
    );
  }
};

// ===== EXECUTE =====
window.executeProposal =
async (id) => {

  try {

    showLoading(
      "Executing proposal..."
    );

    const tx =
      await governance.executeProposal(id);

    await tx.wait();

    hideLoading();

    setStatus(
      "Proposal executed",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    hideLoading();

    setStatus(
      err.reason ||
      err.message ||
      "Execution failed",
      "error"
    );
  }
};

// ===== DONATE =====
window.donateToTreasury =
async () => {

  try {

    const amount =
      document.getElementById(
        "donationAmount"
      ).value;

    if (
      !amount ||
      Number(amount) <= 0
    ) {

      setStatus(
        "Invalid donation amount",
        "error"
      );

      return;
    }

    showLoading(
      "Sending donation..."
    );

    const tx =
      await signer.sendTransaction({

        to: DAO_TREASURY,

        value:
          ethers.parseEther(
            amount
          )
      });

    await tx.wait();

    hideLoading();

    setStatus(
      "Donation sent",
      "success"
    );

  } catch (err) {

    console.error(err);

    hideLoading();

    setStatus(
      err.reason ||
      err.message ||
      "Donation failed",
      "error"
    );
  }
};