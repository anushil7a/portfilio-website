/* ============================================================
   Anushil Adhikari — anushiladhikari.com
   Tabs, pointer glow, drag rail, stack probe,
   credential disclosures, contact form. No dependencies.

   Progressive enhancement: without this file every panel stays
   visible and the tabs behave as ordinary anchor links.
   ============================================================ */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover)').matches;

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Glow follows the pointer --------------------- */
  /* Eased toward the cursor rather than pinned to it, so the
     light drifts in the background instead of tracking the eye. */

  var glow = document.querySelector('.glow');

  if (glow && finePointer && !reduceMotion) {
    var targetX = 0, targetY = 0;      // where the pointer is
    var glowX = 0, glowY = 0;          // where the light has caught up to
    var primed = false;
    var raf = null;

    function drift() {
      glowX += (targetX - glowX) * 0.045;
      glowY += (targetY - glowY) * 0.045;
      glow.style.setProperty('--mx', glowX.toFixed(1) + 'px');
      glow.style.setProperty('--my', glowY.toFixed(1) + 'px');

      raf = (Math.abs(targetX - glowX) > 0.5 || Math.abs(targetY - glowY) > 0.5)
        ? window.requestAnimationFrame(drift)
        : null;
    }

    window.addEventListener('pointermove', function (e) {
      targetX = e.clientX;
      targetY = e.clientY;

      if (!primed) {                    // start where the pointer already is
        primed = true;
        glowX = targetX;
        glowY = targetY;
      }
      if (!raf) raf = window.requestAnimationFrame(drift);
    }, { passive: true });

    document.addEventListener('pointerleave', function () { glow.style.opacity = '0'; });
    document.addEventListener('pointerenter', function () { glow.style.opacity = ''; });
  }

  /* ---------- Tabs ----------------------------------------- */

  var tablist = document.getElementById('tablist');
  var head = document.getElementById('tabsHead');
  var tabs = tablist ? Array.prototype.slice.call(tablist.querySelectorAll('.tab')) : [];
  var panels = tabs.map(function (tab) {
    return document.getElementById(tab.getAttribute('href').slice(1));
  });

  var current = -1;

  function movePlayhead(tab) {
    if (!head || !tab) return;
    head.style.width = tab.offsetWidth + 'px';
    head.style.transform = 'translateX(' + tab.offsetLeft + 'px)';
    head.classList.add('is-ready');
  }

  function revealTab(tab) {
    if (!tablist) return;
    var bar = tablist.parentNode;
    if (bar.scrollWidth <= bar.clientWidth) return;

    var left = tab.offsetLeft;
    var right = left + tab.offsetWidth;
    var pad = 24;

    if (left - pad < bar.scrollLeft) bar.scrollLeft = Math.max(0, left - pad);
    else if (right + pad > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right + pad - bar.clientWidth;
  }

  function select(index, opts) {
    opts = opts || {};
    if (index < 0 || index >= tabs.length) return;
    if (index === current) { revealTab(tabs[index]); return; }

    var previous = current;
    current = index;

    tabs.forEach(function (tab, i) {
      var on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.setAttribute('tabindex', on ? '0' : '-1');
    });

    panels.forEach(function (panel, i) {
      if (!panel) return;
      if (i === index) {
        panel.hidden = false;
        if (previous !== -1 && !reduceMotion) {
          panel.classList.remove('is-entering');
          void panel.offsetWidth;          // restart the animation
          panel.classList.add('is-entering');
        }
      } else {
        panel.hidden = true;
      }
    });

    movePlayhead(tabs[index]);
    revealTab(tabs[index]);

    if (panels[index] && panels[index].id === 'projects') syncRail();
    if (panels[index] && panels[index].id === 'projects') countUp();

    if (opts.focus) tabs[index].focus();

    if (opts.push) {
      var hash = tabs[index].getAttribute('href');
      if (location.hash !== hash) history.pushState({ tab: index }, '', hash);
    }

    if (previous !== -1 && opts.scroll !== false && window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  function indexFromHash() {
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('href') === location.hash) return i;
    }
    return 0;
  }

  if (tabs.length && panels.every(Boolean)) {
    tablist.setAttribute('role', 'tablist');

    tabs.forEach(function (tab, i) {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panels[i].id);
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');

      // Deliberately not focusable: the page itself scrolls, so a
      // panel tabindex buys nothing and makes the browser paint a
      // focus ring around the whole page on any /#work style link.
      panels[i].setAttribute('role', 'tabpanel');

      tab.addEventListener('click', function (e) {
        e.preventDefault();
        select(i, { push: true });
      });
    });

    tablist.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i === -1) return;

      var next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;

      e.preventDefault();
      select(next, { focus: true, push: true, scroll: false });
    });

    window.addEventListener('popstate', function () {
      select(indexFromHash(), { scroll: false });
    });

    window.addEventListener('resize', function () {
      if (current > -1) movePlayhead(tabs[current]);
      syncRail();
    });

    select(indexFromHash(), { scroll: false });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (current > -1) movePlayhead(tabs[current]);
      });
    }
  }

  /* ---------- Projects rail -------------------------------- */

  var rail = document.getElementById('rail');
  var slides = rail ? Array.prototype.slice.call(rail.children) : [];
  var jumps = Array.prototype.slice.call(document.querySelectorAll('.jump'));
  var progress = document.getElementById('railProgress');

  function stepOf() {
    if (!rail || !slides.length) return 1;
    var gap = parseFloat(getComputedStyle(rail).columnGap);
    return slides[0].offsetWidth + (isNaN(gap) ? 0 : gap);
  }

  function railIndex() {
    if (!rail || !slides.length) return 0;
    return Math.min(slides.length - 1, Math.max(0, Math.round(rail.scrollLeft / stepOf())));
  }

  function syncRail() {
    if (!rail || !slides.length) return;
    var i = railIndex();

    if (progress) {
      progress.style.width = (100 / slides.length) + '%';
      progress.style.transform = 'translateX(' + (i * 100) + '%)';
    }
    jumps.forEach(function (b, n) {
      b.setAttribute('aria-current', String(n === i));
    });
  }

  function goTo(i) {
    if (!rail || !slides.length) return;
    var clamped = Math.min(slides.length - 1, Math.max(0, i));
    rail.scrollTo({ left: clamped * stepOf(), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  if (rail && slides.length) {
    jumps.forEach(function (btn) {
      btn.addEventListener('click', function () { goTo(Number(btn.dataset.go)); });
    });

    var railTicking = false;
    rail.addEventListener('scroll', function () {
      if (railTicking) return;
      railTicking = true;
      window.requestAnimationFrame(function () {
        syncRail();
        railTicking = false;
      });
    }, { passive: true });

    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(railIndex() + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(railIndex() - 1); }
    });

    // Drag to pan, so a mouse can move the rail without a stepper.
    var dragging = false, startX = 0, startScroll = 0, moved = 0;

    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;         // native touch scroll is better
      if (e.target.closest('video, a, button')) return;
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startScroll = rail.scrollLeft;
      rail.classList.add('is-dragging');
    });

    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      moved = Math.abs(dx);
      rail.scrollLeft = startScroll - dx;
    });

    window.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      rail.classList.remove('is-dragging');
      if (moved > 8) goTo(Math.round(rail.scrollLeft / stepOf()));  // settle onto a slide
    });

    syncRail();
  }

  /* ---------- Count-up on the getSense metrics ------------- */

  var counted = false;

  function countUp() {
    if (counted || reduceMotion) return;
    var vals = document.querySelectorAll('.readout__val[data-count]');
    if (!vals.length) return;
    counted = true;

    vals.forEach(function (el) {
      var target = Number(el.dataset.count);
      var prefix = el.dataset.prefix || '';
      var suffix = el.dataset.suffix || '';
      var start = performance.now();
      var dur = 900;

      function frame(now) {
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = prefix + Math.round(target * eased) + suffix;
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  /* ---------- Stack probe ---------------------------------- */

  var probe = document.getElementById('stackProbe');

  if (probe && finePointer) {
    var pName = probe.querySelector('.probe__name');
    var pWhere = probe.querySelector('.probe__where');

    document.querySelectorAll('.chips--lg li').forEach(function (chip) {
      chip.addEventListener('pointerenter', function () {
        var group = chip.closest('.stack__group');
        var label = group ? group.querySelector('.rule-label').textContent.trim() : '';
        pName.textContent = chip.textContent.trim();
        pWhere.textContent = chip.dataset.where || label;
        probe.classList.add('is-live');
      });
    });

    var stackWrap = document.querySelector('.stack');
    if (stackWrap) {
      stackWrap.addEventListener('pointerleave', function () {
        probe.classList.remove('is-live');
      });
    }
  }

  /* ---------- Credential disclosures ----------------------- */

  document.querySelectorAll('.cred__toggle').forEach(function (btn) {
    var cred = btn.closest('.cred');
    var detail = document.getElementById(btn.getAttribute('aria-controls'));
    if (!detail) return;

    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      detail.hidden = open;
      cred.classList.toggle('is-open', !open);
      if (!open) fillValidity(detail);
    });
  });

  function fillValidity(scope) {
    var box = scope.querySelector('.validity');
    if (!box || box.dataset.done) return;
    box.dataset.done = '1';

    var from = new Date(box.dataset.from).getTime();
    var to = new Date(box.dataset.to).getTime();
    var now = Date.now();
    var pct = Math.min(100, Math.max(0, ((now - from) / (to - from)) * 100));

    var months = Math.max(0, Math.round((to - now) / (1000 * 60 * 60 * 24 * 30.44)));
    var bar = box.querySelector('span');
    var note = box.querySelector('.validity__note');

    requestAnimationFrame(function () { bar.style.width = pct + '%'; });
    note.textContent = months > 0
      ? months + ' months remaining before renewal'
      : 'Due for renewal';
  }

  /* ---------- Contact form --------------------------------- */

  var form = document.getElementById('contactForm');
  var status = document.getElementById('formStatus');

  function fieldOf(input) { return input.closest('.field'); }

  function showError(input, message) {
    var field = fieldOf(input);
    if (!field) return;
    field.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');

    var error = field.querySelector('.field__error');
    if (!error) {
      error = document.createElement('p');
      error.className = 'field__error';
      error.id = input.id + '-error';
      field.appendChild(error);
      input.setAttribute('aria-describedby', error.id);
    }
    error.textContent = message;
  }

  function clearError(input) {
    var field = fieldOf(input);
    if (!field) return;
    field.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    var error = field.querySelector('.field__error');
    if (error) error.remove();
  }

  function validate(input) {
    if (input.validity.valid) {
      clearError(input);
      return true;
    }

    var label = (input.labels && input.labels[0] ? input.labels[0].textContent : 'This field')
      .replace(/optional/i, '').trim();

    var message;
    if (input.validity.valueMissing) message = label + ' is required.';
    else if (input.validity.typeMismatch) message = 'Enter a valid email address.';
    else if (input.validity.tooShort) message = label + ' needs at least ' + input.minLength + ' characters.';
    else message = 'Check this field.';

    showError(input, message);
    return false;
  }

  if (form) {
    var inputs = Array.prototype.slice.call(form.querySelectorAll('input, textarea'));

    inputs.forEach(function (input) {
      input.addEventListener('blur', function () {
        if (input.value !== '' || input.required) validate(input);
      });
      input.addEventListener('input', function () {
        var field = fieldOf(input);
        if (field && field.classList.contains('is-invalid')) validate(input);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var firstInvalid = null;
      inputs.forEach(function (input) {
        if (!validate(input) && !firstInvalid) firstInvalid = input;
      });

      if (firstInvalid) {
        status.textContent = 'Fix the highlighted fields and try again.';
        status.className = 'form__status is-error';
        firstInvalid.focus();
        return;
      }

      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      status.textContent = 'Sending…';
      status.className = 'form__status';

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      })
        .then(function (response) {
          if (!response.ok) throw new Error('Request failed');
          form.reset();
          status.textContent = 'Message sent. I’ll get back to you.';
          status.className = 'form__status is-ok';
        })
        .catch(function () {
          status.textContent = 'That didn’t send. Email anushil7a@gmail.com directly.';
          status.className = 'form__status is-error';
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  }
})();
