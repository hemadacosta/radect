(() => {
  const settings = window.RADECT_SETTINGS || {};
  const editions = Array.isArray(window.RADECT_EDITIONS) ? window.RADECT_EDITIONS : [];

  const els = {
    select: document.getElementById('editionSelect'),
    title: document.getElementById('editionTitle'),
    subtitle: document.getElementById('editionSubtitle'),
    book: document.getElementById('book'),
    stage: document.getElementById('book-stage'),
    reader: document.querySelector('.reader-shell'),
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

  // Som sutil de folha virando, gerado pelo próprio navegador.
  // Não exige arquivo MP3/WAV adicional no GitHub.
  const PAGE_SOUND_ENABLED = true;
  const PAGE_SOUND_VOLUME = 0.11;
  let audioContext = null;
  let audioUnlocked = false;

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

  function unlockAudio() {
    if (!PAGE_SOUND_ENABLED) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') audioContext.resume();
      audioUnlocked = true;
    } catch (_) {}
  }

  function playPageTurnSound() {
    if (!PAGE_SOUND_ENABLED || !audioUnlocked || !audioContext) return;

    try {
      const ctx = audioContext;
      const duration = 0.24;
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Ruído curto com envelope assimétrico para lembrar papel deslizando.
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const attack = Math.min(1, t / 0.06);
        const decay = Math.pow(1 - t, 2.4);
        data[i] = (Math.random() * 2 - 1) * attack * decay;
      }

      const source = ctx.createBufferSource();
      const highpass = ctx.createBiquadFilter();
      const bandpass = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(450, ctx.currentTime);
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1850, ctx.currentTime);
      bandpass.Q.setValueAtTime(0.7, ctx.currentTime);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(PAGE_SOUND_VOLUME, ctx.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      source.buffer = buffer;
      source.connect(highpass);
      highpass.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch (_) {}
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
      pageFlip.on('flip', ({ data }) => {
        updatePageLabel(data);
        playPageTurnSound();
      });
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

    // Em zoom > 100%, habilita o modo de arrastar para navegar pela página.
    els.reader.classList.toggle('is-pannable', zoom > 1.001);

    // Ao voltar a 100% ou menos, retorna ao início para evitar ficar "preso"
    // em uma posição de rolagem criada durante o zoom.
    if (zoom <= 1.001) {
      els.reader.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }

    els.status.textContent = zoom > 1.001
      ? `Zoom: ${Math.round(zoom * 100)}% · arraste a revista com o mouse para mover a página.`
      : `Zoom: ${Math.round(zoom * 100)}%`;
  }

  // Arrastar para navegar pela revista quando o zoom estiver acima de 100%.
  // Usamos a fase de captura para impedir que o gesto seja interpretado
  // simultaneamente pelo PageFlip como uma tentativa de virar a página.
  let panning = false;
  let panPointerId = null;
  let panStartX = 0;
  let panStartY = 0;
  let panStartLeft = 0;
  let panStartTop = 0;

  function beginPan(event) {
    if (zoom <= 1.001 || event.button !== 0) return;

    panning = true;
    panPointerId = event.pointerId;
    panStartX = event.clientX;
    panStartY = event.clientY;
    panStartLeft = els.reader.scrollLeft;
    panStartTop = els.reader.scrollTop;
    els.reader.classList.add('is-panning');

    try { els.reader.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
    event.stopPropagation();
  }

  function movePan(event) {
    if (!panning || event.pointerId !== panPointerId) return;

    const dx = event.clientX - panStartX;
    const dy = event.clientY - panStartY;
    els.reader.scrollLeft = panStartLeft - dx;
    els.reader.scrollTop = panStartTop - dy;

    event.preventDefault();
    event.stopPropagation();
  }

  function endPan(event) {
    if (!panning || event.pointerId !== panPointerId) return;

    panning = false;
    els.reader.classList.remove('is-panning');
    try { els.reader.releasePointerCapture(event.pointerId); } catch (_) {}
    panPointerId = null;

    event.preventDefault();
    event.stopPropagation();
  }

  // Os navegadores só liberam áudio depois da primeira interação do usuário.
  // A primeira ação (clique, toque ou tecla) apenas habilita o áudio;
  // a partir daí, cada virada de página produz o som.
  window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
  window.addEventListener('keydown', unlockAudio, { once: true, capture: true });

  els.reader.addEventListener('pointerdown', beginPan, true);
  els.reader.addEventListener('pointermove', movePan, true);
  els.reader.addEventListener('pointerup', endPan, true);
  els.reader.addEventListener('pointercancel', endPan, true);

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
