// ===== CONFIG =====
const LABR_TOKEN =
  "0x460DD873A1D2a41e77410B125cD3027C5FEd2f78";

const REGISTRATION_CONTRACT =
  "0xFFc3499A71b806C3919f4B54D236b151cFdCB453";

const LABRV_TOKEN =
  "0x113579220515cd59b884Ea2379b4C369025246e2";

const VERIFIER_URL =
  "https://laborcoin-verifier.onrender.com";

// ===== ABIS =====
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)"
];

const REGISTRATION_ABI = [
  "function register(bytes signature)"
];

const LABRV_ABI = [
  "function delegate(address delegatee)",
  "function delegates(address account) view returns (address)"
];

// ===== STATE =====
let provider;
let signer;
let userAddress;

let registration;
let labr;
let labrv;

let registrationSignature;

// ===== ELEMENTS =====
const connectBtn =
  document.getElementById("connectBtn");

const verifyBtn =
  document.getElementById("verifyBtn");

const attestBtn =
  document.getElementById("attestBtn");

const registerBtn =
  document.getElementById("registerBtn");

const daoStatus =
  document.getElementById("daoStatus");

const attestationModal =
  document.getElementById(
    "attestationModal"
  );

const confirmAttestationBtn =
  document.getElementById(
    "confirmAttestationBtn"
  );

const cancelAttestationBtn =
  document.getElementById(
    "cancelAttestationBtn"
  );

// ===== HELPERS =====
function setStatus(msg, type = "") {

  daoStatus.innerText = msg;

  daoStatus.style.color =
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
connectBtn.onclick = async () => {

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

    // ===== CONTRACTS =====
    registration =
      new ethers.Contract(
        REGISTRATION_CONTRACT,
        REGISTRATION_ABI,
        signer
      );

    labr =
      new ethers.Contract(
        LABR_TOKEN,
        ERC20_ABI,
        provider
      );

    labrv =
      new ethers.Contract(
        LABRV_TOKEN,
        LABRV_ABI,
        signer
      );

    completeStep("step-wallet");

    // ===== VERIFY LABR =====
    const balance =
      await labr.balanceOf(
        userAddress
      );

    if (
      Number(balance) <
      Number(
        ethers.parseEther("1")
      )
    ) {

      setStatus(
        "Requires at least 1 LABR",
        "error"
      );

      return;

    }

    completeStep("step-balance");

    attestBtn.disabled = false;

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

// ===== VERIFY IDENTITY =====
verifyBtn.onclick = async () => {

  try {

    if (!userAddress) {

      setStatus(
        "Connect wallet first",
        "error"
      );

      return;

    }

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
            type: "registration"
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

    registrationSignature =
      data.signature;

    completeStep("step-identity");

    setStatus(
      "Identity verified",
      "success"
    );

  } catch (err) {

    console.error(err);

    setStatus(
      "Verification failed",
      "error"
    );

  }

};

// ===== SIGN ATTESTATION =====

// ===== OPEN MODAL =====
attestBtn.onclick = () => {

  if (!signer) {

    setStatus(
      "Connect wallet first",
      "error"
    );

    return;
  }

  attestationModal.classList.remove(
    "hidden"
  );

};

// ===== CANCEL =====
cancelAttestationBtn.onclick = () => {

  attestationModal.classList.add(
    "hidden"
  );

};

// ===== CONFIRM + SIGN =====
confirmAttestationBtn.onclick =
  async () => {

  try {

    const message = `
LaborCoin DAO Attestation

I affirm my support for democratic worker organization,
transparent collective governance, and mutual aid.

I understand that LaborCoin is designed to strengthen
collective economic power through shared participation,
coordination, and long-term solidarity.

I support the principle that shared resources should be
used to assist workers engaged in strikes, labor actions,
mutual aid efforts, and other forms of collective support.

I recognize that proposals involving treasury funds
should prioritize legitimate worker-centered initiatives
and transparent community accountability.

Participation in LaborCoin is voluntary and intended
to strengthen cooperation, democratic governance,
and collective power.

Power to the People.
`;

    await signer.signMessage(
      message
    );

    completeStep(
      "step-attest"
    );

    registerBtn.disabled = false;

    setStatus(
      "Attestation signed",
      "success"
    );

    attestationModal.classList.add(
      "hidden"
    );

    // ===== DOWNLOAD PDF =====
    const link =
      document.createElement("a");

    link.href =
      "attestation.pdf";

    link.download =
      "LaborCoin-DAO-Attestation.pdf";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

  } catch (err) {

    console.error(err);

    setStatus(
      "Attestation cancelled",
      "error"
    );

  }

};

// ===== REGISTER =====
registerBtn.onclick = async () => {

  try {

    if (!registrationSignature) {

      setStatus(
        "Verify identity first",
        "error"
      );

      return;

    }

    const tx =
      await registration.register(
        registrationSignature
      );

    setStatus(
      "Confirming registration...",
      "success"
    );

    await tx.wait();

    // ===== AUTO DELEGATE =====
    const currentDelegate =
      await labrv.delegates(
        userAddress
      );

    if (
      currentDelegate.toLowerCase() !==
      userAddress.toLowerCase()
    ) {

      const delegateTx =
        await labrv.delegate(
          userAddress
        );

      await delegateTx.wait();

    }

    completeStep("step-register");

    setStatus(
      "DAO registration complete",
      "success"
    );

  } catch (err) {

    console.error(err);

    setStatus(
      "Registration failed",
      "error"
    );

  }

};