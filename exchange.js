// ===== CONFIG =====
const EXCHANGE_ADDRESS = "0xD0692ec758bb852421B702B187b6439f74f8Bf3b";
const LABR_TOKEN = "0x460DD873A1D2a41e77410B125cD3027C5FEd2f78";
const RPC_URL = "https://polygon-bor-rpc.publicnode.com";
const VERIFIER_URL =
  "https://laborcoin-verifier.onrender.com";

const MAX_WALLET =
  10000;

const buyBtn =
  document.getElementById(
    "buyBtn"
  );

const sellBtn =
  document.getElementById(
    "sellBtn"
  );

const buyAmount =
  document.getElementById(
    "buyAmount"
  );

const sellAmount =
  document.getElementById(
    "sellAmount"
  );

const buyEstimate =
  document.getElementById(
    "buyEstimate"
  );

const buyDaoShare =
  document.getElementById(
    "buyDaoShare"
  );

const sellEstimate =
  document.getElementById(
    "sellEstimate"
  );

const sellTax =
  document.getElementById(
    "sellTax"
  );

const sellNet =
  document.getElementById(
    "sellNet"
  );

// ===== SETTINGS =====
const SLIPPAGE = 0.95; // 5% protection

// ===== ABIs =====
const EXCHANGE_ABI = [
  "function buy(uint256 minTokensOut) payable",
  "function sell(uint256 amount, uint256 minPOL)",
  "function getPrice(uint256 sold) view returns (uint256)",
  "function totalSold() view returns (uint256)",
  "function daoTreasury() view returns (address)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function unlockedSupply() view returns (uint256)",
  "function lastTxTime(address) view returns (uint256)"
];

const ERC20_ABI = [

  "function balanceOf(address) view returns (uint256)",

  "function totalSupply() view returns (uint256)",

  "function approve(address spender, uint256 amount) returns (bool)"

];  

// ===== PROVIDERS =====
const readProvider = new ethers.JsonRpcProvider(RPC_URL);
const readExchange = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, readProvider);

let provider, signer, exchange, userAddress;

let exchangeVerified = false;

// ===== STATUS UI =====
function setStatus(msg, type = "") {
  const el = document.getElementById("statusMessage");
  el.innerText = msg;

  el.style.color =
    type === "error" ? "#ff4d4d" :
    type === "success" ? "#4dff88" :
    "#ccc";
}

const exchangeVerifyBtn =
  document.getElementById(
    "exchangeVerifyBtn"
  );

const exchangeGateStatus =
  document.getElementById(
    "exchangeGateStatus"
  );

const exchangeTradePanel =
  document.getElementById(
    "exchangeTradePanel"
  );

const loadingOverlay =
  document.getElementById(
    "loadingOverlay"
  );

const loadingText =
  document.getElementById(
    "loadingText"
  );

function setGateStatus(
  msg,
  type = ""
) {

  exchangeGateStatus.innerText =
    msg;

  exchangeGateStatus.style.color =
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

function showLoading(text) {

  loadingText.innerText = text;

  loadingOverlay.classList.remove(
    "hidden"
  );
}

function hideLoading() {

  loadingOverlay.classList.add(
    "hidden"
  );
}

// ===== INITIAL LOAD =====
async function initialLoad() {
  try {
    const sold = await readExchange.totalSold();
    const price = await readExchange.getPrice(sold);

    document.getElementById("currentPrice").innerText =
      Number(ethers.formatEther(price)).toFixed(6) + " POL";

    await drawCurve();
  } catch (e) {
    console.error(e);
    setStatus("Failed to load data", "error");
  }
}

// ===== CONNECT =====
async function connectWallet() {
  if (!window.ethereum) {
    setStatus("No wallet detected", "error");
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
        { chainId: "0x89" }
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

userAddress =
  await signer.getAddress();

exchange =
  new ethers.Contract(
    EXCHANGE_ADDRESS,
    EXCHANGE_ABI,
    signer
  );

  completeStep(
    "exchange-step-wallet"
  );

  document.getElementById("walletAddress").innerText =
    userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

  setGateStatus(
    "Wallet connected",
    "success"
  );

  updateAll();
}

// ===== VERIFY EXCHANGE ACCESS =====
exchangeVerifyBtn.onclick =
async () => {

  try {

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
            type: "exchange"
          })
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        "Verification failed"
      );
    }

    exchangeVerified = true;

    completeStep(
      "exchange-step-identity"
    );

    exchangeTradePanel
      .classList
      .remove("hidden");

    setGateStatus(
      `Verified. Passport score: ${data.score}`,
      "success"
    );

    hideLoading();

  } catch (err) {

    console.error(err);

    hideLoading();

    setGateStatus(
      err.message ||
      "Verification failed",
      "error"
    );
  }
};

// ===== UPDATE =====
async function updateAll() {
  if (!userAddress) return;

  try {
    const labr = new ethers.Contract(LABR_TOKEN, ERC20_ABI, provider);

    const balance = await labr.balanceOf(userAddress);

    const formattedBalance =
      Number(
        ethers.formatEther(balance)
      );

    if (
      formattedBalance >= MAX_WALLET
    ) {

      setGateStatus(
        "Wallet exceeds exchange limit",
        "error"
      );

      return;
    }

    completeStep(
      "exchange-step-balance"
    );

    exchangeVerifyBtn.disabled =
      false;

    const sold = await readExchange.totalSold();
    const price = await readExchange.getPrice(sold);

    const bal = Number(ethers.formatEther(balance));

// ===== POL BALANCE =====
const polBalance =
  await provider.getBalance(
    userAddress
  );

document.getElementById(
  "polBalance"
).innerText =
  Number(
    ethers.formatEther(polBalance)
  ).toFixed(4);

// ===== LABR BALANCE =====
document.getElementById(
  "labrBalance"
).innerText =
  bal.toFixed(2);

    // ===== TREASURY DEPTH =====
const treasuryAddress =
  await readExchange.daoTreasury();

const treasuryBalance =
  await readProvider.getBalance(
    treasuryAddress
  );

document.getElementById(
  "treasuryDepth"
).innerText =
  Number(
    ethers.formatEther(
      treasuryBalance
    )
  ).toLocaleString() + " POL";

// ===== TOTAL SOLD =====
const totalSold =
  await readExchange.totalSold();

document.getElementById(
  "totalSoldDisplay"
).innerText =
  Number(
    ethers.formatEther(
      totalSold
    )
  ).toLocaleString() + " LABR";

// ===== CIRCULATING SUPPLY =====
const totalSupply =
  await labr.totalSupply();

document.getElementById(
  "circulatingSupply"
).innerText =
  Number(
    ethers.formatEther(
      totalSupply
    )
  ).toLocaleString() + " LABR";

    document.getElementById("balance").innerText =
      bal.toFixed(2) + " LABR";

    document.getElementById("walletPercent").innerText =
      ((bal / 10000) * 100).toFixed(1) + "% of limit";

    document.getElementById("currentPrice").innerText =
      Number(ethers.formatEther(price)).toFixed(6) + " POL";

    updateCooldown();

  } catch (e) {
    console.error(e);
  }
}

// ===== COOLDOWN =====
async function updateCooldown() {
  if (!userAddress) return;

  try {
    const last = await readExchange.lastTxTime(userAddress);
    const now = Math.floor(Date.now() / 1000);

    const remaining = Number(last) + 43200 - now;

    const btns = [buyBtn, sellBtn];

    if (remaining <= 0) {
      document.getElementById("cooldown").innerText = "Ready";
      btns.forEach(b => b.disabled = false);
    } else {
      btns.forEach(b => b.disabled = true);

      const hours = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);

      document.getElementById("cooldown").innerText =
        `${hours}h ${mins}m`;
    }
  } catch (e) {
    console.error(e);
  }
}

// ===== BUY ESTIMATE =====
buyAmount.oninput = async (e) => {
  const pol = Number(e.target.value);

  if (isNaN(pol) || pol <= 0) {
    buyEstimate.innerText = "0";
    buyDaoShare.innerText = "0";
    return;
  }

  const sold = await readExchange.totalSold();
  const price = await readExchange.getPrice(sold);

  const p = Number(ethers.formatEther(price));

  const tokens = pol / p;

  buyEstimate.innerText = tokens.toFixed(2);
  buyDaoShare.innerText = (pol * 0.10).toFixed(4) + " POL";
};

// ===== SELL ESTIMATE (FIXED LOGIC) =====
sellAmount.oninput = async (e) => {
  const amt = Number(e.target.value);

  if (isNaN(amt) || amt <= 0) {
    sellEstimate.innerText = "0";
    sellTax.innerText = "0";
    sellNet.innerText = "0";
    return;
  }

  const sold = await readExchange.totalSold();
  const price = await readExchange.getPrice(sold);

  const p = Number(ethers.formatEther(price));

  // Token tax happens BEFORE conversion
  const netTokens = amt * 0.90;
  const gross = netTokens * p;
  const tax = (amt - netTokens) * p;

  sellEstimate.innerText = gross.toFixed(4);
  sellTax.innerText = tax.toFixed(4) + " POL";
  sellNet.innerText = gross.toFixed(4) + " POL";
};

// ===== BUY =====
buyBtn.onclick = async () => {

  if (!exchangeVerified) {

    setStatus(
      "Exchange access not verified",
      "error"
    );

    return;
  }

  if (!exchange) return;

  const val = buyAmount.value;

  if (!val || val <= 0) {
    return;
  }

  try {

    showLoading(
      "Processing buy..."
    );

    setStatus(
      "Processing buy..."
    );

    const balanceCheckContract =
      new ethers.Contract(
        LABR_TOKEN,
        ERC20_ABI,
        provider
      );

    const currentBalance =
      Number(
        ethers.formatEther(
          await balanceCheckContract.balanceOf(
            userAddress
          )
        )
      );

    if (
      currentBalance >= MAX_WALLET
    ) {

      setStatus(
        "Wallet exceeds limit",
        "error"
      );

      return;
    }

    const pol =
      Number(val);

    const sold =
      await readExchange.totalSold();

    const price =
      await readExchange.getPrice(
        sold
      );

    const tokensExpected =
      pol /
      Number(
        ethers.formatEther(price)
      );

    const minOut =
      ethers.parseEther(
        (
          tokensExpected * SLIPPAGE
        ).toString()
      );

    const tx =
      await exchange.buy(
        minOut,
        {
          value:
            ethers.parseEther(val)
        }
      );

    await tx.wait();

    hideLoading();

    buyAmount.value = "";

    buyEstimate.innerText = "0";

    buyDaoShare.innerText = "0";

    setStatus(
      "Buy successful",
      "success"
    );

    updateAll();

  } catch (e) {

    console.error(e);

    hideLoading();

    setStatus(
      "Buy failed",
      "error"
    );
  }
};

// ===== SELL =====
sellBtn.onclick = async () => {

  if (!exchangeVerified) {

    setStatus(
      "Exchange access not verified",
      "error"
    );

    return;
  }

  if (!exchange) return;

  const val =
    sellAmount.value;

  if (!val || val <= 0) {
    return;
  }

  try {

    showLoading(
      "Preparing approval..."
    );

    const labr =
      new ethers.Contract(
        LABR_TOKEN,
        ERC20_ABI,
        provider
      );
  
    const currentBalance =
      Number(
        ethers.formatEther(
          await labr.balanceOf(
            userAddress
          )
        )
      );

    if (
      currentBalance >= MAX_WALLET
    ) {

      setStatus(
        "Wallet exceeds limit",
        "error"
      );

      return;
    }

    const amt =
      ethers.parseEther(val);

    const labr =
      new ethers.Contract(
        LABR_TOKEN,
        ERC20_ABI,
        signer
      );

    const approveTx =
      await labr.approve(
        EXCHANGE_ADDRESS,
        amt
      );

    await approveTx.wait();

    showLoading(
      "Processing sell..."
    );

    setStatus(
      "Processing sell..."
    );

    const sold =
      await readExchange.totalSold();

    const price =
      await readExchange.getPrice(
        sold
      );

    const expectedPOL =
      Number(val)
      *
      Number(
        ethers.formatEther(price)
      )
      *
      0.90;

    const minPOL =
      ethers.parseEther(
        (
          expectedPOL * SLIPPAGE
        ).toString()
      );

    const tx =
      await exchange.sell(
        amt,
        minPOL
      );

    await tx.wait();

    hideLoading();

    sellAmount.value = "";

    sellEstimate.innerText = "0";

    sellTax.innerText = "0";

    sellNet.innerText = "0";

    setStatus(
      "Sell successful",
      "success"
    );

    updateAll();

  } catch (e) {

    console.error(e);

    hideLoading();

    setStatus(
      "Sell failed",
      "error"
    );
  }
};

// ===== CURVE =====
async function drawCurve() {

  const canvas = curveCanvas;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const maxSupply = 500_000_000;
  const steps = canvas.width;

  let prices = [];

  for (let i = 0; i < steps; i++) {

    const sold =
      ethers.parseEther(
        (
          (i / steps) * maxSupply
        ).toString()
      );

    const rawPrice =
      await readExchange.getPrice(sold);

    const price =
      Number(
        ethers.formatEther(rawPrice)
      );

    prices.push(price);
  }

  const maxPrice =
    Math.max(...prices);

  ctx.beginPath();

  for (let x = 0; x < steps; x++) {

    const normalized =
      prices[x] / maxPrice;

    const y =
      canvas.height -
      normalized * canvas.height;

    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.strokeStyle = "#ff3b3b";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ===== CONNECT FIX =====
window.addEventListener("DOMContentLoaded", () => {

  const connectBtn =
    document.getElementById("connectBtn");

  connectBtn.onclick =
    connectWallet;

  initialLoad();

});

// ===== AUTO RECONNECT =====
window.addEventListener("load", async () => {

  try {

    if (!window.ethereum) return;

    const accounts =
      await window.ethereum.request({
        method: "eth_accounts"
      });

    if (accounts.length > 0) {

      connectWallet();

    }

  } catch (err) {

    console.error(err);

  }

});