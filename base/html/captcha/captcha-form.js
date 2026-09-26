export function manufactureCapWidget() {
  const capWidget = document.createElement('cap-widget');
  capWidget.setAttribute('data-cap-api-endpoint', '/api/captcha/');
  capWidget.setAttribute('name', 'cap-widget');
  return capWidget;
}

/**@param {SubmitEvent} ev */
export async function handleCaptcha(ev) {
  ev.preventDefault();

  let statusDiv = document.getElementById('status');
  if (!(statusDiv instanceof HTMLDivElement)) {
		statusDiv = document.createElement('div');
  }
  statusDiv.textContent = 'Verifying...';
  statusDiv.style.color = 'black';

  let widget = document.querySelector('cap-widget');
  if (!(widget instanceof HTMLElement)) {
		widget = manufactureCapWidget();
  }

  // 1. Dig into the widget to find the hidden input
  const hiddenInput = widget?.querySelector('input[type="hidden"]')
    || (widget?.shadowRoot && widget.shadowRoot.querySelector('input[type="hidden"]'));

  // 2. Grab the value (with fallbacks just in case the widget exposes it directly as a property)
  const capResponse = (hiddenInput ? String(hiddenInput.value) : null)
    || (widget?.value ? String(widget?.value) : null)
    || widget?.getAttribute('token')
    || widget?.getAttribute('value');

  if (!capResponse) {
    statusDiv.textContent = 'Please check the CAPTCHA box first (or wait for it to finish).';
    statusDiv.style.color = 'red';
    return;
  }

  try {
    // 3. Send the explicitly extracted token
    const res = await fetch('/api/captcha/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'cap-response': capResponse })
    });

    const data = await res.json();
    statusDiv.textContent = res.ok ? data.success : data.error;
    statusDiv.style.color = res.ok ? 'green' : 'red';
    if (res.ok) {
      const target = ev.target;
      if (target instanceof HTMLFormElement) {
        const submitButton = target.querySelector('button[type="submit"]');
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = true;
        }
      }
    }
  } catch (err) {
    statusDiv.textContent = 'Network error reaching the server.';
    statusDiv.style.color = 'red';
  }
}
