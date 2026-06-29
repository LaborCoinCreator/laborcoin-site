// ===== CONFIG =====

const DAO_TREASURY =
  "0x0C2e5679153593b82a84eAB5CA90895BB291Cec4";

let provider;
let signer;

let walletInitialized = false;

// ===== ELEMENTS =====

const connectBtn =
  document.getElementById(
    "connectBtn"
  );

const donateBtn =
  document.getElementById(
    "donateBtn"
  );

const donationAmount =
  document.getElementById(
    "donationAmount"
  );

const donationStatus =
  document.getElementById(
    "donationStatus"
  );

// ===== STATUS =====

function setStatus(
  msg,
  type = ""
) {

  donationStatus.innerText =
    msg;

  donationStatus.style.color =
    type === "error"
      ? "#ff4d4d"
      : type === "success"
      ? "#4dff88"
      : "#ccc";
}

// ===== CONNECT =====
connectBtn.onclick =
async () => {

  try {

    if (!window.LaborWallet) {
      throw new Error(
        "Wallet system is still loading. Please wait a moment and try again."
      );
    }

    setStatus(
      "Opening wallet connection..."
    );

    connectBtn.disabled = true;
    connectBtn.innerText = "Connecting...";

    const wallet =
      await window.LaborWallet.connect();

    walletInitialized = true;

    provider =
      wallet.provider;

    signer =
      wallet.signer;

    connectBtn.style.display =
      "none";

    donateBtn.disabled = false;

    setStatus(
      "Ready to donate",
      "success"
    );

  } catch (err) {

    console.error(err);

    connectBtn.disabled = false;
    connectBtn.innerText = "Connect Wallet";

    setStatus(
      err.message ||
      "Connection failed",
      "error"
    );
  }
};

// ===== DONATE =====

donateBtn.onclick =
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
      donationAmount.value.trim();

    if (
      !amount ||
      Number(amount) <= 0
    ) {

      setStatus(
        "Enter donation amount",
        "error"
      );

      return;
    }

    donateBtn.disabled = true;

    setStatus(
      "Submitting donation..."
    );

    const tx =
      await signer.sendTransaction({

        to:
          DAO_TREASURY,

        value:
          ethers.parseEther(
            amount
          )
      });

    await tx.wait();

    donationAmount.value =
      "";

    setStatus(
      "Donation successful",
      "success"
    );

  } catch (err) {

    console.error(err);

    setStatus(
      err.code === 4001 ||
      err.code === "ACTION_REJECTED"
        ? "Donation cancelled"
        : "Donation failed",
      "error"
    );

  } finally {

    donateBtn.disabled = false;
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
        await window.LaborWallet.reconnect();

      if (!wallet) {
        return;
      }

      if (walletInitialized) {
        return;
      }

      walletInitialized = true;

      connectBtn.click();

    } catch (err) {

      console.error(err);
    }
  }
);
