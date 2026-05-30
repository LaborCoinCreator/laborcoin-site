// ===== CONFIG =====
const LABR_TOKEN =
  "0x460DD873A1D2a41e77410B125cD3027C5FEd2f78";

const REGISTRATION_CONTRACT =
  "0xa7D0C092C2391379046cACDc56BEbDe5A0CBD113";

const LABRV_TOKEN =
  "0x113579220515cd59b884Ea2379b4C369025246e2";

const VERIFIER_URL =
  "https://laborcoin-verifier.onrender.com";

// ===== ABIS =====
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)"
];

const REGISTRATION_ABI = [

  "function register(bytes signature)",

  "function registered(address) view returns (bool)",

  "function memberNumber(address) view returns (uint256)",

  "function registrationTimestamp(address) view returns (uint256)",

  "function getMemberData(address) view returns (bool,uint256,uint256)",

  "function totalMembers() view returns (uint256)"
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

const certificateBox =
  document.getElementById(
    "certificateBox"
  );

const certificateText =
  document.getElementById(
    "certificateText"
  );

const downloadCertificateBtn =
  document.getElementById(
    "downloadCertificateBtn"
  );

const governanceAccessWrapper =
  document.getElementById(
    "governanceAccessWrapper"
  );

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

// ===== INITIAL UI STATE =====
verifyBtn.disabled = true;
attestBtn.disabled = true;
registerBtn.disabled = true;

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

async function showMembershipData() {

  try {

    const memberData =
      await registration.getMemberData(
        userAddress
      );

    const isRegistered =
      memberData[0];

    const memberId =
      Number(memberData[1]);

    const registeredAt =
      Number(memberData[2]);

    if (!isRegistered) {
      return;
    }

  let displayName =
    userAddress;

  try {

    const ethProvider =
      new ethers.JsonRpcProvider(
        "https://ethereum-rpc.publicnode.com"
      );

    const ens =
      await ethProvider.lookupAddress(
        userAddress
      );

console.log(
  "Address:",
  userAddress
);

console.log(
  "ENS:",
  ens
);

    console.log(
      "ENS:",
      ens
    );

    if (ens) {

      displayName = ens;

    }

  } catch (err) {

    console.log(
      "ENS lookup failed",
      err
    );

  }

    const date =
      new Date(
        registeredAt * 1000
      );

    certificateText.innerHTML = `
    <div style="font-size:28px;font-weight:bold;">
      Member #${memberId}
    </div>

    <br>

    <div style="font-size:22px;">
      ${displayName}
    </div>

    <br>

    <div style="font-size:14px;color:#aaa;">
      ${userAddress.slice(0,6)}...${userAddress.slice(-4)}
    </div>

    <br>

    <div style="font-size:16px;">
      Registered
    </div>

    <div style="font-size:18px;">
      ${date.toLocaleString()}
    </div>
  `;

    certificateBox.classList.remove(
      "hidden"
    );

  } catch (err) {

    console.error(
      "Membership display failed",
      err
    );
  }
}

const loadingOverlay =
  document.getElementById(
    "loadingOverlay"
  );

const loadingText =
  document.getElementById(
    "loadingText"
  );

function showLoading(text) {

  loadingText.innerText =
    text;

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

    verifyBtn.disabled = false;

    const alreadyRegistered =
  await registration.registered(
    userAddress
  );

if (alreadyRegistered) {

  completeStep("step-identity");

  completeStep("step-attest");

  completeStep("step-register");

  governanceAccessWrapper
    .classList
    .remove("hidden");

  await showMembershipData();

  setStatus(
    "Already registered",
    "success"
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
      "Connection failed",
      "error"
    );

  }

};

// ===== VERIFY IDENTITY =====
verifyBtn.onclick = async () => {

  try {

verifyBtn.disabled = true;

setStatus(
  "Verifying identity..."
);

showLoading(
  "Verifying identity..."
);

    if (!userAddress) {

      hideLoading();

      verifyBtn.disabled = false;

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

    if (response.ok && data.success) {

      daoStatus.innerText =
        `Verification passed.\nPassport score: ${data.score}`;

      daoStatus.style.color =
        "#4dff88";

    } else {

      daoStatus.innerText =
        `Verification failed.\nPassport score: ${data.score || 0}\nMinimum required: 15`;

      daoStatus.style.color =
        "#ff4d4d";
    }

    if (!response.ok || !data.success) {

      hideLoading();

      verifyBtn.disabled = false;

      return;
    }

    registrationSignature =
      data.signature;

    completeStep("step-identity");

    attestBtn.disabled = false;

    hideLoading();

  } catch (err) {

  hideLoading();

  console.error(err);

  verifyBtn.disabled = false;

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

const downloadAttestationBtn =
  document.getElementById(
    "downloadAttestationBtn"
  );

downloadAttestationBtn.onclick =
() => {

  const link =
    document.createElement("a");

  link.href =
    "attestation.pdf";

  link.download =
    "LaborCoin-DAO-Attestation.pdf";

  link.click();

};

// ===== MEMBERSHIP CERTIFICATE =====

async function generateMembershipCertificate() {

  const memberData =
    await registration.getMemberData(
      userAddress
    );

  const memberId =
    Number(memberData[1]);

  const registeredAt =
    Number(memberData[2]);

  const date =
    new Date(
      registeredAt * 1000
    );

let displayName =
  userAddress;

try {

  const ethProvider =
    new ethers.JsonRpcProvider(
      "https://ethereum-rpc.publicnode.com"
    );

  const ens =
    await ethProvider.lookupAddress(
      userAddress
    );

  if (ens) {

    displayName = ens;

  }

} catch {

  displayName =
    userAddress;

}

  const { jsPDF } =
    window.jspdf;

  const pdf =
    new jsPDF();

  // =====================================
  // BORDER
  // =====================================

  pdf.setLineWidth(1);

  pdf.rect(
    10,
    10,
    190,
    277
  );

  // =====================================
  // LOGO
  // =====================================

  const logo =
    new Image();

  logo.src =
    "assets/logo.png";

  await new Promise(
    resolve => {

      logo.onload =
        resolve;

      logo.onerror =
        resolve;

    }
  );

  pdf.addImage(
    logo,
    "PNG",
    75,
    18,
    60,
    60
  );

  // =====================================
  // TITLE
  // =====================================

  pdf.setFontSize(34);
  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.text(
    "CERTIFICATE OF MEMBERSHIP",
    105,
    95,
    {
      align: "center"
    }
  );

  pdf.setFontSize(28);

  pdf.text(
    "LaborCoin DAO",
    105,
    115,
    {
      align: "center"
    }
  );

  // =====================================
  // BODY
  // =====================================

  pdf.setFont(
    "helvetica",
    "italic"
  );

  pdf.setFontSize(18);

  pdf.text(
    "This certifies that",
    105,
    130,
    {
      align: "center"
    }
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  if (
    displayName &&
    displayName !== userAddress
  ) {

  pdf.text(
    displayName,
    105,
    142,
    {
      align: "center"
    }
  );

  pdf.text(
    userAddress,
    105,
    152,
    {
      align: "center"
    }
  );

} else {

  pdf.text(
    userAddress,
    105,
    147,
    {
      align: "center"
    }
  );

}

  pdf.setFontSize(18);

  pdf.text(
    "is a verified member of the",
    105,
    158,
    {
      align: "center"
    }
  );

  pdf.text(
    "LaborCoin DAO",
    105,
    168,
    {
      align: "center"
    }
  );

  // =====================================
  // MEMBER INFO
  // =====================================

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(24);

  pdf.text(
    `Member #${memberId}`,
  105,
  188,
  {
    align: "center"
  }
);

pdf.setFont(
  "helvetica",
  "italic"
);

pdf.setFontSize(14);

pdf.text(
  `Certificate No. LC-${memberId}`,
  105,
  198,
  {
    align: "center"
  }
);

pdf.setFont(
  "helvetica",
  "normal"
);

pdf.setFontSize(14);

pdf.text(
  `Registered: ${date.toLocaleDateString()}`,
  105,
  208,
  {
    align: "center"
  }
);

  // =====================================
  // QR CODE
  // =====================================

  const qrContainer =
    document.createElement("div");

  new QRCode(
    qrContainer,
    {
      text:
        "https://laborcoin.tech",
      width: 120,
      height: 120
    }
  );

  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        300
      )
  );

  const qrImage =
    qrContainer.querySelector(
      "img"
    );

  if (qrImage) {

    pdf.addImage(
      qrImage.src,
      "PNG",
      87,
      220,
      36,
      36
    );

  }

  // =====================================
  // PRINCIPLES
  // =====================================

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(20);

  pdf.text(
  "One Verified Identity",
  105,
  265,
  {
    align: "center"
  }
);

pdf.text(
  "One Vote",
  105,
  272,
  {
    align: "center"
  }
);

pdf.setFont(
  "helvetica",
  "normal"
);

pdf.setFontSize(14);

pdf.text(
  "laborcoin.tech",
  105,
  282,
  {
    align: "center"
  }
);

  // =====================================
  // SAVE
  // =====================================

  pdf.save(
    `LaborCoin-Member-${memberId}.pdf`
  );

}

// ===== REGISTER =====
registerBtn.onclick = async () => {

  try {

registerBtn.disabled = true;

setStatus(
  "Registering DAO membership..."
);

showLoading(
  "Registering DAO membership..."
);

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

      await showMembershipData();

      await generateMembershipCertificate();

    governanceAccessWrapper
      .classList
      .remove("hidden");

    hideLoading();
    setStatus(
      "DAO registration complete.",
      "success"
    );

  } catch (err) {

    hideLoading();

    console.error(err);

    // ===== ALREADY REGISTERED =====
    const errorText =
      JSON.stringify(err).toLowerCase();

    if (
      errorText.includes("already registered")
    ) {

      governanceAccessWrapper
        .classList
        .remove("hidden");

      setStatus(
        "Already registered. Governance access unlocked.",
        "success"
      );

      return;

    }

    setStatus(
      "Registration failed",
      "error"
    );

  }

};

downloadCertificateBtn.onclick =
async () => {

  await generateMembershipCertificate();

};

window.addEventListener(
  "load",
  async () => {

    try {

      if (!window.ethereum)
        return;

      const accounts =
        await window.ethereum.request({
          method:
            "eth_accounts"
        });

      if (
        accounts.length > 0
      ) {

        connectBtn.click();

      }

    } catch (err) {

      console.error(err);

    }

  }
);