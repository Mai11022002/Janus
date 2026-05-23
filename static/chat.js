import * as ui from './chat-ui.js';
import { initEmojiPicker, loadGifs, loadStickers } from './chat-media.js';
import { initContactPanel } from './chat-contacts.js';
import { initMessages, sendMediaMessage } from './chat-messages.js';

window.selectUser = ui.selectUser;
window.toggleMenu = ui.toggleMenu;
window.deleteChat = ui.deleteChat;
window.deleteContact = ui.deleteContact;

// ────────────────────── DOM References ────────────────────
const socket = io();
const emojiBtn = document.getElementById('emoji-btn');
const pickerPanel = document.getElementById('picker-panel');

initEmojiPicker();
initContactPanel();
initMessages(socket, pickerPanel);

// ────────────────────── Load contacts ────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const userRes = await fetch('/api/current_user');
        const userData = await userRes.json();
        if (userData.username) {
            document.getElementById('current-user-display').textContent = userData.username;
        }

        const contactsRes = await fetch('/api/contacts');
        const contactsData = await contactsRes.json();
        const chatList = document.querySelector('.chat-list');
        chatList.innerHTML = '';

        if (contactsData.users) {
            contactsData.users.forEach(user => {
                ui.renderContactItem(user);
            });
        }
    } catch (err) {
        console.error("Initialization failed:", err);
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