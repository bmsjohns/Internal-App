"use client";

function shell(title: string, message: string) {
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-labelledby", "backstage-dialog-title");
  dialog.className = "m-auto w-[min(92vw,440px)] rounded-2xl border border-cream-2 bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/40";
  dialog.innerHTML = `<form method="dialog"><div class="border-b border-cream-2 px-6 py-5"><h2 id="backstage-dialog-title" class="font-display text-2xl"></h2><p class="mt-2 text-sm leading-6 text-stone"></p></div><div data-body class="px-6 pt-5"></div><div class="flex justify-end gap-2 px-6 py-5"><button value="cancel" class="rounded-lg border border-cream-2 px-4 py-2.5 text-sm font-semibold">Cancel</button><button value="confirm" class="rounded-lg bg-rust px-4 py-2.5 text-sm font-semibold text-white">Confirm</button></div></form>`;
  dialog.querySelector("h2")!.textContent = title;
  dialog.querySelector("p")!.textContent = message;
  document.body.appendChild(dialog);
  return dialog;
}

export function confirmAction(message: string, title = "Please confirm"): Promise<boolean> {
  const dialog = shell(title, message);
  dialog.showModal();
  return new Promise((resolve) => dialog.addEventListener("close", () => {
    resolve(dialog.returnValue === "confirm");
    dialog.remove();
  }, { once: true }));
}

export function promptText(message: string, title = "Add details"): Promise<string | null> {
  const dialog = shell(title, message);
  const input = document.createElement("input");
  input.className = "w-full rounded-lg border border-cream-2 px-3 py-2.5 text-sm outline-none focus:border-rust";
  input.setAttribute("aria-label", message);
  dialog.querySelector("[data-body]")!.appendChild(input);
  dialog.showModal();
  input.focus();
  return new Promise((resolve) => dialog.addEventListener("close", () => {
    const value = dialog.returnValue === "confirm" ? input.value.trim() : null;
    dialog.remove();
    resolve(value || null);
  }, { once: true }));
}
