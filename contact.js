/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* Contact page: accessible validation, then compose an email in the visitor's mail app.
   There is no server: nothing is sent until the visitor presses Send in their email app. */
(() => {
  'use strict';
  const form = $('#contact-form');
  if (!form) return;
  const to = (window.ATS_SITE || {}).contactEmail || '';
  const site = (window.ATS_SITE || {}).siteName || 'ATS Resume';
  const MAX = 1200;

  const rules = {
    name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.'),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address, like name@example.com.'),
    topic: (v) => (v ? '' : 'Please choose a topic.'),
    message: (v) => (v.trim().length < 20 ? 'Please write at least 20 characters so we can help properly.' : v.length > MAX ? `Please keep it under ${MAX} characters.` : ''),
  };

  const wrapOf = (name) => form.querySelector(`[data-field="${name}"]`);
  function check(name) {
    const wrap = wrapOf(name);
    const input = wrap.querySelector('input, select, textarea');
    const msg = rules[name](input.value);
    wrap.classList.toggle('invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    wrap.querySelector('.field-error').textContent = msg;
    return !msg;
  }
  Object.keys(rules).forEach((name) => {
    const input = wrapOf(name).querySelector('input, select, textarea');
    input.addEventListener('blur', () => check(name));
    input.addEventListener('input', () => { if (wrapOf(name).classList.contains('invalid')) check(name); });
  });

  const msgBox = form.querySelector('#c-message');
  const counter = $('#c-count');
  const updateCount = () => { counter.textContent = `${msgBox.value.length} / ${MAX}`; counter.style.color = msgBox.value.length > MAX ? 'var(--danger)' : ''; };
  msgBox.addEventListener('input', updateCount); updateCount();

  const success = $('#success');
  let lastText = '';
  let lastHref = '';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const results = Object.keys(rules).map((n) => [n, check(n)]);
    const bad = results.find(([, ok]) => !ok);
    if (bad) { wrapOf(bad[0]).querySelector('input, select, textarea').focus(); return; }

    const data = Object.fromEntries(new FormData(form).entries());
    const topicLabel = form.querySelector('#c-topic').selectedOptions[0].textContent;
    const subject = `[${site}] ${topicLabel} from ${data.name.trim()}`;
    const text = `${data.message.trim()}\n\n---\nFrom: ${data.name.trim()} <${data.email.trim()}>\nTopic: ${topicLabel}`;
    lastText = `To: ${to}\nSubject: ${subject}\n\n${text}`;
    lastHref = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    $('#open-again').href = lastHref;
    success.classList.add('show');
    success.focus();
    window.location.href = lastHref;
  });

  $('#copy-msg').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(lastText);
      notify('Message copied. Paste it into any email app.');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = lastText; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); notify('Message copied. Paste it into any email app.'); }
      catch { notify('Could not copy automatically. Select the text in the form and copy it.', { type: 'error' }); }
      ta.remove();
    }
  });
})();
