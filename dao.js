// ===== CONFIG =====
const LABR_TOKEN =
  "YOUR_LABR_TOKEN_ADDRESS";

const REGISTRATION_CONTRACT =
  "0xFFc3499A71b806C3919f4B54D236b151cFdCB453";

const LABRV_TOKEN =
  "YOUR_LABRV_TOKEN_ADDRESS";

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
attestBtn.onclick = async () => {

  try {

    const message = `
LaborCoin DAO Attestation

I acknowledge and agree to the following principles:

• Buy LABR to strengthen collective resources.
• Sell LABR primarily to support strikes, mutual aid, or collective worker action.
• Only support legitimate worker organizations, unions, strike funds, or solidarity efforts.
• Use governance responsibly and transparently.
• Recognize that participation in the LaborCoin system contributes to collective worker power.

Power to the People.
`;

    await signer.signMessage(
      message
    );

    completeStep("step-attest");

    registerBtn.disabled = false;

    setStatus(
      "Attestation signed",
      "success"
    );

    // ===== DOWNLOAD CERTIFICATE =====
    const blob =
      new Blob(
        [message],
        { type: "text/plain" }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      `laborcoin-attestation-${userAddress}.txt`;

    a.click();

    URL.revokeObjectURL(url);

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