(() => {
  const settings = window.RADECT_SETTINGS || {};
  const editions = Array.isArray(window.RADECT_EDITIONS) ? window.RADECT_EDITIONS : [];

  const els = {
    select: document.getElementById('editionSelect'),
    title: document.getElementById('editionTitle'),
    subtitle: document.getElementById('editionSubtitle'),
    book: document.getElementById('book'),
    stage: document.getElementById('book-stage'),
    page: document.getElementById('pageIndicator'),
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loadingText'),
    status: document.getElementById('status'),
    openPdf: document.getElementById('openPdf')
  };

  let pageFlip = null;
  let currentPdf = null;
  let currentEdition = null;
  let zoom = 1;

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  function setLoading(show, text = 'Preparando a revista…') {
    els.loading.classList.toggle('show', show);
    els.loading.setAttribute('aria-hidden', show ? 'false' : 'true');
    els.loadingText.textContent = text;
  }

  function editionFromUrl() {
    const id = new URLSearchParams(location.search).get('issue');
    return editions.find(e => e.id === id) || editions.find(e => e.default === true) || editions[0];
  }

  function populateEditions() {
    els.select.innerHTML = '';
    editions.forEach((edition) => {
      const option = document.createElement('option');
      option.value = edition.id;
      option.textContent = `${edition.title} — ${edition.date}`;
      els.select.appendChild(option);
    });
  }

  function updateUrl(id) {
    const url = new URL(location.href);
    url.searchParams.set('issue', id);
    history.replaceState({}, '', url);
  }

  function clearBook() {
    if (pageFlip) {
      try { pageFlip.destroy(); } catch (_) {}
      pageFlip = null;
    }
    els.book.innerHTML = '';
    currentPdf = null;
  }

  function isPlaceholder(value) {
    return !value || /SEU-WORKER|COLE_AQUI|ID_DO_/i.test(String(value));
  }

  function getPdfSource(edition) {
    // Mantém compatibilidade opcional com um PDF local, caso file seja informado.
    if (edition.file) return edition.file;

    if (isPlaceholder(edition.driveId)) {
      throw new Error('O driveId desta edição ainda não foi configurado em config.js.');
    }

    const proxyBase = String(settings.proxyBase || '').replace(/\/+$/, '');
    if (isPlaceholder(proxyBase)) {
      throw new Error('A URL do Cloudflare Worker ainda não foi configurada em RADECT_SETTINGS.proxyBase.');
    }

    return `${proxyBase}/pdf/${encodeURIComponent(edition.driveId)}`;
  }

  function getOriginalPdfUrl(edition) {
    if (edition.driveId && !isPlaceholder(edition.driveId)) {
      return `https://drive.google.com/file/d/${encodeURIComponent(edition.driveId)}/view`;
    }
    return edition.file || '#';
  }

  function fitSize(pdfWidth, pdfHeight) {
    const stageRect = els.stage.getBoundingClientRect();
    const mobile = window.matchMedia('(max-width: 700px)').matches;
    const pagesAcross = mobile ? 1 : 2;
    const availableW = Math.max(300, stageRect.width - 20);
    const availableH = Math.max(400, stageRect.height - 20);
    const pageWFromWidth = availableW / pagesAcross;
    const ratio = pdfHeight / pdfWidth;
    let width = Math.min(pageWFromWidth, availableH / ratio);
    width = Math.max(260, width);
    return { width: Math.round(width), height: Math.round(width * ratio) };
  }

  async function renderPdfPages(pdf) {
    const first = await pdf.getPage(1);
    const firstViewport = first.getViewport({ scale: 1 });
    const dimensions = fitSize(firstViewport.width, firstViewport.height);

    for (let n = 1; n <= pdf.numPages; n++) {
      setLoading(true, `Preparando página ${n} de ${pdf.numPages}…`);
      const page = n === 1 ? first : await pdf.getPage(n);
      const baseViewport = page.getViewport({ scale: 1 });
      const targetPixelWidth = Math.min(
        1700,
        Math.max(900, dimensions.width * (window.devicePixelRatio || 1.3))
      );
      const scale = targetPixelWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      const wrapper = document.createElement('div');
      wrapper.className = 'page';
      wrapper.dataset.density = n === 1 || n === pdf.numPages ? 'hard' : 'soft';

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.setAttribute('aria-label', `Página ${n}`);
      wrapper.appendChild(canvas);
      els.book.appendChild(wrapper);

      await page.render({
        canvasContext: canvas.getContext('2d', { alpha: false }),
        viewport
      }).promise;
    }

    return dimensions;
  }

  async function loadEdition(edition) {
    if (!edition) return;
    currentEdition = edition;
    clearBook();
    setLoading(true, 'Abrindo a edição…');
    els.select.value = edition.id;
    els.title.textContent = edition.title;
    els.subtitle.textContent = `${edition.subtitle} · ${edition.date}`;
    els.openPdf.href = getOriginalPdfUrl(edition);
    els.openPdf.removeAttribute('download');
    els.status.textContent = edition.description || '';
    updateUrl(edition.id);

    try {
      const source = getPdfSource(edition);
      const loadingTask = pdfjsLib.getDocument({
        url: source,
        withCredentials: false,
        disableRange: false,
        disableStream: false
      });

      const pdf = await loadingTask.promise;
      currentPdf = pdf;
      const size = await renderPdfPages(pdf);

      pageFlip = new St.PageFlip(els.book, {
        width: size.width,
        height: size.height,
        size: 'fixed',
        minWidth: 240,
        maxWidth: 900,
        minHeight: 320,
        maxHeight: 1280,
        showCover: true,
        usePortrait: true,
        mobileScrollSupport: false,
        maxShadowOpacity: 0.45,
        flippingTime: 700,
        drawShadow: true,
        autoSize: true,
        clickEventForward: true,
        disableFlipByClick: false
      });

      pageFlip.loadFromHTML(document.querySelectorAll('.page'));
      pageFlip.on('flip', ({ data }) => updatePageLabel(data));
      pageFlip.on('changeOrientation', () => updatePageLabel(pageFlip.getCurrentPageIndex()));
      updatePageLabel(0);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
      els.page.textContent = '—';
      els.status.textContent =
        `Não foi possível abrir esta edição. ${error.message || ''} ` +
        'Confira o driveId, a URL do Worker e se o PDF no Google Drive está compartilhado como “Qualquer pessoa com o link”.';
    }
  }

  function updatePageLabel(index) {
    const total = currentPdf ? currentPdf.numPages : 0;
    const page = Math.min(total, (Number(index) || 0) + 1);
    els.page.textContent = total ? `Página ${page} de ${total}` : '—';
  }

  function applyZoom(next) {
    zoom = Math.max(.75, Math.min(1.6, next));
    els.stage.style.transform = `scale(${zoom})`;
    els.status.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
  }

  document.getElementById('prevBtn').addEventListener('click', () => pageFlip?.flipPrev());
  document.getElementById('nextBtn').addEventListener('click', () => pageFlip?.flipNext());
  document.getElementById('zoomOutBtn').addEventListener('click', () => applyZoom(zoom - .1));
  document.getElementById('zoomInBtn').addEventListener('click', () => applyZoom(zoom + .1));
  document.getElementById('zoomResetBtn').addEventListener('click', () => applyZoom(1));
  document.getElementById('fullscreenBtn').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {}
  });

  els.select.addEventListener('change', () => {
    const edition = editions.find(e => e.id === els.select.value);
    if (edition) loadEdition(edition);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') pageFlip?.flipPrev();
    if (event.key === 'ArrowRight') pageFlip?.flipNext();
  });

  if (!editions.length) {
    els.status.textContent = 'Nenhuma edição cadastrada em config.js.';
    setLoading(false);
    return;
  }

  populateEditions();
  loadEdition(editionFromUrl());
})();
