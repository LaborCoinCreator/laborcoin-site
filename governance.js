// ===== CONFIG =====
const GOVERNANCE_CONTRACT =
  "0xe4Fd8127Ad01c2691C8955cb240D2062d1731020";

const LABRV_TOKEN =
  "0x113579220515cd59b884Ea2379b4C369025246e2";

const VERIFIER_URL =
  "https://laborcoin-verifier.onrender.com";

const DAO_TREASURY =
  "0x0C2e5679153593b82a84eAB5CA90895BB291Cec4";

// ===== ABI =====
const GOV_ABI = [

  "function proposalCount() view returns (uint256)",

  "function totalRegisteredUsers() view returns (uint256)",

  "function executionAllowed() view returns(bool)",

  "function proposalPassed(uint256) view returns(bool)",

  "function nonces(address) view returns(uint256)",

  "function createProposal(string,string,address,uint256,uint256,uint256,bytes)",

  "function vote(uint256,bool,uint256,uint256,bytes)",

  "function executeProposal(uint256)",

  "function proposals(uint256) view returns(string title,string description,address recipient,uint256 amount,uint256 yesVotes,uint256 noVotes,uint256 startTime,uint256 endTime,bool executed)"
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
    await governance.nonces(
      userAddress
    );

  const expiry =
    Math.floor(
      Date.now() / 1000
    ) + 300;

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
          action,
          nonce: nonce.toString(),
          expiry,
          contract:
            GOVERNANCE_CONTRACT
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
    nonce,
    expiry,
    signature: data.signature
  };
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
      await getGovernanceSignature(0);

    const tx =
      await governance.createProposal(
        "Treasury Transfer",
        description,
        recipient,
        amount,
        auth.nonce,
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

      const card =
        document.createElement("div");

      card.className =
        "trade-box";

      const endDate =
        new Date(
          Number(p.endTime) * 1000
        ).toLocaleString();

      const details = `
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

      const now =
        Math.floor(
          Date.now() / 1000
        );

      let status = "ACTIVE";

      if (p.executed) {

        status = "EXECUTED";

      } else if (
        now >= Number(p.endTime)
      ) {

        const passed =
          await governance.proposalPassed(i);

        status =
          passed
            ? "PASSED"
            : "FAILED";
      }

      const remaining =
        Number(p.endTime) - now;

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

        const minutes =
          Math.floor(
            (remaining % 3600)
            / 60
          );

        remainingText =
          `${days}d ${hours}h ${minutes}m remaining`;
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
          Remaining:<br>
          ${remainingText}
        </p>

        <p>
          Description:<br>
          ${p.description}
        </p>

        ${details}

        <p>
          YES:
          ${Number(p.yesVotes)}

          <br>

          NO:
          ${Number(p.noVotes)}
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
            (
              !p.executed &&
              now >= Number(p.endTime) &&
              await governance.proposalPassed(i)
            )
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
        support ? 1 : 2
      );

    const tx =
      await governance.vote(
        id,
        support,
        auth.nonce,
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

    if (!signer) {

      setStatus(
        "Connect wallet first",
        "error"
      );

      return;
    }

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