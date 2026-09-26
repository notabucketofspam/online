
// ---------------- some stuff about product keys
async function show_product_keys() {
	/**@type{HTMLTableSectionElement} */
	var teebod = document.querySelector('#the-box-with-product-keys tbody');
	teebod.replaceChildren();
	const res = await fetch('/api/pkey/list');
	if (res.ok) {
		const data = await res.json();
		for (const [key, name] of Object.entries(data.pkeys)) {
			var row = document.createElement('tr');
			var name_cell = document.createElement('td');
			name_cell.innerText = name;
			var key_cell = document.createElement('td');
			key_cell.innerText = key;
			var del_cell = document.createElement('td');
			var del_btn = document.createElement('button');
			del_btn.innerText = 'delete';
			del_btn.addEventListener('click', async function () {
				// if (confirm(`Are you sure you want to delete the product key "${name}"?`)) {
				if (true) {
					const res = await fetch('/api/pkey/delete', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ key })
					});
					if (res.ok) {
						alert_II('DELETE OK');
						show_product_keys();
					} else {
						alert_II('Failed to delete the product key.');
					}
				}
			});
			del_cell.appendChild(del_btn);
			row.appendChild(del_cell);
			row.appendChild(name_cell);
			row.appendChild(key_cell);
			teebod.appendChild(row);
		}
	}
}

/**
* @param {SubmitEvent} ev
*/
async function pleaseGenerateProductKey(ev) {
	ev.preventDefault();
	/**@type{HTMLInputElement} */
	var genpk_name = document.getElementById('genpk_name');
	if (genpk_name) {
		var keyname = genpk_name.value;
		if (!keyname) {
			// keyname = Math.random().toString(16);
		}
		const res = await fetch('/api/pkey/create', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ keyname })
		});
		if (res.ok) {
			const data = await res.json();
			// alert_II(`New product key generated:<br/>${data.key}`);
			show_product_keys();
		}

	}

	/**@type {HTMLFormElement}*/
	var genpk_form = document.getElementById('genpk_form');
	if (genpk_form) {
		genpk_form.reset();
	}
}
document.getElementById('genpk_form')?.addEventListener('submit', pleaseGenerateProductKey);

// ---- delete account ----
document.getElementById('delete_this')?.addEventListener('click', async function () {
	try {
		const response = await fetch('/api/users/delete');
		if (response.ok) {
			alert_II('ok');
			updateUiForUser(null);
			localStorage.removeItem("online_username");
		} else {
			alert_II('fail');
		}
	} catch (eeeee) {
		console.error(eeeee);
	}
});

var welcomeMessage = document.getElementById('welcome-message');
var logoutButton = document.getElementById('logout-button');
var authFormsContainer = document.getElementById('auth-forms-container');
var authStatusArea = document.getElementById('auth-status-area');

// --- Logout Handler ---
logoutButton?.addEventListener('click', async function () {
	try {
		const response = await fetch('/api/users/logout', { method: 'POST' });
		if (response.ok) {
			updateUiForUser(null);
			localStorage.removeItem("online_username");
		} else {
			alert_II('Logout failed.');
		}
	} catch (error) {
		console.error('Logout error:', error);
	}
});

// --- UI Update Function ---
function updateUiForUser(username) {
	if (username) {
		welcomeMessage.textContent = username;
		authStatusArea.removeAttribute("hidden");
		authFormsContainer.setAttribute("hidden", "");
	} else {
		authStatusArea.setAttribute("hidden", "")
		authFormsContainer.removeAttribute("hidden");
	}
}

// --- Check Login Status Endpoint Call ---
async function checkLoginStatus() {
	if (true) {
		try {
			const response = await fetch('/api/users/info', {
				method: 'GET',
				cache: "no-store"
			});

			if (response.ok) {
				// User is authenticated, retrieve username
				const data = await response.json();
				updateUiForUser(data.username);
				localStorage.setItem("online_username", data.username);
				await show_product_keys();
				var user_email_span = document.getElementById('user-email');
				var user_id_span = document.getElementById('user-id');
				if (user_email_span) user_email_span.textContent = data.email;
				if (user_id_span) user_id_span.textContent = data.userId;
			} else {
				// User is not authenticated (HTTP 401 or 404 from server)
				updateUiForUser(null);
			}
		} catch (error) {
			console.error('Status check error:', error);
			updateUiForUser(null);
		}
	}

}

// --- Form Handlers ---
document.getElementById('api_users_add')?.addEventListener('submit', async function (event) {
	event.preventDefault(); // Prevent the default form submission

	const email = document.querySelector('#api_users_add [name="email"]').value;
	//const username = document.querySelector('#api_users_add [name="username"]').value;
	//const password = document.querySelector('#api_users_add [name="password"]').value;

	try {
		/**@type {string|null} */
		let capResponse = get_capWidget_from_event(event);
		const response = await fetch('/api/users/ask-for-token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				email,
				'cap-response': capResponse
			})
		});

		if (response.ok) {
			alert_II('Ok, now check your email inbox.');
			document.getElementById('api_users_add').reset(); // Clear the form
		} else {
			const errorData = await response.json();
			alert_II('Signup failed: ' + (errorData.message || 'Unknown error'));
		}
	} catch (error) {
		console.error('Fetch error:', error);
		alert_II('Network error: Could not connect to the server.');
	}
});

// ------------ this is where we log into the system -------------------
document.getElementById('api_users_login')?.addEventListener('submit', async function (event) {
	event.preventDefault(); // Prevent the default form submission

	const email = document.querySelector('#api_users_login [name="email"]').value;
	const password = document.querySelector('#api_users_login [name="password"]').value;

	try {
		let capResponse = get_capWidget_from_event(event);
		const response = await fetch('/api/users/login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				email: email,
				password: password,
				'cap-response': capResponse
			})
		});

		if (response.ok) {
			//alert_II('Login successful!');
			document.getElementById('api_users_login').reset();
			checkLoginStatus(); // Update UI after successful login
		} else {
			const errorData = await response.json();
			alert_II('Login failed: ' + (errorData.message || 'Unknown error'));
		}
	} catch (error) {
		console.error('Fetch error:', error);
		alert_II('Network error: Could not connect to the server.');
	}
});

// --------------- this guy is for the password reset -----------------------
document.getElementById("ask_for_token")?.addEventListener("submit", async function (ev) {
	ev.preventDefault();

	const email = document.querySelector('#ask_for_token [name="email"]').value;

	try {
		let capResponse = get_capWidget_from_event(ev);
		const response = await fetch('/api/users/ask-for-token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: email,
				'cap-response': capResponse
			})
		});
		if (response.ok) {
			alert_II("Ok, now check your email inbox.");
			document.getElementById('ask_for_token').reset();
		} else {
			const errorData = await response.text();
			alert_II('fail: ' + (errorData || 'Unknown error'));
		}
	} catch (err) {
		console.error(err);
		alert_II("Error: " + err.message);
	}
});

// --- storage stuff

async function setStorage(stor) {
	try {
		const response = await fetch('/api/users/storage', {
			method: "POST",
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(stor)
		});
		const data = await response.json();
		return data;
	} catch (error) {
		console.error(error);
	}
}

async function getStorage() {
	try {
		const response = await fetch('api/users/storage');
		const data = await response.json();
		return data;
	} catch (error) {
		console.error(error);
	}
}

// Run this on page load
checkLoginStatus();

document.getElementById('this-is-the-leave-button')?.addEventListener('click', () => {
	//@ts-ignore
	goto_smart('/');
});

// ============================== captcha tomfoolery

setTimeout(function () {
	injectCapScript();
	[
		'api_users_add',
		'api_users_login',
		'ask_for_token',
	].forEach(insert_capWidget_here);
});
