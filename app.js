const fileInput = document.getElementById("fileInput");
const mergeInput = document.getElementById("mergeInput");
const dropzone = document.getElementById("dropzone");
const thumbs = document.getElementById("thumbs");
const status = document.getElementById("status");
const rotateBtn = document.getElementById("rotateBtn");
const addPageBtn = document.getElementById("addPageBtn");
const deletePageBtn = document.getElementById("deletePageBtn");
const finishEditBtn = document.getElementById("finishEditBtn");
const completionToast = document.getElementById("completionToast");
const closeCompletionToast = document.getElementById("closeCompletionToast");
const completedFilename = document.getElementById("completedFilename");
const downloadCompletedPdf = document.getElementById("downloadCompletedPdf");
const previewCompletedPdf = document.getElementById("previewCompletedPdf");
const continueEditing = document.getElementById("continueEditing");
const startNewDocument = document.getElementById("startNewDocument");
const downloadBtn = document.getElementById("downloadBtn");
const compressBtn = document.getElementById("compressBtn");
const aggressiveBtn = document.getElementById("aggressiveBtn");
const mergeTrigger = document.getElementById("mergeTrigger");
const conversionType = document.getElementById("conversionType");
const conversionInput = document.getElementById("conversionInput");
const convertBtn = document.getElementById("convertBtn");
const conversionStatus = document.getElementById("conversionStatus");
const conversionDropzone = document.getElementById("conversionDropzone");
const conversionFileName = document.getElementById("conversionFileName");
const conversionFileHint = document.getElementById("conversionFileHint");
const pdfWordModeWrap = document.getElementById("pdfWordModeWrap");
const pdfWordMode = document.getElementById("pdfWordMode");
const installBtn = document.getElementById("installBtn");
const progressCard = document.getElementById("progressCard");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const progressHint = document.getElementById("progressHint");
const categoryButtons = document.querySelectorAll(".category-pill");
const toolCards = document.querySelectorAll(".tool-card");
const serverPdfTools = new Set(["unlock", "protect", "repair", "compare"]);

toolCards.forEach((card) => {
  const isServerTool = Boolean(card.dataset.operation || card.dataset.createTool)
    || serverPdfTools.has(card.dataset.pdfTool);
  const badge = document.createElement("span");
  badge.className = `processing-badge ${isServerTool ? "processing-badge--server" : "processing-badge--local"}`;
  badge.textContent = isServerTool ? "Sunucuda işlenir" : "Cihazda işlenir";
  const icon = card.querySelector(".tool-icon");
  icon?.insertAdjacentElement("afterend", badge);
  card.dataset.processing = isServerTool ? "server" : "local";
});
const copyrightYear = document.getElementById("copyrightYear");

let pdfDoc = null;
let currentPageIndex = 0;
let lastBytes = null;
let selectedConversionFile = null;
let progressTimer = null;
let deferredPrompt = null;
let thumbnailRenderVersion = 0;
let completedPdfBlob = null;
let completedPreviewUrl = null;
const apiBaseUrl = /^https?:$/.test(window.location.protocol)
  ? ""
  : "http://127.0.0.1:3000";

const conversionRules = {
  "pdf-to-docx": { extensions: [".pdf"], accept: ".pdf,application/pdf" },
  "pdf-to-xlsx": { extensions: [".pdf"], accept: ".pdf,application/pdf" },
  "pdf-to-pptx": { extensions: [".pdf"], accept: ".pdf,application/pdf" },
  "docx-to-pdf": { extensions: [".docx"], accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  "xlsx-to-pdf": { extensions: [".xlsx"], accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  "pptx-to-pdf": { extensions: [".pptx"], accept: ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  "dwg-to-pdf": { extensions: [".dwg"], accept: ".dwg,application/acad,application/x-acad,application/autocad_dwg" },
};

if (copyrightYear) {
  copyrightYear.textContent = new Date().getFullYear();
}

window.pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

function setStatus(message) {
  status.textContent = message;
}

function enableControls(enabled) {
  rotateBtn.disabled = !enabled;
  addPageBtn.disabled = !enabled;
  deletePageBtn.disabled = !enabled;
  downloadBtn.disabled = !enabled;
  compressBtn.disabled = !enabled;
  aggressiveBtn.disabled = !enabled;
  finishEditBtn.disabled = !enabled;
}

async function renderPageList() {
  const version = ++thumbnailRenderVersion;
  thumbs.innerHTML = "";
  if (!pdfDoc || !lastBytes) {
    return;
  }

  const count = pdfDoc.getPageCount();
  let previewDocument;
  try {
    previewDocument = await window.pdfjsLib
      .getDocument({ data: new Uint8Array(lastBytes).slice() })
      .promise;
  } catch (error) {
    console.error("Küçük önizlemeler oluşturulamadı:", error);
    return;
  }

  for (let index = 0; index < count; index += 1) {
    if (version !== thumbnailRenderVersion) break;
    const card = document.createElement("article");
    card.className = `thumb-card ${index === currentPageIndex ? "active" : ""}`;
    card.draggable = true;
    card.dataset.index = index;
    card.title = "Sayfayı seçin veya yeni konumuna sürükleyin";

    const preview = document.createElement("canvas");
    preview.className = "thumb-canvas";
    const label = document.createElement("strong");
    label.textContent = `Sayfa ${index + 1}`;
    const actions = document.createElement("div");
    actions.className = "thumb-actions";
    actions.innerHTML = `
      <button type="button" data-action="left" title="Sola döndür">↶</button>
      <button type="button" data-action="right" title="Sağa döndür">↷</button>
      <button type="button" data-action="delete" title="Sayfayı sil">×</button>
    `;
    card.append(preview, label, actions);

    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      currentPageIndex = index;
      thumbs.querySelectorAll(".thumb-card").forEach((item) => item.classList.remove("active"));
      card.classList.add("active");
    });
    actions.addEventListener("click", async (event) => {
      const action = event.target.closest("button")?.dataset.action;
      if (!action) return;
      if (action === "delete") {
        if (pdfDoc.getPageCount() <= 1) {
          setStatus("Belgede en az bir sayfa kalmalıdır.");
          return;
        }
        pdfDoc.removePage(index);
        currentPageIndex = Math.min(currentPageIndex, pdfDoc.getPageCount() - 1);
        await refreshDocument();
        setStatus(`Sayfa ${index + 1} silindi.`);
      } else {
        const page = pdfDoc.getPage(index);
        const delta = action === "right" ? 90 : 270;
        page.setRotation(window.PDFLib.degrees((page.getRotation().angle + delta) % 360));
        currentPageIndex = index;
        await refreshDocument();
        setStatus(`Sayfa ${index + 1} döndürüldü.`);
      }
    });
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", String(index));
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", async (event) => {
      event.preventDefault();
      card.classList.remove("drag-over");
      const fromIndex = Number(event.dataTransfer.getData("text/plain"));
      const toIndex = index;
      if (Number.isInteger(fromIndex) && fromIndex !== toIndex) {
        await movePage(fromIndex, toIndex);
      }
    });
    thumbs.appendChild(card);

    try {
      const page = await previewDocument.getPage(index + 1);
      const viewport = page.getViewport({ scale: 0.28 });
      const ratio = window.devicePixelRatio || 1;
      preview.width = Math.floor(viewport.width * ratio);
      preview.height = Math.floor(viewport.height * ratio);
      preview.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      await page.render({
        canvasContext: preview.getContext("2d"),
        viewport,
        transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
      }).promise;
    } catch (error) {
      console.error(error);
    }
  }
  await previewDocument.destroy();
}

async function movePage(fromIndex, toIndex) {
  const order = pdfDoc.getPageIndices();
  const [moved] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, moved);
  const reordered = await window.PDFLib.PDFDocument.create();
  const pages = await reordered.copyPages(pdfDoc, order);
  pages.forEach((page) => reordered.addPage(page));
  pdfDoc = reordered;
  currentPageIndex = toIndex;
  await refreshDocument();
  setStatus(`Sayfa ${fromIndex + 1}, ${toIndex + 1}. sıraya taşındı.`);
}

function renderPreview() {}

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    categoryButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const filter = button.dataset.filter;
    toolCards.forEach((card) => {
      card.hidden = filter !== "all" && !card.dataset.category.split(" ").includes(filter);
    });
  });
});

toolCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (card.dataset.pdfTool || card.dataset.createTool) {
      return;
    }
    if (card.dataset.operation) {
      conversionType.value = card.dataset.operation;
      conversionType.dispatchEvent(new Event("change"));
      document.getElementById("converter").scrollIntoView({ behavior: "smooth" });
    } else {
      document.getElementById(card.dataset.target || "editor").scrollIntoView({ behavior: "smooth" });
    }
  });
});


async function refreshDocument() {
  if (!pdfDoc) {
    return;
  }

  const updatedBytes = await pdfDoc.save();
  lastBytes = updatedBytes.slice();
  renderPageList();
  if (currentPageIndex >= pdfDoc.getPageCount()) {
    currentPageIndex = Math.max(0, pdfDoc.getPageCount() - 1);
  }
  renderPreview();
}

async function loadPdfFiles(files, append = false) {
  const selectedFiles = [...files];
  if (!selectedFiles.length) return;
  if (selectedFiles.some((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
    setStatus("Lütfen geçerli bir PDF dosyası seçin.");
    return;
  }

  try {
    const combined = append && pdfDoc ? pdfDoc : await window.PDFLib.PDFDocument.create();
    for (const file of selectedFiles) {
      setStatus(`${file.name} belgeye ekleniyor...`);
      const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
      const pages = await combined.copyPages(source, source.getPageIndices());
      pages.forEach((page) => combined.addPage(page));
    }
    pdfDoc = combined;
    currentPageIndex = append ? Math.max(0, pdfDoc.getPageCount() - 1) : 0;
    lastBytes = (await pdfDoc.save()).slice();
    enableControls(true);
    renderPageList();
    setStatus(`${selectedFiles.length} PDF eklendi. Çalışma alanında ${pdfDoc.getPageCount()} sayfa var.`);
    await renderPreview();
  } catch (error) {
    if (!append) {
      pdfDoc = null;
      lastBytes = null;
      enableControls(false);
    }
    setStatus(`PDF açılamadı: ${error.message}`);
  }
}

fileInput.addEventListener("change", async (event) => {
  await loadPdfFiles(event.target.files || [], Boolean(pdfDoc));
  event.target.value = "";
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.style.borderColor = "#66d9ef";
});

dropzone.addEventListener("dragleave", () => {
  dropzone.style.borderColor = "rgba(255,255,255,0.2)";
});

dropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropzone.style.borderColor = "rgba(255,255,255,0.2)";
  await loadPdfFiles(event.dataTransfer.files || [], Boolean(pdfDoc));
});

rotateBtn.addEventListener("click", async () => {
  if (!pdfDoc) {
    return;
  }
  const page = pdfDoc.getPage(currentPageIndex);
  const currentRotation = page.getRotation().angle || 0;
  page.setRotation(window.PDFLib.degrees((currentRotation + 90) % 360));
  await refreshDocument();
  setStatus("Sayfa döndürüldü.");
});

addPageBtn.addEventListener("click", async () => {
  if (!pdfDoc) {
    return;
  }
  pdfDoc.addPage([595.28, 841.89]);
  await refreshDocument();
  setStatus("Boş sayfa eklendi.");
});

deletePageBtn.addEventListener("click", async () => {
  if (!pdfDoc || pdfDoc.getPageCount() <= 1) {
    return;
  }
  pdfDoc.removePage(currentPageIndex);
  currentPageIndex = Math.min(currentPageIndex, pdfDoc.getPageCount() - 1);
  await refreshDocument();
  setStatus("Sayfa silindi.");
});

downloadBtn.addEventListener("click", async () => {
  if (!pdfDoc) {
    return;
  }
  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "duzenlenmis-pdf.pdf";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("PDF indirildi.");
});

finishEditBtn.addEventListener("click", async () => {
  if (!pdfDoc) return;
  finishEditBtn.disabled = true;
  finishEditBtn.textContent = "PDF hazırlanıyor...";
  try {
    const bytes = await pdfDoc.save();
    completedPdfBlob = new Blob([bytes], { type: "application/pdf" });
    setStatus("Düzenleme tamamlandı. İndirme veya önizleme seçeneğini kullanabilirsiniz.");
    completionToast.hidden = false;
    completionToast.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    setStatus(`PDF hazırlanamadı: ${error.message}`);
  } finally {
    finishEditBtn.disabled = false;
    finishEditBtn.textContent = "Düzenlemeyi tamamla";
  }
});

closeCompletionToast.addEventListener("click", () => {
  completionToast.hidden = true;
});

function getCompletedFilename() {
  const safeName = completedFilename.value
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return `${safeName || "duzenlenmis-belge"}.pdf`;
}

downloadCompletedPdf.addEventListener("click", () => {
  if (!completedPdfBlob) return;
  downloadBlob(completedPdfBlob, getCompletedFilename());
  setStatus(`${getCompletedFilename()} cihazınıza indirildi.`);
});

previewCompletedPdf.addEventListener("click", () => {
  if (!completedPdfBlob) return;
  if (completedPreviewUrl) URL.revokeObjectURL(completedPreviewUrl);
  completedPreviewUrl = URL.createObjectURL(completedPdfBlob);
  window.open(completedPreviewUrl, "_blank", "noopener,noreferrer");
});

continueEditing.addEventListener("click", () => {
  completionToast.hidden = true;
  document.getElementById("editor").scrollIntoView({ behavior: "smooth" });
  setStatus("Düzenlemeye devam edebilirsiniz.");
});

startNewDocument.addEventListener("click", () => {
  if (completedPreviewUrl) {
    URL.revokeObjectURL(completedPreviewUrl);
    completedPreviewUrl = null;
  }
  pdfDoc = null;
  lastBytes = null;
  completedPdfBlob = null;
  currentPageIndex = 0;
  thumbnailRenderVersion += 1;
  thumbs.innerHTML = "";
  fileInput.value = "";
  mergeInput.value = "";
  enableControls(false);
  completionToast.hidden = true;
  renderPreview();
  setStatus("Yeni belge için PDF dosyalarınızı ekleyin.");
  dropzone.scrollIntoView({ behavior: "smooth", block: "center" });
});

compressBtn.addEventListener("click", async () => {
  if (!pdfDoc) {
    return;
  }
  compressBtn.disabled = true;
  setStatus("Sıkıştırılıyor...");
  
  try {
    // Get original size
    const originalBytes = await pdfDoc.save();
    const originalSize = originalBytes.length;
    
    // Create a new document and copy pages with compression
    const { PDFDocument } = window.PDFLib;
    const compressedDoc = await PDFDocument.create();
    
    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
      const pages = await compressedDoc.copyPages(pdfDoc, [i]);
      compressedDoc.addPage(pages[0]);
    }
    
    const candidateBytes = await compressedDoc.save();
    const compressedBytes = candidateBytes.length < originalSize ? candidateBytes : originalBytes;
    const compressedSize = compressedBytes.length;
    const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);
    
    const blob = new Blob([compressedBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kayipsiz-optimize-edilmis.pdf";
    link.click();
    URL.revokeObjectURL(url);
    
    const sizeBefore = (originalSize / 1024).toFixed(2);
    const sizeAfter = (compressedSize / 1024).toFixed(2);
    setStatus(
      compressedSize < originalSize
        ? `Kayıpsız optimizasyon tamamlandı. ${sizeBefore}KB → ${sizeAfter}KB (%${compressionRatio} küçüldü)`
        : `Belge zaten optimize edilmiş (${sizeBefore}KB); daha büyük bir sürüm oluşturulmadı.`
    );
  } catch (err) {
    setStatus("Sıkıştırma hatası: " + err.message);
  }
  
  compressBtn.disabled = false;
});

mergeTrigger.addEventListener("click", () => mergeInput.click());

aggressiveBtn.addEventListener("click", async () => {
  if (!pdfDoc) {
    return;
  }
  aggressiveBtn.disabled = true;
  setStatus("Agresif sıkıştırma uygulanıyor...");
  
  try {
    const { PDFDocument } = window.PDFLib;
    const originalBytes = await pdfDoc.save();
    const originalSize = originalBytes.length;
    const aggressiveDoc = await PDFDocument.create();

    const source = await window.pdfjsLib
      .getDocument({ data: new Uint8Array(originalBytes).slice() })
      .promise;
    for (let i = 1; i <= source.numPages; i += 1) {
      setStatus(`Agresif sıkıştırma: ${i}/${source.numPages} sayfa işleniyor...`);
      const sourcePage = await source.getPage(i);
      const viewport = sourcePage.getViewport({ scale: 1.25 });
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = Math.floor(viewport.width);
      pageCanvas.height = Math.floor(viewport.height);
      await sourcePage.render({
        canvasContext: pageCanvas.getContext("2d", { alpha: false }),
        viewport,
      }).promise;
      const jpegBlob = await new Promise((resolve) => pageCanvas.toBlob(resolve, "image/jpeg", 0.65));
      if (!jpegBlob) {
        throw new Error("Sayfa görüntüsü oluşturulamadı.");
      }
      const jpeg = await aggressiveDoc.embedJpg(await jpegBlob.arrayBuffer());
      const outputPage = aggressiveDoc.addPage([viewport.width, viewport.height]);
      outputPage.drawImage(jpeg, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
    }
    await source.destroy();
    const aggressiveBytes = await aggressiveDoc.save();
    const aggressiveSize = aggressiveBytes.length;
    const compressionRatio = Math.round((1 - aggressiveSize / originalSize) * 100);
    
    const blob = new Blob([aggressiveBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "duzenlenmis-agresif.pdf";
    link.click();
    URL.revokeObjectURL(url);
    
    const sizeBefore = (originalSize / 1024).toFixed(2);
    const sizeAfter = (aggressiveSize / 1024).toFixed(2);
    setStatus(`Agresif sıkıştırma tamamlandı. ${sizeBefore}KB → ${sizeAfter}KB (%${compressionRatio} küçüldü)`);
  } catch (err) {
    setStatus("Agresif sıkıştırma hatası: " + err.message);
  }
  
  aggressiveBtn.disabled = false;
});

mergeInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file || !pdfDoc) {
    return;
  }

  try {
    const sourceBytes = await file.arrayBuffer();
    const sourceDoc = await window.PDFLib.PDFDocument.load(sourceBytes);
    const copiedPages = await pdfDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
    copiedPages.forEach((page) => pdfDoc.addPage(page));
    await refreshDocument();
    setStatus(`${file.name} belgeye eklendi.`);
  } catch (error) {
    setStatus(`PDF birleştirilemedi: ${error.message}`);
  } finally {
    mergeInput.value = "";
  }
});

function setConversionStatus(message) {
  conversionStatus.textContent = message;
}

function resetConversionFileDisplay() {
  conversionDropzone.classList.remove("has-file");
  conversionFileName.textContent = "Dönüştürülecek dosyayı seçin";
  conversionFileHint.textContent = "PDF, DOCX, XLSX, PPTX veya DWG";
}

function showSelectedConversionFile(file) {
  conversionDropzone.classList.add("has-file");
  conversionFileName.textContent = file.name;
  conversionFileHint.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB • Dosya seçildi`;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }
}

function setConversionProgress(message, percentage) {
  progressText.textContent = message;
  progressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
  progressCard.hidden = false;
}

function clearConversionProgress() {
  if (progressTimer) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
  progressCard.hidden = true;
}

function startConversionProgress(operation) {
  clearConversionProgress();
  let percentage = 10;
  progressHint.hidden = operation !== "dwg-to-pdf";
  setConversionProgress("İşlem başlatıldı", percentage);
  progressTimer = window.setInterval(() => {
    if (percentage < 55) {
      percentage += 5;
    } else if (percentage < 78) {
      percentage += 2;
    } else if (percentage < 99) {
      percentage += 1;
    }
    setConversionProgress(`İşleniyor... ${percentage}%`, percentage);
  }, 700);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function callConversionApi(file, operation) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("operation", operation);
  if (operation === "pdf-to-docx") {
    formData.append("pdf_word_mode", pdfWordMode.value);
  }

  const response = await fetch(`${apiBaseUrl}/api/convert`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Sunucu dönüştürme hatası verdi.");
    }
    const errorText = await response.text();
    throw new Error(errorText || `Sunucu ${response.status} hatası verdi.`);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") || "";
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  const basicMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  let filename = `${file.name.replace(/\.[^.]+$/, "")}-${operation}.bin`;
  if (utf8Match) {
    try {
      filename = decodeURIComponent(utf8Match[1]);
    } catch {
      filename = utf8Match[1];
    }
  } else if (basicMatch) {
    filename = basicMatch[1];
  }
  downloadBlob(blob, filename);
}

conversionInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }
  const rule = conversionRules[conversionType.value];
  const extension = `.${file.name.split(".").pop().toLowerCase()}`;
  if (!rule.extensions.includes(extension)) {
    selectedConversionFile = null;
    conversionInput.value = "";
    convertBtn.disabled = true;
    resetConversionFileDisplay();
    setConversionStatus(`Bu işlem için ${rule.extensions.join(" veya ")} uzantılı bir dosya seçin.`);
    return;
  }
  selectedConversionFile = file;
  convertBtn.disabled = false;
  showSelectedConversionFile(file);
  setConversionStatus(`${file.name} seçildi. Dönüştürmeye hazırsınız.`);
});

conversionType.addEventListener("change", () => {
  const rule = conversionRules[conversionType.value];
  conversionInput.accept = rule.accept;
  conversionInput.value = "";
  selectedConversionFile = null;
  convertBtn.disabled = true;
  resetConversionFileDisplay();
  pdfWordModeWrap.hidden = conversionType.value !== "pdf-to-docx";
  setConversionStatus(`Bu işlem için ${rule.extensions.join(" veya ")} dosyası seçin.`);
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    window.alert(isIos
      ? "BelgeLab'i yüklemek için Safari'de Paylaş düğmesine, ardından “Ana Ekrana Ekle” seçeneğine dokunun."
      : "Tarayıcı menüsünden “Uygulamayı yükle” veya “Ana ekrana ekle” seçeneğini kullanın.");
    return;
  }

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

convertBtn.addEventListener("click", async () => {
  if (!selectedConversionFile) {
    setConversionStatus("Önce bir dosya seçin.");
    return;
  }

  const operation = conversionType.value;
  const fileName = selectedConversionFile.name;
  setConversionStatus(`${fileName} dönüştürülüyor...`);
  startConversionProgress(operation);

  try {
    await callConversionApi(selectedConversionFile, operation);
    clearConversionProgress();
    setConversionProgress("Tamamlandı", 100);
    setConversionStatus("Dönüştürme tamamlandı.");
    selectedConversionFile = null;
    conversionInput.value = "";
    convertBtn.disabled = true;
    resetConversionFileDisplay();
    window.setTimeout(() => {
      clearConversionProgress();
    }, 1200);
  } catch (error) {
    clearConversionProgress();
    setConversionProgress("İşlem başarısız oldu", 0);
    console.error(error);
    setConversionStatus(`Dönüştürme hatası: ${error.message}`);
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  installBtn.hidden = true;
});

const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
if (isIosDevice && !isStandalone) {
  installBtn.hidden = false;
  installBtn.textContent = "Ana ekrana ekle";
}

registerServiceWorker();
enableControls(false);
conversionType.dispatchEvent(new Event("change"));
