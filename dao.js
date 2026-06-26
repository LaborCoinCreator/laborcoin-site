// ===== CONFIG =====
const LABR_TOKEN =
  "0x460DD873A1D2a41e77410B125cD3027C5FEd2f78";

const REGISTRATION_CONTRACT =
  "0xd1CD6C0B6f1F709A52908B40C07D3C54649e323C";

const LABRV_TOKEN =
  "0x833242E933c675846D8f8982048FecA95B8e435A";

const VERIFIER_URL =
  "https://laborcoin-verifier.onrender.com";

const ENS_OVERRIDES = {

  "0x015b6d0990e56d908c876474c6a30eba2b8a0cfb":
    "laborcoin.eth"

};

// ===== ABIS =====
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)"
];

const REGISTRATION_ABI = [

  "function register(uint256 expiry, bytes signature)",

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
let registrationExpiry;

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

const overrideName =
  ENS_OVERRIDES[
    userAddress.toLowerCase()
  ];

if (overrideName) {

  displayName =
    overrideName;

}

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

  if (loadingText) {

    loadingText.innerText =
      text;
  }

  if (loadingOverlay) {

    loadingOverlay.classList.remove(
      "hidden"
    );
  }
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

    const wallet =
      await window.LaborWallet.connect();

    provider =
      wallet.provider;

    signer =
      wallet.signer;

    userAddress =
      wallet.address;

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
      err.message ||
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

    console.log("VERIFY RESPONSE:", data);

    if (
      !data.signature ||
      !data.expiry
    ) {

      hideLoading();

      verifyBtn.disabled = false;

      setStatus(
        "Verification response missing signature or expiry",
        "error"
      );

      return;
    }

    registrationSignature =
      data.signature;

    registrationExpiry =
      data.expiry;

    sessionStorage.setItem(
      "registrationSignature",
      registrationSignature
    );

    sessionStorage.setItem(
      "registrationExpiry",
      String(registrationExpiry)
    );

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

const overrideName =
  ENS_OVERRIDES[
    userAddress.toLowerCase()
  ];

if (overrideName) {

  displayName =
    overrideName;

}

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
    new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter"
    });

  const pageWidth =
    pdf.internal.pageSize.getWidth();

  const pageHeight =
    pdf.internal.pageSize.getHeight();

  const centerX =
    pageWidth / 2;

  // =====================================
  // BORDER
  // =====================================

  pdf.setLineWidth(2);

  pdf.rect(
    10,
    10,
    pageWidth - 20,
    pageHeight - 20
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

  const logoSize = 45;

  pdf.addImage(
    logo,
    "PNG",
    centerX - (logoSize / 2),
    18,
    logoSize,
    logoSize
  );

  // =====================================
  // TITLE
  // =====================================

  pdf.setFontSize(30);
  pdf.setFont(
    "times",
    "bold"
  );

  pdf.text(
    "CERTIFICATE OF MEMBERSHIP",
    centerX,
    82,
    {
      align: "center"
    }
  );

  pdf.setFontSize(24);

  pdf.text(
    "The LaborCoin DAO",
    centerX,
    100,
    {
      align: "center"
    }
  );

  // =====================================
  // BODY
  // =====================================

  pdf.setFont(
    "times",
    "italic"
  );

  pdf.setFontSize(20);

  pdf.text(
    "hereby certifies that",
    centerX,
    115,
    {
      align: "center"
    }
  );

  pdf.setFont(
    "times",
    "bold"
  );

  pdf.setFontSize(22);

  if (
    displayName &&
    displayName !== userAddress
  ) {

  pdf.text(
    displayName,
    centerX,
    130,
    {
      align: "center"
    }
  );

  pdf.setFontSize(12);

  pdf.text(
    `${userAddress.slice(0,6)}...${userAddress.slice(-4)}`,
    centerX,
    143,
    {
      align: "center"
    }
  );

} else {

  pdf.text(
    userAddress,
    centerX,
    147,
    {
      align: "center"
    }
  );

}

  pdf.setFont(
    "times",
    "italic"
  );  

  pdf.setFontSize(16);

pdf.text(
  "is a verified member of the",
  centerX,
  158,
  {
    align: "center"
  }
);

pdf.setFont(
    "times",
    "bold"
  );

pdf.setFontSize(18);

pdf.text(  
  "LaborCoin DAO",
  centerX,
  168,
  {
    align: "center"
  }
);

pdf.setLineWidth(0.8);

const dividerWidth = 120;

pdf.line(
  (pageWidth - dividerWidth) / 2,
  174,
  (pageWidth + dividerWidth) / 2,
  174
);

pdf.setFont(
  "times",
  "bold"
);

pdf.setFontSize(24);

pdf.text(
  `Member #${memberId}`,
  centerX,
  190,
  {
    align: "center"
  }
);

pdf.setFont(
  "times",
  "italic"
);

pdf.setFontSize(14);

pdf.text(
  `Certificate No. LC-${memberId}`,
  centerX,
  198,
  {
    align: "center"
  }
);

pdf.setFont(
  "times",
  "normal"
);

pdf.setFontSize(14);

pdf.text(
  `Registered: ${date.toLocaleDateString()}`,
  centerX,
  206,
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

  const qrSize = 22;

  pdf.addImage(
    qrImage.src,
    "PNG",
    (pageWidth / 2) - (qrSize / 2),
    215,
    qrSize,
    qrSize
  );

  }

  // =====================================
  // PRINCIPLES
  // =====================================

  pdf.setFont(
    "times",
    "bold"
  );

  pdf.setFontSize(16);

  pdf.text(
  "One Verified Identity",
  centerX,
  248,
  {
    align: "center"
  }
);

pdf.text(
  "One Vote",
  centerX,
  255,
  {
    align: "center"
  }
);

pdf.setFont(
  "times",
  "normal"
);

pdf.setFontSize(14);

pdf.text(
  "laborcoin.tech",
  centerX,
  263,
  {
    align: "center"
  }
);

  // =====================================
  // SAVE
  // =====================================

    const fileName =
      `LaborCoin-Member-${memberId}.pdf`;

    const pdfBlob =
      pdf.output("blob");

    const pdfUrl =
      URL.createObjectURL(pdfBlob);

    downloadCertificateBtn.href =
      pdfUrl;

    downloadCertificateBtn.download =
      fileName;

    return {
      pdfUrl,
      fileName
    };
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

    registrationSignature =
      registrationSignature ||
      sessionStorage.getItem(
        "registrationSignature"
      );

    registrationExpiry =
      registrationExpiry ||
      sessionStorage.getItem(
        "registrationExpiry"
      );

    if (
      !registrationSignature ||
      !registrationExpiry
    ) {

      hideLoading();

      setStatus(
        "Verify identity first",
        "error"
      );

      return;
    }

    const tx =
      await registration.register(
        registrationExpiry,
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
async event => {

  if (
    downloadCertificateBtn.href &&
    downloadCertificateBtn.href !== "#"
  ) {
    return;
  }

  event.preventDefault();

  try {

    await generateMembershipCertificate();

    downloadCertificateBtn.click();

  } catch (err) {

    console.error(err);

    setStatus(
      "Certificate download failed",
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

      connectBtn.click();

    } catch (err) {

      console.error(err);
    }
  }
);

window.addEventListener(
  "laborWalletConnected",
  async event => {

    const wallet =
      event.detail;

    provider =
      wallet.provider;

    signer =
      wallet.signer;

    userAddress =
      wallet.address;

    exchange =
      new ethers.Contract(
        EXCHANGE_ADDRESS,
        EXCHANGE_ABI,
        signer
      );

    completeStep(
      "exchange-step-wallet"
    );

    document.getElementById(
      "connectBtn"
    ).style.display = "none";

    document.getElementById(
      "walletAddress"
    ).innerText =
      userAddress.slice(0, 6)
      +
      "..."
      +
      userAddress.slice(-4);

    setGateStatus(
      "Wallet connected",
      "success"
    );

    updateAll();
  }
);