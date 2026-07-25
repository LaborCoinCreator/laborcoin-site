// ===== REVISION 7 SHARED IDENTITY + REGISTRATION =====
const SITE_CONFIG = window.LaborCoinConfig;
const DEPLOYMENT_ACTIVE = window.LaborCoinDeployment?.isActive() === true;
const LABR_TOKEN = SITE_CONFIG?.addresses?.labr || ethers.ZeroAddress;
const IDENTITY_REGISTRY = SITE_CONFIG?.addresses?.identityRegistry || ethers.ZeroAddress;
const REGISTRATION_CONTRACT = SITE_CONFIG?.addresses?.registration || ethers.ZeroAddress;
const LABRV_TOKEN = SITE_CONFIG?.addresses?.labrv || ethers.ZeroAddress;
const VERIFIER_URL = SITE_CONFIG?.verifierUrl || "";
const ENS_OVERRIDES = {"0x015b6d0990e56d908c876474c6a30eba2b8a0cfb":"laborcoin.eth"};

const ERC20_ABI=["function balanceOf(address) view returns(uint256)"];
const IDENTITY_ABI=["function isVerified(address) view returns(bool)","function verifyParticipant(uint256,uint256,bytes)","function identityReady() view returns(bool)"];
const REGISTRATION_ABI=["function register()","function registered(address) view returns(bool)","function memberNumber(address) view returns(uint256)","function registrationTimestamp(address) view returns(uint256)","function getMemberData(address) view returns(bool,uint256,uint256)","function totalMembers() view returns(uint256)"];
const LABRV_ABI=["function balanceOf(address) view returns(uint256)"];

let provider,signer,userAddress,identity,registration,labr,labrv;
let walletInitialized=false;
let cachedCertificateFile=null,cachedCertificateUrl=null,cachedCertificateName=null;

const connectBtn=document.getElementById("connectBtn");
const verifyBtn=document.getElementById("verifyBtn");
const attestBtn=document.getElementById("attestBtn");
const registerBtn=document.getElementById("registerBtn");
const daoStatus=document.getElementById("daoStatus");
const memberCount=document.getElementById("memberCount");
const certificateBox=document.getElementById("certificateBox");
const certificateText=document.getElementById("certificateText");
const downloadCertificateBtn=document.getElementById("downloadCertificateBtn");
const certificateStatus=document.getElementById("certificateStatus");
const governanceAccessWrapper=document.getElementById("governanceAccessWrapper");
const attestationModal=document.getElementById("attestationModal");
const confirmAttestationBtn=document.getElementById("confirmAttestationBtn");
const cancelAttestationBtn=document.getElementById("cancelAttestationBtn");
const downloadAttestationBtn=document.getElementById("downloadAttestationBtn");
const loadingOverlay=document.getElementById("loadingOverlay");
const loadingText=document.getElementById("loadingText");

connectBtn.disabled=!DEPLOYMENT_ACTIVE; verifyBtn.disabled=true; attestBtn.disabled=true; registerBtn.disabled=true;
if(!DEPLOYMENT_ACTIVE){daoStatus.innerText="Revision 7 is in predeployment mode. Registration is disabled until all seven final contract addresses and runtime commitments are verified.";daoStatus.style.color="#ff4d4d";}
function setStatus(msg,type=""){daoStatus.innerText=msg;daoStatus.style.color=type==="error"?"#ff4d4d":type==="success"?"#4dff88":"#ccc";}
function completeStep(id,complete=true){document.getElementById(id)?.classList.toggle("complete",Boolean(complete));}
function showLoading(text){if(loadingText)loadingText.innerText=text;loadingOverlay?.classList.remove("hidden");}
function hideLoading(){loadingOverlay?.classList.add("hidden");}

async function showMembershipData(){
  try{
    const memberData=await registration.getMemberData(userAddress); if(!memberData[0])return;
    const memberId=Number(memberData[1]),registeredAt=Number(memberData[2]); let displayName=userAddress;
    const overrideName=ENS_OVERRIDES[userAddress.toLowerCase()]; if(overrideName)displayName=overrideName;
    try{const ethProvider=new ethers.JsonRpcProvider(SITE_CONFIG?.ensRpcUrl||"https://ethereum-rpc.publicnode.com");const ens=await ethProvider.lookupAddress(userAddress);if(ens)displayName=ens;}catch(err){console.log("ENS lookup failed",err);}
    const date=new Date(registeredAt*1000);
    certificateText.innerHTML=`<div style="font-size:28px;font-weight:bold;">Member #${memberId}</div><br><div style="font-size:22px;">${displayName}</div><br><div style="font-size:14px;color:#aaa;">${userAddress.slice(0,6)}...${userAddress.slice(-4)}</div><br><div style="font-size:16px;">Registered</div><div style="font-size:18px;">${date.toLocaleString()}</div>`;
    certificateBox.classList.remove("hidden");
  }catch(err){console.error("Membership display failed",err);}
}

async function refreshRegistrationState(){
  if(!userAddress)return;
  const [isRegistered,isVerified,balance,total]=await Promise.all([registration.registered(userAddress),identity.isVerified(userAddress),labr.balanceOf(userAddress),registration.totalMembers()]);
  if(memberCount)memberCount.innerText=`Registered members: ${Number(total).toLocaleString()}`;
  completeStep("step-wallet",true); completeStep("step-balance",balance>=ethers.parseEther("1")); completeStep("step-identity",isVerified);
  verifyBtn.disabled=isVerified;
  if(isRegistered){completeStep("step-attest",true);completeStep("step-register",true);governanceAccessWrapper.classList.remove("hidden");attestBtn.disabled=true;registerBtn.disabled=true;setStatus("Already registered. Governance access unlocked.","success");await showMembershipData();setCertificateStatus("Preparing certificate...");await buildMembershipCertificate();setCertificateStatus("Certificate prepared. Tap Download Certificate to save or share.","success");return;}
  attestBtn.disabled=!(isVerified && balance>=ethers.parseEther("1"));
  if(!isVerified)setStatus("Permanent Human Passport verification is required before registration.","error");
  else if(balance<ethers.parseEther("1"))setStatus("Identity verified. Hold at least 1 LABR to register.","error");
  else setStatus("Identity and LABR requirements passed. Sign the attestation to continue.","success");
}

async function adoptWallet(wallet){
  provider=wallet.provider;signer=wallet.signer;userAddress=ethers.getAddress(wallet.address);
  identity=new ethers.Contract(IDENTITY_REGISTRY,IDENTITY_ABI,signer);
  registration=new ethers.Contract(REGISTRATION_CONTRACT,REGISTRATION_ABI,signer);
  labr=new ethers.Contract(LABR_TOKEN,ERC20_ABI,provider);
  labrv=new ethers.Contract(LABRV_TOKEN,LABRV_ABI,signer);
  connectBtn.style.display="none";await refreshRegistrationState();
}

connectBtn.onclick=async()=>{try{window.LaborCoinDeployment.requireActive();if(!window.LaborWallet)throw new Error("Wallet system is still loading. Please wait a moment and try again.");setStatus("Opening wallet connection...");connectBtn.disabled=true;connectBtn.innerText="Connecting...";const wallet=await window.LaborWallet.connect();walletInitialized=true;await adoptWallet(wallet);}catch(err){console.error(err);connectBtn.disabled=false;connectBtn.innerText="Connect Wallet";setStatus(err.message||"Connection failed","error");}};

verifyBtn.onclick=async()=>{try{if(!userAddress)throw new Error("Connect wallet first.");verifyBtn.disabled=true;showLoading("Checking Human Passport score...");const response=await fetch(`${VERIFIER_URL}/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({address:userAddress,type:"identity"})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||`Human Passport score must be at least ${SITE_CONFIG.limits.minPassportScore}.`);if(!data.signature||!data.expiry||!data.scoreThousandths)throw new Error("Verification response is incomplete.");showLoading("Recording permanent identity verification...");const tx=await identity.verifyParticipant(data.scoreThousandths,data.expiry,data.signature);await tx.wait();if(!await identity.isVerified(userAddress))throw new Error("Registry did not confirm verification.");setStatus(`Permanent identity verification confirmed. Human Passport score: ${data.score}.`,"success");await refreshRegistrationState();}catch(err){console.error(err);setStatus(err.shortMessage||err.reason||err.message||"Verification failed","error");verifyBtn.disabled=false;}finally{hideLoading();}};

attestBtn.onclick=()=>{if(!signer){setStatus("Connect wallet first","error");return;}attestationModal.classList.remove("hidden");};
cancelAttestationBtn.onclick=()=>attestationModal.classList.add("hidden");
confirmAttestationBtn.onclick=async()=>{try{const message=`
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
`;await signer.signMessage(message);completeStep("step-attest",true);registerBtn.disabled=false;setStatus("Attestation signed","success");attestationModal.classList.add("hidden");const link=document.createElement("a");link.href="attestation.pdf";link.download="LaborCoin-DAO-Attestation.pdf";document.body.appendChild(link);link.click();document.body.removeChild(link);}catch(err){console.error(err);setStatus("Attestation cancelled","error");}};
downloadAttestationBtn.onclick=()=>{const link=document.createElement("a");link.href="attestation.pdf";link.download="LaborCoin-DAO-Attestation.pdf";link.click();};

async function imageToJpegDataUrl(
  src,
  width,
  height
) {

  const img =
    new Image();

  img.src =
    src;

  await new Promise(
    (resolve, reject) => {

      img.onload =
        resolve;

      img.onerror =
        reject;
    }
  );

  const canvas =
    document.createElement("canvas");

  canvas.width =
    width;

  canvas.height =
    height;

  const ctx =
    canvas.getContext("2d");

  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  ctx.drawImage(
    img,
    0,
    0,
    width,
    height
  );

  return canvas.toDataURL(
    "image/jpeg",
    0.95
  );
}

async function buildMembershipCertificate() {

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

  const logoSize = 45;

  const logoData =
    await imageToJpegDataUrl(
      "assets/logo.png",
      512,
      512
    );

  pdf.addImage(
    logoData,
    "JPEG",
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

  const qrCanvas =
    qrContainer.querySelector(
      "canvas"
    );

  const qrImage =
    qrContainer.querySelector(
      "img"
    );

  const qrSize = 22;

  if (qrCanvas) {

    const qrData =
      qrCanvas.toDataURL(
        "image/jpeg",
        0.95
      );

    pdf.addImage(
      qrData,
      "JPEG",
      (pageWidth / 2) - (qrSize / 2),
      215,
      qrSize,
      qrSize
    );

  } else if (qrImage) {

    const qrData =
      await imageToJpegDataUrl(
        qrImage.src,
        120,
        120
      );

    pdf.addImage(
      qrData,
      "JPEG",
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

    const pdfFile =
      new File(
        [pdfBlob],
        fileName,
        {
          type: "application/pdf"
        }
      );

    if (cachedCertificateUrl) {

      URL.revokeObjectURL(
        cachedCertificateUrl
      );
    }

    cachedCertificateFile =
      pdfFile;

    cachedCertificateUrl =
      URL.createObjectURL(pdfBlob);

    cachedCertificateName =
      fileName;

    return {
      file: pdfFile,
      url: cachedCertificateUrl,
      name: fileName
    };

}

async function downloadMembershipCertificate() {

  if (!cachedCertificateFile) {

    setCertificateStatus(
      "Preparing certificate..."
    );

    await buildMembershipCertificate();

    setCertificateStatus(
      "Certificate prepared. Tap Download Certificate to save or share.",
      "success"
    );
  }

  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent
    );

  if (
    isMobile &&
    navigator.canShare &&
    navigator.canShare({
      files: [cachedCertificateFile]
    })
  ) {

    try {

      await navigator.share({
        files: [cachedCertificateFile],
        title: "LaborCoin Membership Certificate",
        text: "LaborCoin DAO membership certificate"
      });

      setCertificateStatus(
        "Certificate shared.",
        "success"
      );

      return;

    } catch (err) {

      console.error(
        "Mobile share failed, using download fallback",
        err
      );
    }
  }

  const link =
    document.createElement("a");

  link.href =
    cachedCertificateUrl;

  link.download =
    cachedCertificateName ||
    "LaborCoin-Membership-Certificate.pdf";

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  setCertificateStatus(
    isMobile
      ? "Certificate opened. Use your browser share or save option if needed."
      : "Certificate downloaded.",
    "success"
  );
}

function setCertificateStatus(msg, type = "") {

  if (!certificateStatus) {
    return;
  }

  certificateStatus.innerText = msg;

  certificateStatus.style.color =
    type === "error"
      ? "#ff4d4d"
      : type === "success"
      ? "#4dff88"
      : "#ccc";
}

// ===== REGISTER WITH SHARED IDENTITY =====
registerBtn.onclick=async()=>{
  let registrationConfirmed=false;
  try{
    registerBtn.disabled=true;setStatus("Registering DAO membership...");showLoading("Registering DAO membership...");
    if(!await identity.isVerified(userAddress))throw new Error("Permanent identity verification is required.");
    if(await labr.balanceOf(userAddress)<ethers.parseEther("1"))throw new Error("At least 1 LABR is required to register.");
    const tx=await registration.register();setStatus("Confirming registration...");await tx.wait();
    const [isRegistered,labrvBalance]=await Promise.all([registration.registered(userAddress),labrv.balanceOf(userAddress)]);
    if(!isRegistered||labrvBalance===0n)throw new Error("Registration confirmed, but membership state could not be verified.");
    registrationConfirmed=true;completeStep("step-register",true);governanceAccessWrapper.classList.remove("hidden");hideLoading();setStatus("DAO registration complete.","success");
    try{await showMembershipData();await buildMembershipCertificate();setCertificateStatus("Certificate prepared. Tap Download Certificate to save or share.","success");}catch(postError){console.error("Post-registration setup failed",postError);setCertificateStatus("Registration succeeded, but the certificate could not be prepared. Reload the page and try again.","error");}
  }catch(err){hideLoading();console.error(err);if(registrationConfirmed){setStatus("DAO registration complete.","success");return;}registerBtn.disabled=false;setStatus(err.shortMessage||err.reason||err.message||"Registration failed","error");}
};

downloadCertificateBtn.onclick=async()=>{try{downloadCertificateBtn.disabled=true;await downloadMembershipCertificate();}catch(err){console.error(err);setCertificateStatus("Certificate download failed","error");}finally{downloadCertificateBtn.disabled=false;}};

window.addEventListener("load",async()=>{try{if(!DEPLOYMENT_ACTIVE||!window.LaborWallet)return;const wallet=await window.LaborWallet.reconnect();if(!wallet||walletInitialized)return;walletInitialized=true;await adoptWallet(wallet);}catch(err){console.error(err);}});
