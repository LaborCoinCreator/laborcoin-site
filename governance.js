// ===== CONFIG =====
const GOVERNANCE_CONTRACT =
  "0x8238105d31F6Bb26897d8Ab270a0A521FEF03E8c";

const LABRV_TOKEN =
  "0x833242E933c675846D8f8982048FecA95B8e435A";

const VERIFIER_URL =
  "https://laborcoin-verifier.onrender.com";

const MAX_TRANSFER_PERCENT = 5;

const DAO_TREASURY =
  "0x0C2e5679153593b82a84eAB5CA90895BB291Cec4";

// ===== ABI =====
const GOV_ABI = [

  "function proposalCount() view returns (uint256)",

  "function executionAllowed() view returns(bool)",

  "function treasuryModule() view returns(address)",

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

let walletInitialized = false;

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

const proposalTreasuryInfo =
  document.getElementById(
    "proposalTreasuryInfo"
  );

const proposalObligationsInfo =
  document.getElementById(
    "proposalObligationsInfo"
  );

const maxProposalBtn =
  document.getElementById(
    "maxProposalBtn"
  );

const proposalDescription =
  document.getElementById("proposalDescription");

const descriptionCounter =
  document.getElementById(
    "descriptionCounter"
  );

const submitProposalBtn =
  document.getElementById("submitProposalBtn");

const proposalStatus =
  document.getElementById(
    "proposalStatus"
  );

const loadingOverlay =
  document.getElementById(
    "loadingOverlay"
  );

const loadingText =
  document.getElementById(
    "loadingText"
  );

proposalDescription.addEventListener(
  "input",
  () => {

    const count =
      proposalDescription.value.length;

    descriptionCounter.innerText =
      `${count.toLocaleString()} / 1,000 characters`

  }
);

// ===== INITIAL UI STATE =====
govVerifyBtn.disabled = true;

// ===== HELPERS =====
function setStatus(
  msg,
  type = "",
  target = "gate"
) {

  const color =
    type === "error"
      ? "#ff4d4d"
      : type === "success"
      ? "#4dff88"
      : "#ccc";

  const el =
    target === "proposal"
      ? proposalStatus
      : govStatus;

  if (!el) {
    return;
  }

  el.innerText = msg;
  el.style.color = color;
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

async function refreshGovernanceConnection() {

  if (!provider) return;

  try {

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

    if (Number(bal) > 0) {

      completeStep(
        "gov-step-labrv"
      );

      govVerifyBtn.disabled =
        false;
    }

  } catch (err) {

    console.error(err);
  }
}

// ===== CONNECT =====
govConnectBtn.onclick = async () => {

  try {

    const wallet =
      await window.LaborWallet.connect();

    provider =
      wallet.provider;

    signer =
      wallet.signer;

    userAddress =
      wallet.address;

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

    await refreshGovernanceConnection();

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

    setStatus(
      "Wallet connected",
      "success"
    );

  } catch (err) {

    console.error(err);

    setStatus(
      err.message ||
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

    await loadProposalLimit();

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
    
    descriptionCounter.innerText =
      "0 / 1000 characters";

    hideLoading();

    submitProposalBtn.disabled =
      false;

    setStatus(
      "Treasury proposal submitted",
      "success",
      "proposal"
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
      "error",
      "proposal"
    );
  }
};

// ===== LOAD FEED =====
async function loadProposalLimit() {

  try {

    const balance =
      await provider.getBalance(
        DAO_TREASURY
      );

    const treasuryPOL =
      Number(
        ethers.formatEther(balance)
      );

    const maxProposal =
      treasuryPOL *
      (
        MAX_TRANSFER_PERCENT
        / 100
      );

    let pendingObligations = 0;

    const count =
      Number(
        await governance.proposalCount()
      );

    const now =
      Math.floor(
        Date.now() / 1000
      );

    for (
      let i = 1;
      i <= count;
      i++
    ) {

      const proposal =
        await governance.proposals(i);

      const executed =
        proposal.executed;

      const ended =
        Number(
          proposal.endTime
        ) < now;

      const passed =
        await governance.proposalPassed(
          i
        );

      if (
        !executed &&
        ended &&
        passed
      ) {

        pendingObligations +=
          Number(
            ethers.formatEther(
              proposal.amount
            )
          );
      }
    }

    const difference =
      treasuryPOL -
      pendingObligations;

    proposalTreasuryInfo.innerHTML =

      "<strong>Treasury:</strong> "
      + treasuryPOL.toLocaleString(
          undefined,
          {
            maximumFractionDigits: 2
          }
        )
      + " POL"
      + "<br>"
      + "<strong>Maximum Proposal (5%):</strong> "
      + maxProposal.toLocaleString(
          undefined,
          {
            maximumFractionDigits: 2
          }
        )
      + " POL";

    if (
      difference >= 0
    ) {

      proposalObligationsInfo.innerHTML =

        "<strong>Pending Obligations:</strong> "
        + pendingObligations.toLocaleString(
            undefined,
            {
              maximumFractionDigits: 2
            }
          )
        + " POL"
        + "<br>"
        + "<strong>Funding Surplus:</strong> "
        + difference.toLocaleString(
            undefined,
            {
              maximumFractionDigits: 2
            }
          )
        + " POL";

    } else {

      proposalObligationsInfo.innerHTML =

        "<strong>Pending Obligations:</strong> "
        + pendingObligations.toLocaleString(
            undefined,
            {
              maximumFractionDigits: 2
            }
          )
        + " POL"
        + "<br>"
        + "<strong>Funding Gap:</strong> "
        + Math.abs(
            difference
          ).toLocaleString(
            undefined,
            {
              maximumFractionDigits: 2
            }
          )
        + " POL";
    }

    maxProposalBtn.onclick =
      () => {

        const safeMax =
          maxProposal * 0.99;

        document.getElementById(
          "treasuryAmount"
        ).value =
          safeMax.toFixed(6);
      };

  } catch (err) {

    console.error(err);
  }
}

async function loadProposalFeed() {

  try {

    proposalFeed.innerHTML = "";

    const total =
      Number(
        await governance.proposalCount()
      );

    const executionWindow =
        7 * 24 * 60 * 60;

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

      const executionDeadline =
        Number(p.endTime)
        + executionWindow;

      let status = "ACTIVE";

      let remainingText =
        "Ended";

      let timerLabel =
        "Voting Remaining";

      if (p.executed) {

        timerLabel =
          "Execution Status";

        remainingText =
          "Completed";        

        status = "EXECUTED";

      } else if (
        now < Number(p.endTime)
      ) {

        const remaining =
          Number(p.endTime) - now;

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
          `${days}d ${hours}h ${minutes}m`;

      } else {

        const passed =
          await governance.proposalPassed(i);

        if (!passed) {

          status = "FAILED";

        } else if (
          now <= executionDeadline
        ) {

          status =
            "EXECUTION WINDOW OPEN";

          timerLabel =
            "Execution Remaining";

          const remaining =
            executionDeadline - now;

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
            `${days}d ${hours}h ${minutes}m`;

        } else {

          status = "EXPIRED";

          timerLabel =
            "Execution Remaining";

          remainingText =
            "Expired";
        }
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
          ${timerLabel}:<br>
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
          Voting Ends:<br>
          ${endDate}
        </p>

          ${
            (
              !p.executed &&
              status ===
                "EXECUTION WINDOW OPEN"
            )
              ? `
                <p>
                  Execution Deadline:<br>
                  ${
                    new Date(
                      executionDeadline * 1000
                    ).toLocaleString()
                  }
                </p>
              `
              : ""
          }

        <p>
          Executed:
          ${p.executed}
        </p>

        <p
          id="proposalActionStatus-${i}"
          class="status"
          style="
            text-align:center;
            min-height:24px;
          "
        ></p>

        <div class="cta-row">

          ${
            (
              !p.executed &&
              now < Number(p.endTime)
            )
              ? `
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
              `
              : ""
          }

          ${
            (
              !p.executed &&
              status ===
                "EXECUTION WINDOW OPEN"
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

    proposalFeed.innerHTML = `
      <div class="trade-box">
        Failed to load proposals.
      </div>
    `;
  }
}        

// ===== VOTE =====
function setProposalActionStatus(
  id,
  msg,
  type = ""
) {

  const el =
    document.getElementById(
      `proposalActionStatus-${id}`
    );

  if (!el) {
    return;
  }

  el.innerText = msg;

  el.style.color =
    type === "error"
      ? "#ff4d4d"
      : type === "success"
      ? "#4dff88"
      : "#ccc";
}

window.voteProposal =
async (
  id,
  support
) => {

  try {

    showLoading(
      "Submitting vote..."
    );

    setProposalActionStatus(
      id,
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

    setProposalActionStatus(
      id,
      "Vote submitted",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    hideLoading();

    setProposalActionStatus(
      id,
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

    setProposalActionStatus(
      id,
      "Executing proposal..."
    );

    const tx =
      await governance.executeProposal(id);

    await tx.wait();

    hideLoading();

    setProposalActionStatus(
      id,
      "Proposal executed",
      "success"
    );

    loadProposalFeed();

  } catch (err) {

    console.error(err);

    hideLoading();

    setProposalActionStatus(
      id,
      err.reason ||
      err.message ||
      "Execution failed",
      "error"
    );
  }
};

window.addEventListener(
  "load",
  async () => {

    try {

      if (!window.LaborWallet) {
        return;
      }

      const wallet =
        await window.LaborWallet.reconnectInjected();

      if (!wallet) {
        return;
      }

      if (walletInitialized) {
        return;
      }

      walletInitialized = true;

      govConnectBtn.click();

    } catch (err) {

      console.error(err);
    }
  }
);

if (window.ethereum) {

  window.ethereum.on(
    "accountsChanged",
    () => location.reload()
  );

  window.ethereum.on(
    "chainChanged",
    () => location.reload()
  );

}

window.addEventListener(
  "laborWalletConnected",
  () => {

    if (walletInitialized) {
      return;
    }

    walletInitialized = true;

    govConnectBtn.click();

  }
);