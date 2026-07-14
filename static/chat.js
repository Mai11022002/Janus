import * as ui from './chat-ui.js';
import { initEmojiPicker, loadGifs, loadStickers } from './chat-media.js';
import { initContactPanel } from './chat-contacts.js';
import { initMessages, sendMediaMessage } from './chat-messages.js';
import { initWebRTC, startWebRTCCall } from './chat-rtc.js';

window.selectUser = ui.selectUser;
window.toggleMenu = ui.toggleMenu;
window.deleteChat = ui.deleteChat;
window.deleteContact = ui.deleteContact;
window.toggleBlockContact = ui.toggleBlockContact;
window.toggleMuteContact = ui.toggleMuteContact;

// ────────────────────── DOM References ────────────────────
const socket = io();
const emojiBtn = document.getElementById('emoji-btn');
const pickerPanel = document.getElementById('picker-panel');

initEmojiPicker();
initContactPanel();
initMessages(socket, pickerPanel);
initWebRTC(socket);

socket.on('user_status_change', (data) => {
    ui.updateUserPresenceUI(data.user_id, data.is_online, data.last_seen);
});

// ────────────────────── Load contacts ────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const userRes = await fetch('/api/current_user');
        const userData = await userRes.json();
        if (userData.username) {
            const userDisplay = document.getElementById('current-user-display');
            if (userDisplay) {
                userDisplay.textContent = userData.username;
            }
        }
    } catch (err) {
        console.error("Initialization failed:", err);
    }

    try {
        const contactsRes = await fetch('/api/contacts');
        const contactsData = await contactsRes.json();
        const chatList = document.querySelector('.chat-list');

        if (contactsData && contactsData.users && chatList) {
            chatList.innerHTML = '';
            contactsData.users.forEach(user => {
                ui.renderContactItem(user);
            });
        }
    } catch (err) {
        console.error("Initialization failed:", err);
    }
    const profileNewGroupBtn = document.getElementById('profile-new-group-btn');
    const groupModalOverlay = document.getElementById('group-modal-overlay');
    const closeGroupModalBtn = document.getElementById('close-group-modal-btn');
    const cancelGroupBtn = document.getElementById('cancel-group-btn');
    const submitGroupBtn = document.getElementById('submit-group-btn');
    const checklistContainer = document.getElementById('group-contacts-checklist');

    if (profileNewGroupBtn) {
        profileNewGroupBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            document.getElementById('profile-dropdown').classList.remove('open');

            try {
                checklistContainer.innerHTML = '';
                const contactItems = document.querySelectorAll('.chat-list .chat-item');

                if (contactItems.length > 0) {
                    contactItems.forEach(item => {
                        if (item.id.startsWith('chat-item-group-')) return;
                        const userId = item.id.replace('chat-item-', '');
                        const usernameElement = item.querySelector('.chat-info h4');
                        const username = usernameElement ? usernameElement.textContent.trim() : '';

                        if (userId && username) {
                            const label = document.createElement('label');
                            label.className = 'checklist-item';
                            label.innerHTML = `
                                <div class="checklist-item-info">
                                    <span>${username}</span>
                                </div>
                                <input type="checkbox" class="checklist-checkbox" value="${userId}">
                            `;
                            checklistContainer.appendChild(label);
                        }
                    });
                } 

                if (checklistContainer.children.length === 0) {
                    checklistContainer.innerHTML = '<p class="no-contacts-msg">No existing contacts available.</p>';
                }
                groupModalOverlay.classList.add('active');
            } catch (err) {
                console.error("Failed to load contacts for group creation:", err);
            }
        });
    }
    const closeGroupModal = () => {
        groupModalOverlay.classList.remove('active');
        document.getElementById('group-name-input').value = '';
        document.getElementById('group-creation-error').style.display = 'none';
    };
    if (closeGroupModalBtn) closeGroupModalBtn.addEventListener('click', closeGroupModal);
    if (cancelGroupBtn) cancelGroupBtn.addEventListener('click', closeGroupModal);
    if (submitGroupBtn) {
        submitGroupBtn.addEventListener('click', async () => {
            const groupName = document.getElementById('group-name-input').value.trim();
            const errorElement = document.getElementById('group-creation-error');

            if (!groupName) {
                errorElement.textContent = "Group name cannot be empty!";
                errorElement.style.display = "block";
                return;
            }
            const selectedCheckboxes = checklistContainer.querySelectorAll('.checklist-checkbox:checked');
            const memberIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));

            try {
                const response = await fetch('/groups/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: groupName, members: memberIds })
                });
                const result = await response.json();

                if (result.success) {
                    closeGroupModal();
                    window.location.reload();
                } else {
                    errorElement.textContent = result.error || "Failed to build group.";
                    errorElement.style.display = "block";
                }
            } catch (err) {
                errorElement.textContent = "Error during request.";
                errorElement.style.display = "block";
            }
        });
    }
});

document.addEventListener('mouseover', (e) => {
    const itemMenu = e.target.closest('.chat-item-menu');
    const openMenus = document.querySelectorAll('.dropdown-menu.open');   
    openMenus.forEach(menu => {
        if (!itemMenu || !itemMenu.contains(menu)) {
            menu.classList.remove('open');
        }
    });
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-trigger')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('open');
        });
    }
});

document.getElementById('settings-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('settings-dropdown').classList.toggle('open');
});

document.getElementById('accessibility-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('settings-dropdown').classList.remove('open');
    document.getElementById('accessibility-panel').classList.add('open');
});

document.getElementById('back-to-settings-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('accessibility-panel').classList.remove('open');
    document.getElementById('settings-dropdown').classList.add('open');
});

async function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
        await fetch('/update_theme', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme })
        });
    } catch (err) {
        console.error('Failed to save theme:', err);
    }
}

document.getElementById('theme-light-btn').addEventListener('click', () => setTheme('light'));
document.getElementById('theme-dark-btn').addEventListener('click', () => setTheme('dark'));

document.addEventListener('click', (e) => {
    if (!e.target.closest('.settings-menu-container')) {
        document.getElementById('settings-dropdown').classList.remove('open');
        document.getElementById('accessibility-panel').classList.remove('open');
    }
});

// ────────────────────── Picker Panel Toggle ────────────────────
emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    pickerPanel.style.display = pickerPanel.style.display === 'none' ? 'block' : 'none';
});

document.addEventListener('click', (e) => {
    if (!pickerPanel.contains(e.target) && e.target !== emojiBtn) {
        pickerPanel.style.display = 'none';
    }
});

// ────────────────────── Picker Panel Tab Switching ────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.tab;
        document.getElementById('tab-emoji').style.display = tab === 'emoji' ? 'block' : 'none';
        document.getElementById('tab-gif').style.display = tab === 'gif' ? 'block' : 'none';
        document.getElementById('tab-sticker').style.display = tab === 'sticker' ? 'block' : 'none';

        if (tab === 'gif') loadGifs('trending', sendMediaMessage);
        if (tab === 'sticker') loadStickers('', sendMediaMessage);
    });
});

document.getElementById('gif-search').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length > 1) loadGifs(query, sendMediaMessage);
    else loadGifs('trending', sendMediaMessage);
});

// ────────────────────── Call Button UI ────────────────────
const callBtn = document.getElementById('call-btn');
const callDropdown = document.getElementById('call-dropdown');

callBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callDropdown.classList.toggle('open');
});

document.addEventListener('click', () => {
    callDropdown.classList.remove('open');
});

window.startCall = function(type) {
    callDropdown.classList.remove('open');
    if (!ui.currentRecipientId) {
        alert('Select a contact first');
        return;
    }
    startWebRTCCall(type);
};