import { addMessageToScreen, getMessageType, currentRecipientId } from './chat-ui.js';

let _socket = null;
let _pickerPanel = null;

// ────────────────────── Init ────────────────────
export function initMessages(socket, pickerPanel) {
    _socket = socket;
    _pickerPanel = pickerPanel;

    document.getElementById('send-btn').onclick = sendMessage;

    document.getElementById('message-input').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });
    document.getElementById('photo-upload').addEventListener('change', handlePhotoUpload);
    _socket.on('receive_message', handleReceiveMessage);
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
        addMessageToScreen(message, 'sent', 'text');
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
    addMessageToScreen(url, 'sent', type);
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
            addMessageToScreen(data.url, 'sent', 'image');
        }
    } catch (err) {
        console.error("Upload failed:", err);
    }
    e.target.value = '';
}

// ────────────────────── Receive Message ────────────────────
function handleReceiveMessage(data) {
    if (data.recipient_id == currentRecipientId || data.sender_id == currentRecipientId) {
        if (parseInt(data.sender_id) !== parseInt(currentRecipientId)) return;
        const msgType = getMessageType(data.message, data.type);
        addMessageToScreen(data.message, 'received', msgType);
    }
}