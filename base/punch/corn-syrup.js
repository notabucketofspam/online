var please_use_relay = document.getElementById("please_use_relay");
please_use_relay.addEventListener('change', function(ev) {
  const all_viaIPv6 = Array.from(document.getElementsByClassName('viaIPv6'));
  if (ev.target.checked) {
    all_viaIPv6.forEach(button => {
      button.setAttribute('disabled', '');
    });
  } else {
    all_viaIPv6.forEach(button => {
      button.removeAttribute('disabled');
    });
  }
});

var macuser = document.createElement('AUDIO');
macuser.setAttribute('src', '/page/soundboard/opodes/GordonMahUng/fuck%20you%20Steve%20Jobs.opus');
macuser.volume = 0.5;
//document.appendChild(macuser);
var how_does_it_work = document.getElementById('how_does_it_work');
how_does_it_work.volume = 0.2;

/**@param {PointerEvent}ev*/
function showSoftwareDownloads(ev) {
  Array.from(document.getElementsByClassName('choose-os')).forEach(item => {
    item.classList.remove('active');
  });
  ev.target.classList.add('active');
  document.getElementById('software-download-windows').setAttribute('hidden', "");
  document.getElementById('software-download-linux').setAttribute('hidden', "");
  document.getElementById('software-download-macos').setAttribute('hidden', "");
  /**@type string*/
  const operatingsystem = ev.target.dataset['operatingsystem'] ?? 'windows';
  document.getElementById(`software-download-${operatingsystem}`).removeAttribute('hidden');
  sessionStorage.setItem("software-download", operatingsystem);
}

Array.from(document.getElementsByClassName('choose-os')).forEach(item => {
  item.addEventListener('click', showSoftwareDownloads);
});
setTimeout(function() {
  let operatingsystem = sessionStorage.getItem('software-download');
  if (!operatingsystem) {
    const platty = window.navigator.platform.toLowerCase();
    if (platty.includes('mac')) {
      operatingsystem = 'macos';
    } else if (platty.includes('linux')) {
      operatingsystem = 'linux';
    } else {
      operatingsystem = 'windows';
    }
    sessionStorage.setItem('software-download', operatingsystem);
  }
  document.getElementById(`software-download-${operatingsystem}`)?.removeAttribute('hidden');
  document.getElementById(`choose-${operatingsystem}`)?.classList.add('active');
});

check_online(async (jazz) => {
  var logged_in_as = document.getElementById("logged_in_as");
  if (jazz.username) {
    logged_in_as.innerHTML = `Logged in as <div><b>${jazz.username}</b><div>`;
    await showTrusts();
  } else {
    document.getElementById("trust_stuff").setAttribute("hidden", '');
  }
});

// =================================
// HARVEY DENT CAN WE TRUST HIM?

var trusts = [];

/**
  who do you trust?
*/
async function showTrusts() {
  const trusted_users = document.getElementById('trusted_users');
  const the_store = await get_storage();
  trusts = the_store['storage']['trusts'] || [''];
  const insertable = trusts.map(write_trustee).join('');
  trusted_users.insertAdjacentHTML('beforeend', insertable);
}

function write_trustee(name) {
  return `<li id="trust_${name}"><button onclick="untrust('${name}')"><b>&#x1F5D1;&#xFE0F;</b></button> <span>${name}</span></li>`
}

var form_addTrust = document.getElementById("form_addTrust");
form_addTrust.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const input = document.querySelector('#form_addTrust input[name="trustee"]');
  const trustee = input.value;
  if (!trusts.includes(trustee)) {
    trusts.push(trustee);
    const trusted_users = document.getElementById('trusted_users');
    trusted_users.insertAdjacentHTML('beforeend', write_trustee(trustee));
    await post_storage({trusts});
    alert_II("I'm glad you have people in your life you can trust.");
  } else {
    alert_II("You can't double-trust someone.");
  }
  form_addTrust.reset();
});

async function untrust(name) {
  var thatsHimOfficer = document.getElementById(`trust_${name}`);
  thatsHimOfficer.remove();
  trusts = trusts.filter((x) => x !== name);
  await post_storage({trusts});
  alert_II(`<span style="white-space:nowrap;">It's a shame things didn't work out between you two.</span>`);
}

// ==================================
// all of this stuff below is what actually does punch

var useLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '';

async function actual_init() {
  await writeIpAddr();
  await getPunchList();
}
actual_init();

var addr_v4 = '';
var addr_v6 = '';

/**
Display the IP address of the user
*/
async function writeIpAddr() {
  if (useLocalhost) {
    // we are at home, feeling cozy
    var addr_real = (await (await fetch("/ip", {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors'
    })).text());
    var which_fam = 4;
    if (addr_real.includes(':')) {
      which_fam = 6;
    }
    window[`addr_v${which_fam}`] = addr_real;
    var your_ipvx = document.getElementById(`your_ipv${which_fam}`);
    your_ipvx.innerText = addr_real;
  } else {
    // we are surfing the world wide web

    // record your ipv4
    var your_ipv4 = document.getElementById("your_ipv4");
    try {
      window.addr_v4 = (await (await fetch(`https://4.${window.location.hostname}`, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors'
      })).text());
      your_ipv4.innerText = window.addr_v4;
    } catch (err) {
      your_ipv4.innerHTML = "<em>nothing</em>";
    }

    // and now your ipv6
    var your_ipv6 = document.getElementById("your_ipv6");
    try {
      window.addr_v6 = (await (await fetch(`https://6.${window.location.hostname}`, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors'
      })).text());
      your_ipv6.innerText = window.addr_v6;
    } catch (err) {
      your_ipv6.innerHTML = "<em>nothing</em>";
    }
  }
}

/**
@typedef Punch
  @prop {string} addr the IP address for someone
  @prop {number} port this is the port for the service that client wants to advertise (ex: 2302)
  @prop {string} serviceName this is the name of the server, for display purposes
  @prop {string} username Who posted this?
  @prop {boolean=} useRelay the WSBC UDP relay
  @prop {string} sku sha256 to identify a service
*/

/**
Get the punch list
*/
async function getPunchList() {
  const plist = document.getElementById("plist");
  const res = await fetch('/api/punch/list', {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store'
  });
  if (res.ok) {
    /** @type Punch[] */
    let all_services = await res.json();
    //cog(all_services);

    // actually putting pen to paper here
    if (all_services.length === 0) {
      plist.innerHTML = '<li>sorry nothing</li>';
    } else {
      var services_html = all_services.forEach(punch => {
        var insert_me = makeServiceListing(punch);
        plist.insertAdjacentHTML('beforeend', insert_me);
      });
      // plist.innerHTML = services_html;
      setTimeout(function() {
        var buttons = document.getElementsByClassName('let_me_connect');
        Array.from(buttons).forEach(function(button) {
          button.addEventListener('click', do_connect);
        });
      });
    }

  } else {
    // res is *not* ok
    plist.innerHTML = await res.text();
  }
}

/**
 * @param {PointerEvent } ev
 */
async function do_connect(ev) {
  /**@type HTMLButtonElement*/
  var button = ev.target;
  // console.log(button.dataset);
  button.setAttribute('disabled', '');
  /**@type Punch*/
  var punch = {
    addr: button.dataset.addr,
    port: Number(button.dataset.port),
    serviceName: button.dataset.serviceName,
    username: button.dataset.username,
    sku: button.dataset.sku
  };
  await pleaseLetMeJoin(punch);
  const oldInnerHtml = button.innerHTML;
  button.innerHTML = `Attempting to connect...`;
  setTimeout(function() {
    button.innerHTML = oldInnerHtml;
    button.removeAttribute('disabled');
  }, 9000);
}

/**@param {string} addr
 * @returns {number}
 */
function toFam(addr) {
  return addr.includes(':') ? 6 : addr.includes('.') ? 4 : 9;
}

/**@param {Punch} punch
 * @returns {string}
*/
function makeConnectButton(punch) {
  let tofu = toFam(punch.addr);
  var button_html = `
      <button class="let_me_connect viaIPv${tofu}" style="grid-area:v${tofu}"
      data-addr="${punch.addr}"
      data-port="${punch.port}"
      data-service-name="${punch.serviceName}"
      data-username="${punch.username}"
      data-sku="${punch.sku}"
      ${window[`addr_v${tofu}`] ? '' : 'hidden'}
      >Connect via IPv${tofu}</button>
      `;
  return button_html;
}

/**
 * @param {Punch} punch
 * @returns {string}
*/
function makeServiceListing(punch) {
  var service_proto = {
    port: punch.port,
    serviceName: punch.serviceName,
    username: punch.username
  };
  var sp_tag = encodeURIComponent(JSON.stringify(service_proto));

  var service = ``;
  var some_button = makeConnectButton(punch);
  var already_here = document.getElementById(sp_tag);
  if (already_here) {
    already_here.querySelector('div.some_buttons').insertAdjacentHTML('beforeend', some_button);

  } else {
    service = `
    <li class="service" id="${sp_tag}">
      <ul>
        <li hidden>Port: ${punch.port}</li>
        <li>ServiceName: ${punch.serviceName}</li>
        <li>username: ${punch.username}</li>
      </ul>
      <div class="some_buttons">
      ${some_button}
      </div>
    </li>
    `;
  }
  return service;
}

var httpd_port = 39648;
/**
*@param {Punch} punch
*@returns {Promise<void>}
*/
async function pleaseLetMeJoin(punch) {
  try {
    var contentType = 'application/json';
    // var fetch_url = '/api/punch/join';
    var fetch_url = `http://127.0.0.1:${httpd_port}/join`;

    let useRelay = document.getElementById("please_use_relay")?.checked ?? false;
    if (useRelay) {
      punch['useRelay'] = useRelay;
    }

    const res = await fetch(fetch_url, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      headers: {'Content-Type': contentType},
      targetAddressSpace: 'loopback',
      body: JSON.stringify(punch)
    });
    if (res.status === 306) {
      alert_II('problem');
    } else if (res.ok) {
      const resdat = await res.json();
      console.log(resdat);
      alert_II('Now connecting...<br/>Check OPM console window for details.');
      setTimeout(function() {
        let dog_maybe = document.querySelector('dialog.alert_II');
        if (dog_maybe.open) {
          dog_maybe.close();
        }
      }, 9000);
    } else {
      let restext = await res.text();
      console.log(restext);
      let real_text = restext;
      try {
        let real_json = JSON.parse(restext);
        real_text = real_json?.msg;
      } catch (err) {}
      alert_II(`Problem:<br/>${real_text}`);
    }
  } catch (errr) {
    console.log(errr);
    if (errr.name === 'TypeError') {
      alert_II('Problem:<br/>OPM is (probably) not running.');
    } else {
      alert_II(`Problem:<br/>${errr.message}`);
    }
  }
}

