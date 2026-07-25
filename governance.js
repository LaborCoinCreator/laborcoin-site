// ===== CONFIG =====
const SITE_CONFIG = window.LaborCoinConfig;
const DEPLOYMENT_ACTIVE = window.LaborCoinDeployment?.isActive() === true;

const GOVERNANCE_CONTRACT =
  SITE_CONFIG?.addresses?.governance || ethers.ZeroAddress;

const LABRV_TOKEN =
  SITE_CONFIG?.addresses?.labrv || ethers.ZeroAddress;

const RPC_URL = SITE_CONFIG?.rpcUrl;
const ENS_RPC_URL = SITE_CONFIG?.ensRpcUrl;
const MAX_TRANSFER_PERCENT = 5;
const DAO_TREASURY =
  SITE_CONFIG?.addresses?.daoTreasury || ethers.ZeroAddress;

// ===== ABI =====
const GOV_ABI = [

  "function proposalCount() view returns (uint256)",

  "function governanceReady() view returns(bool)",

  "function executionAllowed() view returns(bool)",

  "function proposalPassed(uint256) view returns(bool)",

  "function requiredParticipationVotes(uint256) view returns(uint256)",

  "function requiredYesVotes(uint256) view returns(uint256)",

  "function proposalState(uint256) view returns(uint8)",

  "function eligibleToVote(uint256,address) view returns(bool)",

  "function maxProposalAmount() view returns(uint256)",

  "function createProposal(string,address,uint256) returns(uint256)",

  "function validateProposalDescription(string) view returns(bool)",

  "function PROPOSAL_TITLE() view returns(string)",

  "function vote(uint256,bool)",

  "function executeProposal(uint256)",

  "function proposalContent(uint256) view returns(string description,bytes32 descriptionHash,address recipient,uint256 amount,address creator)",

  "function proposalVoteData(uint256) view returns(uint256 yesVotes,uint256 noVotes,uint256 electorateSize,uint256 treasuryBalanceSnapshot)",

  "function proposalExecutionData(uint256) view returns(uint256 startTime,uint256 endTime,bool executed,uint256 executedAt,bytes32 callId)"
];

const LABRV_ABI = [
  "function balanceOf(address) view returns (uint256)"
];

const readProvider = DEPLOYMENT_ACTIVE
  ? new ethers.JsonRpcProvider(RPC_URL)
  : null;

const readGovernance = DEPLOYMENT_ACTIVE
  ? new ethers.Contract(
      GOVERNANCE_CONTRACT,
      GOV_ABI,
      readProvider
    )
  : null;

const ensProvider = DEPLOYMENT_ACTIVE
  ? new ethers.JsonRpcProvider(ENS_RPC_URL)
  : null;

// ===== STATE =====
let provider;
let signer;
let userAddress;

let governance;
let labrv;

let walletInitialized = false;
let governanceVerified = false;

if (!window.LaborCoinProposalTextPolicy) {
  throw new Error(
    "Proposal text policy failed to load."
  );
}

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

const proposalPolicyStatus =
  document.getElementById(
    "proposalPolicyStatus"
  );

const proposalTextPolicy =
  window.LaborCoinProposalTextPolicy;

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

function updateProposalPolicyPreview() {

  const result =
    proposalTextPolicy.validate(
      proposalDescription.value
    );

  descriptionCounter.innerText =
    `${result.byteLength.toLocaleString()} / 1,000 bytes`;

  if (!proposalDescription.value) {
    proposalDescription.setCustomValidity("");
    proposalPolicyStatus.innerText = "";
    proposalPolicyStatus.style.color = "#999";
    return;
  }

  if (!result.allowed) {
    const message =
      proposalTextPolicy.messageFor(result);

    proposalDescription.setCustomValidity(message);
    proposalPolicyStatus.innerText = message;
    proposalPolicyStatus.style.color = "#ff4d4d";
    return;
  }

  proposalDescription.setCustomValidity("");
  proposalPolicyStatus.innerText =
    "Description satisfies the local copy of the permanent content policy.";
  proposalPolicyStatus.style.color = "#4dff88";
}

proposalDescription.addEventListener(
  "input",
  updateProposalPolicyPreview
);

// ===== INITIAL UI STATE =====
govConnectBtn.disabled = !DEPLOYMENT_ACTIVE;
govVerifyBtn.disabled = true;
submitProposalBtn.disabled = !DEPLOYMENT_ACTIVE;

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

  if (!ensProvider) {
    return address.slice(0, 6) + "..." + address.slice(-4);
  }

  try {

    const ens =
      await ensProvider.lookupAddress(
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

    if (bal === ethers.parseEther("1")) {

      completeStep(
        "gov-step-labrv"
      );

      govVerifyBtn.disabled =
        false;
    } else {

      govVerifyBtn.disabled =
        true;
    }

  } catch (err) {

    console.error(err);
  }
}

// ===== CONNECT =====
govConnectBtn.onclick = async () => {

  try {

    if (!window.LaborWallet) {
      throw new Error(
        "Wallet system is still loading. Please wait a moment and try again."
      );
    }

    setStatus(
      "Opening wallet connection..."
    );

    govConnectBtn.disabled = true;
    govConnectBtn.innerText = "Connecting...";

    const wallet =
      await window.LaborWallet.connect();

    walletInitialized = true;

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

    govConnectBtn.style.display =
      "none";

    govConnectBtn.disabled = false;
    govConnectBtn.innerText =
      "Connect Wallet";

    if (bal !== ethers.parseEther("1")) {

      setStatus(
        "Wallet connected. This address has no LABRV voting rights, but it may still view proposals and execute approved proposals.",
        "error"
      );

      await loadProposalFeed();

      return;
    }

    setStatus(
      "Wallet connected",
      "success"
    );

    await loadProposalFeed();

  } catch (err) {

    console.error(err);

    govConnectBtn.disabled = false;
    govConnectBtn.innerText = "Connect Wallet";

    setStatus(
      err.message ||
      "Connection failed",
      "error"
    );
  }
};

// ===== GOVERNANCE ACCESS =====
govVerifyBtn.onclick = async () => {

  if (!userAddress || !governance || !labrv) {

    setStatus(
      "Connect wallet first",
      "error"
    );

    return;
  }

  try {

    govVerifyBtn.disabled = true;

    showLoading(
      "Confirming governance membership..."
    );

    const balance =
      await labrv.balanceOf(
        userAddress
      );

    if (balance !== ethers.parseEther("1")) {
      throw new Error(
        "This wallet does not hold the required LABRV membership token."
      );
    }

    const ready =
      await governance.governanceReady();

    if (!ready) {
      throw new Error(
        "Governance V15 is not fully activated or its DAO execution permission is missing."
      );
    }

    completeStep(
      "gov-step-identity"
    );

    governanceVerified = true;

    govPanel.classList.remove(
      "hidden"
    );

    setStatus(
      "LABRV membership confirmed. Governance access enabled.",
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
      err.reason ||
      err.message ||
      "Governance access check failed",
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

    const amountText =
      treasuryAmount.value.trim();

    const description =
      proposalDescription.value.trim();

    if (!ethers.isAddress(recipient)) {

      throw new Error(
        "Enter a valid Polygon recipient address"
      );
    }

    if (
      !amountText ||
      Number(amountText) <= 0
    ) {

      throw new Error(
        "Enter a valid proposal amount"
      );
    }

    const localPolicyResult =
      proposalTextPolicy.validate(
        description
      );

    if (!localPolicyResult.allowed) {
      throw new Error(
        proposalTextPolicy.messageFor(
          localPolicyResult
        )
      );
    }

    const allowedOnChain =
      await readGovernance
        .validateProposalDescription(
          description
        );

    if (!allowedOnChain) {
      throw new Error(
        "The permanent on-chain proposal-content policy rejected this description."
      );
    }

    const amount =
      ethers.parseEther(
        amountText
      );

    const tx =
      await governance.createProposal(
        description,
        recipient,
        amount
      );

    await tx.wait();

    recipientAddress.value = "";
    treasuryAmount.value = "";
    proposalDescription.value = "";
    
    updateProposalPolicyPreview();

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
async function readProposal(
  proposalId
) {
  const [
    content,
    voteData,
    executionData
  ] = await Promise.all([
    readGovernance.proposalContent(
      proposalId
    ),
    readGovernance.proposalVoteData(
      proposalId
    ),
    readGovernance.proposalExecutionData(
      proposalId
    )
  ]);

  return {
    description: content.description,
    descriptionHash:
      content.descriptionHash,
    recipient: content.recipient,
    amount: content.amount,
    creator: content.creator,
    yesVotes: voteData.yesVotes,
    noVotes: voteData.noVotes,
    electorateSize:
      voteData.electorateSize,
    treasuryBalanceSnapshot:
      voteData.treasuryBalanceSnapshot,
    startTime: executionData.startTime,
    endTime: executionData.endTime,
    executed: executionData.executed,
    executedAt: executionData.executedAt,
    callId: executionData.callId
  };
}

async function loadProposalLimit() {

  try {

    const balance =
      await readProvider.getBalance(
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
        await readGovernance.proposalCount()
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
        await readProposal(i);

      const executed =
        proposal.executed;

      const ended =
        Number(
          proposal.endTime
        ) < now;

      const passed =
        await readGovernance.proposalPassed(
          i
        );

      const executionDeadline =
        Number(proposal.endTime) +
        7 * 24 * 60 * 60;

      const executionWindowOpen =
        ended &&
        now <= executionDeadline;

      if (
        !executed &&
        executionWindowOpen &&
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

function escapeHtml(value) {

  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]
  );
}

async function loadProposalFeed() {

  try {

    proposalFeed.innerHTML = "";

    const total =
      Number(
        await readGovernance.proposalCount()
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
  await readProposal(i);

const recipientName =
  await displayName(
    p.recipient
  );

const safeRecipientName =
  escapeHtml(
    recipientName
  );

const safeTitle =
  "Treasury Transfer";

const safeDescription =
  escapeHtml(
    p.description
  );

const participationRequired =
  await readGovernance.requiredParticipationVotes(i);

const yesRequired =
  await readGovernance.requiredYesVotes(i);

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
          ${safeRecipientName}
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
          await readGovernance.proposalPassed(i);

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
          Proposal #${i}: ${safeTitle}
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
          ${safeDescription}
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
          Electorate Snapshot:<br>
          ${Number(p.electorateSize)} members
        </p>

        <p>
          Participation Required:<br>
          ${Number(participationRequired)} votes
        </p>

        <p>
          YES Votes Currently Required:<br>
          ${Number(yesRequired)}
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
              governanceVerified &&
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

    if (
      !governanceVerified ||
      !governance ||
      !signer ||
      !userAddress
    ) {

      setProposalActionStatus(
        id,
        "Connect a wallet holding the required LABRV membership before voting.",
        "error"
      );

      return;
    }

    showLoading(
      "Submitting vote..."
    );

    setProposalActionStatus(
      id,
      "Submitting vote..."
    );

    const eligible =
      await governance.eligibleToVote(
        id,
        userAddress
      );

    if (!eligible) {
      throw new Error(
        "This wallet is not eligible to vote on this proposal or has already voted."
      );
    }

    const tx =
      await governance.vote(
        id,
        support
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

    if (
      !governance ||
      !signer ||
      !userAddress
    ) {

      setProposalActionStatus(
        id,
        "Connect a wallet before executing this proposal.",
        "error"
      );

      return;
    }

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

async function waitForLaborWallet(
  timeoutMs = 10000
) {

  const started =
    Date.now();

  while (
    !window.LaborWallet &&
    Date.now() - started < timeoutMs
  ) {

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          100
        )
    );
  }

  return window.LaborWallet ||
    null;
}

async function applyReconnectedWallet(
  wallet
) {

  if (
    !wallet ||
    walletInitialized
  ) {
    return;
  }

  walletInitialized = true;

  provider =
    wallet.provider;

  signer =
    wallet.signer;

  userAddress =
    ethers.getAddress(
      wallet.address
    );

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

  govConnectBtn.style.display =
    "none";

  if (bal === ethers.parseEther("1")) {

    setStatus(
      "Wallet reconnected",
      "success"
    );

  } else {

    setStatus(
      "Wallet reconnected. This address has no LABRV voting rights, but it may still execute approved proposals.",
      "error"
    );
  }

  await loadProposalFeed();
}

async function initializeGovernancePage() {

  if (!DEPLOYMENT_ACTIVE) {
    proposalFeedSection.classList.remove("hidden");
    proposalFeed.innerHTML =
      "<p class=\"status\" style=\"text-align:center;color:#ff4d4d;\">Revision 7 is in predeployment mode. Governance reads and transactions are disabled until final addresses are verified.</p>";
    setStatus(
      "Predeployment mode. Enter and verify all final addresses in protocol-config.js before enabling governance.",
      "error"
    );
    return;
  }

  proposalFeedSection.classList.remove(
    "hidden"
  );

  await loadProposalFeed();

  try {

    const laborWallet =
      await waitForLaborWallet();

    if (!laborWallet) {
      return;
    }

    const wallet =
      await laborWallet.ready;

    await applyReconnectedWallet(
      wallet
    );

  } catch (err) {

    console.error(
      "Wallet reconnect failed:",
      err
    );
  }
}

if (
  document.readyState ===
  "loading"
) {

  window.addEventListener(
    "DOMContentLoaded",
    initializeGovernancePage,
    {
      once: true
    }
  );

} else {

  initializeGovernancePage();
}
