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
                addMessageToScreen(msg.content, type, msgType, msg.created_at, msg.status);
            });
        }
        await fetch(`/status/${id}`, { method: 'POST' });
    } catch (error) {
        console.error("Error fetching messages:", error);
    }
}

// ────────────────────── Render Message on Screen ────────────────────
export function addMessageToScreen(content, type, messageType = 'text', timestamp = null, status = null) {
    const container = document.querySelector('.message-container');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;

    const now = timestamp ? new Date(timestamp) : new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let contentHTML = '';
    if (messageType === 'image') {
        contentHTML = `<img src="${content}" class="chat-image">`;
    } else {
        contentHTML = `<p>${content}</p>`;
    }

    const metaHTML = type === 'sent'
        ? `<span class="msg-meta"><span class="msg-time">${timeStr}</span><span class="msg-status">${getStatus(status || 'sent')}</span></span>`
        : `<span class="msg-meta"><span class="msg-time">${timeStr}</span></span>`;

    msgDiv.innerHTML = contentHTML + metaHTML;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return msgDiv;
}

// ────────────────────── Status Icons ────────────────────
export function getStatus(status) {
    const icons = {
        'sent': '<svg class="tree-icon" viewBox="0 0 20 20" title="Sent"><circle cx="10" cy="16" r="2" fill="#8B6914"/><line x1="10" y1="14" x2="10" y2="10" stroke="#8B6914" stroke-width="1.5"/><ellipse cx="10" cy="9" rx="3" ry="2.5" fill="#8B6914" opacity="0.4"/></svg>',
        'delivered': '<svg class="tree-icon" viewBox="0 0 20 20" title="Delivered"><rect x="9" y="14" width="2" height="4" fill="#5C4A1E"/><rect x="7" y="17" width="6" height="1.5" rx="0.75" fill="#5C4A1E"/><ellipse cx="10" cy="11" rx="4" ry="3" fill="#5C7A2E"/><ellipse cx="10" cy="8" rx="3" ry="2.5" fill="#4A6B24"/><ellipse cx="10" cy="5.5" rx="2" ry="2" fill="#3D5C1A"/></svg>',
        'read': '<svg class="tree-icon" viewBox="0 0 20 20" title="Read"><rect x="9" y="14" width="2" height="4" fill="#5C4A1E"/><rect x="7" y="17" width="6" height="1.5" rx="0.75" fill="#5C4A1E"/><ellipse cx="10" cy="11" rx="4" ry="3" fill="#5C7A2E"/><ellipse cx="10" cy="8" rx="3" ry="2.5" fill="#4A6B24"/><ellipse cx="10" cy="5.5" rx="2" ry="2" fill="#3D5C1A"/><circle cx="7" cy="9" r="1.2" fill="#E8A0B0"/><circle cx="13" cy="8" r="1" fill="#F4C2D0"/><circle cx="10" cy="6" r="1.2" fill="#E8A0B0"/><circle cx="8" cy="6.5" r="0.9" fill="#F4C2D0"/><circle cx="12" cy="10" r="1" fill="#F4C2D0"/></svg>'
    };
    return icons[status] || icons['sent'];
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