(() => {
  const panel = document.getElementById("documentCreator");
  const title = document.getElementById("creatorTitle");
  const description = document.getElementById("creatorDescription");
  const filename = document.getElementById("creatorFilename");
  const extension = document.getElementById("creatorExtension");
  const status = document.getElementById("creatorStatus");
  const saveButton = document.getElementById("saveCreatedDocument");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingStage = document.getElementById("loadingStage");
  const workspaces = {
    word: document.getElementById("wordCreator"),
    excel: document.getElementById("excelCreator"),
    powerpoint: document.getElementById("powerpointCreator"),
  };
  const config = {
    word: { title: "Word belgesi oluştur", extension: ".docx", description: "Metninizi biçimlendirin ve DOCX olarak kaydedin.", loadingStage: "Word belgesi sunucuda hazırlanıyor..." },
    excel: { title: "Excel çalışma kitabı oluştur", extension: ".xlsx", description: "Hücre verilerini ve temel formülleri XLSX olarak kaydedin.", loadingStage: "Excel çalışma kitabı sunucuda hazırlanıyor..." },
    powerpoint: { title: "PowerPoint sunumu oluştur", extension: ".pptx", description: "Slaytlarınızı hazırlayın ve PPTX olarak kaydedin.", loadingStage: "Sunum sunucuda hazırlanıyor..." },
  };
  let activeType = "word";
  let excelRows = 10;
  let excelColumns = 6;
  let slides = [{ title: "Sunum başlığı", body: "Alt başlık veya açıklama" }];
  let activeSlide = 0;
  let isSaving = false;
  const connectionErrorMessage = "İnternet bağlantısı yok. Bu işlem için bağlantınızı kontrol edip yeniden deneyin.";

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
  }

  function waitForNextPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function setCreatorBusy(busy, stage = "") {
    const controls = [
      ...panel.querySelectorAll("button, input, textarea, [contenteditable]"),
      ...document.querySelectorAll("[data-create-tool]"),
    ];
    controls.forEach((control) => {
      if (busy) {
        control.dataset.creatorPreviousDisabled = String(control.disabled);
        control.dataset.creatorPreviousContenteditable = control.getAttribute("contenteditable") ?? "";
        if ("disabled" in control) control.disabled = true;
        if (control.hasAttribute("contenteditable")) control.setAttribute("contenteditable", "false");
      } else {
        if ("disabled" in control) control.disabled = control.dataset.creatorPreviousDisabled === "true";
        if (control.hasAttribute("contenteditable")) {
          const previous = control.dataset.creatorPreviousContenteditable;
          if (previous) control.setAttribute("contenteditable", previous);
          else control.removeAttribute("contenteditable");
        }
        delete control.dataset.creatorPreviousDisabled;
        delete control.dataset.creatorPreviousContenteditable;
      }
    });

    if (busy) {
      panel.setAttribute("aria-busy", "true");
      loadingStage.textContent = stage;
      loadingOverlay.hidden = false;
      document.body.classList.add("is-processing");
    } else {
      panel.removeAttribute("aria-busy");
      loadingOverlay.hidden = true;
      document.body.classList.remove("is-processing");
    }
  }

  function open(toolName) {
    const selected = config[toolName];
    if (!selected) return null;
    activeType = toolName;
    title.textContent = selected.title;
    description.textContent = selected.description;
    extension.textContent = selected.extension;
    Object.entries(workspaces).forEach(([name, element]) => {
      element.hidden = name !== activeType;
    });
    setStatus("Düzenlemeye başlayabilirsiniz.");
    panel.hidden = false;
    if (activeType === "excel" && !document.getElementById("excelGrid").rows.length) renderExcelGrid();
    if (activeType === "powerpoint") renderSlides();
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    return panel;
  }

  function close() {
    panel.hidden = true;
  }

  window.BelgeLabCreators = { ...window.BelgeLabCreators, open, close };

  document.querySelectorAll("[data-create-tool]").forEach((card) => {
    card.addEventListener("click", () => {
      if (window.BelgeLabNavigation?.openTool(card.dataset.toolId)) return;
      open(card.dataset.createTool);
    });
  });

  document.getElementById("closeCreator").addEventListener("click", close);

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("wordEditor").focus();
      document.execCommand(button.dataset.command, false, button.dataset.value || null);
    });
  });

  function columnName(index) {
    let name = "";
    let value = index + 1;
    while (value) {
      value -= 1;
      name = String.fromCharCode(65 + (value % 26)) + name;
      value = Math.floor(value / 26);
    }
    return name;
  }

  function renderExcelGrid() {
    const grid = document.getElementById("excelGrid");
    const previous = [...grid.rows].slice(1).map((row) =>
      [...row.cells].slice(1).map((cell) => cell.textContent)
    );
    grid.innerHTML = "";
    const header = grid.insertRow();
    header.insertCell().textContent = "";
    for (let column = 0; column < excelColumns; column += 1) {
      header.insertCell().textContent = columnName(column);
    }
    for (let row = 0; row < excelRows; row += 1) {
      const tableRow = grid.insertRow();
      tableRow.insertCell().textContent = String(row + 1);
      for (let column = 0; column < excelColumns; column += 1) {
        const cell = tableRow.insertCell();
        cell.contentEditable = "true";
        cell.spellcheck = false;
        cell.textContent = previous[row]?.[column] || "";
      }
    }
  }

  document.getElementById("addExcelRow").addEventListener("click", () => {
    excelRows += 1;
    renderExcelGrid();
  });
  document.getElementById("addExcelColumn").addEventListener("click", () => {
    excelColumns += 1;
    renderExcelGrid();
  });
  document.getElementById("removeExcelRow").addEventListener("click", () => {
    excelRows = Math.max(1, excelRows - 1);
    renderExcelGrid();
  });

  function syncCurrentSlide() {
    slides[activeSlide] = {
      title: document.getElementById("slideTitle").value,
      body: document.getElementById("slideBody").value,
    };
  }

  function renderSlides() {
    const list = document.getElementById("slideList");
    list.innerHTML = "";
    slides.forEach((slide, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === activeSlide ? "active" : "";
      button.textContent = `${index + 1}. ${slide.title || "Başlıksız slayt"}`;
      button.addEventListener("click", () => {
        syncCurrentSlide();
        activeSlide = index;
        renderSlides();
      });
      list.appendChild(button);
    });
    document.getElementById("slideTitle").value = slides[activeSlide]?.title || "";
    document.getElementById("slideBody").value = slides[activeSlide]?.body || "";
  }

  document.getElementById("addSlide").addEventListener("click", () => {
    syncCurrentSlide();
    slides.push({ title: "Yeni slayt", body: "" });
    activeSlide = slides.length - 1;
    renderSlides();
  });
  document.getElementById("removeSlide").addEventListener("click", () => {
    if (slides.length === 1) return setStatus("Sunumda en az bir slayt kalmalıdır.", true);
    slides.splice(activeSlide, 1);
    activeSlide = Math.max(0, activeSlide - 1);
    renderSlides();
  });

  function safeFilename() {
    const base = filename.value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-") || "yeni-belge";
    return `${base}${config[activeType].extension}`;
  }

  function excelData() {
    return [...document.getElementById("excelGrid").rows]
      .slice(1)
      .map((row) => [...row.cells].slice(1).map((cell) => cell.textContent.trim()));
  }

  function wordData() {
    const editor = document.getElementById("wordEditor");
    return [...editor.children].map((element) => ({
      text: element.innerText.trim(),
      type: /^H[1-3]$/.test(element.tagName) ? "heading" : "paragraph",
    })).filter((item) => item.text);
  }

  async function saveDocument() {
    if (isSaving) return;
    if (!navigator.onLine) {
      setStatus(connectionErrorMessage, true);
      return;
    }
    isSaving = true;
    const savingType = activeType;
    setCreatorBusy(true, config[savingType].loadingStage);
    setStatus(config[savingType].loadingStage);
    try {
      await waitForNextPaint();
      if (savingType === "powerpoint") syncCurrentSlide();
      const payload = {
        type: savingType,
        filename: safeFilename(),
        content: savingType === "word" ? wordData() : savingType === "excel" ? excelData() : slides,
      };
      const response = await fetch("/api/create-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Belge oluşturulamadı.");
      }
      loadingStage.textContent = "Dosya telefona aktarılıyor...";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeFilename();
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`${safeFilename()} cihazınıza indirildi.`);
    } catch (error) {
      const message = !navigator.onLine || error instanceof TypeError
        ? connectionErrorMessage
        : error.message;
      if (message !== connectionErrorMessage) console.error(error);
      setStatus(message, true);
    } finally {
      setCreatorBusy(false);
      isSaving = false;
    }
  }

  saveButton.addEventListener("click", saveDocument);
})();
