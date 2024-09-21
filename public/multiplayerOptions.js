const socket = io();

function createRoom() {
    const roomId = Math.random().toString(36).substr(2, 6);
    socket.emit('createRoom', roomId);

    window.location.href = "/game.html?room=" + roomId;
}

function joinRoom(roomId = null) {
    if (!roomId) {
        roomId = document.getElementById('roomId').value.trim();
    }

    if (roomId) {
        window.location.href = "/game.html?room=" + roomId;
    } else {
        alert("Please enter a valid Room ID.");
    }
}

socket.on('chatHistory', (history) => {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = ''; 

    history.forEach(({ username, message }) => {
        const messageElement = document.createElement('div');
        messageElement.textContent = `${username}: ${message}`;
        chatMessages.appendChild(messageElement);
    });
});

socket.on('roomDetails', (data) => {
    const roomDetailsDiv = document.getElementById('room-details');
    roomDetailsDiv.innerHTML = `<p>Room ID: ${data.roomId} | Players: ${data.players}</p>`;
});

socket.on('roomList', (rooms) => {
    const roomListDiv = document.getElementById('room-list');
    roomListDiv.innerHTML = ''; 

    if (rooms.length === 0) {
        roomListDiv.innerHTML = '<p>No rooms available.</p>';
    } else {
        rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.innerHTML = `
                Room ID: ${room.roomId} | Players: ${room.players} 
                <button onclick="joinRoom('${room.roomId}')">Join</button>
            `;
            roomListDiv.appendChild(roomElement);
        });
    }
});

window.addEventListener('focus', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (roomId) {
        socket.emit('reconnectToRoom', roomId);
    }
});
