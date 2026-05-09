let currentRecipientId = null;
const emojiBtn = document.getElementById('emoji-btn');
const emojiContainer = document.getElementById('emoji-picker-container');

const picker = new EmojiMart.Picker({
    onEmojiSelect: (emoji) => {
        const input = document.getElementById('message-input');
        const pos = input.selectionStart;
        const before = input.value.substring(0, pos);
        const after = input.value.substring(pos);
        input.value = before + emoji.native + after;
        input.focus();
        input.selectionStart = input.selectionEnd = pos + emoji.native.length;
    }
});

emojiContainer.appendChild(picker);
emojiContainer.style.display = 'none';

emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = emojiContainer.style.display === 'none';
    emojiContainer.style.display = isHidden ? 'block' : 'none';
})

document.addEventListener('click', (e) => {
    if (!emojiContainer.contains(e.target) && e.target !== emojiBtn) {
        emojiContainer.style.display = 'none';
    }
})

async function selectUser(id, username) {
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

function addMessageToScreen(content, type, messageType = 'text') {
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

function getMessageType(content, messageType) {
    if (messageType === 'image') return 'image';
    if (content && content.startsWith('/static/uploads/')) return 'image';
    return 'text';
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();

    if (message && currentRecipientId) {
        socket.emit('send_message', {
            'message': message,
            'recipient_id': currentRecipientId,
            'type': 'text'
        });
        addMessageToScreen(message, 'sent', 'text');
        input.value = '';
    } else if (!currentRecipientId) {
        alert("Select a user to chat with");
    }
}

const socket = io();

document.getElementById('send-btn').onclick = sendMessage;

document.getElementById('photo-upload').addEventListener('change', async (e) => {
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
            socket.emit('send_message', {
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
})

const chatInput = document.getElementById('message-input');
chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});

socket.on('receive_message', (data) => {
    if (data.recipient_id == currentRecipientId || data.sender_id == currentRecipientId) {
        if (parseInt(data.sender_id) !== parseInt(currentRecipientId)) return;
        const msgType = getMessageType(data.message, data.type);
        addMessageToScreen(data.message, 'received', msgType);
    }
});