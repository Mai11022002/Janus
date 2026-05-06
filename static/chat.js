const socket = io();

document.getElementById('send-btn').onclick = () => {
    const input = document.querySelector('.chat-input input');
    const message = input.value;

    if (message) {
        socket.emit('send_message', {
            'message': message,
            'recipient_id': 1
        });
        input.value = '';
    }
};

socket.on('receive_message', (data) => {
    const container = document.querySelector('.message-container');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message received';
    msgDiv.innerHTML = `<p>${data.message}</p>`;
    container.appendChild(msgDiv);
});