(() => {
  'use strict';
  const initialize = (scope = document) => {
    scope.querySelectorAll('[data-product-root]').forEach(root => {
      if (root.dataset.initialized) return;
      const payload = root.querySelector('[data-product-json]');
      const form = root.querySelector('[data-product-form]');
      if (!payload || !form) return;
      let variants;
      try { variants = JSON.parse(payload.textContent).variants; } catch { return; }
      root.dataset.initialized = 'true';
      form.classList.add('enhanced');
      const select = form.querySelector('[data-variant-select]');
      const status = root.querySelector('[data-product-status]');
      const quantity = form.querySelector('[name="quantity"]');
      const addButtons = [...root.querySelectorAll('[data-add]')];
      let active = variants.find(v => String(v.id) === select.value);
      let busy = false;
      const showMedia = id => {
        if (!id) return;
        const target = root.querySelector(`[data-media-id="${id}"]`);
        if (!target) return;
        root.querySelectorAll('[data-media-id]').forEach(slide => {
          slide.hidden = slide !== target;
          if (slide.hidden) slide.querySelectorAll('video').forEach(video => video.pause());
        });
        root.querySelectorAll('[data-media-target]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mediaTarget === String(id))));
      };
      root.querySelectorAll('[data-media-target]').forEach(button => button.addEventListener('click', () => showMedia(button.dataset.mediaTarget)));
      const renderButtons = () => addButtons.forEach(button => {
        button.disabled = busy || !active?.available;
        button.textContent = busy ? root.dataset.addingLabel : active ? (active.available ? root.dataset.addLabel : root.dataset.soldLabel) : root.dataset.unavailableLabel;
      });
      const applyVariant = variant => {
        active = variant;
        select.disabled = !variant;
        if (variant) {
          select.value = String(variant.id);
          root.querySelectorAll('[data-price]').forEach(node => { node.innerHTML = variant.price; });
          const compare = root.querySelector('[data-compare]');
          if (compare) { compare.innerHTML = variant.compare; compare.hidden = !variant.onSale; }
          const sale = root.querySelector('[data-sale]');
          if (sale) sale.hidden = !variant.onSale;
          quantity.min = variant.min; quantity.step = variant.step;
          if (variant.max != null) quantity.max = variant.max; else quantity.removeAttribute('max');
          let count = Math.max(Number(quantity.value) || variant.min, variant.min);
          count = variant.min + Math.ceil((count - variant.min) / variant.step) * variant.step;
          if (variant.max != null) count = Math.min(count, variant.max);
          quantity.value = count;
          showMedia(variant.media);
          if (document.body.classList.contains('template-product')) {
            const url = new URL(location.href); url.searchParams.set('variant', variant.id); history.replaceState({}, '', url);
          }
        }
        renderButtons();
      };
      form.querySelectorAll('[data-option-position]').forEach(group => group.addEventListener('change', () => {
        const options = [...form.querySelectorAll('[data-option-position]')].map(g => g.querySelector('input:checked')?.value);
        form.querySelectorAll('[data-option-position]').forEach(g => {
          const label = g.querySelector('[data-option-label]');
          if (label) label.textContent = g.querySelector('input:checked')?.value || '';
        });
        applyVariant(variants.find(v => v.options.every((option, index) => option === options[index])));
        status.textContent = ''; status.classList.remove('error');
      }));
      form.addEventListener('submit', async event => {
        if (!window.secureCupRoutes) return;
        event.preventDefault();
        if (busy || !active?.available || !form.reportValidity()) return;
        const formData = new FormData(form);
        busy = true; renderButtons(); status.classList.remove('error'); status.textContent = '';
        try {
          const response = await fetch(window.secureCupRoutes.add, { method: 'POST', headers: { Accept: 'application/json' }, body: formData });
          const result = await response.json();
          if (!response.ok) throw new Error(typeof result.description === 'string' ? result.description : root.dataset.errorLabel);
          status.textContent = root.dataset.addedLabel;
          const notice = document.querySelector('[data-cart-notice]');
          if (notice) { notice.querySelector('[data-notice-text]').textContent = root.dataset.addedLabel; notice.hidden = false; }
          try {
            const cartResponse = await fetch(window.secureCupRoutes.cart, { headers: { Accept: 'application/json' } });
            if (cartResponse.ok) {
              const cart = await cartResponse.json();
              document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = cart.item_count; });
              document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
            }
          } catch { /* Counter refresh must not invalidate a successful cart addition. */ }
        } catch (error) {
          status.classList.add('error'); status.textContent = error.message || root.dataset.errorLabel;
        } finally { busy = false; renderButtons(); }
      });
      renderButtons();
    });
  };
  initialize();
  document.addEventListener('shopify:section:load', event => initialize(event.target));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-close-notice]')) document.querySelector('[data-cart-notice]').hidden = true;
  });
})();
