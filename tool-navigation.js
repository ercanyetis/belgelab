(() => {
  const registry = {
    "pdf-editor": { type: "editor" },
    "pdf-split": { type: "quick", value: "split" },
    "pdf-compress": { type: "quick", value: "compress" },
    "create-word": { type: "creator", value: "word" },
    "create-excel": { type: "creator", value: "excel" },
    "create-powerpoint": { type: "creator", value: "powerpoint" },
    "pdf-to-word": { type: "operation", value: "pdf-to-docx" },
    "pdf-to-powerpoint": { type: "operation", value: "pdf-to-pptx" },
    "pdf-to-excel": { type: "operation", value: "pdf-to-xlsx" },
    "word-to-pdf": { type: "operation", value: "docx-to-pdf" },
    "dwg-to-pdf": { type: "operation", value: "dwg-to-pdf" },
    "powerpoint-to-pdf": { type: "operation", value: "pptx-to-pdf" },
    "excel-to-pdf": { type: "operation", value: "xlsx-to-pdf" },
    "pdf-to-jpg": { type: "quick", value: "pdf-to-jpg" },
    "jpg-to-pdf": { type: "quick", value: "jpg-to-pdf" },
    "pdf-sign": { type: "quick", value: "sign" },
    "pdf-watermark": { type: "quick", value: "watermark" },
    "pdf-rotate": { type: "quick", value: "rotate-all" },
    "pdf-unlock": { type: "quick", value: "unlock" },
    "pdf-protect": { type: "quick", value: "protect" },
    "pdf-page-numbers": { type: "quick", value: "page-numbers" },
    "pdf-repair": { type: "quick", value: "repair" },
    "pdf-crop": { type: "quick", value: "crop" },
    "pdf-compare": { type: "quick", value: "compare" },
    "pdf-to-markdown": { type: "quick", value: "markdown" },
    "pdf-redact": { type: "redaction" },
  };

  function closeTransientWorkspaces() {
    window.BelgeLabTools?.close();
    window.BelgeLabCreators?.close();
    window.BelgeLabRedaction?.close();
  }

  function focusWorkspace(workspace) {
    if (!workspace) return;
    requestAnimationFrame(() => {
      const primaryControl = workspace.querySelector(
        "[tabindex]:not([tabindex='-1']), input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable='true']"
      );
      const actionControl = workspace.querySelector(
        "button:not([disabled]):not(#closeQuickTool):not(#closeCreator)"
      );
      (primaryControl || actionControl)?.focus({ preventScroll: true });
    });
  }

  function showToolsFallback() {
    closeTransientWorkspaces();
    document.getElementById("tools")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return false;
  }

  function openTool(toolId) {
    const entry = registry[toolId];
    if (!entry) return showToolsFallback();
    closeTransientWorkspaces();
    let workspace = null;
    if (entry.type === "quick") workspace = window.BelgeLabTools?.open(entry.value);
    else if (entry.type === "creator") workspace = window.BelgeLabCreators?.open(entry.value);
    else if (entry.type === "operation") workspace = window.BelgeLabApp?.openOperation(entry.value);
    else if (entry.type === "editor") workspace = window.BelgeLabApp?.openEditor();
    else if (entry.type === "redaction") workspace = window.BelgeLabRedaction?.open();
    if (!workspace) return showToolsFallback();
    focusWorkspace(workspace);
    return true;
  }

  window.BelgeLabNavigation = { ...window.BelgeLabNavigation, openTool };
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has("tool")) openTool(searchParams.get("tool"));
})();
