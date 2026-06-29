import {
  createAppKit
} from "https://esm.sh/@reown/appkit@1.8.21";

import {
  EthersAdapter
} from "https://esm.sh/@reown/appkit-adapter-ethers@1.8.21";

import {
  polygon
} from "https://esm.sh/@reown/appkit@1.8.21/networks";

const projectId =
  "85ab9a6a880170f3d4ec1ae6893dc2bc";

const metadata = {
  name: "LaborCoin",
  description: "LaborCoin DAO and Exchange",
  url: "https://www.laborcoin.tech",
  icons: [
    "https://www.laborcoin.tech/assets/logo.png"
  ]
};

const ensProvider =
  new ethers.JsonRpcProvider(
    "https://ethereum-rpc.publicnode.com"
  );

const ENS_OVERRIDES = {
  "0x015b6d0990e56d908c876474c6a30eba2b8a0cfb":
    "laborcoin.eth"
};

const appKit =
  createAppKit({
    adapters: [
      new EthersAdapter()
    ],
    networks: [
      polygon
    ],
    defaultNetwork: polygon,
    metadata,
    projectId,
    features: {
      analytics: false,
      socials: false,
      email: false
    }
  });

let connectPromise = null;
let reconnectPromise = null;
let activeRawProvider = null;
let accountChangeHandler = null;
let chainChangeHandler = null;
let disconnectHandler = null;

let resolveReady;

const walletReady =
  new Promise(resolve => {
    resolveReady = resolve;
  });

function isUserRejection(err) {
  const code =
    err?.code ??
    err?.error?.code;

  const message =
    String(
      err?.shortMessage ||
      err?.message ||
      ""
    ).toLowerCase();

  return (
    code === 4001 ||
    code === "ACTION_REJECTED" ||
    message.includes("user rejected") ||
    message.includes("request rejected") ||
    message.includes("connection cancelled") ||
    message.includes("connection canceled")
  );
}

function friendlyWalletError(err) {
  if (isUserRejection(err)) {
    return new Error(
      "Wallet connection was cancelled."
    );
  }

  return err instanceof Error
    ? err
    : new Error(
        "Wallet connection failed."
      );
}

async function ensurePolygon(
  ethersProvider,
  rawProvider,
  allowSwitch
) {
  const network =
    await ethersProvider.getNetwork();

  if (Number(network.chainId) === 137) {
    return true;
  }

  if (!allowSwitch) {
    return false;
  }

  if (
    !rawProvider ||
    typeof rawProvider.request !== "function"
  ) {
    throw new Error(
      "Please switch to Polygon Mainnet."
    );
  }

  await rawProvider.request({
    method: "wallet_switchEthereumChain",
    params: [
      {
        chainId: "0x89"
      }
    ]
  });

  return true;
}

function removeProviderListeners() {
  if (!activeRawProvider) {
    return;
  }

  const remove =
    activeRawProvider.removeListener ||
    activeRawProvider.off;

  if (typeof remove === "function") {
    if (accountChangeHandler) {
      remove.call(
        activeRawProvider,
        "accountsChanged",
        accountChangeHandler
      );
    }

    if (chainChangeHandler) {
      remove.call(
        activeRawProvider,
        "chainChanged",
        chainChangeHandler
      );
    }

    if (disconnectHandler) {
      remove.call(
        activeRawProvider,
        "disconnect",
        disconnectHandler
      );
    }
  }

  activeRawProvider = null;
  accountChangeHandler = null;
  chainChangeHandler = null;
  disconnectHandler = null;
}

function bindProviderListeners(rawProvider) {
  if (
    !rawProvider ||
    typeof rawProvider.on !== "function" ||
    activeRawProvider === rawProvider
  ) {
    return;
  }

  removeProviderListeners();

  activeRawProvider =
    rawProvider;

  accountChangeHandler =
    accounts => {
      if (
        !accounts ||
        accounts.length === 0
      ) {
        localStorage.removeItem(
          "laborWalletConnected"
        );
      }

      window.location.reload();
    };

  chainChangeHandler =
    () => {
      window.location.reload();
    };

  disconnectHandler =
    () => {
      localStorage.removeItem(
        "laborWalletConnected"
      );

      window.location.reload();
    };

  rawProvider.on(
    "accountsChanged",
    accountChangeHandler
  );

  rawProvider.on(
    "chainChanged",
    chainChangeHandler
  );

  rawProvider.on(
    "disconnect",
    disconnectHandler
  );
}

async function buildWallet(
  rawProvider,
  {
    requestAccounts = false,
    allowNetworkSwitch = false
  } = {}
) {
  if (!rawProvider) {
    throw new Error(
      "No wallet provider detected."
    );
  }

  let provider =
    new ethers.BrowserProvider(
      rawProvider
    );

  const method =
    requestAccounts
      ? "eth_requestAccounts"
      : "eth_accounts";

  const accounts =
    await provider.send(
      method,
      []
    );

  if (
    !accounts ||
    accounts.length === 0
  ) {
    return null;
  }

  const onPolygon =
    await ensurePolygon(
      provider,
      rawProvider,
      allowNetworkSwitch
    );

  if (!onPolygon) {
    return null;
  }

  provider =
    new ethers.BrowserProvider(
      rawProvider
    );

  const signer =
    await provider.getSigner();

  const address =
    ethers.getAddress(
      await signer.getAddress()
    );

  bindProviderListeners(
    rawProvider
  );

  return {
    provider,
    signer,
    address,
    walletProvider: rawProvider
  };
}

function createAppKitProviderWaiter() {
  let cancelWait = () => {};

  const promise =
    new Promise(
      (resolve, reject) => {
        const existingProvider =
          appKit.getWalletProvider
            ? appKit.getWalletProvider()
            : null;

        if (existingProvider) {
          resolve(existingProvider);
          return;
        }

        let settled = false;
        let timeout = null;
        let sawOpen = false;

        let unsubscribeProviders = null;
        let unsubscribeState = null;

        let providerUnsubscribePending = false;
        let stateUnsubscribePending = false;

        const cleanup = () => {
          if (timeout) {
            clearTimeout(timeout);
          }

          if (unsubscribeProviders) {
            unsubscribeProviders();
            unsubscribeProviders = null;
          } else {
            providerUnsubscribePending = true;
          }

          if (unsubscribeState) {
            unsubscribeState();
            unsubscribeState = null;
          } else {
            stateUnsubscribePending = true;
          }
        };

        const finish = rawProvider => {
          if (
            settled ||
            !rawProvider
          ) {
            return;
          }

          settled = true;
          cleanup();
          resolve(rawProvider);
        };

        const fail = err => {
          if (settled) {
            return;
          }

          settled = true;
          cleanup();
          reject(err);
        };

        cancelWait = () => {
          if (settled) {
            return;
          }

          settled = true;
          cleanup();
          resolve(null);
        };

        timeout =
          setTimeout(
            () => {
              fail(
                new Error(
                  "Wallet connection timed out."
                )
              );
            },
            120000
          );

        const providerSubscription =
          appKit.subscribeProviders(
            state => {
              finish(
                state?.eip155
              );
            }
          );

        unsubscribeProviders =
          typeof providerSubscription === "function"
            ? providerSubscription
            : null;

        if (
          providerUnsubscribePending &&
          unsubscribeProviders
        ) {
          unsubscribeProviders();
          unsubscribeProviders = null;
        }

        if (
          typeof appKit.subscribeState === "function"
        ) {
          const stateSubscription =
            appKit.subscribeState(
              state => {
                if (state?.open) {
                  sawOpen = true;
                  return;
                }

                if (
                  sawOpen &&
                  !appKit.getWalletProvider?.()
                ) {
                  fail(
                    new Error(
                      "Wallet connection was cancelled."
                    )
                  );
                }
              }
            );

          unsubscribeState =
            typeof stateSubscription === "function"
              ? stateSubscription
              : null;

          if (
            stateUnsubscribePending &&
            unsubscribeState
          ) {
            unsubscribeState();
            unsubscribeState = null;
          }
        }
      }
    );

  return {
    promise,
    cancel: () => cancelWait()
  };
}

function shortAddress(address) {
  return (
    address.slice(0, 6) +
    "..." +
    address.slice(-4)
  );
}

async function getWalletDisplay(address) {
  try {
    const overrideName =
      ENS_OVERRIDES[
        address.toLowerCase()
      ];

    const ens =
      overrideName ||
      await ensProvider.lookupAddress(
        address
      );

    if (!ens) {
      return {
        name: shortAddress(address),
        avatar: null
      };
    }

    const avatar =
      await ensProvider.getAvatar(
        ens
      );

    return {
      name: ens,
      avatar
    };
  } catch (err) {
    console.log(
      "ENS display lookup failed",
      err
    );

    return {
      name: shortAddress(address),
      avatar: null
    };
  }
}

async function updateGlobalWalletButton(
  btn,
  address
) {
  if (!btn) {
    return;
  }

  const display =
    await getWalletDisplay(address);

  btn.innerHTML = "";

  const label =
    document.createElement("span");

  label.innerText =
    display.name;

  btn.appendChild(label);

  if (display.avatar) {
    const img =
      document.createElement("img");

    img.src =
      display.avatar;

    img.alt =
      display.name;

    img.className =
      "global-wallet-avatar";

    btn.appendChild(img);
  }
}

async function publishWallet(wallet) {
  if (!wallet) {
    return null;
  }

  window.LaborWallet.current =
    wallet;

  localStorage.setItem(
    "laborWalletConnected",
    "true"
  );

  const globalButton =
    document.getElementById(
      "globalWalletBtn"
    );

  if (globalButton) {
    globalButton.innerText =
      shortAddress(
        wallet.address
      );
  }

  updateGlobalWalletButton(
    globalButton,
    wallet.address
  ).catch(err => {
    console.log(
      "Wallet display update failed",
      err
    );
  });

  window.dispatchEvent(
    new CustomEvent(
      "laborWalletConnected",
      {
        detail: wallet
      }
    )
  );

  return wallet;
}

window.LaborWallet = {
  current: null,
  ready: walletReady,

  connect: async function () {
    if (this.current) {
      return this.current;
    }

    if (connectPromise) {
      return connectPromise;
    }

    connectPromise =
      (async () => {
        try {
          const providerWaiter =
            createAppKitProviderWaiter();

          try {
            await appKit.open({
              view: "Connect",
              namespace: "eip155"
            });
          } catch (openError) {
            providerWaiter.cancel();
            throw openError;
          }

          const rawProvider =
            await providerWaiter.promise;

          const wallet =
            await buildWallet(
              rawProvider,
              {
                requestAccounts: true,
                allowNetworkSwitch: true
              }
            );

          if (!wallet) {
            throw new Error(
              "No wallet account was connected."
            );
          }

          return await publishWallet(
            wallet
          );
        } catch (err) {
          if (
            !isUserRejection(err) &&
            window.ethereum
          ) {
            try {
              const wallet =
                await buildWallet(
                  window.ethereum,
                  {
                    requestAccounts: true,
                    allowNetworkSwitch: true
                  }
                );

              if (wallet) {
                return await publishWallet(
                  wallet
                );
              }
            } catch (fallbackError) {
              throw friendlyWalletError(
                fallbackError
              );
            }
          }

          throw friendlyWalletError(err);
        } finally {
          connectPromise = null;
        }
      })();

    return connectPromise;
  },

  reconnectInjected: async function () {
    if (!window.ethereum) {
      return null;
    }

    return await buildWallet(
      window.ethereum,
      {
        requestAccounts: false,
        allowNetworkSwitch: false
      }
    );
  },

  reconnect: async function () {
    if (this.current) {
      return this.current;
    }

    if (reconnectPromise) {
      return reconnectPromise;
    }

    reconnectPromise =
      (async () => {
        try {
          const rawProvider =
            appKit.getWalletProvider
              ? appKit.getWalletProvider()
              : null;

          if (rawProvider) {
            const wallet =
              await buildWallet(
                rawProvider,
                {
                  requestAccounts: false,
                  allowNetworkSwitch: false
                }
              );

            if (wallet) {
              return await publishWallet(
                wallet
              );
            }
          }
        } catch (err) {
          console.error(
            "WalletConnect reconnect failed",
            err
          );
        }

        try {
          const wallet =
            await this.reconnectInjected();

          if (wallet) {
            return await publishWallet(
              wallet
            );
          }
        } catch (err) {
          console.error(
            "Injected wallet reconnect failed",
            err
          );
        }

        return null;
      })().finally(() => {
        reconnectPromise = null;
      });

    return reconnectPromise;
  }
};

function ensureGlobalWalletButton() {
  if (
    document.getElementById(
      "globalWalletBtn"
    )
  ) {
    return;
  }

  const btn =
    document.createElement("button");

  btn.id =
    "globalWalletBtn";

  btn.className =
    "global-wallet-button";

  btn.type =
    "button";

  btn.innerText =
    "Connect Wallet";

  btn.onclick =
    async () => {
      const pageConnectButton =
        document.querySelector(
          "#connectBtn, #govConnectBtn"
        );

      if (
        !window.LaborWallet.current &&
        pageConnectButton &&
        !pageConnectButton.disabled &&
        pageConnectButton.offsetParent !== null
      ) {
        pageConnectButton.click();
        return;
      }

      try {
        btn.disabled = true;

        if (!window.LaborWallet.current) {
          btn.innerText =
            "Connecting...";
        }

        await window.LaborWallet.connect();
      } catch (err) {
        console.error(err);

        btn.innerText =
          err.message ||
          "Connection failed";

        setTimeout(
          () => {
            if (!window.LaborWallet.current) {
              btn.innerText =
                "Connect Wallet";
            }
          },
          3000
        );
      } finally {
        btn.disabled = false;
      }
    };

  document.body.appendChild(btn);
}

async function initializeGlobalWallet() {
  ensureGlobalWalletButton();

  let wallet = null;

  if (
    localStorage.getItem(
      "laborWalletConnected"
    ) === "true"
  ) {
    wallet =
      await window.LaborWallet.reconnect();
  }

  resolveReady(wallet);
}

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeGlobalWallet,
    {
      once: true
    }
  );
} else {
  initializeGlobalWallet();
}
