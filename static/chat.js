let currentRecipientId = null;

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
                addMessageToScreen(msg.content, type);
            });
        }
    } catch (error) {
        console.error("Error fetching messages:", error);
    }
}

function addMessageToScreen(content, type) {
    const container = document.querySelector('.message-container');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.innerHTML = `<p>${content}</p>`;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

const socket = io();

document.getElementById('send-btn').onclick = () => {
    const input = document.querySelector('.chat-input input');
    const message = input.value;

    if (message && currentRecipientId) {
        socket.emit('send_message', {
            'message': message,
            'recipient_id': currentRecipientId
        });
        addMessageToScreen(message, 'sent');
        input.value = '';
    } else if (!currentRecipientId) {
        alert("Select a user to chat with");
    }
};


socket.on('receive_message', (data) => {
    const container = document.querySelector('.message-container');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message received';
    msgDiv.innerHTML = `<p>${data.message}</p>`;
    container.appendChild(msgDiv);
});