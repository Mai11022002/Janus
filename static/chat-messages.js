import { addMessageToScreen, getMessageType, currentRecipientId } from './chat-ui.js';

let _socket = null;
let _pickerPanel = null;
let typingTimeout = null;
let isCurrentlyTyping = false;
let battleHorn = null;

// ────────────────────── Init ────────────────────
export function initMessages(socket, pickerPanel) {
    _socket = socket;
    _pickerPanel = pickerPanel;

    battleHorn = new Audio('/static/uploads/roman-horn.mp3');
    battleHorn.load();

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    document.getElementById('send-btn').onclick = sendMessage;

    const messageInput = document.getElementById('message-input');

    messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });

    // Debounced Typing Indicator Listener
    messageInput.addEventListener('input', () => {
        if (!currentRecipientId) return;

        if (!isCurrentlyTyping) {
            isCurrentlyTyping = true;
            _socket.emit('typing_status', { 'recipient_id': currentRecipientId, 'is_typing': true });
        }

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            isCurrentlyTyping = false;
            _socket.emit('typing_status', { 'recipient_id': currentRecipientId, 'is_typing': false });
        }, 1500);
    });

    document.getElementById('photo-upload').addEventListener('change', handlePhotoUpload);
    _socket.on('receive_message', handleReceiveMessage);

    _socket.on('message_blocked', (data) => {
        if (data.reason === 'you_blocked_them') {
            alert("You've blocked this user. Unblock them to send messages.");
        } else if (data.reason === 'blocked_contact_attempted') {
            alert("A contact you blocked just tried to message you.");
        }
    });

    // Listen for typing updates from backend
    _socket.on('display_typing', (data) => {
        import('./chat-ui.js').then(ui => ui.handleTypingUI(data));
    });
}

// ────────────────────── Send Text Message ────────────────────
export function sendMessage() {
    const chatInput = document.getElementById('message-input');
    const message = chatInput.value.trim();

    if (message && currentRecipientId) {
        _socket.emit('send_message', {
            'message': message,
            'recipient_id': currentRecipientId,
            'type': 'text'
        });
        addMessageToScreen(message, 'sent', 'text', null, 'sent');
        chatInput.value = '';
    } else if (!currentRecipientId) {
        alert("Select a user to chat with");
    }
}

// ────────────────────── Send Media (GIF/Sticker/Photo) ────────────────────
export function sendMediaMessage(url, type) {
    if (!currentRecipientId) {
        alert("Select a user");
        return;
    }
    _socket.emit('send_message', {
        'message': url,
        'recipient_id': currentRecipientId,
        'type': type
    });
    addMessageToScreen(url, 'sent', type, null, 'sent');
    _pickerPanel.style.display = 'none';
}

// ────────────────────── Document Media Uploads ────────────────────
async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file || !currentRecipientId) {
        alert("Select a user first");
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.url) {
            _socket.emit('send_message', {
                'message': data.url,
                'recipient_id': currentRecipientId,
                'type': 'image'
            });
            addMessageToScreen(data.url, 'sent', 'image', null, 'sent');
        }
    } catch (err) {
        console.error("Upload failed:", err);
    }
    e.target.value = '';
}

// ────────────────────── Receive Message ────────────────────
function handleReceiveMessage(data) {
    const isGroupMsg = data.is_group || (typeof data.recipient_id === 'string' && data.recipient_id.startsWith('group-'));
    const userDisplayEl = document.getElementById('current-user-display') || document.querySelector('.user-profile span') || document.querySelector('.profile-nav h3');
    const currentProfileName = userDisplayEl ? userDisplayEl.textContent.trim() : '';

    if (isGroupMsg) {
        if (data.recipient_id == currentRecipientId) {
            const isMe = (data.sender_username === currentProfileName);
            if (isMe) return;
            const msgType = getMessageType(data.message, data.type);
            const contentDisplay = `<strong>${data.sender_username}:</strong> ${data.message}`;
            addMessageToScreen(contentDisplay, 'received', msgType, null, null);
        }
    } else {
        if (data.recipient_id == currentRecipientId || data.sender_id == currentRecipientId) {
            if (data.sender_username === currentProfileName) return;
            if (parseInt(data.sender_id) !== parseInt(currentRecipientId) && parseInt(data.recipient_id) !== parseInt(currentRecipientId)) return;
            const msgType = getMessageType(data.message, data.type);
            addMessageToScreen(data.message, 'received', msgType, null, null);
        }
    }

    // Trigger Native HTML5 Web Notification if browser tab is backgrounded
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        if (battleHorn) {
            battleHorn.currentTime = 0;
            battleHorn.play().catch(err => console.log("Browser blocked sound audio track playback:", err));
        }

        const notificationTitle = isGroupMsg ? `Group update in room` : `New message from ${data.sender_username}`;
        new Notification(notificationTitle, {
            body: data.type === 'text' ? data.message : 'Sent an attachment',
            icon: '/static/uploads/roman-flag.png',
            silent: true
        });
    }
}