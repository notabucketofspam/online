import {createAppShell} from './app-shell';

function spawn_goobo() {
  const goobo_root = document.getElementById('goobo-root');
  if (goobo_root) {
    goobo_root.innerHTML = '';
    goobo_root.appendChild(createAppShell());
  }
}

document.addEventListener('spam', ev => {
	let cev = ev as CustomEvent;
	let the_url = cev?.detail?.url;
	if (typeof the_url === 'string' && the_url.startsWith('/api/goobo')) {
    spawn_goobo();
  }
});
spawn_goobo();
