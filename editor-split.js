(() => {
  const pagesTab = document.getElementById("editorPagesTab");
  const toolsTab = document.getElementById("editorToolsTab");
  const pagesPane = document.getElementById("editorPagesPane");
  const toolsPane = document.getElementById("editorToolsPane");
  const mode = document.getElementById("splitMode");
  const chunkWrap = document.getElementById("splitChunkWrap");
  const chunkSize = document.getElementById("splitChunkSize");
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

  let ranges = [];
  let totalPages = 0;
  let busy = false;
  let sourceFilename = "belgelab.pdf";

  function showTab(tabName) {
    const showTools = tabName === "split";
    pagesTab.classList.toggle("active", !showTools);
    toolsTab.classList.toggle("active", showTools);
    pagesTab.setAttribute("aria-selected", String(!showTools));
    toolsTab.setAttribute("aria-selected", String(showTools));
    pagesPane.hidden = showTools;
    toolsPane.hidden = !showTools;
    if (showTools) syncWorkspace();
  }

  function rangeError() {
    if (!totalPages) return "Önce editöre bir PDF yükleyin.";
    if (mode.value === "each") return "";
    if (mode.value === "chunk") {
      const size = Number(chunkSize.value);
      return Number.isInteger(size) && size >= 1 && size <= totalPages
        ? ""
        : `Bölüm boyutu 1 ile ${totalPages} arasında olmalıdır.`;
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

  function renderRanges() {
    rangeList.innerHTML = "";
    ranges.forEach((range, index) => {
      const row = document.createElement("fieldset");
      row.className = "split-range-row";
      const legend = document.createElement("legend");
      legend.textContent = `Aralık ${index + 1}`;
      const startLabel = document.createElement("label");
      startLabel.textContent = "Başlangıç";
      const start = document.createElement("input");
      start.type = "number";
      start.min = "1";
      start.max = String(totalPages);
      start.value = String(range.start);
      start.setAttribute("aria-label", `Aralık ${index + 1} başlangıç sayfası`);
      const endLabel = document.createElement("label");
      endLabel.textContent = "Bitiş";
      const end = document.createElement("input");
      end.type = "number";
      end.min = "1";
      end.max = String(totalPages);
      end.value = String(range.end);
      end.setAttribute("aria-label", `Aralık ${index + 1} bitiş sayfası`);
      const remove = document.createElement("button");
      remove.className = "secondary";
      remove.type = "button";
      remove.textContent = "Kaldır";
      remove.disabled = ranges.length === 1;
      const update = () => {
        range.start = Number(start.value);
        range.end = Number(end.value);
        syncWorkspace();
      };
      start.addEventListener("input", update);
      end.addEventListener("input", update);
      remove.addEventListener("click", () => {
        ranges.splice(index, 1);
        renderRanges();
        syncWorkspace();
      });
      startLabel.appendChild(start);
      endLabel.appendChild(end);
      row.append(legend, startLabel, endLabel, remove);
      rangeList.appendChild(row);
    });
  }

  function syncWorkspace() {
    const nextTotal = typeof pdfDoc === "undefined" || !pdfDoc ? 0 : pdfDoc.getPageCount();
    if (nextTotal !== totalPages) {
      totalPages = nextTotal;
      ranges = totalPages ? [{ start: 1, end: 1 }] : [];
      renderRanges();
    }
    pageCount.textContent = totalPages ? `${totalPages} sayfa` : "PDF yüklenmedi";
    chunkSize.max = String(Math.max(1, totalPages));
    chunkWrap.hidden = mode.value !== "chunk";
    rangeControls.hidden = mode.value !== "ranges";
    const selectedPages = new Set();
    if (mode.value !== "ranges") {
      for (let page = 1; page <= totalPages; page += 1) selectedPages.add(page);
    } else {
      ranges.forEach(({ start, end }) => {
        for (let page = start; page <= end && page <= totalPages; page += 1) selectedPages.add(page);
      });
    }
    pagePreview.innerHTML = "";
    for (let page = 1; page <= totalPages; page += 1) {
      const chip = document.createElement("span");
      chip.textContent = String(page);
      chip.classList.toggle("selected", selectedPages.has(page));
      chip.setAttribute("aria-label", `Sayfa ${page}`);
      pagePreview.appendChild(chip);
    }
    const error = rangeError();
    validation.classList.toggle("error", Boolean(error));
    if (error) validation.textContent = error;
    else if (mode.value === "each") validation.textContent = `${totalPages} sayfa, ${totalPages} ayrı PDF olarak hazırlanacak.`;
    else if (mode.value === "chunk") validation.textContent = "PDF, seçtiğiniz sayfa sayısına göre sıralı bölümlere ayrılacak.";
    else validation.textContent = `${ranges.length} aralık ayrı PDF olarak hazırlanacak.`;
    addRange.disabled = !totalPages || busy;
    runButton.disabled = Boolean(error) || busy;
    return error;
  }

  function setBusy(isBusy) {
    busy = isBusy;
    mode.disabled = busy;
    chunkSize.disabled = busy;
    rangeList.querySelectorAll("input, button").forEach((control) => {
      control.disabled = busy || (control.tagName === "BUTTON" && ranges.length === 1);
    });
    syncWorkspace();
  }

  pagesTab.addEventListener("click", () => showTab("pages"));
  toolsTab.addEventListener("click", () => showTab("split"));
  mode.addEventListener("change", syncWorkspace);
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
    renderRanges();
    syncWorkspace();
    rangeList.lastElementChild?.querySelector("input")?.focus();
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
      form.append("split_mode", mode.value);
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
    return toolName === "split" ? toolsPane : workspace;
  };

  const badge = splitCard?.querySelector(".processing-badge");
  if (badge) {
    badge.className = "processing-badge processing-badge--server";
    badge.textContent = "Sunucuda işlenir";
    splitCard.dataset.processing = "server";
  }
  syncWorkspace();
})();
