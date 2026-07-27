(() => {
  const STORAGE_KEY = "belgelab-consent";
  const VERSION = 2;

  function readConsent() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return value?.version === VERSION ? value : null;
    } catch {
      return null;
    }
  }

  function saveConsent(preferences) {
    const value = { version: VERSION, necessary: true, savedAt: new Date().toISOString(), ...preferences };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("belgelab:consent", { detail: value }));
    return value;
  }

  const banner = document.createElement("section");
  banner.className = "consent-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Çerez tercihleri");
  banner.hidden = true;
  banner.innerHTML = `
    <div>
      <strong>Gizliliğiniz sizin kontrolünüzde</strong>
      <p>Zorunlu depolama uygulamanın çalışmasını sağlar. Analiz ve reklam teknolojileri yalnızca izninizle etkinleştirilir. <a href="/cookies.html">Çerez politikasını okuyun</a>.</p>
    </div>
    <div class="consent-actions">
      <button type="button" data-consent="reject" class="secondary">Yalnızca zorunlu</button>
      <button type="button" data-consent="manage" class="secondary">Tercihleri yönet</button>
      <button type="button" data-consent="accept">Tümünü kabul et</button>
    </div>`;

  const modal = document.createElement("div");
  modal.className = "consent-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="consentTitle">
      <h2 id="consentTitle">Çerez tercihleri</h2>
      <p>Tercihlerinizi istediğiniz zaman sayfanın altındaki bağlantıdan değiştirebilirsiniz.</p>
      <label class="consent-option"><span><strong>Zorunlu</strong><small>Güvenlik, tercih kaydı ve çevrimdışı kullanım.</small></span><input type="checkbox" checked disabled></label>
      <label class="consent-option"><span><strong>Analiz</strong><small>Site kullanımını ölçmeye yardımcı olur.</small></span><input id="consentAnalytics" type="checkbox"></label>
      <label class="consent-option"><span><strong>Reklam</strong><small>Reklam gösterimi ve ölçümü için kullanılabilir.</small></span><input id="consentAdvertising" type="checkbox"></label>
      <div class="consent-actions">
        <button type="button" data-consent="close" class="secondary">Vazgeç</button>
        <button type="button" data-consent="save">Tercihleri kaydet</button>
      </div>
    </div>`;

  document.body.append(banner, modal);

  function openPreferences() {
    const current = readConsent() || {};
    modal.querySelector("#consentAnalytics").checked = current.analytics === true;
    modal.querySelector("#consentAdvertising").checked = current.advertising === true;
    modal.hidden = false;
  }

  banner.addEventListener("click", (event) => {
    const action = event.target.closest("[data-consent]")?.dataset.consent;
    if (action === "accept") { saveConsent({ analytics: true, advertising: true }); banner.hidden = true; }
    if (action === "reject") { saveConsent({ analytics: false, advertising: false }); banner.hidden = true; }
    if (action === "manage") openPreferences();
  });
  modal.addEventListener("click", (event) => {
    const action = event.target.closest("[data-consent]")?.dataset.consent;
    if (action === "close") modal.hidden = true;
    if (action === "save") {
      const previous = readConsent();
      const updated = saveConsent({
        analytics: modal.querySelector("#consentAnalytics").checked,
        advertising: modal.querySelector("#consentAdvertising").checked,
      });
      modal.hidden = true;
      banner.hidden = true;
      if (previous?.advertising === true && updated.advertising === false) window.location.reload();
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-consent]")) {
      event.preventDefault();
      openPreferences();
    }
  });
  if (!readConsent()) banner.hidden = false;
})();
