let currentRecipientId = null;
const GIPHY_API_KEY = 'u8JVjqUKx81v8IODen6mNhLT5YS1MhwD';
// ────────────────────── DOM References ────────────────────
const pickerPanel = document.getElementById('picker-panel');
const emojiBtn = document.getElementById('emoji-btn');
const emojiContainer = document.getElementById('tab-emoji');
const chatInput = document.getElementById('message-input');
// ────────────────────── Emoji Picker Setup ────────────────────
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

        if (tab === 'gif') loadGifs('trending');
        if (tab === 'sticker') loadStickers();
    });
});
// ────────────────────── GIF Loader ────────────────────
async function loadGifs(query) {
    const endpoint = query === 'trending'
    ? `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=12`
    : `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&api_key=${GIPHY_API_KEY}&limit=12`;

    try {
        const res = await fetch(endpoint);
        const data = await res.json();
        const resultsDiv = document.getElementById('gif-results');
        resultsDiv.innerHTML = '';

        data.data.forEach(gif => {
            const url =gif.images.fixed_height_small.url;
            const img = document.createElement('img');
            img.src = url;
            img.className = 'gif-thumbnail';
            img.onclick = () => sendMediaMessage(url, 'image');
            resultsDiv.appendChild(img);
        });
    } catch (err) {
        console.error("GIF load failed:", err);
        document.getElementById('gif-results').innerHTML = '<p style="padding:10px;color:#999;font-size:13px;">Add your GIPHY API key to enable GIFs</p>';
    }
}

document.getElementById('gif-search').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length > 1) loadGifs(query);
    else loadGifs('trending');
});
// ────────────────────── Sticker Loader ────────────────────
async function loadStickers(query = '') {
    const resultsDiv = document.getElementById('sticker-results');
    if (resultsDiv.dataset.loaded === 'true' && !query) return;
    resultsDiv.innerHTML = '<p style="padding:10px;color:#999;font-size:13px;">Loading...</p>';

    const endpoint = query
        ? `https://api.giphy.com/v1/stickers/search?q=${encodeURIComponent(query)}&api_key=${GIPHY_API_KEY}&limit=12`
        : `https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_API_KEY}&limit=12`;

    try {
        const res = await fetch(endpoint);
        const data = await res.json();
        resultsDiv.innerHTML = '';
        resultsDiv.dataset.loaded = 'true';

        data.data.forEach(sticker => {
            const url = sticker.images.fixed_height_small.url;
            const img = document.createElement('img');
            img.src = url;
            img.className = 'sticker-thumbnail';
            img.onclick = () => sendMediaMessage(url, 'image');
            resultsDiv.appendChild(img);
        });
    } catch (err) {
        console.error("Sticker load failed:", err);
    }
}
// ────────────────────── Send Media (GIF/Sticker/Photo) ────────────────────
function sendMediaMessage(url, type) {
    if (!currentRecipientId) {
        alert("Select a user");
        return;
    }
    socket.emit('send_message', {
        'message': url,
        'recipient_id': currentRecipientId,
        'type': type
    });
    addMessageToScreen(url, 'sent', type);
    pickerPanel.style.display = 'none';
}
// ────────────────────── Select User & Load Chat History ────────────────────
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
// ────────────────────── Render Message on Screen ────────────────────
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
// ────────────────────── Message Type Detection ────────────────────
function getMessageType(content, messageType) {
    if (messageType === 'image') return 'image';
    if (content && content.startsWith('/static/uploads/')) return 'image';
    if (content && content.includes('giphy.com')) return 'image';
    return 'text';
}
// ────────────────────── Send Text Message ────────────────────
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
// ────────────────────── Socket & Event Listeners ────────────────────
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
});

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