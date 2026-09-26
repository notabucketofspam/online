// --------------------------- some window-cap stuffs
//@ts-ignore
window.CAP_CUSTOM_WASM_URL = "/dlc/cap/wasm/src/browser/cap_wasm_bg.wasm";
//@ts-ignore
window.CAP_CUSTOM_HASHWX_URL = "/dlc/cap/wasm/src/browser/hashwx.wasm";
//@ts-ignore
window.CAP_SILENT = true;

// ------------------------------------------- this helps inject it into existing pages
function manufactureCapWidget() {
  const capWidget = document.createElement('cap-widget');
  capWidget.setAttribute('data-cap-api-endpoint', '/api/captcha/');
  capWidget.setAttribute('name', 'cap-widget');
  capWidget.setAttribute('id', 'cap-widget');
  capWidget.setAttribute('style', 'display:block;');
  return capWidget;
}

/**@param {string} someid */
function insert_capWidget_here(someid) {
  const someform = document.getElementById(someid);
  if (someform instanceof HTMLFormElement) {
    const lec = someform.lastElementChild;
    if (lec) {
      lec.insertAdjacentElement('beforebegin', manufactureCapWidget());
    }
  }
}

function manufactureCapScript() {
  const script = document.createElement('script');
  script.setAttribute('src', '/dlc/cap/widget/src/cap.min.js');
	script.setAttribute('async','');
	script.setAttribute('defer','');
  return script;
}
function injectCapScript() {
	document.head.appendChild(manufactureCapScript());
}

/**
 * @param {HTMLFormElement} form the HTML form with the cap-widget
 * @returns {string | null} an item that can be sent in the body as 'cap-response'
 */
function extractCapResponseFromForm(form) {
  /**@type {string | null}*/
	let capResponse = null;
  let widget = form.querySelector('cap-widget');
  if (widget instanceof HTMLElement) {
    // 1. Dig into the widget to find the hidden input
    const hiddenInput = widget.querySelector('input[type="hidden"]')
      || (widget.shadowRoot && widget.shadowRoot.querySelector('input[type="hidden"]'));
    if (hiddenInput instanceof HTMLInputElement) {
      // 2. Grab the value (i hope lol)
      capResponse = (hiddenInput.value ? String(hiddenInput.value) : null);
    } else {
      // couldnt find hidden input. 
    }

    if (!capResponse) {
      //maybe the value is on the widget?
      capResponse = (widget.value ? String(widget.value) : null)
        || widget.getAttribute('token')
        || widget.getAttribute('value');
    }
  } else {

  }
  return capResponse;
}

/**@param {Event} ev 
 * @returns {string | null}
 */
function get_capWidget_from_event(ev) {
  /**@type {string|null} */
  let capResponse = null;
  if (ev.target instanceof HTMLFormElement) {
    capResponse = extractCapResponseFromForm(ev.target);
  }
  return capResponse;
}
