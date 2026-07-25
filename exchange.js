(() => {
  const config = window.LaborCoinConfig;
  const deployment = window.LaborCoinDeployment;
  const active = deployment?.isActive() === true;
  const zero = ethers.ZeroAddress;

  const identityAddress = config?.addresses?.identityRegistry || zero;
  const exchangeAddress = config?.addresses?.exchange || zero;
  const labrAddress = config?.addresses?.labr || zero;
  const rpcUrl = config?.rpcUrl;
  const verifierUrl = config?.verifierUrl || "";
  const maxWallet = BigInt(config?.limits?.maxWalletLabr ?? 10000);
  const maxTrade = BigInt(config?.limits?.maxTradeLabr ?? 5000);

  const IDENTITY_ABI = [
    "function isVerified(address) view returns(bool)",
    "function identityReady() view returns(bool)",
    "function MIN_PASSPORT_SCORE() view returns(uint256)",
    "function verifyParticipant(uint256 passportScore,uint256 expiry,bytes signature)",
    "function nonces(address) view returns(uint256)"
  ];
  const EXCHANGE_ABI = [
    "function LABR() view returns(address)",
    "function identityRegistry() view returns(address)",
    "function totalSold() view returns(uint256)",
    "function unlockedSupply() view returns(uint256)",
    "function accountedReserve() view returns(uint256)",
    "function currentSpotPricePOL() view returns(uint256)",
    "function quoteBuyExactTokens(uint256) view returns(uint256 reserveContribution,uint256 daoContribution,uint256 totalPOLIn)",
    "function quoteSellExactTokens(uint256) view returns(uint256 grossRedemption,uint256 sellerPOL,uint256 daoContribution,uint256 dividendContribution)",
    "function buyExactTokens(uint256,uint256,uint256) payable returns(uint256)",
    "function sellExactTokens(uint256,uint256,uint256) returns(uint256)",
    "function maxBuyableTokens(address) view returns(uint256)",
    "function maxSellableTokens(address) view returns(uint256)",
    "function canTrade(address) view returns(bool)",
    "function nextTradeTime(address) view returns(uint256)",
    "function invariantsHold() view returns(bool)",
    "function launchReady() view returns(bool)"
  ];
  const LABR_ABI = [
    "function balanceOf(address) view returns(uint256)",
    "function allowance(address,address) view returns(uint256)",
    "function approve(address,uint256) returns(bool)",
    "function dividendEligible(address) view returns(bool)",
    "function eligibleDividendHolderCount() view returns(uint256)",
    "function withdrawableDividendOf(address) view returns(uint256)",
    "function claimDividends() returns(uint256)"
  ];

  const ids = [
    "connectBtn", "identityVerifyBtn", "exchangeVerifyBtn", "exchangeGateStatus", "exchangeTradePanel",
    "walletAddress", "identityStatus", "polBalance", "labrBalance", "walletPercent", "cooldown",
    "dividendEligibility", "withdrawableDividends", "claimDividendsBtn", "eligibleHolderCount",
    "currentPrice", "totalSoldDisplay", "availableSupply", "bondingCurveValue", "bondingCurveProgress",
    "invariantStatus", "buyAmount", "buyEstimate", "buyDaoShare", "buyTotal", "sellAmount",
    "sellEstimate", "sellTax", "sellDividend", "sellNet", "buyBtn", "sellBtn", "statusMessage",
    "loadingOverlay", "loadingText", "curveCanvas"
  ];
  const els = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));

  const readProvider = active ? new ethers.JsonRpcProvider(rpcUrl) : null;
  const readIdentity = active ? new ethers.Contract(identityAddress, IDENTITY_ABI, readProvider) : null;
  const readExchange = active ? new ethers.Contract(exchangeAddress, EXCHANGE_ABI, readProvider) : null;
  const readLabr = active ? new ethers.Contract(labrAddress, LABR_ABI, readProvider) : null;

  let wallet;
  let identity;
  let exchange;
  let labr;
  let userAddress;
  let walletBalance = 0n;
  let verified = false;
  let accessReady = false;

  function setText(el, value) { if (el) el.textContent = value; }
  function colorStatus(el, type) {
    if (!el) return;
    el.style.color = type === "error" ? "#ff4d4d" : type === "success" ? "#4dff88" : "#ccc";
  }
  function setStatus(message, type = "") { setText(els.statusMessage, message); colorStatus(els.statusMessage, type); }
  function setGate(message, type = "") { setText(els.exchangeGateStatus, message); colorStatus(els.exchangeGateStatus, type); }
  function completeStep(id, complete) { document.getElementById(id)?.classList.toggle("complete", Boolean(complete)); }
  function showLoading(message) { setText(els.loadingText, message); els.loadingOverlay?.classList.remove("hidden"); }
  function hideLoading() { els.loadingOverlay?.classList.add("hidden"); }
  function formatPOL(value, digits = 6) { return `${Number(ethers.formatEther(value)).toLocaleString(undefined,{maximumFractionDigits:digits})} POL`; }
  function formatLABR(value, digits = 6) { return `${Number(ethers.formatEther(value)).toLocaleString(undefined,{maximumFractionDigits:digits})} LABR`; }
  function parseLABRInput(input) {
    const raw = input?.value?.trim();
    if (!raw) return 0n;
    const value = ethers.parseEther(raw);
    if (value <= 0n) throw new Error("Enter an amount greater than zero.");
    if (value > ethers.parseEther(maxTrade.toString())) throw new Error("The maximum official trade is 5,000 LABR.");
    return value;
  }
  function deadline() { return BigInt(Math.floor(Date.now() / 1000) + 15 * 60); }

  function drawCurve(totalSold = 0n) {
    const canvas = els.curveCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d"), width = canvas.width, height = canvas.height, pad = 30;
    ctx.clearRect(0,0,width,height);
    ctx.strokeStyle="#444"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,height-pad); ctx.lineTo(width-pad,height-pad); ctx.stroke();
    ctx.strokeStyle="#ff3b3b"; ctx.lineWidth=2; ctx.beginPath();
    for (let i=0;i<=100;i+=1) {
      const x=i/100, price=14+196*x*x, px=pad+x*(width-2*pad), py=height-pad-((price-14)/196)*(height-2*pad);
      if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
    const sold=Number(ethers.formatEther(totalSold)), progress=Math.max(0,Math.min(1,sold/1_000_000_000));
    const price=14+196*progress*progress, markerX=pad+progress*(width-2*pad), markerY=height-pad-((price-14)/196)*(height-2*pad);
    ctx.fillStyle="#4dff88"; ctx.beginPath(); ctx.arc(markerX,markerY,6,0,Math.PI*2); ctx.fill();
  }

  async function loadMarket() {
    if (!active) return;
    try {
      const [reportedLabr, reportedIdentity, totalSold, unlocked, reserve, price, invariants, ready, holders] = await Promise.all([
        readExchange.LABR(), readExchange.identityRegistry(), readExchange.totalSold(), readExchange.unlockedSupply(),
        readExchange.accountedReserve(), readExchange.currentSpotPricePOL(), readExchange.invariantsHold(),
        readExchange.launchReady(), readLabr.eligibleDividendHolderCount()
      ]);
      if (ethers.getAddress(reportedLabr) !== ethers.getAddress(labrAddress)) throw new Error("Exchange LABR address does not match protocol configuration.");
      if (ethers.getAddress(reportedIdentity) !== ethers.getAddress(identityAddress)) throw new Error("Exchange Identity Registry does not match protocol configuration.");
      setText(els.currentPrice, `${formatPOL(price)} per LABR`);
      setText(els.totalSoldDisplay, formatLABR(totalSold,2)); setText(els.availableSupply, formatLABR(unlocked,2));
      setText(els.bondingCurveValue, formatPOL(reserve,2));
      setText(els.bondingCurveProgress, `${(Number(ethers.formatEther(totalSold))/1_000_000_000*100).toFixed(4)}%`);
      setText(els.eligibleHolderCount, Number(holders).toLocaleString());
      setText(els.invariantStatus, invariants && ready ? "Verified" : "Not ready");
      colorStatus(els.invariantStatus, invariants && ready ? "success" : "error"); drawCurve(totalSold);
    } catch (error) { console.error(error); setStatus(error.message || "Unable to load Exchange V6.","error"); }
  }

  async function refreshWallet() {
    if (!wallet || !active) return;
    userAddress=ethers.getAddress(wallet.address);
    identity=new ethers.Contract(identityAddress,IDENTITY_ABI,wallet.signer);
    exchange=new ethers.Contract(exchangeAddress,EXCHANGE_ABI,wallet.signer);
    labr=new ethers.Contract(labrAddress,LABR_ABI,wallet.signer);
    const [pol,balance,isVerified,canTrade,nextTime,maxBuy,maxSell,isEligible,withdrawable] = await Promise.all([
      wallet.provider.getBalance(userAddress), labr.balanceOf(userAddress), identity.isVerified(userAddress),
      exchange.canTrade(userAddress), exchange.nextTradeTime(userAddress), exchange.maxBuyableTokens(userAddress),
      exchange.maxSellableTokens(userAddress), labr.dividendEligible(userAddress), labr.withdrawableDividendOf(userAddress)
    ]);
    walletBalance=balance; verified=isVerified;
    setText(els.walletAddress,`${userAddress.slice(0,8)}...${userAddress.slice(-6)}`);
    setText(els.identityStatus,verified ? "Verified permanently" : "Verification required"); colorStatus(els.identityStatus,verified?"success":"error");
    setText(els.polBalance,formatPOL(pol)); setText(els.labrBalance,formatLABR(balance));
    const room=balance>=ethers.parseEther(maxWallet.toString())?0n:ethers.parseEther(maxWallet.toString())-balance;
    setText(els.walletPercent,formatLABR(room));
    setText(els.dividendEligibility,isEligible ? "Eligible for one equal share" : "Not currently eligible");
    colorStatus(els.dividendEligibility,isEligible?"success":"");
    setText(els.withdrawableDividends,formatPOL(withdrawable));
    completeStep("exchange-step-wallet",true); completeStep("exchange-step-identity",verified);
    completeStep("exchange-step-balance",balance<=ethers.parseEther(maxWallet.toString())); completeStep("exchange-step-cooldown",canTrade);
    const now=BigInt(Math.floor(Date.now()/1000));
    setText(els.cooldown,canTrade?"Ready":nextTime>now?`Ready ${new Date(Number(nextTime)*1000).toLocaleString()}`:"Unavailable");
    els.identityVerifyBtn.disabled=verified; els.exchangeVerifyBtn.disabled=false; els.claimDividendsBtn.disabled=!verified || withdrawable===0n;
    els.buyBtn.disabled=maxBuy===0n; els.sellBtn.disabled=maxSell===0n;
    accessReady=verified && balance<=ethers.parseEther(maxWallet.toString()) && canTrade;
    if (!verified) { setGate("Human Passport verification is required before official buying, selling, dividend eligibility, or claims.","error"); els.exchangeTradePanel.classList.add("hidden"); return; }
    if (balance>ethers.parseEther(maxWallet.toString())) { setGate("This wallet holds more than 10,000 LABR and is barred from both buying and selling through the official exchange.","error"); els.exchangeTradePanel.classList.add("hidden"); return; }
    setGate(canTrade?`Identity and wallet checks passed. Maximum current buy: ${formatLABR(maxBuy)}. Maximum current sell: ${formatLABR(maxSell)}.`:"Identity and wallet checks passed, but the trade cooldown is active.",canTrade?"success":"error");
  }

  async function connectWallet() {
    try {
      deployment.requireActive(); els.connectBtn.disabled=true; setGate("Opening wallet connection...");
      wallet=await window.LaborWallet.connect(); await refreshWallet(); els.connectBtn.style.display="none";
    } catch(error) { console.error(error); setGate(error.message||"Wallet connection failed.","error"); els.connectBtn.disabled=false; }
  }

  async function verifyIdentity() {
    try {
      if (!userAddress || !identity) throw new Error("Connect wallet first.");
      if (verified) { setGate("This wallet is already permanently verified.","success"); return; }
      els.identityVerifyBtn.disabled=true; showLoading("Checking Human Passport score...");
      const response=await fetch(`${verifierUrl}/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({address:userAddress,type:"identity"})});
      const data=await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `Human Passport score must be at least ${config.limits.minPassportScore}.`);
      if (!data.signature || !data.expiry || !data.scoreThousandths) throw new Error("Verification response is incomplete.");
      showLoading("Recording permanent identity verification...");
      const tx=await identity.verifyParticipant(data.scoreThousandths,data.expiry,data.signature); await tx.wait();
      const confirmed=await identity.isVerified(userAddress); if (!confirmed) throw new Error("Verification transaction confirmed but Registry status is false.");
      setStatus(`Identity verification confirmed. Human Passport score: ${data.score}.`,"success");
      await Promise.all([refreshWallet(),loadMarket()]);
    } catch(error) { console.error(error); setStatus(error.shortMessage||error.reason||error.message||"Identity verification failed.","error"); els.identityVerifyBtn.disabled=false; }
    finally { hideLoading(); }
  }

  async function checkAccess() {
    try { await refreshWallet(); els.exchangeTradePanel.classList.toggle("hidden",!accessReady); if(accessReady)setGate("Official Exchange access is currently available.","success"); }
    catch(error){setGate(error.message||"Access check failed.","error");}
  }

  async function quoteBuy() {
    try { if(!active)return; const amount=parseLABRInput(els.buyAmount); if(amount===0n){setText(els.buyEstimate,"0 POL");setText(els.buyDaoShare,"0 POL");setText(els.buyTotal,"0 POL");return;} const [reserve,dao,total]=await readExchange.quoteBuyExactTokens(amount); setText(els.buyEstimate,formatPOL(reserve));setText(els.buyDaoShare,formatPOL(dao));setText(els.buyTotal,formatPOL(total)); }
    catch(error){setText(els.buyTotal,error.shortMessage||error.message||"Quote unavailable");}
  }
  async function quoteSell() {
    try { if(!active)return; const amount=parseLABRInput(els.sellAmount); if(amount===0n){setText(els.sellEstimate,"0 POL");setText(els.sellTax,"0 POL");setText(els.sellDividend,"0 POL");setText(els.sellNet,"0 POL");return;} const [gross,seller,dao,dividend]=await readExchange.quoteSellExactTokens(amount); setText(els.sellEstimate,formatPOL(gross));setText(els.sellTax,formatPOL(dao));setText(els.sellDividend,formatPOL(dividend));setText(els.sellNet,formatPOL(seller)); }
    catch(error){setText(els.sellNet,error.shortMessage||error.message||"Quote unavailable");}
  }
  async function buy() {
    try { if(!accessReady)throw new Error("Complete the identity and Exchange access checks first."); const amount=parseLABRInput(els.buyAmount); const [,,required]=await exchange.quoteBuyExactTokens(amount); const maxPOL=(required*101n+99n)/100n; showLoading("Submitting exact-token purchase..."); const tx=await exchange.buyExactTokens(amount,maxPOL,deadline(),{value:required}); await tx.wait(); setStatus("Purchase confirmed.","success"); els.buyAmount.value=""; await Promise.all([loadMarket(),refreshWallet()]); await quoteBuy(); }
    catch(error){console.error(error);setStatus(error.shortMessage||error.reason||error.message||"Purchase failed.","error");}finally{hideLoading();}
  }
  async function sell() {
    try { if(!accessReady)throw new Error("Complete the identity and Exchange access checks first."); const amount=parseLABRInput(els.sellAmount); if(amount>walletBalance)throw new Error("Insufficient LABR balance."); const [,seller]=await exchange.quoteSellExactTokens(amount); const minPOL=seller*99n/100n; const allowance=await labr.allowance(userAddress,exchangeAddress); if(allowance<amount){showLoading("Approving Exchange V6...");const approval=await labr.approve(exchangeAddress,amount);await approval.wait();} showLoading("Submitting exact-token sale..."); const tx=await exchange.sellExactTokens(amount,minPOL,deadline());await tx.wait();setStatus("Sale confirmed.","success");els.sellAmount.value="";await Promise.all([loadMarket(),refreshWallet()]);await quoteSell(); }
    catch(error){console.error(error);setStatus(error.shortMessage||error.reason||error.message||"Sale failed.","error");}finally{hideLoading();}
  }
  async function claimDividends() {
    try { if(!verified)throw new Error("Permanent identity verification is required to claim dividends."); showLoading("Claiming available equal-holder dividends..."); const tx=await labr.claimDividends(); await tx.wait(); setStatus("Dividend claim confirmed.","success"); await Promise.all([loadMarket(),refreshWallet()]); }
    catch(error){console.error(error);setStatus(error.shortMessage||error.reason||error.message||"Dividend claim failed.","error");}finally{hideLoading();}
  }

  async function initialize() {
    els.connectBtn.onclick=connectWallet; els.identityVerifyBtn.onclick=verifyIdentity; els.exchangeVerifyBtn.onclick=checkAccess;
    els.buyAmount.addEventListener("input",quoteBuy); els.sellAmount.addEventListener("input",quoteSell);
    els.buyBtn.onclick=buy; els.sellBtn.onclick=sell; els.claimDividendsBtn.onclick=claimDividends;
    if(!active){for(const b of [els.connectBtn,els.identityVerifyBtn,els.exchangeVerifyBtn,els.buyBtn,els.sellBtn,els.claimDividendsBtn])b.disabled=true;setGate("Predeployment mode. Enter and verify all seven final addresses and runtime hashes in protocol-config.js before enabling interactions.","error");setStatus("Revision 7 is a source candidate and has not been compiled or deployed.");drawCurve(0n);return;}
    await loadMarket();
    try { if(!window.LaborWallet)return; wallet=await window.LaborWallet.reconnect(); if(wallet){els.connectBtn.style.display="none";await refreshWallet();} } catch(error){console.error("Wallet reconnect failed",error);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});else initialize();
})();
