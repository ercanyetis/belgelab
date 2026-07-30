(() => {
  const pagesTab = document.getElementById("editorPagesTab");
  const splitTab = document.getElementById("editorToolsTab");
  const pagesPane = document.getElementById("editorPagesPane");
  const splitPane = document.getElementById("editorToolsPane");
  const modeInputs = [...document.querySelectorAll('input[name="split_mode_ui"]')];
  const modeDescription = document.getElementById("splitModeDescription");
  const chunkPanel = document.getElementById("splitChunkWrap");
  const chunkSize = document.getElementById("splitChunkSize");
  const chunkTotal = document.getElementById("splitChunkTotal");
  const chunkOutput = document.getElementById("splitChunkOutput");
  const eachPanel = document.getElementById("splitEachPanel");
  const eachTotal = document.getElementById("splitEachTotal");
  const eachOutput = document.getElementById("splitEachOutput");
  const pageCount = document.getElementById("splitPageCount");
  const pagePreview = document.getElementById("splitPagePreview");
  const rangeControls = document.getElementById("splitRangeControls");
  const rangeList = document.getElementById("splitRangeList");
  const validation = document.getElementById("splitValidation");
  const addRange = document.getElementById("addSplitRange");
  const runButton = document.getElementById("runEditorSplit");
  const splitStatus = document.getElementById("editorSplitStatus");
  const editorThumbs = document.getElementById("thumbs");
  const splitCard = document.querySelector('[data-editor-tool="split"]');
  const connectionMessage = "İnternet bağlantısı yok. Bu işlem için bağlantınızı kontrol edip yeniden deneyin.";
  const descriptions = {
    ranges: "Her seçilen aralık ayrı bir PDF olarak oluşturulur.",
    each: "Belgedeki her sayfa tek bir PDF dosyası olarak oluşturulur.",
    chunk: "Her bölüm belirttiğiniz sayıda sayfa içerir.",
  };
  const MAX_PREVIEW_CHIPS = 120;
  let ranges = [];
  let totalPages = 0;
  let busy = false;
  let sourceFilename = "belgelab.pdf";

  function selectedMode() {
    return modeInputs.find((input) => input.checked)?.value || "ranges";
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showTab(tabName) {
    const showSplit = tabName === "split";
    pagesTab.classList.toggle("active", !showSplit);
    splitTab.classList.toggle("active", showSplit);
    pagesTab.setAttribute("aria-selected", String(!showSplit));
    splitTab.setAttribute("aria-selected", String(showSplit));
    pagesTab.tabIndex = showSplit ? -1 : 0;
    splitTab.tabIndex = showSplit ? 0 : -1;
    pagesPane.hidden = showSplit;
    splitPane.hidden = !showSplit;
    if (showSplit) syncWorkspace();
  }

  function rangeError() {
    const mode = selectedMode();
    if (!totalPages) return "Önce editöre bir PDF yükleyin.";
    if (mode === "each") return "";
    if (mode === "chunk") {
      const size = Number(chunkSize.value);
      return Number.isInteger(size) && size >= 1 && size <= totalPages
        ? ""
        : `Sayfa sayısı 1 ile ${totalPages} arasında olmalıdır.`;
    }
    const selected = new Set();
    for (const range of ranges) {
      if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 1 || range.end < range.start) {
        return "Başlangıç ve bitiş sayfalarını geçerli bir aralık olarak girin.";
      }
      if (range.end > totalPages) return `Aralıklar ${totalPages}. sayfayı aşamaz.`;
      for (let page = range.start; page <= range.end; page += 1) {
        if (selected.has(page)) return `${page}. sayfa birden fazla aralıkta seçilemez.`;
        selected.add(page);
      }
    }
    return ranges.length ? "" : "En az bir sayfa aralığı ekleyin.";
  }

  function renderRanges(focusIndex = -1) {
    rangeList.innerHTML = "";
    ranges.forEach((range, index) => {
      const row = document.createElement("fieldset");
      row.className = "split-range-row";
      const legend = document.createElement("legend");
      legend.textContent = `Aralık ${index + 1}`;
      const startLabel = document.createElement("label");
      startLabel.textContent = "Başlangıç sayfası";
      const start = document.createElement("input");
      start.type = "number";
      start.inputMode = "numeric";
      start.min = "1";
      start.max = String(totalPages);
      start.value = String(range.start);
      start.setAttribute("aria-label", `Aralık ${index + 1} başlangıç sayfası`);
      const separator = document.createElement("span");
      separator.className = "split-range-separator";
      separator.textContent = "—";
      separator.setAttribute("aria-hidden", "true");
      const endLabel = document.createElement("label");
      endLabel.textContent = "Bitiş sayfası";
      const end = document.createElement("input");
      end.type = "number";
      end.inputMode = "numeric";
      end.min = "1";
      end.max = String(totalPages);
      end.value = String(range.end);
      end.setAttribute("aria-label", `Aralık ${index + 1} bitiş sayfası`);
      const remove = document.createElement("button");
      remove.className = "secondary split-range-remove";
      remove.type = "button";
      remove.textContent = "Sil";
      remove.setAttribute("aria-label", `Aralık ${index + 1}'i sil`);
      const update = () => {
        range.start = Number(start.value);
        range.end = Number(end.value);
        syncWorkspace();
      };
      start.addEventListener("input", update);
      end.addEventListener("input", update);
      remove.addEventListener("click", () => {
        ranges.splice(index, 1);
        renderRanges(Math.min(index, ranges.length - 1));
        syncWorkspace();
        if (!ranges.length) addRange.focus();
      });
      startLabel.appendChild(start);
      endLabel.appendChild(end);
      row.append(legend, startLabel, separator, endLabel, remove);
      rangeList.appendChild(row);
    });
    if (focusIndex >= 0) {
      rangeList.children[focusIndex]?.querySelector("input")?.focus();
    }
  }

  function renderPagePreview(selectedPages) {
    pagePreview.innerHTML = "";
    if (!totalPages) return;
    const visibleCount = Math.min(totalPages, MAX_PREVIEW_CHIPS);
    const fragment = document.createDocumentFragment();
    for (let page = 1; page <= visibleCount; page += 1) {
      const chip = document.createElement("span");
      chip.textContent = String(page);
      chip.classList.toggle("selected", selectedPages.has(page));
      chip.setAttribute("aria-label", `Sayfa ${page}`);
      chip.setAttribute("role", "listitem");
      fragment.appendChild(chip);
    }
    if (totalPages > MAX_PREVIEW_CHIPS) {
      const remainder = document.createElement("span");
      remainder.className = "split-page-remainder";
      remainder.textContent = `+${totalPages - MAX_PREVIEW_CHIPS}`;
      remainder.setAttribute("aria-label", `${totalPages - MAX_PREVIEW_CHIPS} sayfa daha`);
      remainder.setAttribute("role", "listitem");
      fragment.appendChild(remainder);
    }
    pagePreview.appendChild(fragment);
  }

  function syncWorkspace() {
    const nextTotal = typeof pdfDoc === "undefined" || !pdfDoc ? 0 : pdfDoc.getPageCount();
    if (nextTotal !== totalPages) {
      totalPages = nextTotal;
      ranges = totalPages ? [{ start: 1, end: Math.min(5, totalPages) }] : [];
      renderRanges();
    }
    const mode = selectedMode();
    pageCount.textContent = totalPages ? `${totalPages} sayfa` : "PDF yüklenmedi";
    modeDescription.textContent = descriptions[mode];
    chunkSize.max = String(Math.max(1, totalPages));
    rangeControls.hidden = mode !== "ranges";
    pagePreview.hidden = mode !== "ranges";
    eachPanel.hidden = mode !== "each";
    chunkPanel.hidden = mode !== "chunk";
    eachTotal.textContent = totalPages ? `${totalPages} sayfa` : "—";
    eachOutput.textContent = totalPages ? `${totalPages} PDF oluşturulacak` : "PDF yüklenmesi bekleniyor";
    const size = Number(chunkSize.value);
    const outputCount = totalPages && Number.isInteger(size) && size > 0 ? Math.ceil(totalPages / size) : 0;
    chunkTotal.textContent = totalPages ? `Toplam ${totalPages} sayfa` : "PDF yüklenmedi";
    chunkOutput.textContent = outputCount ? `${outputCount} PDF oluşturulacak` : "Geçerli bir sayı girin";
    const selectedPages = new Set();
    ranges.forEach(({ start, end }) => {
      for (let page = start; page <= end && page <= totalPages; page += 1) selectedPages.add(page);
    });
    if (mode === "ranges") renderPagePreview(selectedPages);
    const error = rangeError();
    validation.classList.toggle("error", Boolean(error));
    if (error) validation.textContent = error;
    else if (mode === "each") validation.textContent = "Her sayfa ayrı bir PDF olarak hazırlanacak.";
    else if (mode === "chunk") validation.textContent = `${outputCount} PDF dosyası hazırlanacak.`;
    else validation.textContent = `${ranges.length} aralık, ${selectedPages.size} sayfa seçildi.`;
    addRange.disabled = !totalPages || busy;
    runButton.disabled = Boolean(error) || busy;
    runButton.textContent = mode === "each" ? "Sayfaları ayrı PDF yap" : mode === "ranges" ? "Aralıkları böl" : "PDF'yi böl";
    return error;
  }

  function setBusy(isBusy) {
    busy = isBusy;
    modeInputs.forEach((input) => { input.disabled = busy; });
    chunkSize.disabled = busy;
    rangeList.querySelectorAll("input, button").forEach((control) => { control.disabled = busy; });
    syncWorkspace();
  }

  function handleTabKey(event) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.currentTarget === pagesTab ? splitTab : pagesTab;
    showTab(nextTab === splitTab ? "split" : "pages");
    nextTab.focus();
  }

  pagesTab.addEventListener("click", () => showTab("pages"));
  splitTab.addEventListener("click", () => showTab("split"));
  pagesTab.addEventListener("keydown", handleTabKey);
  splitTab.addEventListener("keydown", handleTabKey);
  modeInputs.forEach((input) => input.addEventListener("change", syncWorkspace));
  chunkSize.addEventListener("input", syncWorkspace);
  addRange.addEventListener("click", () => {
    if (!totalPages) return;
    const covered = new Set();
    ranges.forEach(({ start, end }) => {
      for (let page = start; page <= end; page += 1) covered.add(page);
    });
    const nextPage = Array.from({ length: totalPages }, (_, index) => index + 1)
      .find((page) => !covered.has(page)) || totalPages;
    ranges.push({ start: nextPage, end: nextPage });
    renderRanges(ranges.length - 1);
    syncWorkspace();
  });

  runButton.addEventListener("click", async () => {
    const error = syncWorkspace();
    if (error || typeof lastBytes === "undefined" || !lastBytes || busy) return;
    if (!navigator.onLine) {
      splitStatus.textContent = connectionMessage;
      splitStatus.classList.add("error");
      return;
    }
    setBusy(true);
    splitStatus.classList.remove("error");
    splitStatus.textContent = "PDF bölünüyor...";
    try {
      const form = new FormData();
      form.append("file", new Blob([lastBytes], { type: "application/pdf" }), sourceFilename);
      form.append("operation", "split");
      form.append("split_mode", selectedMode());
      form.append("ranges", ranges.map(({ start, end }) => start === end ? `${start}` : `${start}-${end}`).join(","));
      form.append("chunk_size", chunkSize.value);
      const response = await fetch("/api/pdf-tool", { method: "POST", body: form });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Sunucu işlemi tamamlayamadı.");
      }
      const blob = await response.blob();
      const match = /filename="?([^";]+)"?/i.exec(response.headers.get("content-disposition") || "");
      downloadBlob(blob, match?.[1] || "bolunmus-pdf.zip");
      splitStatus.textContent = "Bölme tamamlandı; çıktı cihazınıza indirildi.";
    } catch (error) {
      const message = !navigator.onLine || error instanceof TypeError ? connectionMessage : error.message;
      splitStatus.textContent = `İşlem tamamlanamadı: ${message}`;
      splitStatus.classList.add("error");
    } finally {
      setBusy(false);
    }
  });

  document.getElementById("fileInput").addEventListener("change", (event) => {
    const firstFile = event.target.files?.[0];
    if (firstFile && !pdfDoc) sourceFilename = firstFile.name;
  });
  new MutationObserver(syncWorkspace).observe(editorThumbs, { childList: true });

  const originalOpenEditor = window.BelgeLabApp.openEditor;
  window.BelgeLabApp.openEditor = (toolName) => {
    showTab(toolName === "split" ? "split" : "pages");
    const workspace = originalOpenEditor();
    return toolName === "split" ? splitPane : workspace;
  };

  const badge = splitCard?.querySelector(".processing-badge");
  if (badge) {
    badge.className = "processing-badge processing-badge--server";
    badge.textContent = "Sunucuda işlenir";
    splitCard.dataset.processing = "server";
  }
  showTab("pages");
  syncWorkspace();
})();
