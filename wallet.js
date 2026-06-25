import {
  createAppKit
} from "https://esm.sh/@reown/appkit";

import {
  EthersAdapter
} from "https://esm.sh/@reown/appkit-adapter-ethers";

import {
  polygon
} from "https://esm.sh/@reown/appkit/networks";

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

async function ensurePolygon(
  ethersProvider,
  rawProvider
) {

  const network =
    await ethersProvider.getNetwork();

  if (Number(network.chainId) === 137) {
    return;
  }

  if (
    rawProvider &&
    rawProvider.request
  ) {

    await rawProvider.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: "0x89"
        }
      ]
    });

    return;
  }

  throw new Error(
    "Please switch to Polygon Mainnet"
  );
}

async function buildWallet(
  rawProvider
) {

  if (!rawProvider) {
    throw new Error(
      "No wallet provider detected"
    );
  }

  const provider =
    new ethers.BrowserProvider(
      rawProvider
    );

  await provider.send(
    "eth_requestAccounts",
    []
  );

  await ensurePolygon(
    provider,
    rawProvider
  );

  const signer =
    await provider.getSigner();

  const address =
    await signer.getAddress();

  return {
    provider,
    signer,
    address,
    walletProvider: rawProvider
  };
}

function waitForAppKitProvider() {

  return new Promise(
    (resolve, reject) => {

      const timeout =
        setTimeout(
          () => {

            unsubscribe();

            reject(
              new Error(
                "Wallet connection timed out"
              )
            );

          },
          120000
        );

      const unsubscribe =
        appKit.subscribeProvider(
          state => {

            const rawProvider =
              state.walletProvider ||
              state.provider;

            if (
              state.isConnected &&
              rawProvider
            ) {

              clearTimeout(timeout);

              unsubscribe();

              resolve(rawProvider);
            }
          }
        );
    }
  );
}

window.LaborWallet = {

  connect: async function () {

    try {

      const providerPromise =
        waitForAppKitProvider();

      await appKit.open();

      const rawProvider =
        await providerPromise;

      return await buildWallet(
        rawProvider
      );

    } catch (err) {

      if (window.ethereum) {

        return await buildWallet(
          window.ethereum
        );
      }

      const path =
        window.location.host +
        window.location.pathname;

      window.location.href =
        `https://metamask.app.link/dapp/${path}`;

      throw err;
    }
  },

  reconnectInjected: async function () {

    if (!window.ethereum) {
      return null;
    }

    const provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    const accounts =
      await provider.send(
        "eth_accounts",
        []
      );

    if (
      !accounts ||
      accounts.length === 0
    ) {
      return null;
    }

    return await buildWallet(
      window.ethereum
    );
  }

};