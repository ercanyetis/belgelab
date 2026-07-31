(() => {
  const panel = document.getElementById("redactionTool");
  if (!panel) return;
  const input = document.getElementById("redactionFile");
  const picker = document.getElementById("redactionPicker");
  const empty = document.getElementById("redactionEmpty");
  const workspace = document.getElementById("redactionWorkspace");
  const canvas = document.getElementById("redactionCanvas");
  const stage = document.getElementById("redactionStage");
  const overlay = document.getElementById("redactionOverlay");
  const pageLabel = document.getElementById("redactionPageLabel");
  const status = document.getElementById("redactionStatus");
  const fileName = document.getElementById("redactionFileName");
  const redactButton = document.getElementById("redactPdf");
  const deleteButton = document.getElementById("deleteRedaction");
  const pageClearButton = document.getElementById("clearPageRedactions");
  const allClearButton = document.getElementById("clearAllRedactions");
  let file = null;
  let pdf = null;
  let pageNumber = 1;
  let zoom = 1;
  let areas = [];
  let selectedId = null;
  let interaction = null;
  let nextId = 1;
  let busy = false;

  const currentAreas = () => areas.filter((area) => area.page === pageNumber);
  const selectedArea = () => areas.find((area) => area.id === selectedId);
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle("error", error);
  };

  function syncControls() {
    const hasSelection = Boolean(selectedArea());
    deleteButton.disabled = busy || !hasSelection;
    pageClearButton.disabled = busy || !currentAreas().length;
    allClearButton.disabled = busy || !areas.length;
    redactButton.disabled = busy || !file || !areas.length;
    panel.querySelectorAll("button[data-needs-pdf]").forEach((button) => { button.disabled = busy || !pdf; });
  }

  function pointFromEvent(event) {
    const rect = overlay.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  }

  function renderAreas() {
    overlay.replaceChildren();
    currentAreas().forEach((area) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `redaction-area${area.id === selectedId ? " selected" : ""}`;
      element.dataset.areaId = String(area.id);
      element.setAttribute("aria-label", `Sayfa ${pageNumber} sansür alanı`);
      element.style.left = `${area.x * 100}%`;
      element.style.top = `${area.y * 100}%`;
      element.style.width = `${area.width * 100}%`;
      element.style.height = `${area.height * 100}%`;
      ["nw", "ne", "sw", "se"].forEach((handle) => {
        const span = document.createElement("span");
        span.className = `redaction-handle ${handle}`;
        span.dataset.handle = handle;
        span.setAttribute("aria-hidden", "true");
        element.appendChild(span);
      });
      overlay.appendChild(element);
    });
    syncControls();
  }

  async function renderPage() {
    if (!pdf) return;
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const available = Math.max(280, Math.min(900, panel.clientWidth - 70));
    const viewport = page.getViewport({ scale: Math.min(2.2, available / base.width) * zoom });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport }).promise;
    pageLabel.textContent = `Sayfa ${pageNumber} / ${pdf.numPages}`;
    document.getElementById("redactionPrev").disabled = busy || pageNumber === 1;
    document.getElementById("redactionNext").disabled = busy || pageNumber === pdf.numPages;
    renderAreas();
  }

  async function loadFile(nextFile) {
    if (pdf) await pdf.destroy().catch(() => {});
    file = nextFile;
    areas = [];
    selectedId = null;
    pageNumber = 1;
    zoom = 1;
    try {
      pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      fileName.textContent = file.name;
      empty.hidden = true;
      workspace.hidden = false;
      await renderPage();
      setStatus("Önizleme hazır. PDF üzerinde sürükleyerek sansür alanı çizin.");
    } catch (error) {
      pdf = null;
      file = null;
      workspace.hidden = true;
      empty.hidden = false;
      input.value = "";
      setStatus("PDF önizlemesi açılamadı. Dosya bozuk veya parola korumalı olabilir.", true);
    }
    syncControls();
  }

  async function clearFile() {
    const previous = pdf;
    pdf = null;
    file = null;
    areas = [];
    selectedId = null;
    input.value = "";
    canvas.width = 0;
    canvas.height = 0;
    overlay.replaceChildren();
    workspace.hidden = true;
    empty.hidden = false;
    if (previous) await previous.destroy().catch(() => {});
    setStatus("PDF dosyası seçilmedi.");
    syncControls();
  }

  function startInteraction(event) {
    if (!pdf || busy || event.button !== 0) return;
    const point = pointFromEvent(event);
    const areaElement = event.target.closest(".redaction-area");
    if (areaElement) {
      selectedId = Number(areaElement.dataset.areaId);
      const area = selectedArea();
      interaction = { mode: event.target.dataset.handle ? "resize" : "move", handle: event.target.dataset.handle, start: point, original: { ...area } };
    } else {
      const area = { id: nextId++, page: pageNumber, x: point.x, y: point.y, width: 0, height: 0 };
      areas.push(area);
      selectedId = area.id;
      interaction = { mode: "draw", start: point };
    }
    try { overlay.setPointerCapture(event.pointerId); } catch (_) { /* Synthetic pointers may not have active capture. */ }
    renderAreas();
    event.preventDefault();
  }

  function moveInteraction(event) {
    if (!interaction) return;
    const point = pointFromEvent(event);
    const area = selectedArea();
    if (!area) return;
    if (interaction.mode === "draw") {
      area.x = Math.min(interaction.start.x, point.x);
      area.y = Math.min(interaction.start.y, point.y);
      area.width = Math.abs(point.x - interaction.start.x);
      area.height = Math.abs(point.y - interaction.start.y);
    } else if (interaction.mode === "move") {
      area.x = clamp(interaction.original.x + point.x - interaction.start.x, 0, 1 - area.width);
      area.y = clamp(interaction.original.y + point.y - interaction.start.y, 0, 1 - area.height);
    } else {
      const original = interaction.original;
      const left = interaction.handle.includes("w") ? clamp(point.x, 0, original.x + original.width - .005) : original.x;
      const right = interaction.handle.includes("e") ? clamp(point.x, original.x + .005, 1) : original.x + original.width;
      const top = interaction.handle.includes("n") ? clamp(point.y, 0, original.y + original.height - .005) : original.y;
      const bottom = interaction.handle.includes("s") ? clamp(point.y, original.y + .005, 1) : original.y + original.height;
      Object.assign(area, { x: left, y: top, width: right - left, height: bottom - top });
    }
    renderAreas();
  }

  function finishInteraction() {
    if (!interaction) return;
    const area = selectedArea();
    if (area && (area.width < .01 || area.height < .01)) {
      areas = areas.filter((item) => item.id !== area.id);
      selectedId = null;
      setStatus("Çok küçük seçim kaldırıldı. Daha geniş bir alan çizin.", true);
    } else if (area) {
      setStatus(`Sansür alanı eklendi. Belgede ${areas.length} alan var.`);
    }
    interaction = null;
    renderAreas();
  }

  async function submit() {
    if (!file || !areas.length || busy) return;
    busy = true;
    syncControls();
    setStatus("Sayfalar güvenli biçimde düzleştirilip sansürleniyor...");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("areas", JSON.stringify(areas.map(({ page, x, y, width, height }) => ({ page, x, y, width, height }))));
      const response = await fetch("/api/pdf-redact", { method: "POST", body: form });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Sunucu sansür işlemini tamamlayamadı.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = /filename\*?=(?:UTF-8''|\")?([^";]+)/i.exec(disposition);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = match ? decodeURIComponent(match[1].replace(/"/g, "")) : "sansurlenmis.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setStatus("Güvenli sansür tamamlandı; yeni PDF indirildi.");
    } catch (error) {
      setStatus(`İşlem tamamlanamadı: ${error.message}`, true);
    } finally {
      busy = false;
      syncControls();
      await renderPage();
    }
  }

  function open() {
    window.BelgeLabTools?.close();
    window.BelgeLabCreators?.close();
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => (file ? redactButton : picker).focus({ preventScroll: true }));
    return panel;
  }
  function close() { panel.hidden = true; }
  window.BelgeLabRedaction = { ...window.BelgeLabRedaction, open, close };

  document.querySelector('[data-tool-id="pdf-redact"]')?.addEventListener("click", () => window.BelgeLabNavigation?.openTool("pdf-redact") || open());
  picker.addEventListener("click", () => { input.value = ""; input.click(); });
  document.getElementById("chooseAnotherRedactionFile").addEventListener("click", () => { input.value = ""; input.click(); });
  document.getElementById("removeRedactionFile").addEventListener("click", clearFile);
  document.getElementById("closeRedaction").addEventListener("click", close);
  input.addEventListener("change", () => input.files[0] && loadFile(input.files[0]));
  overlay.addEventListener("pointerdown", startInteraction);
  overlay.addEventListener("pointermove", moveInteraction);
  overlay.addEventListener("pointerup", finishInteraction);
  overlay.addEventListener("pointercancel", finishInteraction);
  document.getElementById("redactionPrev").addEventListener("click", async () => { if (pageNumber > 1) { pageNumber -= 1; selectedId = null; await renderPage(); } });
  document.getElementById("redactionNext").addEventListener("click", async () => { if (pdf && pageNumber < pdf.numPages) { pageNumber += 1; selectedId = null; await renderPage(); } });
  document.getElementById("redactionZoomIn").addEventListener("click", async () => { zoom = Math.min(1.8, zoom + .2); await renderPage(); });
  document.getElementById("redactionZoomOut").addEventListener("click", async () => { zoom = Math.max(.6, zoom - .2); await renderPage(); });
  document.getElementById("addRedactionArea").addEventListener("click", () => { selectedId = null; renderAreas(); setStatus("PDF üzerinde sürükleyerek yeni bir sansür alanı çizin."); stage.focus(); });
  deleteButton.addEventListener("click", () => { areas = areas.filter((area) => area.id !== selectedId); selectedId = null; renderAreas(); setStatus("Seçili sansür alanı silindi."); });
  pageClearButton.addEventListener("click", () => { areas = areas.filter((area) => area.page !== pageNumber); selectedId = null; renderAreas(); setStatus("Bu sayfadaki sansür alanları temizlendi."); });
  allClearButton.addEventListener("click", () => { areas = []; selectedId = null; renderAreas(); setStatus("Belgedeki tüm sansür alanları temizlendi."); });
  redactButton.addEventListener("click", submit);
  syncControls();
})();
