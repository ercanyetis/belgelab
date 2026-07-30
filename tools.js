(() => {
  const panel = document.getElementById("quickTool");
  const title = document.getElementById("quickToolTitle");
  const description = document.getElementById("quickToolDescription");
  const filesInput = document.getElementById("quickToolFiles");
  const secondInput = document.getElementById("quickSecondFile");
  const secondWrap = document.getElementById("quickSecondFileWrap");
  const filePrompt = document.getElementById("quickFilePrompt");
  const fileTypes = document.getElementById("quickFileTypes");
  const options = document.getElementById("quickOptions");
  const runButton = document.getElementById("runQuickTool");
  const closeButton = document.getElementById("closeQuickTool");
  const toolStatus = document.getElementById("quickToolStatus");
  const processingNotice = document.getElementById("quickProcessingNotice");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingStage = document.getElementById("loadingStage");
  const cropWorkspace = document.getElementById("cropWorkspace");
  const cropStage = document.getElementById("cropStage");
  const cropCanvas = document.getElementById("cropCanvas");
  const cropSelection = document.getElementById("cropSelection");
  const cropPageLabel = document.getElementById("cropPageLabel");
  const cropPrevPage = document.getElementById("cropPrevPage");
  const cropNextPage = document.getElementById("cropNextPage");
  const cropReset = document.getElementById("cropReset");
  const runButtonHome = document.getElementById("runQuickToolHome");
  let activeTool = null;
  let cropPdf = null;
  let cropPage = 1;
  let cropArea = null;
  let cropDragStart = null;
  let cropDragMode = "draw";
  let cropStartArea = null;
  let isQuickToolRunning = false;
  const connectionErrorMessage = "İnternet bağlantısı yok. Bu işlem için bağlantınızı kontrol edip yeniden deneyin.";

  const toolConfig = {
    split: {
      title: "PDF böl",
      accept: ".pdf",
      prompt: "Bölünecek PDF'i seçin",
      server: true,
      fields: [
        {
          id: "split_mode",
          label: "Bölme yöntemi",
          type: "select",
          options: [
            { value: "ranges", label: "Sayfa aralıklarına göre" },
            { value: "each", label: "Her sayfayı ayrı PDF yap" },
            { value: "chunk", label: "Her N sayfada böl" },
          ],
        },
        {
          id: "ranges",
          label: "Sayfa aralıkları",
          type: "text",
          value: "1-3,8-10",
          visibleWhen: { field: "split_mode", value: "ranges" },
        },
        {
          id: "chunk_size",
          label: "Her bölümdeki sayfa sayısı",
          type: "number",
          value: "5",
          visibleWhen: { field: "split_mode", value: "chunk" },
        },
      ],
    },
    compress: {
      title: "PDF sıkıştırma",
      accept: ".pdf",
      prompt: "Sıkıştırılacak PDF'i seçin",
      fields: [{
        id: "level",
        label: "Sıkıştırma oranı",
        type: "select",
        options: [
          { value: "light", label: "Hafif — yüksek görüntü kalitesi" },
          { value: "balanced", label: "Dengeli — önerilen" },
          { value: "strong", label: "Güçlü — daha küçük dosya" },
        ],
      }],
    },
    "pdf-to-jpg": { title: "PDF'den JPG'ye", accept: ".pdf", prompt: "PDF dosyanızı seçin", multiple: false },
    "jpg-to-pdf": { title: "Görselden PDF'e", accept: ".jpg,.jpeg,.png", prompt: "JPG veya PNG görsellerini seçin", multiple: true },
    sign: { title: "PDF imzala", accept: ".pdf", prompt: "İmzalanacak PDF'i seçin", fields: [{ id: "signature", label: "İmza metni", type: "text", value: "" }, { id: "page", label: "Sayfa", type: "number", value: "1" }] },
    watermark: { title: "Filigran ekle", accept: ".pdf", prompt: "PDF dosyanızı seçin", fields: [{ id: "text", label: "Filigran metni", type: "text", value: "BELGELAB" }] },
    "rotate-all": { title: "Tüm sayfaları döndür", accept: ".pdf", prompt: "PDF dosyanızı seçin", fields: [{ id: "angle", label: "Döndürme açısı", type: "select", options: ["90", "180", "270"] }] },
    unlock: { title: "PDF kilidini aç", accept: ".pdf", prompt: "Kilitli PDF'i seçin", server: true, fields: [{ id: "password", label: "Mevcut parola", type: "password", value: "" }] },
    protect: { title: "PDF'i parolayla koru", accept: ".pdf", prompt: "Korunacak PDF'i seçin", server: true, fields: [{ id: "password", label: "Yeni parola", type: "password", value: "" }] },
    "page-numbers": { title: "Sayfa numarası ekle", accept: ".pdf", prompt: "PDF dosyanızı seçin" },
    repair: { title: "PDF'i onar", accept: ".pdf", prompt: "Onarılacak PDF'i seçin", server: true },
    crop: { title: "PDF kırpma", accept: ".pdf", prompt: "PDF dosyanızı seçin" },
    compare: { title: "PDF karşılaştırma", accept: ".pdf", prompt: "İlk PDF'i seçin", server: true, second: true },
    markdown: { title: "PDF'den Markdown'a", accept: ".pdf", prompt: "PDF dosyanızı seçin" },
  };

  function setStatus(message, error = false) {
    toolStatus.textContent = message;
    toolStatus.classList.toggle("error", error);
    if (isQuickToolRunning && !error) loadingStage.textContent = message;
  }

  function setQuickToolBusy(busy, stage = "İşlem hazırlanıyor...") {
    isQuickToolRunning = busy;
    runButton.disabled = busy;
    closeButton.disabled = busy;
    filesInput.disabled = busy;
    secondInput.disabled = busy;
    options.querySelectorAll("input, select, button").forEach((control) => {
      control.disabled = busy;
    });
    if (busy) {
      loadingStage.textContent = stage;
      loadingOverlay.hidden = false;
      document.body.classList.add("is-processing");
    } else {
      loadingOverlay.hidden = true;
      document.body.classList.remove("is-processing");
    }
  }

  function optionValues() {
    return Object.fromEntries([...options.querySelectorAll("[data-option]")].map((el) => [el.dataset.option, el.value]));
  }

  function renderFields(fields = []) {
    options.innerHTML = "";
    fields.forEach((field) => {
      const label = document.createElement("label");
      label.textContent = field.label;
      if (field.visibleWhen) {
        label.dataset.visibleWhenField = field.visibleWhen.field;
        label.dataset.visibleWhenValue = field.visibleWhen.value;
      }
      let input;
      if (field.type === "select") {
        input = document.createElement("select");
        field.options.forEach((item) => {
          const value = typeof item === "string" ? item : item.value;
          const label = typeof item === "string" ? `${item}°` : item.label;
          input.add(new Option(label, value));
        });
      } else {
        input = document.createElement("input");
        input.type = field.type;
        input.value = field.value || "";
        if (field.type === "number") input.min = "1";
      }
      input.dataset.option = field.id;
      label.appendChild(input);
      options.appendChild(label);
    });
    const syncConditionalFields = () => {
      options.querySelectorAll("[data-visible-when-field]").forEach((label) => {
        const controller = options.querySelector(`[data-option="${label.dataset.visibleWhenField}"]`);
        label.hidden = controller?.value !== label.dataset.visibleWhenValue;
      });
    };
    options.querySelectorAll("select[data-option]").forEach((select) => {
      select.addEventListener("change", syncConditionalFields);
    });
    syncConditionalFields();
  }

  function updateCropSelection() {
    if (!cropArea) {
      cropSelection.hidden = true;
      return;
    }
    cropSelection.hidden = false;
    cropSelection.style.left = `${cropArea.x * 100}%`;
    cropSelection.style.top = `${cropArea.y * 100}%`;
    cropSelection.style.width = `${cropArea.width * 100}%`;
    cropSelection.style.height = `${cropArea.height * 100}%`;
  }

  async function renderCropPage() {
    if (!cropPdf) return;
    const page = await cropPdf.getPage(cropPage);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1.6, 760 / baseViewport.width) });
    cropCanvas.width = Math.floor(viewport.width);
    cropCanvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: cropCanvas.getContext("2d"), viewport }).promise;
    cropPageLabel.textContent = `Sayfa ${cropPage} / ${cropPdf.numPages}`;
    cropPrevPage.disabled = cropPage === 1;
    cropNextPage.disabled = cropPage === cropPdf.numPages;
    updateCropSelection();
  }

  async function loadCropPreview(file) {
    if (cropPdf) await cropPdf.destroy();
    cropPdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    cropPage = 1;
    cropArea = null;
    cropWorkspace.hidden = false;
    await renderCropPage();
    setStatus("Önizleme hazır. Kırpılacak alanı PDF üzerinde çizin.");
  }

  function cropPoint(event) {
    const rect = cropCanvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function open(toolName) {
    const config = toolConfig[toolName];
    if (!config) return null;
    const card = document.querySelector(`[data-pdf-tool="${toolName}"]`);
    if (!card) return null;
    activeTool = toolName;
    title.textContent = config.title;
    description.textContent = card.querySelector("span:last-child").textContent;
    filesInput.accept = config.accept;
    filesInput.multiple = Boolean(config.multiple);
    filesInput.value = "";
    secondInput.value = "";
    filePrompt.textContent = config.prompt;
    fileTypes.textContent = config.accept.replaceAll(".", "").toUpperCase();
    secondWrap.hidden = !config.second;
    renderFields(config.fields);
    processingNotice.className = `processing-notice ${config.server ? "processing-notice--server" : "processing-notice--local"}`;
    processingNotice.innerHTML = config.server
      ? "<strong>Sunucuda işlenir</strong> Seçtiğiniz dosya bu işlem için uygulama sunucusuna gönderilir ve işlem sonunda geçici çalışma alanından silinir."
      : "<strong>Cihazınızda işlenir</strong> Seçtiğiniz dosya bu işlem sırasında sunucuya gönderilmez.";
    cropWorkspace.hidden = activeTool !== "crop";
    if (activeTool === "crop") cropReset.after(runButton);
    else runButtonHome.after(runButton);
    cropArea = null;
    updateCropSelection();
    setStatus("Dosya seçimi bekleniyor.");
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
    return panel;
  }

  function close() {
    panel.hidden = true;
    activeTool = null;
    cropWorkspace.hidden = true;
  }

  window.BelgeLabTools = { ...window.BelgeLabTools, open, close };

  document.querySelectorAll("[data-pdf-tool]").forEach((card) => {
    card.addEventListener("click", () => {
      if (window.BelgeLabNavigation?.openTool(card.dataset.toolId)) return;
      open(card.dataset.pdfTool);
    });
  });

  closeButton.addEventListener("click", close);

  filesInput.addEventListener("change", async () => {
    const count = filesInput.files.length;
    if (activeTool === "crop" && filesInput.files[0]) {
      try {
        await loadCropPreview(filesInput.files[0]);
      } catch (error) {
        setStatus(`PDF önizlemesi açılamadı: ${error.message}`, true);
      }
      return;
    }
    setStatus(count ? `${count} dosya seçildi. İşlemi başlatabilirsiniz.` : "Dosya seçimi bekleniyor.");
  });

  cropStage.addEventListener("pointerdown", (event) => {
    if (!cropPdf || event.button !== 0) return;
    cropStage.setPointerCapture(event.pointerId);
    cropDragStart = cropPoint(event);
    const insideSelection = cropArea
      && cropDragStart.x >= cropArea.x
      && cropDragStart.x <= cropArea.x + cropArea.width
      && cropDragStart.y >= cropArea.y
      && cropDragStart.y <= cropArea.y + cropArea.height;
    cropDragMode = insideSelection ? "move" : "draw";
    cropStartArea = insideSelection ? { ...cropArea } : null;
    cropStage.classList.toggle("moving-selection", insideSelection);
    if (!insideSelection) cropArea = { ...cropDragStart, width: 0, height: 0 };
    updateCropSelection();
  });

  cropStage.addEventListener("pointermove", (event) => {
    if (!cropDragStart) return;
    const point = cropPoint(event);
    if (cropDragMode === "move") {
      cropArea = {
        ...cropStartArea,
        x: Math.max(0, Math.min(1 - cropStartArea.width, cropStartArea.x + point.x - cropDragStart.x)),
        y: Math.max(0, Math.min(1 - cropStartArea.height, cropStartArea.y + point.y - cropDragStart.y)),
      };
    } else {
      cropArea = {
        x: Math.min(cropDragStart.x, point.x),
        y: Math.min(cropDragStart.y, point.y),
        width: Math.abs(point.x - cropDragStart.x),
        height: Math.abs(point.y - cropDragStart.y),
      };
    }
    updateCropSelection();
  });

  function finishCropDrag() {
    if (!cropDragStart) return;
    if (cropArea && (cropArea.width < .01 || cropArea.height < .01)) cropArea = null;
    cropDragStart = null;
    cropStartArea = null;
    cropStage.classList.remove("moving-selection");
    updateCropSelection();
    setStatus(cropArea ? "Kırpma alanı seçildi. İşlemi başlatabilirsiniz." : "Daha geniş bir kırpma alanı seçin.", !cropArea);
  }

  cropStage.addEventListener("pointerup", finishCropDrag);
  cropStage.addEventListener("pointercancel", finishCropDrag);

  cropPrevPage.addEventListener("click", async () => {
    if (cropPage > 1) { cropPage -= 1; await renderCropPage(); }
  });
  cropNextPage.addEventListener("click", async () => {
    if (cropPdf && cropPage < cropPdf.numPages) { cropPage += 1; await renderCropPage(); }
  });
  cropReset.addEventListener("click", () => {
    cropArea = null;
    updateCropSelection();
    setStatus("Seçim sıfırlandı. Yeni bir alan çizin.");
  });

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function loadPdfLib(file) {
    return window.PDFLib.PDFDocument.load(await file.arrayBuffer());
  }

  async function savePdf(doc, filename) {
    saveBlob(new Blob([await doc.save()], { type: "application/pdf" }), filename);
  }

  async function pdfToJpg(file) {
    const source = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    for (let i = 1; i <= source.numPages; i += 1) {
      setStatus(`${i}/${source.numPages} sayfa hazırlanıyor...`);
      const page = await source.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const output = document.createElement("canvas");
      output.width = Math.floor(viewport.width);
      output.height = Math.floor(viewport.height);
      await page.render({ canvasContext: output.getContext("2d", { alpha: false }), viewport }).promise;
      const blob = await new Promise((resolve) => output.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("JPG oluşturulamadı.");
      saveBlob(blob, `sayfa-${i}.jpg`);
    }
    await source.destroy();
  }

  async function imagesToPdf(files) {
    const doc = await window.PDFLib.PDFDocument.create();
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const image = file.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const maxWidth = 595.28;
      const maxHeight = 841.89;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const width = image.width * scale;
      const height = image.height * scale;
      const page = doc.addPage([maxWidth, maxHeight]);
      page.drawImage(image, { x: (maxWidth - width) / 2, y: (maxHeight - height) / 2, width, height });
    }
    await savePdf(doc, "gorseller.pdf");
  }

  async function compressPdf(file, level) {
    const presets = {
      light: { scale: 1.55, quality: 0.84, label: "Hafif" },
      balanced: { scale: 1.2, quality: 0.66, label: "Dengeli" },
      strong: { scale: 0.9, quality: 0.48, label: "Güçlü" },
    };
    const preset = presets[level] || presets.balanced;
    const originalSize = file.size;
    const source = await window.pdfjsLib.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;
    const output = await window.PDFLib.PDFDocument.create();

    for (let index = 1; index <= source.numPages; index += 1) {
      setStatus(`${preset.label} sıkıştırma: ${index}/${source.numPages} sayfa işleniyor...`);
      const sourcePage = await source.getPage(index);
      const viewport = sourcePage.getViewport({ scale: preset.scale });
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = Math.max(1, Math.floor(viewport.width));
      pageCanvas.height = Math.max(1, Math.floor(viewport.height));
      const context = pageCanvas.getContext("2d", { alpha: false });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      await sourcePage.render({ canvasContext: context, viewport }).promise;
      const jpegBlob = await new Promise((resolve) => {
        pageCanvas.toBlob(resolve, "image/jpeg", preset.quality);
      });
      if (!jpegBlob) throw new Error("Sıkıştırılmış sayfa oluşturulamadı.");
      const jpeg = await output.embedJpg(await jpegBlob.arrayBuffer());
      const originalViewport = sourcePage.getViewport({ scale: 1 });
      const page = output.addPage([originalViewport.width, originalViewport.height]);
      page.drawImage(jpeg, {
        x: 0,
        y: 0,
        width: originalViewport.width,
        height: originalViewport.height,
      });
      pageCanvas.width = 1;
      pageCanvas.height = 1;
    }
    await source.destroy();
    const bytes = await output.save();
    const resultBlob = new Blob([bytes], { type: "application/pdf" });
    saveBlob(resultBlob, `sikistirilmis-${level}.pdf`);
    const difference = Math.round((1 - resultBlob.size / originalSize) * 100);
    const before = (originalSize / 1024 / 1024).toFixed(2);
    const after = (resultBlob.size / 1024 / 1024).toFixed(2);
    return difference > 0
      ? `${preset.label} sıkıştırma tamamlandı: ${before} MB → ${after} MB (%${difference} küçüldü).`
      : `İşlem tamamlandı: ${before} MB → ${after} MB. Bu PDF bu ayarda küçülmedi.`;
  }

  async function editPdf(file, operation, values) {
    const doc = await loadPdfLib(file);
    const { degrees, rgb, StandardFonts, PDFDocument } = window.PDFLib;
    let outputDoc = doc;
    const font = await doc.embedFont(StandardFonts.Helvetica);
    if (operation === "rotate-all") {
      doc.getPages().forEach((page) => page.setRotation(degrees((page.getRotation().angle + Number(values.angle)) % 360)));
    } else if (operation === "page-numbers") {
      doc.getPages().forEach((page, index) => {
        const label = `${index + 1} / ${doc.getPageCount()}`;
        const width = font.widthOfTextAtSize(label, 10);
        page.drawText(label, { x: (page.getWidth() - width) / 2, y: 18, size: 10, font, color: rgb(.25, .22, .35) });
      });
    } else if (operation === "watermark") {
      const text = (values.text || "FILIGRAN").replace(/[^\x20-\x7E]/g, "");
      doc.getPages().forEach((page) => page.drawText(text, {
        x: page.getWidth() * .18, y: page.getHeight() * .48, size: Math.min(52, page.getWidth() / 8),
        font, color: rgb(.45, .35, .75), opacity: .22, rotate: degrees(35),
      }));
    } else if (operation === "sign") {
      const signature = (values.signature || "").replace(/[^\x20-\x7E]/g, "");
      if (!signature) throw new Error("İmza metni girin.");
      const pageIndex = Number(values.page) - 1;
      if (pageIndex < 0 || pageIndex >= doc.getPageCount()) throw new Error("Geçerli bir sayfa numarası girin.");
      const page = doc.getPage(pageIndex);
      page.drawText(signature, { x: page.getWidth() - 190, y: 45, size: 18, font, color: rgb(.12, .18, .38) });
      page.drawLine({ start: { x: page.getWidth() - 205, y: 40 }, end: { x: page.getWidth() - 35, y: 40 }, thickness: 1 });
    } else if (operation === "crop") {
      if (!cropArea) throw new Error("Önizleme üzerinde kırpılacak alanı seçin.");
      const page = doc.getPage(cropPage - 1);
      const width = page.getWidth();
      const height = page.getHeight();
      page.setCropBox(
        width * cropArea.x,
        height * (1 - cropArea.y - cropArea.height),
        width * cropArea.width,
        height * cropArea.height
      );
      const croppedDoc = await PDFDocument.create();
      const [croppedPage] = await croppedDoc.copyPages(doc, [cropPage - 1]);
      croppedDoc.addPage(croppedPage);
      outputDoc = croppedDoc;
    }
    const outputName = operation === "crop"
      ? `${file.name.replace(/\.pdf$/i, "")}.crop.pdf`
      : `${operation}.pdf`;
    await savePdf(outputDoc, outputName);
  }

  async function toMarkdown(file) {
    const source = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const sections = [];
    for (let i = 1; i <= source.numPages; i += 1) {
      const content = await (await source.getPage(i)).getTextContent();
      sections.push(`## Sayfa ${i}\n\n${content.items.map((item) => item.str).join(" ")}`);
    }
    await source.destroy();
    saveBlob(new Blob([`# ${file.name.replace(/\.pdf$/i, "")}\n\n${sections.join("\n\n")}`], { type: "text/markdown;charset=utf-8" }), "belge.md");
  }

  async function callServerTool(file, operation, values, secondFile) {
    if (!navigator.onLine) throw new Error(connectionErrorMessage);
    const form = new FormData();
    form.append("file", file);
    if (secondFile) form.append("second_file", secondFile);
    form.append("operation", operation);
    Object.entries(values).forEach(([key, value]) => form.append(key, value));
    const response = await fetch("/api/pdf-tool", { method: "POST", body: form });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Sunucu işlemi tamamlayamadı.");
    }
    const blob = await response.blob();
    const match = /filename="?([^";]+)"?/i.exec(response.headers.get("content-disposition") || "");
    saveBlob(blob, match?.[1] || `${operation}.bin`);
  }

  runButton.addEventListener("click", async () => {
    if (isQuickToolRunning) return;
    const config = toolConfig[activeTool];
    const files = [...filesInput.files];
    if (!config || !files.length) return setStatus("Önce uygun bir dosya seçin.", true);
    if (config.second && !secondInput.files[0]) return setStatus("İkinci PDF dosyasını da seçin.", true);
    if (activeTool === "crop" && !cropArea) return setStatus("Önizleme üzerinde kırpılacak alanı seçin.", true);
    setQuickToolBusy(true);
    setStatus("İşlem hazırlanıyor...");
    try {
      const values = optionValues();
      let resultMessage = "";
      if (config.server) await callServerTool(files[0], activeTool, values, secondInput.files[0]);
      else if (activeTool === "compress") resultMessage = await compressPdf(files[0], values.level);
      else if (activeTool === "pdf-to-jpg") await pdfToJpg(files[0]);
      else if (activeTool === "jpg-to-pdf") await imagesToPdf(files);
      else if (activeTool === "markdown") await toMarkdown(files[0]);
      else await editPdf(files[0], activeTool, values);
      setStatus(resultMessage || "İşlem tamamlandı; çıktı cihazınıza indirildi.");
    } catch (error) {
      const message = config.server && (!navigator.onLine || error instanceof TypeError)
        ? connectionErrorMessage
        : error.message;
      if (message !== connectionErrorMessage) console.error(error);
      setStatus(`İşlem tamamlanamadı: ${message}`, true);
    } finally {
      setQuickToolBusy(false);
    }
  });
})();
