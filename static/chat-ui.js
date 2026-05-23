export let currentRecipientId = null;

// ────────────────────── Select User & Load Chat History ────────────────────
export async function selectUser(id, username) {
    currentRecipientId = id;
    document.querySelector('.chat-details h3').innerText = username;
    const container = document.querySelector('.message-container');
    container.innerHTML = '';
    console.log("Currently messaging user ID:", id);

    try {
        const response = await fetch(`/messages/${id}`);
        const data = await response.json();

        if (data.messages) {
            data.messages.forEach(msg => {
                const type = (msg.sender_id == id) ? 'received' : 'sent';
                const msgType = getMessageType(msg.content, msg.message_type);
                addMessageToScreen(msg.content, type, msgType);
            });
        }
    } catch (error) {
        console.error("Error fetching messages:", error);
    }
}

// ────────────────────── Render Message on Screen ────────────────────
export function addMessageToScreen(content, type, messageType = 'text') {
    const container = document.querySelector('.message-container');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;

    if (messageType === 'image') {
        msgDiv.innerHTML = `<img src="${content}" class="chat-image">`;
    } else {
        msgDiv.innerHTML = `<p>${content}</p>`;
    }

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// ────────────────────── Message Type Detection ────────────────────
export function getMessageType(content, messageType) {
    if (messageType === 'image') return 'image';
    if (content && content.startsWith('/static/uploads/')) return 'image';
    if (content && content.includes('giphy.com')) return 'image';
    return 'text';
}

// ────────────────────── Dropdown Menu ────────────────────
export function toggleMenu(event, userId) {
    event.stopPropagation();
    document.querySelectorAll('.dropdown-menu.open').forEach(menu => {
        if (menu.id !== `menu-${userId}`) menu.classList.remove('open');
    });
    document.getElementById(`menu-${userId}`).classList.toggle('open');
}

// ────────────────────── Dropdown Operation ────────────────────
export async function deleteChat(event, contactId) {
    event.stopPropagation();
    document.getElementById(`menu-${contactId}`).classList.remove('open');

    if (!confirm('Delete all messages with this contact?')) return;

    try {
        const res = await fetch(`/delete_chat/${contactId}`, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            if (currentRecipientId == contactId) {
                document.querySelector('.message-container').innerHTML = '<p class="select-prompt">Select a user to start chatting</p>';
                currentRecipientId = null;
                document.querySelector('.chat-details h3').innerHTML = 'Global Chat';
            }
        }
    } catch (err) {
        console.error('Delete chat failed:', err);
    }
}

export async function deleteContact(event, contactId) {
    event.stopPropagation();
    document.getElementById(`menu-${contactId}`).classList.remove('open');

    if (!confirm('⚠️ Permanently delete this contact and all their messages? This cannot be undone.')) return;

    try {
        const res = await fetch(`/delete_contact/${contactId}`, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            if (currentRecipientId == contactId) {
                document.querySelector('.message-container').innerHTML = '<p class="select-prompt">Select a user to start chatting</p>';
                currentRecipientId = null;
                document.querySelector('.chat-details h3').innerHTML = 'Global Chat';
            }
            const item = document.querySelector(`[id="menu-${contactId}"]`).closest('.chat-item');
            item.remove();
        }
    } catch (err) {
        console.error('Delete contact failed:', err);
    }
}

export function renderContactItem(user) {
    const chatList = document.querySelector('.chat-list');
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick = () => selectUser(user.id, user.username);
    div.innerHTML = `
        <div class="avatar"></div>
        <div class="chat-info">
            <h4>${user.username}</h4>
        </div>
        <div class="chat-item-menu">
            <button class="menu-trigger" onclick="toggleMenu(event, ${user.id})">⋮</button>
            <div class="dropdown-menu" id="menu-${user.id}">
                <button onclick="deleteChat(event, ${user.id})">🗑️ Delete Chat</button>
                <button class="danger" onclick="deleteContact(event, ${user.id})">⛔ Delete Contact</button>
            </div>
        </div>
    `;
    chatList.appendChild(div);
}

window.selectUser = selectUser;
window.toggleMenu = toggleMenu;
window.deleteChat = deleteChat;
window.deleteContact = deleteContact;