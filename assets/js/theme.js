(function () {
  "use strict";
  const KEY = "skyloom.theme.v1";
  let theme = "christmas";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "sky" || saved === "christmas") theme = saved;
  } catch { /* The theme still works when browser storage is unavailable. */ }
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    document.getElementById("themeFavicon").setAttribute("href", `assets/icons/favicon-${theme}.svg`);
  }
  applyTheme();
  document.addEventListener("DOMContentLoaded", () => {
    const picker = document.getElementById("themePicker");
    const status = document.getElementById("themeStatus");
    function apply() {
      applyTheme();
      picker.value = theme;
      document.querySelector(".sky-credit").hidden = theme !== "sky";
      document.querySelector(".christmas-credit").hidden = theme !== "christmas";
    }
    apply();
    picker.addEventListener("change", () => {
      theme = picker.value;
      apply();
      try {
        localStorage.setItem(KEY, theme);
        status.textContent = "外觀已保存。";
      } catch {
        status.textContent = "外觀已切換，但無法保存；下次開啟可能恢復原設定。";
      }
    });
  });
})();
