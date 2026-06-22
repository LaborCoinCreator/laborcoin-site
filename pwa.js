let deferredInstallPrompt = null;

function getInstallButtons() {
  return document.querySelectorAll(
    "#installAppBtn, .installAppBtn"
  );
}

function showInstallButtons() {
  getInstallButtons().forEach(button => {
    button.classList.remove("hidden");
  });
}

function hideInstallButtons() {
  getInstallButtons().forEach(button => {
    button.classList.add("hidden");
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch(err => {
        console.error(
          "Service worker registration failed:",
          err
        );
      });
  });
}

window.addEventListener(
  "beforeinstallprompt",
  event => {
    event.preventDefault();

    deferredInstallPrompt = event;

    showInstallButtons();
  }
);

document.addEventListener(
  "DOMContentLoaded",
  () => {
    getInstallButtons().forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          if (!deferredInstallPrompt) {
            return;
          }

          deferredInstallPrompt.prompt();

          await deferredInstallPrompt.userChoice;

          deferredInstallPrompt = null;

          hideInstallButtons();
        }
      );
    });
  }
);

window.addEventListener(
  "appinstalled",
  () => {
    deferredInstallPrompt = null;

    hideInstallButtons();
  }
);