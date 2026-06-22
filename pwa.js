let deferredInstallPrompt = null;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch(err => {
        console.error("Service worker registration failed:", err);
      });
  });
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();

  deferredInstallPrompt = event;

  const installBtn =
    document.getElementById("installAppBtn");

  if (installBtn) {
    installBtn.classList.remove("hidden");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const installBtn =
    document.getElementById("installAppBtn");

  if (!installBtn) {
    return;
  }

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    deferredInstallPrompt.prompt();

    await deferredInstallPrompt.userChoice;

    deferredInstallPrompt = null;

    installBtn.classList.add("hidden");
  });
});

window.addEventListener("appinstalled", () => {
  const installBtn =
    document.getElementById("installAppBtn");

  if (installBtn) {
    installBtn.classList.add("hidden");
  }

  deferredInstallPrompt = null;
});