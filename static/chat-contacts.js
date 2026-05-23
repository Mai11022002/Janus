import { renderContactItem } from './chat-ui.js';

// ────────────────────── Init ────────────────────
export function initContactPanel() {
    document.getElementById('new-contact-btn').addEventListener('click', openContactPanel);
    document.getElementById('close-contact-btn').addEventListener('click', closeContactPanel);
    document.getElementById('add-contact-btn').addEventListener('click', handleAddContact);
}

// ────────────────────── Open Panel ────────────────────────
function openContactPanel() {
    document.getElementById('new-contact-panel').style.display = 'flex';
}

// ────────────────────── Close Panel ────────────────────────
function closeContactPanel() {
    document.getElementById('new-contact-panel').style.display = 'none';
    document.getElementById('contact-phone').value = '';
    document.getElementById('contact-error').style.display = 'none';
    document.getElementById('contact-success').style.display = 'none';
}

// ────────────────────── Add Contact ────────────────────────
async function handleAddContact() {
    const firstName = document.getElementById('contact-firstname').value.trim();
    const lastName = document.getElementById('contact-lastname').value.trim();
    const phone = document.getElementById('contact-phone').value.trim();
    const errorCT = document.getElementById('contact-error');
    const successCT = document.getElementById('contact-success');

    if (!phone) {
        errorCT.textContent = 'Phone number is required';
        errorCT.style.display = 'block';
        return;
    }

    if(!firstName && !lastName) {
        errorCT.textContent = 'At least a first or last name is required';
        errorCT.style.display = 'block';
        return;
    }

    const formData = new FormData();
    formData.append('first_name', firstName);
    formData.append('last_name', lastName);
    formData.append('phone', phone);

    try {
        const res = await fetch('/add_contact', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.error) {
            errorCT.textContent = data.error;
            errorCT.style.display = 'block';
            successCT.style.display = 'none';
        } else {
            errorCT.style.display = 'none';

            const displayFirstName = data.user.first_name || '';
            const displayLastName = data.user.last_name || '';
            const fullName = [displayLastName, displayFirstName].filter(Boolean).join(' ');

            successCT.textContent = `✅ ${fullName || data.user.username} added!`;
            successCT.style.display = 'block';

            document.getElementById('contact-firstname').value = '';
            document.getElementById('contact-lastname').value = '';
            document.getElementById('contact-phone').value = '';
            renderContactItem(data.user);
        }
    } catch (err) {
        errorCT.textContent = 'Something went wrong';
        errorCT.style.display = 'block';
    }
}