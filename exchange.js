// ===== CONFIG =====
const EXCHANGE_ADDRESS = "0xD0692ec758bb852421B702B187b6439f74f8Bf3b";
const LABR_TOKEN = "0x460DD873A1D2a41e77410B125cD3027C5FEd2f78";
const RPC_URL = "https://polygon-bor-rpc.publicnode.com";

// ===== SETTINGS =====
const SLIPPAGE = 0.95; // 5% protection

// ===== ABIs =====
const EXCHANGE_ABI = [
  "function buy(uint256 minTokensOut) payable",
  "function sell(uint256 amount, uint256 minPOL)",
  "function getPrice(uint256 sold) view returns (uint256)",
  "function totalSold() view returns (uint256)",
  "function lastTxTime(address) view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// ===== PROVIDERS =====
const readProvider = new ethers.JsonRpcProvider(RPC_URL);
const readExchange = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, readProvider);

let provider, signer, exchange, userAddress;

// ===== STATUS UI =====
function setStatus(msg, type = "") {
  const el = document.getElementById("status");
  el.innerText = msg;

  el.style.color =
    type === "error" ? "#ff4d4d" :
    type === "success" ? "#4dff88" :
    "#ccc";
}

// ===== INITIAL LOAD =====
async function initialLoad() {
  try {
    const sold = await readExchange.totalSold();
    const price = await readExchange.getPrice(sold);

    document.getElementById("currentPrice").innerText =
      Number(ethers.formatEther(price)).toFixed(6) + " POL";

    drawCurve(Number(sold) / 1e18);
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

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  userAddress = await signer.getAddress();

  exchange = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);

  document.getElementById("walletAddress").innerText =
    userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

  setStatus("Wallet connected", "success");

  updateAll();
}


// ===== UPDATE =====
async function updateAll() {
  if (!userAddress) return;

  try {
    const labr = new ethers.Contract(LABR_TOKEN, ERC20_ABI, provider);

    const balance = await labr.balanceOf(userAddress);
    const sold = await readExchange.totalSold();
    const price = await readExchange.getPrice(sold);

    const bal = Number(ethers.formatEther(balance));

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
  if (!exchange) return;

  const val = buyAmount.value;
  if (!val || val <= 0) return;

  try {
    setStatus("Processing buy...");

    const pol = Number(val);

    const sold = await readExchange.totalSold();
    const price = await readExchange.getPrice(sold);

    const tokensExpected = pol / Number(ethers.formatEther(price));
    const minOut = ethers.parseEther((tokensExpected * SLIPPAGE).toString());

    const tx = await exchange.buy(minOut, {
      value: ethers.parseEther(val)
    });

    await tx.wait();

    setStatus("Buy successful", "success");
    updateAll();

  } catch (e) {
    console.error(e);
    setStatus("Buy failed", "error");
  }
};

// ===== SELL (WITH APPROVAL) =====
sellBtn.onclick = async () => {
  if (!exchange) return;

  const val = sellAmount.value;
  if (!val || val <= 0) return;

  try {
    setStatus("Preparing approval...");

    const amt = ethers.parseEther(val);

    const labr = new ethers.Contract(LABR_TOKEN, ERC20_ABI, signer);

    const approveTx = await labr.approve(EXCHANGE_ADDRESS, amt);
    await approveTx.wait();

    setStatus("Processing sell...");

    const sold = await readExchange.totalSold();
    const price = await readExchange.getPrice(sold);

    const expectedPOL =
      Number(val) * Number(ethers.formatEther(price)) * 0.90;

    const minPOL = ethers.parseEther((expectedPOL * SLIPPAGE).toString());

    const tx = await exchange.sell(amt, minPOL);

    await tx.wait();

    setStatus("Sell successful", "success");
    updateAll();

  } catch (e) {
    console.error(e);
    setStatus("Sell failed", "error");
  }
};

// ===== CURVE (VISUAL APPROXIMATION ONLY) =====
function drawCurve(currentSold = 0) {
  const canvas = curveCanvas;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();

  const maxSupply = 500_000_000;

  for (let x = 0; x < canvas.width; x++) {
    let t = x / canvas.width;
    let sold = t * maxSupply;

    // Visual approximation only (not exact contract curve)
    let price = 1 + 14 * Math.pow(sold / maxSupply, 2);

    let y = canvas.height - (price / 15) * canvas.height;

    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }

  ctx.strokeStyle = "#ff3b3b";
  ctx.lineWidth = 2;
  ctx.stroke();
}

initialLoad();
setInterval(updateAll, 8000);

// ===== CONNECT FIX =====
window.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connectBtn");

  connectBtn.onclick = async () => {
    try {
      if (!window.ethereum) {
  setStatus("No wallet detected", "error");

  // MOBILE DETECTION
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    alert("Open this site inside the MetaMask app browser.");
  } else {
    alert("Install MetaMask extension to continue.");
  }

  return;
}

      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      signer = await provider.getSigner();
      userAddress = await signer.getAddress();

      exchange = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);

      document.getElementById("walletAddress").innerText =
        userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

      setStatus("Wallet connected", "success");

      updateAll();

    } catch (e) {
      console.error(e);
      setStatus("Connection failed", "error");
    }
  };
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