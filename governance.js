// ===== CONFIG =====
const GOVERNANCE_CONTRACT =
  "0x1C01BD6ccC2C9aCfb59f37f7877A7a2718167aBe";

const LABRV_TOKEN =
  "0x113579220515cd59b884Ea2379b4C369025246e2";

const VERIFIER_URL =
  "https://laborcoin-verifier.onrender.com";

// ===== ABI =====
const GOV_ABI = [
  "function proposalCount() view returns (uint256)",

  "function propose(address,uint256,bytes,bytes)",

  "function vote(uint256,bool,bytes)",

  "function execute(uint256)",

  "function proposals(uint256) view returns(address target,uint256 value,bytes data,uint256 start,uint256 end,uint256 yes,uint256 no,bool executed)"
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

let governanceSignature;

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

const proposalType =
  document.getElementById("proposalType");

const treasuryFields =
  document.getElementById("treasuryFields");

const recipientAddress =
  document.getElementById("recipientAddress");

const treasuryAmount =
  document.getElementById("treasuryAmount");

const proposalDescription =
  document.getElementById("proposalDescription");

const submitProposalBtn =
  document.getElementById("submitProposalBtn");

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

if (!userAddress || !governance) {

  setStatus(
    "Connect wallet first",
    "error"
  );

  return;

}
  try {

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
	    action: "propose"
          })
        }
      );

    const data =
      await response.json();

    if (!data.success) {

      setStatus(
        data.error ||
        "Verification failed",
        "error"
      );

      return;

    }

    governanceSignature =
      data.signature;

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
      "Governance access granted",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    setStatus(
      "Verification failed",
      "error"
    );

  }

};

// ===== PROPOSAL TYPE UI =====
proposalType.onchange = () => {

  if (
    proposalType.value ===
    "treasury"
  ) {

    treasuryFields.style.display =
      "block";

  } else {

    treasuryFields.style.display =
      "none";

  }

};

// ===== CREATE PROPOSAL =====
submitProposalBtn.onclick = async () => {

  try {

    if (!governanceSignature) {

      setStatus(
        "Verify identity first",
        "error"
      );

      return;

    }

    let target;
    let value = 0;
    let calldata = "0x";

    // ===== TREASURY =====
    if (
      proposalType.value ===
      "treasury"
    ) {

      target =
        recipientAddress.value.trim();

      value =
        ethers.parseEther(
          treasuryAmount.value
        );

    }

    // ===== PLACEHOLDER =====
    if (
      proposalType.value ===
      "pause"
    ) {

      setStatus(
        "Pause executor not connected yet",
        "error"
      );

      return;

    }

    if (
      proposalType.value ===
      "resume"
    ) {

      setStatus(
        "Resume executor not connected yet",
        "error"
      );

      return;

    }

    const tx =
      await governance.propose(
        target,
        value,
        calldata,
        governanceSignature
      );

    await tx.wait();

    setStatus(
      "Proposal submitted",
      "success"
    );

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
          Number(p.end) * 1000
        ).toLocaleString();

      card.innerHTML = `

        <h3>Proposal #${i}</h3>

        <p>
          Target:<br>
          ${p.target}
        </p>

        <p>
          Value:<br>
          ${ethers.formatEther(p.value)} POL
        </p>

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

const verifyResponse =
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
        action: "vote"
      })
    }
  );

const verifyData =
  await verifyResponse.json();

const voteSignature =
  verifyData.signature;

  try {

    const tx =
      await governance.vote(
        id,
        support,
        voteSignature
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