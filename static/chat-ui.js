export let currentRecipientId = null;
let activeRecipientPresence = { is_online: false, last_seen: null };
let typingUsers = {};

// ────────────────────── Select User & Load Chat History ────────────────────
export async function selectUser(id, username, isOnline, lastSeen) {
    currentRecipientId = id;
    const isGroupChat = typeof id === 'string' && id.startsWith('group-');

    const presenceElement = document.getElementById('header-presence') || document.querySelector('.chat-details span');
    document.querySelector('.chat-details h3').innerText = username;

    if (isGroupChat) {
        activeRecipientPresence.is_online = false;
        activeRecipientPresence.last_seen = null;
        if (presenceElement) presenceElement.innerHTML = "Group Active Chat";
    } else {
        activeRecipientPresence.is_online = (isOnline === true || isOnline === 1 || isOnline === 'true');
        activeRecipientPresence.last_seen = lastSeen || null;
        renderHeaderPresence();
    }
    const container = document.querySelector('.message-container');
    container.innerHTML = '';
    console.log("Currently messaging target ID:", id);

    try {
        const fetchUrl = isGroupChat ? `/messages/group/${id.replace('group-', '')}` : `/messages/${id}`;
        const response = await fetch(fetchUrl);
        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
            const currentUserIdElement = document.getElementById('current-user-display') || document.querySelector('.user-profile span');
            const currentProfileName = currentUserIdElement ? currentUserIdElement.innerText.trim() : '';

            data.messages.forEach(msg => {
                let type = 'received';
                let contentDisplay = msg.content;
                if (msg.sender_username) {
                    if (msg.sender_username === currentProfileName) {
                        type = 'sent';
                    } else {
                        type = 'received';
                        contentDisplay = `<strong>${msg.sender_username}:</strong> ${msg.content}`;
                    }
                } else {
                    type = (msg.sender_id == id) ? 'received' : 'sent';
                }
                const msgType = getMessageType(contentDisplay, msg.message_type);
                addMessageToScreen(contentDisplay, type, msgType, msg.created_at, msg.status);
            });
        } else {
            container.innerHTML = '<p class="select-prompt">No messages yet. Say hi!</p>';
        }

        if (!isGroupChat) {
            await fetch(`/status/${id}`, { method: 'POST' });
            const chatItem = document.getElementById(`chat-item-${id}`);
            if (chatItem) chatItem.classList.remove('unread');
        }
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

export async function toggleMuteContact(event, contactId) {
    event.stopPropagation();
    document.getElementById(`menu-${contactId}`).classList.remove('open');

    try {
        const res = await fetch(`/mute_contact/${contactId}`, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            const item = document.getElementById(`chat-item-${contactId}`);
            const btn = document.querySelector(`#menu-${contactId} .mute-btn`);
            item.dataset.muted = data.muted;
            btn.textContent = data.muted ? '🔊 Unmute User' : '🔇 Mute User';
        }
    } catch (err) {
        console.error('Mute contact failed:', err);
    }
}

export async function toggleBlockContact(event, contactId) {
    event.stopPropagation();
    document.getElementById(`menu-${contactId}`).classList.remove('open');

    try {
        const res = await fetch(`/block_contact/${contactId}`, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            const item = document.getElementById(`chat-item-${contactId}`);
            const btn = document.querySelector(`#menu-${contactId} .block-btn`);
            item.classList.toggle('blocked-contact', data.blocked);
            btn.textContent = data.blocked ? '✅ Unblock User' : '🚫 Block User';
        }
    } catch (err) {
        console.error('Block contact failed:', err);
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
    div.id = `chat-item-${user.id}`;
    div.onclick = () => selectUser(user.id, user.username, user.is_online, user.last_seen);
    div.dataset.isOnline = user.is_online;
    div.dataset.lastSeen = user.last_seen || '';
    div.dataset.muted = user.muted || false;
    div.innerHTML = `
        <div class="avatar"></div>
        <div class="chat-info">
            <h4>${user.username}</h4>
        </div>
        <div class="chat-item-menu">
            <button class="menu-trigger" onclick="toggleMenu(event, ${user.id})">⋮</button>
            <div class="dropdown-menu" id="menu-${user.id}">
                <button onclick="deleteChat(event, ${user.id})">🗑️ Delete Chat</button>
                <button class="mute-btn" onclick="toggleMuteContact(event, ${user.id})">🔇 Mute User</button>
                <button class="block-btn" onclick="toggleBlockContact(event, ${user.id})">🚫 Block User</button>
                <button class="danger" onclick="deleteContact(event, ${user.id})">⛔ Delete Contact</button>
            </div>
        </div>
    `;
    chatList.appendChild(div);
}

function renderHeaderPresence() {
    let presenceElement = document.getElementById('header-presence');
    if(!presenceElement) {
        const chatDetails = document.querySelector('.chat-details');
        presenceElement = document.createElement('p');
        presenceElement.id = 'header-presence';
        presenceElement.style.fontSize = '12px';
        presenceElement.style.color = '#777';
        chatDetails.appendChild(presenceElement);
    }

    if (currentRecipientId && typingUsers[parseInt(currentRecipientId)]) {
        const typingName = typingUsers[parseInt(currentRecipientId)];
        presenceElement.innerHTML = `<em>${typingName} is typing...</em>`;
        presenceElement.style.color = '#2e7d32';
        return;
    }

    presenceElement.style.color = '#777';
    if (activeRecipientPresence.is_online) {
        presenceElement.innerHTML = "Online";
    } else if (activeRecipientPresence.last_seen) {
        presenceElement.innerHTML = `Last seen at ${activeRecipientPresence.last_seen}`;
    } else {
        presenceElement.innerHTML = "Offline";
    }
}

// ────────────────────── Dynamic Hook Exporter ────────────────────
export function handleTypingUI(data) {
    const typingId = parseInt(data.sender_id);

    if (data.is_typing) {
        typingUsers[typingId] = data.sender_username || "Someone";
    } else {
        delete typingUsers[typingId];
    }

    if (currentRecipientId == typingId) {
        renderHeaderPresence();
    }
}

export function updateUserPresenceUI(userId, isOnline, lastSeen) {
    const contactRow = document.getElementById(`chat-item-${userId}`);
    if (contactRow) {
        contactRow.dataset.isOnline = isOnline;
        contactRow.dataset.lastSeen = lastSeen || '';
        const usernameElement = contactRow.querySelector('h4');

        if (usernameElement) {
            const username = usernameElement.innerText.trim();
            contactRow.onclick = () => selectUser(userId, username, isOnline, lastSeen);
            const clickZone = contactRow.querySelector('.chat-item-click-zone');
            if (clickZone) {
                clickZone.onclick = (e) => {
                    e.stopPropagation();
                    selectUser(userId, username, isOnline, lastSeen);
                };
            }
        }
    }

    if (currentRecipientId == userId) {
        activeRecipientPresence.is_online = isOnline;
        activeRecipientPresence.last_seen = lastSeen;
        renderHeaderPresence();
    }
}

// ────────────────────── Profile Header Menu Handlers ────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (profileMenuBtn && profileDropdown) {
        profileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close active target contact row items if open
            document.querySelectorAll('.dropdown-menu.open').forEach(menu => {
                menu.classList.remove('open');
            });
            profileDropdown.classList.toggle('open');
        });
    }

    // Capture global clicks outside active context elements to dismiss components
    document.addEventListener('click', (e) => {
        if (profileDropdown && !profileDropdown.contains(e.target) && e.target !== profileMenuBtn) {
            profileDropdown.classList.remove('open');
        }
        
        // Also close message contact contextual lists safely
        if (!e.target.classList.contains('menu-trigger')) {
            document.querySelectorAll('.dropdown-menu.open').forEach(menu => {
                menu.classList.remove('open');
            });
        }
    });
});

// ────────────────────── Group Member Management ────────────────────
export async function manageGroupMemberPrompt(event, groupId, action) {
    event.stopPropagation();
    document.getElementById(`menu-group-${groupId}`).classList.remove('open');

    const promptMsg = action === 'add' 
        ? 'Enter the User ID of the contact you want to ADD to this group:' 
        : 'Enter the User ID of the member you want to KICK from this group:';
        
    const targetUserId = prompt(promptMsg);
    if (!targetUserId || isNaN(targetUserId)) {
        if (targetUserId) alert('Please provide a valid numeric User ID.');
        return;
    }

    try {
        const response = await fetch(`/groups/${groupId}/manage_member`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: action,
                user_id: parseInt(targetUserId)
            })
        });
        const data = await response.json();

        if (data.success) {
            alert(`Successfully execution complete: User was ${action === 'add' ? 'added to' : 'kicked from'} the group.`);
        } else {
            alert(`Operation failed: ${data.error || 'Unknown error occurred.'}`);
        }
    } catch (err) {
        console.error('Group member modification failed:', err);
        alert('Server network communication failure.');
    }
}

export async function deleteGroup(event, groupId) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-group-${groupId}`);
    if (menu) menu.classList.remove('open');
    if (!confirm('Are you sure you want to delete this group?')) return;
    try {
        const response = await fetch(`/groups/${groupId}/delete`, {
            method: 'POST' 
        });
        const data = await response.json();
        if (data.success) {
            if (typeof currentRecipientId !== 'undefined' && currentRecipientId === `group-${groupId}`) {
                const container = document.querySelector('.message-container');
                if (container) {
                    container.innerHTML = '<p class="select-prompt">Select a user to start chatting</p>';
                }
                currentRecipientId = null;
            }
            window.location.reload();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (err) {
        console.error('Delete group fetch request failed:', err);
    }
}
window.selectUser = selectUser;
window.toggleMenu = toggleMenu;
window.deleteChat = deleteChat;
window.deleteContact = deleteContact;
window.manageGroupMemberPrompt = manageGroupMemberPrompt;
window.deleteGroup = deleteGroup;