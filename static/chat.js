let currentRecipientId = null;

function selectUser(id, username) {
    currentRecipientId = id;
    document.querySelector('.chat-details h3').innerText = username;
    document.querySelector('.message-container').innerHTML = '';
    console.log("Currently messaging user ID:", id);
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