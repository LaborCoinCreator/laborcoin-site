// ===== CONFIG =====

const DAO_TREASURY =
  "0x0C2e5679153593b82a84eAB5CA90895BB291Cec4";

let provider;
let signer;

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
            {
              chainId: "0x89"
            }
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

    connectBtn.innerText =
      "Wallet Connected";

    setStatus(
      "Ready to donate",
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
      "Donation failed",
      "error"
    );
  }
};