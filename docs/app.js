(() => {
  const config = window.DEFI_RISK_CONFIG || {};
  const apiBase = String(config.apiBase || "").replace(/\/$/, "");

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const views = $$(".view");
  const navItems = $$(".nav-item");

  function showView(name) {
    views.forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
    navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  }

  navItems.forEach((item) => item.addEventListener("click", () => showView(item.dataset.view)));
  $$("[data-jump]").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.jump)));

  const modePill = $("#modePill");
  const walletNotice = $("#walletNotice");
  if (apiBase) {
    modePill.textContent = "LIVE API";
    modePill.classList.add("live");
    walletNotice.textContent = "Enter a public Ethereum wallet to load live Aave account totals and risk.";
  }

  const hfEl = $("#healthFactor");
  const liqEl = $("#liqBuffer");
  const hfBadge = $("#hfBadge");
  const collateralEl = $("#collateralValue");
  const debtEl = $("#debtValue");

  let baseHf = 1.34;

  function stateForHf(hf) {
    if (hf == null) return "NO_DEBT";
    if (hf <= 1) return "CRITICAL";
    if (hf < 1.2) return "DANGER";
    if (hf < 1.5) return "WATCH";
    return "SAFE";
  }

  function setBadge(el, state) {
    el.className = "risk-badge " + state.toLowerCase().replace("_", "-");
    el.textContent = state.replace("_", " ");
  }

  function formatUsd(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    if (Math.abs(value) < 0.01 && value !== 0) return "<$0.01";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: value < 100 ? 2 : 0
    }).format(value);
  }

  async function liveScan(wallet) {
    const res = await fetch(`${apiBase}/api/v1/aave/account/${encodeURIComponent(wallet)}`, {
      headers: { accept: "application/json" }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API returned ${res.status}`);
    }
    return res.json();
  }

  $("#walletForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#walletInput");
    const wallet = input.value.trim();

    if (!wallet) {
      walletNotice.textContent = "Enter a public Ethereum wallet address.";
      walletNotice.style.color = "#ff6b77";
      return;
    }

    if (!apiBase) {
      walletNotice.textContent = "Live wallet scanning is not configured.";
      walletNotice.style.color = "#f4c35e";
      return;
    }

    walletNotice.textContent = "Scanning public Aave position…";
    walletNotice.style.color = "#8f96a8";

    try {
      const payload = await liveScan(wallet);
      const snapshot = payload?.snapshot || {};
      const hf = snapshot.healthFactor;
      const state = payload?.risk?.state || stateForHf(hf);

      hfEl.textContent = hf == null ? "No debt" : Number(hf).toFixed(2);
      liqEl.textContent = payload?.risk?.uniformCollateralDropToLiquidationPct == null
        ? "—"
        : `${Number(payload.risk.uniformCollateralDropToLiquidationPct).toFixed(1)}%`;
      collateralEl.textContent = formatUsd(snapshot.totalCollateralBase);
      debtEl.textContent = formatUsd(snapshot.totalDebtBase);
      setBadge(hfBadge, state);

      if (typeof hf === "number" && Number.isFinite(hf)) {
        baseHf = hf;
        updateScenario(slider.value);
      }

      walletNotice.textContent =
        `Live Aave snapshot loaded · ${snapshot.observedAt || "now"} · Asset-level tables below remain demo in v0.2.1.`;
      walletNotice.style.color = "#5bd6a2";
    } catch (err) {
      walletNotice.textContent = err instanceof Error ? err.message : "Unable to load wallet.";
      walletNotice.style.color = "#ff6b77";
    }
  });

  const slider = $("#shockSlider");
  const shockLabel = $("#shockLabel");
  const simHf = $("#simHf");
  const simState = $("#simState");
  const meter = $("#scenarioMeterFill");
  const presets = $$(".preset");

  function updateScenario(value) {
    const shock = Number(value);
    const multiplier = 1 + shock / 100;
    const hf = Math.max(0, baseHf * multiplier);
    const state = stateForHf(hf);

    shockLabel.textContent = `${shock > 0 ? "+" : ""}${shock}%`;
    simHf.textContent = hf.toFixed(2);
    simState.textContent = state;
    simState.className = "scenario-state " + state.toLowerCase().replace("_", "-");
    const position = Math.max(4, Math.min(96, ((hf - 0.8) / 1.0) * 100));
    meter.style.width = `${position}%`;

    presets.forEach((p) => p.classList.toggle("active", Number(p.dataset.shock) === shock));
  }

  slider.addEventListener("input", () => updateScenario(slider.value));
  presets.forEach((p) => p.addEventListener("click", () => {
    slider.value = p.dataset.shock;
    updateScenario(p.dataset.shock);
  }));

  $("#refreshBtn").addEventListener("click", () => {
    const btn = $("#refreshBtn");
    btn.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 450 });
    walletNotice.textContent = apiBase
      ? "Enter or resubmit a wallet to refresh the live snapshot."
      : "Live API is not configured.";
    walletNotice.style.color = "#8f96a8";
  });

  updateScenario(slider.value);
})();
