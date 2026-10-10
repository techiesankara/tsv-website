// Lightbox for gallery mosaics and detail photo strips.
// Progressive: every [data-lightbox-item] is an <a href="<full image>">; with
// JS the click opens the shared <dialog class="lightbox" data-lightbox>
// instead. Prev/next follow DOM order inside the same [data-lightbox-group],
// skipping items hidden by the chip filter (main.js).
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const dialog = $('[data-lightbox]');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const image = $('[data-lightbox-image]', dialog);
  const caption = $('[data-lightbox-caption]', dialog);
  const count = $('[data-lightbox-count]', dialog);
  const prevButton = $('[data-lightbox-prev]', dialog);
  const nextButton = $('[data-lightbox-next]', dialog);
  const closeButton = $('[data-lightbox-close]', dialog);

  let items = [];
  let current = -1;
  let opener = null;

  const visibleItems = (item) => {
    const group = item.closest('[data-lightbox-group]') || document;
    return $$('[data-lightbox-item]', group).filter((entry) => !entry.hidden && !entry.closest('[hidden]'));
  };

  const show = (index) => {
    const item = items[index];
    if (!item || !image) return;
    current = index;
    const thumb = $('img', item);
    image.classList.add('is-loading');
    image.src = item.dataset.lightboxSrc || item.getAttribute('href');
    image.alt = thumb?.alt || '';
    const text = item.dataset.lightboxCaption || $('.gallery__caption', item)?.textContent?.trim() || thumb?.alt || '';
    if (caption) {
      caption.textContent = text;
      caption.hidden = !text;
    }
    if (count) count.textContent = `${index + 1} / ${items.length}`;
    const single = items.length < 2;
    if (prevButton) prevButton.hidden = single;
    if (nextButton) nextButton.hidden = single;
  };

  image?.addEventListener('load', () => image.classList.remove('is-loading'));
  image?.addEventListener('error', () => image.classList.remove('is-loading'));

  const step = (delta) => show((current + delta + items.length) % items.length);

  const open = (item) => {
    items = visibleItems(item);
    opener = item;
    show(Math.max(0, items.indexOf(item)));
    dialog.showModal();
    closeButton?.focus();
  };

  $$('[data-lightbox-item]').forEach((item) => item.addEventListener('click', (event) => {
    // Let modifier clicks open the file in a new tab as the plain link would.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    open(item);
  }));

  prevButton?.addEventListener('click', () => step(-1));
  nextButton?.addEventListener('click', () => step(1));
  closeButton?.addEventListener('click', () => dialog.close());

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  });

  // Click on the dark surface (outside the figure and controls) closes.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  // Return focus to the thumbnail that opened the dialog.
  dialog.addEventListener('close', () => {
    opener?.focus();
    opener = null;
  });

  // Touch: horizontal swipe on the figure steps through items.
  let touchStartX = null;
  dialog.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  dialog.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(delta) > 48) step(delta < 0 ? 1 : -1);
  }, { passive: true });
})();