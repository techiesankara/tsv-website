(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // Smooth wheel scrolling on every page (js/vendor/lenis.min.js). Touch keeps
  // native scrolling (Lenis default), anchors glide and honour scroll-margin,
  // and reduced motion skips Lenis entirely so the page scrolls natively.
  const lenis = typeof Lenis !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? new Lenis({ autoRaf: true, anchors: true })
    : null;
  // Anything that locks the page (mobile menu, lightbox dialog) pauses it, or
  // the wheel would keep scrolling the page underneath.
  const lockScroll = (locked) => { if (lenis) locked ? lenis.stop() : lenis.start(); };
  $$('dialog').forEach((dialog) => {
    new MutationObserver(() => lockScroll(dialog.open)).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  });

  // Fade lazy images in on load instead of letting a large, slow-downloading
  // photo pop in instantly once it finally arrives. 'load' does not bubble,
  // so this is capture-phase and delegated on document — that also covers
  // the room image, which gets re-inserted via innerHTML on every tab switch.
  const revealLazyImage = (e) => { if (e.target.matches?.('img[loading="lazy"]')) e.target.classList.add('is-loaded'); };
  document.addEventListener('load', revealLazyImage, true);
  document.addEventListener('error', revealLazyImage, true);
  // This script tag sits at the end of body, after every <img> in the markup.
  // A lazy image close enough to the fold can start fetching during parse and
  // finish loading before this line runs — its 'load' event already fired, so
  // the listeners above will never see it and it stays stuck at opacity: 0.
  // Catch that case once, on init, via the already-loaded flag.
  $$('img[loading="lazy"]').forEach((img) => { if (img.complete) img.classList.add('is-loaded'); });

  const header = $('[data-header]');
  const menuToggle = $('[data-menu-toggle]');
  const mobileMenu = $('[data-mobile-menu]');
  // An open menu gives the header its solid scrolled look even over the hero,
  // so the bar and the menu read as one panel.
  const syncHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24 || mobileMenu?.classList.contains('is-open'));
  const setMenu = (open) => {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute('aria-expanded', String(open));
    mobileMenu.classList.toggle('is-open', open);
    lockScroll(open);
    syncHeader();
  };
  menuToggle?.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  $$('.mobile-menu__link, .mobile-menu .button').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  // The menu covers the page like a dialog, so Escape closes it and hands focus back.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menuToggle?.getAttribute('aria-expanded') !== 'true') return;
    setMenu(false);
    menuToggle.focus();
  });
  window.addEventListener('scroll', syncHeader, { passive: true });

  const guestToggle = $('[data-guest-toggle]');
  const guestMenu = $('[data-guest-menu]');
  const guestValue = $('[data-guest-value]');
  const setGuestMenu = (open) => {
    guestToggle?.setAttribute('aria-expanded', String(open));
    guestMenu?.classList.toggle('is-open', open);
  };
  guestToggle?.addEventListener('click', () => setGuestMenu(guestToggle.getAttribute('aria-expanded') !== 'true'));
  $$('[data-guest-option]').forEach((option) => option.addEventListener('click', () => {
    if (guestValue) guestValue.textContent = option.dataset.guestOption || '';
    $$('[data-guest-option]').forEach((item) => item.setAttribute('aria-selected', String(item === option)));
    setGuestMenu(false);
  }));
  document.addEventListener('click', (event) => {
    if (guestMenu && !guestMenu.parentElement?.contains(event.target)) setGuestMenu(false);
  });

  // Phase 2: every booking action is a redirect to the STAAH URL configured on
  // <body data-booking-url>. Empty value hides the CTAs (PRD edge case: STAAH URL kosong).
  // Pages without the attribute (index.html) fall back to an email enquiry.
  const bookingUrl = document.body.dataset.bookingUrl;
  if (bookingUrl === '') $$('[data-booking-cta], .booking').forEach((cta) => { cta.hidden = true; });

  // WhatsApp number lives on <body data-whatsapp>; empty value hides the float
  // (PRD 7.4 global options). Pages without the attribute keep the float.
  if (document.body.dataset.whatsapp === '') $$('.whatsapp-float').forEach((float) => { float.hidden = true; });

  // The footer lists the WhatsApp number itself and its bottom bar sits where
  // the float lives, so the float steps aside while the footer is on screen.
  const whatsappFloat = $('.whatsapp-float');
  const footer = $('.footer');
  if (whatsappFloat && footer && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      whatsappFloat.classList.toggle('is-parked-footer', entry.isIntersecting);
    }, { rootMargin: '0px 0px -120px 0px' }).observe(footer);
  }

  // Active nav link from <body data-page="about">: matches the link's file
  // name (about.html, id/about.html) so header, mobile menu and footer agree.
  const page = document.body.dataset.page;
  if (page) {
    $$('.header__link, .mobile-menu__link').forEach((link) => {
      const file = (link.getAttribute('href') || '').split(/[?#]/)[0].split('/').pop().replace(/\.html$/, '');
      const active = file === page || (page === 'home' && (file === '' || file === 'index'));
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  // Hero video (home.html): muted loop over the poster photo. Reduced motion
  // keeps the poster; a missing or failed file keeps the poster and never
  // shows the pause control (WCAG 2.2.2), which appears only once it plays.
  const heroVideo = $('[data-hero-video]');
  const heroToggle = $('[data-hero-video-toggle]');
  if (heroVideo) {
    const setPaused = (paused) => {
      if (paused) heroVideo.pause(); else heroVideo.play().catch(() => {});
      heroToggle?.setAttribute('aria-pressed', String(paused));
      heroToggle?.setAttribute('aria-label', paused ? 'Play background video' : 'Pause background video');
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      heroVideo.removeAttribute('autoplay');
      heroVideo.pause();
    } else {
      // autoplay may have started before this script ran, so check before listening.
      const showToggle = () => { if (heroToggle) heroToggle.hidden = false; };
      if (!heroVideo.paused && heroVideo.readyState >= 3) showToggle();
      else heroVideo.addEventListener('playing', showToggle, { once: true });
      heroVideo.play().catch(() => {});
    }
    heroToggle?.addEventListener('click', () => setPaused(!heroVideo.paused));
  }

  const bookingForm = $('[data-booking-form]');
  const bookingNote = $('[data-booking-note]');
  const checkInEl = $('#home_page_check_in_input');
  const checkOutEl = $('#home_page_check_out_input');
  const today = new Date().toISOString().slice(0, 10);
  if (checkInEl) checkInEl.min = today;
  if (checkOutEl) checkOutEl.min = today;
  checkInEl?.addEventListener('change', () => {
    if (!checkOutEl) return;
    checkOutEl.min = checkInEl.value || today;
    if (checkOutEl.value && checkOutEl.value < checkOutEl.min) checkOutEl.value = '';
  });
  bookingForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const checkIn = $('#home_page_check_in_input')?.value;
    const checkOut = $('#home_page_check_out_input')?.value;
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      if (bookingNote) {
        bookingNote.hidden = false;
        bookingNote.classList.add('is-error');
        bookingNote.textContent = 'Please choose a valid check-out date after check-in.';
      }
      return;
    }
    if (bookingNote) {
      bookingNote.hidden = false;
      bookingNote.classList.remove('is-error');
      bookingNote.textContent = 'Dates noted. Opening secure availability search…';
    }
    // TODO(config): confirm STAAH query parameter names for dates/guests with the client's booking engine.
    const url = new URL(bookingUrl || 'https://www.booking.com/hotel/id/the-sankara-hill-penida.html');
    url.searchParams.set('checkin', checkIn);
    url.searchParams.set('checkout', checkOut);
    if (bookingUrl && guestValue) url.searchParams.set('guests', guestValue.textContent.trim());
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  });

  // assumption: image files reused from existing asset set (no dedicated photo per room type; "Photo Link: [link]" still pending in the content doc); capacity not stated in source, defaulted to 2 Adults. Unit counts (16 + 4 + 21 = 41) come from the presentation deck, not the content doc.
  // Room type NAMES stay in English on every locale (they are the fixed
  // product/rate-plan names the booking engine matches against); everything
  // else — description, specs, amenity list, and the render-time UI labels
  // below — switches on <html lang="id">.
  const isID = document.documentElement.lang === 'id';
  // Room image paths are stored root-relative ("images/...") since the EN
  // and ID room arrays share the same strings; id/index.html sits one
  // directory down, so its asset requests need the "../" this prefix adds.
  const assetPrefix = isID ? '../' : '';
  const roomStrings = isID
    ? { size: 'Ukuran', views: 'Pemandangan', capacity: 'Kapasitas', beds: 'Tempat Tidur', details: 'Detail Eksklusif', showLess: 'Tampilkan Lebih Sedikit', viewAll: (n) => `Lihat Semua (${n} Detail Lainnya)`, bookNow: 'Pesan Sekarang', bookEmail: 'Pesan via Email', enquirySubject: (name) => `Permintaan Pemesanan — ${name}` }
    : { size: 'Size', views: 'Views', capacity: 'Capacity', beds: 'Bedding', details: 'Exclusive Details', showLess: 'Show Less', viewAll: (n) => `View All (${n} More Details)`, bookNow: 'Book Now', bookEmail: 'Book via Email', enquirySubject: (name) => `Booking Enquiry — ${name}` };
  const suiteAmenitiesEN = ['Queen / Twin-size Bed', 'Premium Mattress & Linen', 'Balcony with View', 'Writing Desk', 'Smart TV', 'Air Conditioning', 'Wardrobe', 'Safety Deposit Box', 'Mini Refrigerator', 'Coffee Table', 'Full-Length Mirror', 'High-Speed Wi-Fi', 'Telephone', 'USB Charging Port', 'Luggage Rack', 'Bedside Reading Lamp', 'Bluetooth Speakers'];
  const villaAmenitiesEN = ['Queen-size Bed', 'Premium Mattress & Linen', 'Private Terrace Deck', 'Private Plunge Pool', 'Outdoor Sundeck', 'Writing Desk', 'Smart TV', 'Air Conditioning', 'Wardrobe', 'Safety Deposit Box', 'Mini Refrigerator', 'Coffee Table', 'Full-Length Mirror', 'High-Speed Wi-Fi', 'Telephone', 'USB Charging Port', 'Luggage Rack', 'Bedside Reading Lamp', 'Bluetooth Speakers'];
  const suiteAmenitiesID = ['Kasur Ukuran Queen / Twin', 'Kasur & Linen Premium', 'Balkon dengan Pemandangan', 'Meja Tulis', 'Smart TV', 'Pendingin Udara', 'Lemari Pakaian', 'Brankas', 'Kulkas Mini', 'Meja Kopi', 'Cermin Besar', 'Wi-Fi Kecepatan Tinggi', 'Telepon', 'Port Pengisian USB', 'Rak Koper', 'Lampu Baca di Samping Tempat Tidur', 'Speaker Bluetooth'];
  const villaAmenitiesID = ['Kasur Ukuran Queen', 'Kasur & Linen Premium', 'Teras Pribadi', 'Kolam Rendam Pribadi', 'Dek Berjemur Outdoor', 'Meja Tulis', 'Smart TV', 'Pendingin Udara', 'Lemari Pakaian', 'Brankas', 'Kulkas Mini', 'Meja Kopi', 'Cermin Besar', 'Wi-Fi Kecepatan Tinggi', 'Telepon', 'Port Pengisian USB', 'Rak Koper', 'Lampu Baca di Samping Tempat Tidur', 'Speaker Bluetooth'];
  const suiteAmenities = isID ? suiteAmenitiesID : suiteAmenitiesEN;
  const villaAmenities = isID ? villaAmenitiesID : villaAmenitiesEN;
  const roomsEN = [
    { name: 'Ocean Hill Suite', description: 'A 41 sqm suite with an elegant, contemporary interior and a private balcony overlooking the ocean. Available with a queen-size bed or twin beds; selected suites connect in pairs for families and friends.', size: '41 sqm · 16 Suites', views: 'Ocean View', capacity: '2 Adults', beds: 'Queen or Twin Beds', image: 'images/one-bedroom-ocean-view.jpg', tags: ['16 Suites', 'Ocean View'], details: suiteAmenities },
    { name: 'One Bedroom Garden Hill Pool Villa', description: "A 47 sqm private sanctuary set within the island's natural landscape, with a spacious bedroom, living area, private plunge pool, and outdoor terrace overlooking the surrounding hills.", size: '47 sqm · 4 Villas', views: 'Garden & Hill View', capacity: '2 Adults', beds: 'Queen-size Bed', image: 'images/villa-room.jpg', tags: ['4 Villas', 'Private Plunge Pool'], details: villaAmenities },
    { name: 'One Bedroom Ocean Hill Pool Villa', description: 'A 51 sqm villa perched above the island with sweeping ocean views. Contemporary tropical interiors, a spacious bedroom, living area, private plunge pool, and outdoor terrace make an intimate setting for couples.', size: '51 sqm · 21 Villas', views: 'Ocean View', capacity: '2 Adults', beds: 'Queen-size Bed', image: 'images/two-bedrooom-family-pool.jpg', tags: ['21 Villas', 'Private Plunge Pool'], details: villaAmenities }
  ];
  const roomsID = [
    { name: 'Ocean Hill Suite', description: 'Suite seluas 41 m² dengan interior elegan bergaya kontemporer dan balkon pribadi menghadap laut. Tersedia dengan kasur queen atau twin; beberapa suite terhubung berpasangan untuk keluarga dan sahabat.', size: '41 m² · 16 Suite', views: 'Pemandangan Laut', capacity: '2 Dewasa', beds: 'Kasur Queen atau Twin', image: 'images/one-bedroom-ocean-view.jpg', tags: ['16 Suite', 'Pemandangan Laut'], details: suiteAmenities },
    { name: 'One Bedroom Garden Hill Pool Villa', description: 'Sanctuary pribadi seluas 47 m² yang menyatu dengan lanskap alami pulau, dilengkapi kamar tidur luas, ruang keluarga, kolam rendam pribadi, dan teras outdoor menghadap perbukitan sekitar.', size: '47 m² · 4 Vila', views: 'Pemandangan Taman & Bukit', capacity: '2 Dewasa', beds: 'Kasur Queen', image: 'images/villa-room.jpg', tags: ['4 Vila', 'Kolam Pribadi'], details: villaAmenities },
    { name: 'One Bedroom Ocean Hill Pool Villa', description: 'Vila seluas 51 m² yang bertengger di atas pulau dengan pemandangan laut yang luas. Interior tropis kontemporer, kamar tidur luas, ruang keluarga, kolam rendam pribadi, dan teras outdoor menciptakan suasana intim untuk pasangan.', size: '51 m² · 21 Vila', views: 'Pemandangan Laut', capacity: '2 Dewasa', beds: 'Kasur Queen', image: 'images/two-bedrooom-family-pool.jpg', tags: ['21 Vila', 'Kolam Pribadi'], details: villaAmenities }
  ];
  const rooms = isID ? roomsID : roomsEN;
  const roomTabIds = ['ocean_hill_suite', 'garden_view_pool_villa', 'ocean_view_pool_villa'];
  const roomDisplay = $('[data-room-display]');
  let selectedRoom = 0;
  let showAllDetails = false;
  const renderRoom = () => {
    const room = rooms[selectedRoom];
    if (!roomDisplay) return;
    roomDisplay.setAttribute('aria-labelledby', `home_page_room_tab_${roomTabIds[selectedRoom]}`);
    roomDisplay.innerHTML = `<div class="room__gallery"><div class="room__frame"><img id="home_page_room_image" src="${assetPrefix}${room.image}" alt="${room.name}" loading="lazy" decoding="async" width="1600" height="1142"><div class="room__tags">${room.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}</div></div></div><div class="room__panel"><div><h3 class="room__name">${room.name}</h3><p class="room__desc">${room.description}</p><div class="room__specs"><div class="spec"><span class="spec__icon"><svg aria-hidden="true"><use href="#i-ruler"></use></svg></span><span><span class="spec__label">${roomStrings.size}</span><span class="spec__value">${room.size}</span></span></div><div class="spec"><span class="spec__icon"><svg aria-hidden="true"><use href="#i-eye"></use></svg></span><span><span class="spec__label">${roomStrings.views}</span><span class="spec__value">${room.views}</span></span></div><div class="spec"><span class="spec__icon"><svg aria-hidden="true"><use href="#i-users"></use></svg></span><span><span class="spec__label">${roomStrings.capacity}</span><span class="spec__value">${room.capacity}</span></span></div><div class="spec"><span class="spec__icon"><svg aria-hidden="true"><use href="#i-bed-double"></use></svg></span><span><span class="spec__label">${roomStrings.beds}</span><span class="spec__value">${room.beds}</span></span></div></div><span class="room__details-label">${roomStrings.details}</span><ul class="room__details">${room.details.map((detail, index) => `<li class="room__detail${index > 2 ? ' is-extra' : ''}"${index > 2 && !showAllDetails ? ' hidden' : ''}>${detail}</li>`).join('')}</ul>${room.details.length > 3 ? `<button class="room__more" id="home_page_room_details_button" type="button" data-room-more>${showAllDetails ? roomStrings.showLess : roomStrings.viewAll(room.details.length - 3)}</button>` : ''}</div><div class="room__actions">${bookingUrl === '' ? '' : bookingUrl ? `<a class="button button--primary" id="home_page_room_booking_button" href="${bookingUrl}" target="_blank" rel="noopener noreferrer" data-booking-cta>${roomStrings.bookNow}</a>` : `<a class="button button--primary" id="home_page_room_booking_button" href="mailto:info@sankarahillpenida.com?subject=${encodeURIComponent(roomStrings.enquirySubject(room.name))}" data-booking-cta><svg aria-hidden="true"><use href="#i-mail"></use></svg> ${roomStrings.bookEmail}</a>`}</div></div>`;
    $('[data-room-more]', roomDisplay)?.addEventListener('click', () => { showAllDetails = !showAllDetails; renderRoom(); });
  };
  $$('[data-room-tab]').forEach((tab) => tab.addEventListener('click', () => {
    selectedRoom = Number(tab.dataset.roomTab);
    showAllDetails = false;
    $$('[data-room-tab]').forEach((item) => { const active = item === tab; item.classList.toggle('is-active', active); item.setAttribute('aria-selected', String(active)); });
    renderRoom();
  }));
  renderRoom();

  // Reveal-on-scroll: one-shot entrance for [data-reveal] blocks below the hero.
  // Everything that enters in the same observer callback is one batch and
  // staggers in document order (section head first, then cards left to right),
  // --stagger apart and capped at six steps so a long grid never lags. A block
  // scrolled into view on its own enters with no delay, on every page alike.
  const revealTargets = $$('[data-reveal]');
  if ('IntersectionObserver' in window && revealTargets.length) {
    const stagger = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stagger')) || 80;
    const revealObserver = new IntersectionObserver((entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
        .forEach((target, index) => {
          target.style.setProperty('--reveal-delay', `${Math.min(index, 6) * stagger}ms`);
          target.classList.add('is-inview');
          revealObserver.unobserve(target);
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    revealTargets.forEach((target) => revealObserver.observe(target));
  } else {
    revealTargets.forEach((target) => target.classList.add('is-inview'));
  }

  // Promo pop-up (home): opens once per browser session, data-promo-delay ms
  // after load. While the guest is busy (another dialog or the mobile menu
  // open, typing in a field, tab in the background) it waits and tries again.
  const promo = $('[data-promo]');
  if (promo && typeof promo.showModal === 'function') {
    const seenKey = 'tsh-promo-seen';
    const isSeen = () => { try { return sessionStorage.getItem(seenKey) === '1'; } catch (error) { return false; } };
    const markSeen = () => { try { sessionStorage.setItem(seenKey, '1'); } catch (error) { /* storage blocked: shows again next visit */ } };
    const isBusy = () => document.hidden
      || $$('dialog[open]').length > 0
      || menuToggle?.getAttribute('aria-expanded') === 'true'
      || Boolean(document.activeElement?.matches('input, select, textarea'));
    const openPromo = () => {
      if (isSeen()) return;
      if (isBusy()) { setTimeout(openPromo, 3000); return; }
      markSeen();
      promo.showModal();
    };
    if (!isSeen()) {
      // Fetch the photo during the delay so the dialog opens with it in place.
      $('img', promo)?.setAttribute('loading', 'eager');
      setTimeout(openPromo, Number(promo.dataset.promoDelay) || 6000);
    }
    $('[data-promo-close]', promo)?.addEventListener('click', () => promo.close());
    // A click that lands on the <dialog> itself is a click on the backdrop.
    promo.addEventListener('click', (event) => { if (event.target === promo) promo.close(); });
  }

  // Dining & Wellness venues (home). Desktop with motion allowed: the stage
  // pins and each extra screen of scroll wipes the next photo up over the last
  // (clip-path scrubbed to scroll), swapping the copy at the halfway point.
  // Otherwise each photo opens from a slight inset as it enters the viewport.
  // Reduced motion gets neither: no listener, photos stay unclipped.
  const venues = $('[data-venues]');
  if (venues) {
    const frames = $$('[data-venues-media]', venues);
    const bodies = $$('[data-venues-item] .venues__body', venues);
    const current = $('[data-venues-current]', venues);
    const bar = $('[data-venues-bar]', venues);
    const count = frames.length;
    const pinQuery = window.matchMedia('(min-width: 1024px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const clamp01 = (value) => Math.min(1, Math.max(0, value));
    const smooth = (t) => t * t * (3 - 2 * t);
    let pinned = false;
    let active = -1;
    let ticking = false;

    const setFrame = (frame, r, wipe) => {
      frame.style.setProperty('--r', r.toFixed(4));
      frame.style.clipPath = wipe
        ? `inset(${((1 - r) * 100).toFixed(3)}% 0 0 0)`
        : `inset(${((1 - r) * 10).toFixed(3)}% ${((1 - r) * 8).toFixed(3)}%)`;
    };
    // Photo entering from below: opens from a 10%/8% inset while its top edge
    // climbs from the viewport bottom to 20% down.
    const entryProgress = (el) => smooth(clamp01((window.innerHeight - el.getBoundingClientRect().top) / (window.innerHeight * 0.8)));

    const setActive = (index) => {
      if (index === active) return;
      active = index;
      bodies.forEach((body, i) => body.classList.toggle('is-active', i === index));
      if (current) current.textContent = String(index + 1).padStart(2, '0');
    };

    const update = () => {
      ticking = false;
      if (!pinned) {
        frames.forEach((frame) => setFrame(frame, entryProgress(frame), false));
        return;
      }
      const rect = venues.getBoundingClientRect();
      const distance = venues.offsetHeight - window.innerHeight;
      const progress = clamp01(-rect.top / distance);
      const position = progress * (count - 1);
      setFrame(frames[0], entryProgress(venues), false);
      let index = 0;
      for (let k = 1; k < count; k += 1) {
        // Each wipe runs over the middle 60% of its screen, leaving a pause
        // on either side where the venue sits still and readable.
        const r = smooth(clamp01((position - (k - 1) - 0.2) / 0.6));
        setFrame(frames[k], r, true);
        if (r >= 0.5) index = k;
      }
      setActive(index);
      bar?.style.setProperty('--p', progress.toFixed(4));
    };
    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    const setMode = () => {
      pinned = pinQuery.matches;
      venues.classList.toggle('is-pinned', pinned);
      venues.style.setProperty('--venues-count', String(count));
      if (!motionQuery.matches) {
        frames.forEach((frame) => { frame.style.removeProperty('--r'); frame.style.clipPath = ''; });
        window.removeEventListener('scroll', requestUpdate);
        window.removeEventListener('resize', requestUpdate);
        return;
      }
      window.addEventListener('scroll', requestUpdate, { passive: true });
      window.addEventListener('resize', requestUpdate, { passive: true });
      update();
    };
    pinQuery.addEventListener('change', setMode);
    motionQuery.addEventListener('change', setMode);
    setMode();

    // Hidden bodies stay in the tab order; tabbing into one scrolls the
    // pinned stage to that venue so the focused link is the one on screen.
    bodies.forEach((body, i) => body.addEventListener('focusin', () => {
      if (!pinned || i === active) return;
      const top = window.scrollY + venues.getBoundingClientRect().top;
      window.scrollTo({ top: top + (i / (count - 1)) * (venues.offsetHeight - window.innerHeight), behavior: 'instant' });
    }));
  }

  // Horizontal scroll-snap slider: arrows step one card, disable at the ends.
  // Shared by the home amenities track and every [data-slider] on inner pages.
  const initSlider = (track, prev, next, cardSelector) => {
    if (!track) return;
    const step = () => {
      const card = cardSelector ? $(cardSelector, track) : track.firstElementChild;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card ? card.offsetWidth + gap : 360;
    };
    // Optional counter ("01 / 03") and progress hairline next to the track.
    const slider = track.closest('[data-slider]');
    const current = slider ? $('[data-slider-current]', slider) : null;
    const total = slider ? $('[data-slider-total]', slider) : null;
    const progress = slider ? $('[data-slider-progress]', slider) : null;
    const count = track.children.length;
    if (total) total.textContent = String(count).padStart(2, '0');
    const updateArrows = () => {
      const maxLeft = track.scrollWidth - track.clientWidth;
      // Every card fits: there is nothing to scroll, so the arrows come off
      // instead of sitting disabled on every desktop width.
      const overflows = maxLeft > 1;
      if (prev) { prev.hidden = !overflows; prev.disabled = track.scrollLeft <= 1; }
      if (next) { next.hidden = !overflows; next.disabled = track.scrollLeft >= maxLeft - 1; }
      // The last stop rarely lands a full step away, so at the end the counter reads the last card.
      const index = track.scrollLeft >= maxLeft - 1 ? count : Math.min(count, Math.round(track.scrollLeft / step()) + 1);
      if (current) current.textContent = String(index).padStart(2, '0');
      if (progress) progress.style.width = `${(index / count) * 100}%`;
    };
    // Step to the neighbouring card rather than by a fixed distance: the last
    // stop is usually a partial step, and scrollBy from there would snap back
    // two cards instead of one.
    const goTo = (index) => track.scrollTo({ left: Math.min(Math.max(0, index) * step(), track.scrollWidth - track.clientWidth), behavior: 'smooth' });
    prev?.addEventListener('click', () => goTo(Math.ceil(track.scrollLeft / step() - 0.01) - 1));
    next?.addEventListener('click', () => goTo(Math.floor(track.scrollLeft / step() + 0.01) + 1));
    track.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows, { passive: true });
    updateArrows();
  };
  initSlider($('[data-amenities-track]'), $('[data-scroll-left]'), $('[data-scroll-right]'), '.amenity');
  $$('[data-slider]').forEach((slider) => initSlider($('[data-slider-track]', slider), $('[data-slider-prev]', slider), $('[data-slider-next]', slider)));

  // Tabs: [data-tabs] wraps a [role=tablist] of [role=tab] buttons, each
  // naming its [role=tabpanel] through aria-controls. Panels stay in the DOM
  // and are toggled with `hidden`; arrow keys, Home and End move between tabs
  // (roving tabindex, automatic activation).
  $$('[data-tabs]').forEach((tabset) => {
    const tabs = $$('[role="tab"]', tabset);
    const select = (tab, focus) => {
      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(item.getAttribute('aria-controls'));
        if (panel) panel.hidden = !active;
      });
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (event) => {
        const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(tabs[(next + tabs.length) % tabs.length], true);
      });
    });
  });

  // Generic chip filter: [data-filter-group] holds [data-filter="<cat>"] chips
  // and controls the list named by aria-controls / data-filter-target. Items
  // carry data-category (space-separated); "all" shows everything. Items stay
  // in the DOM (SEO, Polylang) and are toggled with `hidden`. The FAQ block on
  // home keeps its own render path (data-faq-filter) and is not affected.
  $$('[data-filter-group]').forEach((group) => {
    const targetId = group.dataset.filterTarget || group.getAttribute('aria-controls');
    const list = targetId ? document.getElementById(targetId) : null;
    if (!list) return;
    const items = $$('[data-filter-item]', list);
    const empty = list.parentElement ? $('.empty-state[data-filter-empty]', list.parentElement) : null;
    const apply = (value) => {
      let shown = 0;
      items.forEach((item) => {
        const categories = (item.dataset.category || '').split(/\s+/);
        const visible = value === 'all' || categories.includes(value);
        item.hidden = !visible;
        if (visible) shown += 1;
      });
      if (empty) empty.hidden = shown > 0;
    };
    $$('[data-filter]', group).forEach((chip) => chip.addEventListener('click', () => {
      $$('[data-filter]', group).forEach((item) => { const active = item === chip; item.classList.toggle('is-active', active); item.setAttribute('aria-pressed', String(active)); });
      apply(chip.dataset.filter || 'all');
    }));
    const initial = $('[data-filter].is-active', group);
    if (initial && initial.dataset.filter !== 'all') apply(initial.dataset.filter);
  });

  // "View all" toggle for static amenity lists ([data-details-toggle] with
  // aria-controls -> list whose .is-extra items start hidden). The home room
  // panel keeps its own [data-room-more] because it re-renders.
  $$('[data-details-toggle]').forEach((button) => {
    const list = document.getElementById(button.getAttribute('aria-controls') || '');
    if (!list) return;
    const extras = $$('.is-extra', list);
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      extras.forEach((item) => { item.hidden = open; });
      button.setAttribute('aria-expanded', String(!open));
      button.textContent = open ? (button.dataset.labelMore || 'View All') : (button.dataset.labelLess || 'Show Less');
    });
  });

  // Copy-link button ([data-copy-link="<url>"], article share row): hidden in
  // the markup, shown only when the clipboard API exists, so without JS the
  // WhatsApp and Facebook links remain the whole share row. Feedback goes to
  // the aria-describedby status element.
  if (navigator.clipboard && window.isSecureContext) {
    $$('[data-copy-link]').forEach((button) => {
      button.hidden = false;
      const status = document.getElementById(button.getAttribute('aria-describedby') || '');
      let timer;
      button.addEventListener('click', async () => {
        const url = button.dataset.copyLink || window.location.href;
        try {
          await navigator.clipboard.writeText(url);
          if (status) status.textContent = 'Link copied';
        } catch {
          if (status) status.textContent = 'Copy failed. Select the address bar instead.';
        }
        clearTimeout(timer);
        timer = setTimeout(() => { if (status) status.textContent = ''; }, 3000);
      });
    });
  }

  // Static accordion: [data-accordion] wraps .accordion__item blocks whose
  // trigger names its panel with aria-controls. One item open at a time per
  // group (offer terms, FAQ page). The home FAQ keeps its own render path.
  $$('[data-accordion]').forEach((group) => {
    const triggers = $$('.accordion__trigger[aria-controls]', group);
    const setOpen = (trigger, open) => {
      trigger.setAttribute('aria-expanded', String(open));
      document.getElementById(trigger.getAttribute('aria-controls') || '')?.classList.toggle('is-open', open);
    };
    triggers.forEach((trigger) => trigger.addEventListener('click', () => {
      const open = trigger.getAttribute('aria-expanded') === 'true';
      triggers.forEach((other) => setOpen(other, false));
      if (!open) setOpen(trigger, true);
    }));
    // Deep link to one question (faq.html#faq_page_faq_item_pets): open it on
    // load and whenever the hash changes.
    const openFromHash = () => {
      const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
      const linked = target && group.contains(target) ? $('.accordion__trigger[aria-controls]', target.closest('.accordion__item') || target) : null;
      if (!linked) return;
      triggers.forEach((other) => setOpen(other, false));
      setOpen(linked, true);
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  });

  // .form: validation styling only after the first submit attempt (see
  // components.css `.form.is-submitted`). Page scripts (contact.js) own the
  // fetch/submit itself.
  $$('form.form').forEach((form) => {
    form.addEventListener('submit', () => form.classList.add('is-submitted'));
    form.addEventListener('invalid', () => form.classList.add('is-submitted'), true);
  });

  // Footer newsletter. Same contract as the inquiry form: POST to
  // data-endpoint, and an empty endpoint (static build) resolves as a preview
  // success without a network call. Messages come from data-msg-* so each
  // language ships its own copy.
  $$('[data-newsletter-form]').forEach((form) => {
    const input = $('input[type="email"]', form);
    const button = $('[type="submit"]', form);
    const status = $('.footer__subscribe-status', form);
    let sending = false;
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true' && input.checkValidity()) input.removeAttribute('aria-invalid');
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (sending) return;
      if (!input.checkValidity()) {
        input.setAttribute('aria-invalid', 'true');
        status.textContent = form.dataset.msgInvalid;
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      sending = true;
      button.disabled = true;
      try {
        const endpoint = form.dataset.endpoint;
        if (endpoint) {
          const response = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }, credentials: 'same-origin' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
        form.reset();
        status.textContent = form.dataset.msgSuccess;
      } catch (error) {
        console.error('Newsletter signup failed', error);
        status.textContent = form.dataset.msgError;
      } finally {
        sending = false;
        button.disabled = false;
      }
    });
  });

  // Content: TSH_Website_Contentwriting.md › FREQUENTLY ASKED QUESTIONS. Answers keep their paragraph breaks ("\n\n") and are split into <p>s at render time.
  const faqs = [
    ['Getting Here', 'How can I get to The Sankara Hill Penida?', "The Sankara Hill Penida is located in Ped, Nusa Penida, Bali. Guests can reach the island by fast boat from Bali's main harbours, including Sanur, Kusamba, or Padang Bai.\n\nFor a seamless journey, our Reservation Team can assist in arranging your fast boat tickets and transportation from the harbour to the resort. We recommend arranging your transfer in advance, especially during peak travel periods."],
    ['Getting Here', 'Can you arrange a fast boat transfer and pick-up from the harbour?', 'Yes. Our Reservation Team can assist with fast boat arrangements and transportation from the Nusa Penida harbour to The Sankara Hill Penida.\n\nSimply let us know your preferred travel date and departure point, and our team will assist with the available options.'],
    ['Getting Here', 'Do you provide airport transfers?', 'We do not operate a direct airport shuttle. However, we can assist in arranging transportation from Ngurah Rai International Airport to the fast boat harbour in Bali, followed by your boat transfer to Nusa Penida.\n\nPlease contact our Reservation Team in advance to arrange your journey.'],
    ['Getting Here', 'How long does it take to reach The Sankara Hill Penida from Bali?', 'The fast boat journey from Bali to Nusa Penida generally takes around 30–60 minutes, depending on the departure harbour, sea conditions, and boat operator.\n\nFrom the harbour in Nusa Penida, the journey to The Sankara Hill Penida generally takes around 15–30 minutes by car, depending on the arrival harbour and traffic conditions.'],
    ['Accommodation & Stay', 'What time is check-in and check-out?', 'Check-in is from 2:00 PM, while check-out is by 12:00 PM.'],
    ['Accommodation & Stay', 'Is early check-in available?', 'Early check-in is subject to availability on the day of arrival.\n\nIf you arrive early, our team will be happy to assist with your luggage while you wait for your room to be ready.'],
    ['Accommodation & Stay', 'Is late check-out available?', 'Late check-out is subject to availability and may be subject to an additional charge depending on the requested departure time.\n\nPlease contact our Front Office Team during your stay for assistance.'],
    ['Accommodation & Stay', 'Is Wi-Fi available at the resort?', 'Yes. Complimentary Wi-Fi is available throughout the resort, including guest rooms and public areas.'],
    ['Accommodation & Stay', 'Is there a deposit required upon check-in?', 'Yes. A security deposit of IDR 500,000 is required upon arrival and can be settled by cash or debit/credit card.\n\nThe deposit may be used toward incidental expenses during your stay. If there are no outstanding charges upon check-out, the remaining deposit will be returned to you.'],
    ['Accommodation & Stay', 'Can I request a specific room or villa?', 'Guests may submit a room or villa preference when making a reservation. Specific room numbers or locations are subject to availability and cannot be guaranteed.\n\nOur Reservation Team will do their best to accommodate your request.'],
    ['Accommodation & Stay', 'Are extra beds available?', 'Yes. Extra single beds are available upon request and are subject to availability. Availability is limited and may vary depending on the accommodation category.\n\nAdditional charges may apply. Please contact our Reservation Team in advance to check availability and the applicable rate for your selected room or villa.'],
    ['Accommodation & Stay', 'Are baby cots available?', 'Baby cots are available upon request and are subject to availability.\n\nWe recommend requesting a baby cot when making your reservation.'],
    ['Accommodation & Stay', 'Is the resort suitable for families with children?', "Children are welcome at The Sankara Hill Penida. Some room categories and facilities may have specific occupancy conditions.\n\nPlease contact our Reservation Team with your children's ages so we can recommend the most suitable accommodation."],
    ['Accommodation & Stay', 'Do you allow pets?', 'No. Pets are not permitted at The Sankara Hill Penida.'],
    ['Accommodation & Stay', 'Does the resort have accessible facilities?', "The resort does not currently provide dedicated accessible facilities. Due to the property's hilltop setting and multi-level layout, guests with mobility requirements are encouraged to contact our Reservation Team before booking so we can advise on the most suitable accommodation and access arrangements."],
    ['Dining & Wellness', 'Do you offer half-board or full-board packages?', 'Selected dining packages may be available depending on the rate plan or offer.\n\nPlease contact our Reservation Team for current package options and inclusions.'],
    ['Dining & Wellness', 'Does The Sankara Hill Penida serve halal food?', 'Our restaurant offers a selection of local, Asian, and international dishes, and some dishes on our menu contain pork.\n\nHowever, pork-free options are available on our menu and may also be prepared upon request, subject to availability.\n\nGuests with specific dietary requirements are encouraged to inform our team in advance so we can assist with suitable dining options.'],
    ['Dining & Wellness', 'Do you provide room service?', 'Yes. Room service is available during designated operating hours.\n\nFor the latest menu and service hours, please contact our Front Office Team.'],
    ['Dining & Wellness', 'Do you have a restaurant at the resort?', 'Yes. Guests can dine at our signature restaurant, Puñña Restaurant, which offers a selection of local, Asian, and international-inspired cuisine.\n\nFor a more relaxed experience, guests can also enjoy a selection of beverages and refreshments at our bar.'],
    ['Dining & Wellness', 'Do you have a spa?', 'Yes. Radha Spa offers a selection of treatments designed to complement your stay with moments of relaxation and wellness.\n\nAdvance booking is recommended, particularly during peak periods.'],
    ['Resort & Destination', 'Is The Sankara Hill Penida a beachfront resort?', 'No. The Sankara Hill Penida is a hilltop resort, rather than a beachfront property.\n\nIts elevated setting offers a sense of privacy and tranquillity, with views across the surrounding landscape and ocean.'],
    ['Resort & Destination', 'How far is The Sankara Hill Penida from the beach?', 'The Sankara Hill Penida is located away from the beachfront, with several beaches accessible by car from the resort.\n\nOur team will be happy to assist in arranging transportation and recommending beaches or other destinations during your stay.'],
    ['Resort & Destination', 'Can the resort arrange activities and experiences in Nusa Penida?', 'Yes. Our team can help arrange selected experiences and transportation around Nusa Penida, depending on availability.\n\nWe recommend speaking with our team before your arrival so your preferred activities can be arranged in advance.'],
    ['Resort & Destination', 'Is The Sankara Hill Penida suitable for honeymooners?', 'The Sankara Hill Penida offers a tranquil hilltop setting, private pool villas, ocean views, spa experiences, and intimate dining options, making it an ideal setting for a romantic island escape.\n\nOur team can also assist with special arrangements for honeymoon and romantic stays.'],
    ['Resort & Destination', 'Can I arrange special occasions at the resort?', 'Yes. Our team can assist with selected arrangements for special occasions such as birthdays, anniversaries, honeymoons, and romantic celebrations.\n\nPlease contact our Reservation Team in advance so we can discuss the available arrangements and additional charges.'],
    ['Resort & Destination', 'What should I know before travelling to Nusa Penida?', 'Nusa Penida is an island destination with a naturally hilly landscape. Travel times may vary depending on road conditions, traffic, harbour schedules, and sea conditions.\n\nWe recommend allowing sufficient travel time between your boat arrival, resort transfer, and onward activities. Our Reservation Team will be happy to assist in planning your journey.'],
    ['Resort & Destination', 'How can I make a reservation?', 'You can make a reservation through our official booking channels or contact our Reservation Team directly.\n\nFor assistance with accommodation, transfers, special requests, or stay arrangements, please contact us before your arrival.'],
    // "Guest Services & Facilities" in the doc are statements, not questions; the heading stands in as the trigger text.
    ['Guest Services & Facilities', '24-Hour Guest Service', 'Our Guest Service Team is available 24 hours a day to assist with your needs throughout your stay. From resort services and arrangements to local recommendations, our team will be pleased to assist you.'],
    ['Guest Services & Facilities', 'International Power Sockets', 'For your convenience, guest rooms are equipped with international-compatible power sockets and USB charging ports, allowing you to easily connect and charge your devices throughout your stay.'],
    ['Guest Services & Facilities', 'Housekeeping', 'Daily housekeeping service is provided to ensure your room remains comfortable throughout your stay. Additional housekeeping amenities, including an iron and ironing board, sewing kit, disposable razor, and additional bathroom supplies, are available upon request.'],
    ['Guest Services & Facilities', 'In-Room Safety Deposit Box', 'An electronic safety deposit box is provided in each room for the safekeeping of your valuables and personal belongings. Guests are kindly advised to use the safe and avoid leaving valuables unattended.'],
    ['Guest Services & Facilities', 'Insects & Mosquito Protection', 'As Nusa Penida is a tropical island, insects and mosquitoes may naturally be present. Preventive measures are taken around the resort, and mosquito protection is provided in guest rooms for your comfort.\n\nAdditional assistance can be requested from our Guest Service Team.'],
    ['Guest Services & Facilities', 'Swimming Pool', "Our swimming pool is open daily from 7:00 AM to 8:00 PM, providing a tranquil space to relax and enjoy the surrounding hilltop setting. Pool towels are available for guests' convenience."],
    ['Guest Services & Facilities', 'Yoga Pavilion', 'The Yoga Pavilion offers a peaceful space for guests to maintain their wellness routine while enjoying the tranquillity of the resort. It is open daily from 7:00 AM to 8:00 PM.'],
    ['Guest Services & Facilities', 'Doctor on Call', 'A doctor-on-call service is available should medical assistance be required. Please contact our Guest Service Team or Front Office for assistance.'],
    ['Guest Services & Facilities', 'Guest Activities', 'Discover curated experiences designed to make your stay at The Sankara Hill Penida more memorable. Our team can assist with selected activities and experiences around the resort and Nusa Penida, subject to availability.']
  ];
  const faqList = $('[data-faq-list]');
  // Initial filter follows the chip marked active in the markup; a page without an "All" chip (index.html) opens on its first category.
  let faqFilter = $('[data-faq-filter].is-active')?.dataset.faqFilter || 'All';
  let openFaq = -1;
  // Toggle in place so the panel's height transition can actually run;
  // re-rendering the list would recreate the node already open.
  const setFaqOpen = (item, open) => {
    const trigger = $('.accordion__trigger', item);
    const panel = $('.accordion__panel', item);
    trigger?.setAttribute('aria-expanded', String(open));
    panel?.classList.toggle('is-open', open);
  };
  const faqSlug = (question) => question.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 6).join('_');
  const renderFaqs = () => {
    if (!faqList) return;
    faqList.innerHTML = faqs.map((faq, index) => ({ faq, index })).filter(({ faq }) => faqFilter === 'All' || faq[0] === faqFilter).map(({ faq, index }) => { const slug = faqSlug(faq[1]); return `<article class="accordion__item" id="home_page_faq_item_${slug}"><button class="accordion__trigger" type="button" aria-expanded="${openFaq === index}" id="home_page_faq_question_${slug}" aria-controls="home_page_faq_answer_${slug}" data-faq-index="${index}"><span class="accordion__question">${faq[1]}</span><span class="accordion__indicator" aria-hidden="true"><svg><use href="#i-plus"></use></svg></span></button><div class="accordion__panel${openFaq === index ? ' is-open' : ''}" id="home_page_faq_answer_${slug}" aria-labelledby="home_page_faq_question_${slug}"><div class="accordion__panel-inner">${faq[2].split('\n\n').map((para) => `<p class="accordion__answer">${para}</p>`).join('')}</div></div></article>`; }).join('');
    $$('[data-faq-index]', faqList).forEach((button) => button.addEventListener('click', () => {
      const index = Number(button.dataset.faqIndex);
      const item = button.closest('.accordion__item');
      const wasOpen = openFaq === index;
      $$('.accordion__item', faqList).forEach((other) => setFaqOpen(other, false));
      openFaq = wasOpen ? -1 : index;
      if (!wasOpen && item) setFaqOpen(item, true);
    }));
  };
  $$('[data-faq-filter]').forEach((button) => button.addEventListener('click', () => { faqFilter = button.dataset.faqFilter || 'All'; openFaq = -1; $$('[data-faq-filter]').forEach((item) => { const active = item === button; item.classList.toggle('is-active', active); item.setAttribute('aria-pressed', String(active)); }); renderFaqs(); }));
  renderFaqs();

  // FAQPage schema only where the rendered FAQ block exists (home); faq.html
  // ships its own static JSON-LD in the head.
  if (faqList) {
    const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((faq) => ({ '@type': 'Question', name: faq[1], acceptedAnswer: { '@type': 'Answer', text: faq[2].replace(/\n\n/g, ' ') } })) };
    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(schema);
  }
})();