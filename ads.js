(() => {
  // AdSense onayından sonra yalnızca bu değeri kendi yayıncı kimliğinizle değiştirin.
  const ADSENSE_CLIENT = "";
  const slots = {
    top: "",
    content: "",
    footer: "",
  };

  function consentAllowsAds() {
    try {
      return JSON.parse(localStorage.getItem("belgelab-consent") || "{}").advertising === true;
    } catch {
      return false;
    }
  }

  function enableAds() {
    if (!/^ca-pub-\d+$/.test(ADSENSE_CLIENT) || !consentAllowsAds()) return;
    if (!document.querySelector('script[data-belgelab-adsense]')) {
      const script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.belgelabAdsense = "";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
      document.head.appendChild(script);
    }
    document.querySelectorAll("[data-ad-position]").forEach((container) => {
      const slot = slots[container.dataset.adPosition];
      if (!/^\d+$/.test(slot || "")) return;
      container.hidden = false;
      const ad = document.createElement("ins");
      ad.className = "adsbygoogle";
      ad.style.display = "block";
      ad.dataset.adClient = ADSENSE_CLIENT;
      ad.dataset.adSlot = slot;
      ad.dataset.adFormat = "auto";
      ad.dataset.fullWidthResponsive = "true";
      container.appendChild(ad);
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  }

  window.addEventListener("belgelab:consent", enableAds);
  enableAds();
})();
