import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const app = express();
const server = createServer(app);
const io = new Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
const chatHistory = {};
const reconnectionTimeouts = {};

function emitRoomList() {
    io.emit('roomList', Object.keys(rooms).map(roomId => ({
        roomId,
        players: rooms[roomId].players
    })));
}

function initializeBoard() {
    let newBoard = Array(8).fill().map(() => Array(8).fill(null));
    for (let col = 0; col < 8; col++) {
        newBoard[7][col] = { color: 'w', x: col, y: 7 };
        newBoard[0][col] = { color: 'b', x: col, y: 0 };
    }
    return newBoard;
}

function saveGameData(roomId, winner) {
    const room = rooms[roomId];
    if (!room || !room.gameState) {
        return;
    }

    const gameData = {
        whitePlayer: room.whiteSeat ? room.whiteSeat.username : 'Unknown',
        blackPlayer: room.blackSeat ? room.blackSeat.username : 'Unknown',
        winner: winner,
        date: new Date().toISOString(),
        moveHistory: room.gameState.moveHistory,
        duration: Date.now() - room.gameState.startTime,
    };

    const historyFilePath = path.join(__dirname, 'gameHistory.json');
    let gameHistory = [];

    try {
        if (fs.existsSync(historyFilePath)) {
            const data = fs.readFileSync(historyFilePath);
            gameHistory = JSON.parse(data);
        }
    } catch (err) {
        console.error('Error reading game history file:', err);
    }

    gameHistory.push(gameData);

    try {
        fs.writeFileSync(historyFilePath, JSON.stringify(gameHistory, null, 2));
        console.log('Game data saved successfully');
    } catch (err) {
        console.error('Error writing game history file:', err);
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    let currentRoom = null;
    emitRoomList();

    socket.on('createRoom', (roomId) => {
        socket.join(roomId);
        currentRoom = roomId;
        rooms[roomId] = rooms[roomId] || { players: 0, whiteSeat: null, blackSeat: null };
        rooms[roomId].players += 1;
        chatHistory[roomId] = chatHistory[roomId] || [];
        emitRoomList();
        console.log(`Room ${roomId} created with ${rooms[roomId].players} player(s).`);
    });

    socket.on('joinRoom', (data) => {
        const { roomId, username } = data;
        socket.username = username || 'Unknown User';
        rooms[roomId] = rooms[roomId] || { players: 0, whiteSeat: null, blackSeat: null };
        socket.join(roomId);
        currentRoom = roomId;
        rooms[roomId].players += 1;
        chatHistory[roomId] = chatHistory[roomId] || [];
        socket.emit('chatHistory', chatHistory[roomId]);
        const room = rooms[roomId];
        socket.emit('seatUpdate', { whiteSeat: room.whiteSeat, blackSeat: room.blackSeat });
    
        io.to(roomId).emit('chat', { username: 'System', message: `${socket.username} has joined the room.`, type: 'system' });
    
        if (room.gameState && room.gameState.isGameStarted) {
            socket.emit('gameStarted', room.gameState);
        }
        emitRoomList();
        console.log(`User ${socket.username} joined room ${roomId}. Now it has ${rooms[roomId].players} player(s).`);
    });

    socket.on('requestSeatUpdate', (data) => {
        const { roomId } = data;
        const room = rooms[roomId];
        if (room) {
            socket.emit('seatUpdate', { whiteSeat: room.whiteSeat, blackSeat: room.blackSeat });
        }
    });

    socket.on('chat', (data) => {
        const { roomId, message, username } = data;
        console.log('Received message:', { roomId, username, message });
        if (chatHistory[roomId]) {
            chatHistory[roomId].push({ username, message });
        }
        io.to(roomId).emit('chat', { username, message });
    });

    socket.on('move', (data) => {
        const room = rooms[currentRoom];
        if (!room) return;
        room.gameState = {
            board: data.board,
            currentTurn: data.currentTurn,
            moveHistory: data.moveHistory,
            currentMoveIndex: data.currentMoveIndex,
            whiteTime: data.whiteTime,
            blackTime: data.blackTime,
            totalTime: data.totalTime,
            isGameStarted: true,
            startTime: room.gameState.startTime,
        };
        io.to(currentRoom).emit('move', data);
    });

    socket.on('chooseSeat', (data) => {
        const { roomId, color, username } = data;
        const room = rooms[roomId];
        if (!room) return;
        if (color === 'w') {
            if (room.whiteSeat) {
                socket.emit('error', { message: 'White seat is already occupied' });
                return;
            } else {
                room.whiteSeat = { socketId: socket.id, username };
            }
        } else if (color === 'b') {
            if (room.blackSeat) {
                socket.emit('error', { message: 'Black seat is already occupied' });
                return;
            } else {
                room.blackSeat = { socketId: socket.id, username };
            }
        }
        io.to(roomId).emit('seatUpdate', { whiteSeat: room.whiteSeat, blackSeat: room.blackSeat });
    });

    socket.on('standUp', (data) => {
        const { roomId } = data;
        const room = rooms[roomId];
        if (!room) return;
        if (room.whiteSeat && room.whiteSeat.socketId === socket.id) {
            room.whiteSeat = null;
        }
        if (room.blackSeat && room.blackSeat.socketId === socket.id) {
            room.blackSeat = null;
        }
        io.to(roomId).emit('seatUpdate', { whiteSeat: room.whiteSeat, blackSeat: room.blackSeat });
    });

    socket.on('playerAFK', (data) => {
        const { roomId } = data;
        const room = rooms[roomId];
        if (!room) return;
        let playerColor = null;
        if (room.whiteSeat && room.whiteSeat.socketId === socket.id) {
            room.whiteSeat.isAfk = true;
            playerColor = 'w';
        }
        if (room.blackSeat && room.blackSeat.socketId === socket.id) {
            room.blackSeat.isAfk = true;
            playerColor = 'b';
        }
        io.to(roomId).emit('seatUpdate', { whiteSeat: room.whiteSeat, blackSeat: room.blackSeat });
        if (room.gameState && room.gameState.isGameStarted && !room.gameState.isGameOver && playerColor) {
            let winner = playerColor === 'w' ? 'b' : 'w';
            io.to(roomId).emit('gameOver', { winner });
            room.gameState.isGameOver = true;
            saveGameData(roomId, winner);
        }
    });
    
    socket.on('playerActive', (data) => {
        const { roomId } = data;
        const room = rooms[roomId];
        if (!room) return;
        if (room.whiteSeat && room.whiteSeat.socketId === socket.id) {
            room.whiteSeat.isAfk = false;
        }
        if (room.blackSeat && room.blackSeat.socketId === socket.id) {
            room.blackSeat.isAfk = false;
        }
        io.to(roomId).emit('seatUpdate', { whiteSeat: room.whiteSeat, blackSeat: room.blackSeat });
    });

    socket.on('startGame', (data) => {
        const { roomId } = data;
        const room = rooms[roomId];
        if (!room) return;
        if ((room.whiteSeat && room.whiteSeat.socketId === socket.id) || (room.blackSeat && room.blackSeat.socketId === socket.id)) {
            if (room.whiteSeat && room.blackSeat) {
                room.gameState = {
                    isGameStarted: true,
                    isGameOver: false,
                    board: initializeBoard(),
                    currentTurn: 'w',
                    moveHistory: [],
                    currentMoveIndex: -1,
                    startTime: Date.now(),
                };
                io.to(roomId).emit('gameStarted', room.gameState);
                io.to(roomId).emit('chat', { username: 'System', message: 'The game has started!', type: 'system' });
            } else {
                socket.emit('error', { message: 'Cannot start game, both seats are not occupied' });
            }
        } else {
            socket.emit('error', { message: 'Only seated players can start the game' });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (currentRoom && rooms[currentRoom]) {
            const room = rooms[currentRoom];
            let playerColor = null;
            if (room.whiteSeat && room.whiteSeat.socketId === socket.id) {
                room.whiteSeat = null;
                playerColor = 'w';
            }
            if (room.blackSeat && room.blackSeat.socketId === socket.id) {
                room.blackSeat = null;
                playerColor = 'b';
            }
            io.to(currentRoom).emit('seatUpdate', { whiteSeat: room.whiteSeat, blackSeat: room.blackSeat });
            io.to(currentRoom).emit('chat', { username: 'System', message: `${socket.username || 'A user'} has left the room.`, type: 'system' });
            if (room.gameState && room.gameState.isGameStarted && !room.gameState.isGameOver && playerColor) {
                let winner = playerColor === 'w' ? 'b' : 'w';
                io.to(currentRoom).emit('gameOver', { winner });
                room.gameState.isGameOver = true;
                saveGameData(currentRoom, winner);
            }
            room.players -= 1;
            if (room.players <= 0) {
                delete rooms[currentRoom];
                delete chatHistory[currentRoom];
                console.log(`Room ${currentRoom} deleted due to no players.`);
            }
            emitRoomList();
        }
    });

    socket.on('surrender', (data) => {
        const { roomId, color } = data;
        const room = rooms[roomId];
        if (!room) return;
        if ((color === 'w' && room.whiteSeat && room.whiteSeat.socketId === socket.id) ||
            (color === 'b' && room.blackSeat && room.blackSeat.socketId === socket.id)) {
            if (room.gameState && room.gameState.isGameStarted && !room.gameState.isGameOver) {
                let winner = color === 'w' ? 'b' : 'w';
                io.to(roomId).emit('stopTimer');
                io.to(roomId).emit('gameOver', { winner });
                room.gameState.isGameOver = true;
                saveGameData(roomId, winner);

                io.to(roomId).emit('chat', { username: 'System', message: `${color === 'w' ? 'White' : 'Black'} player has surrendered.`, type: 'system' });
            }
        } else {
            socket.emit('error', { message: 'You are not allowed to surrender for this color.' });
        }
    });

    socket.on('restGame', (data) => {
        const { roomId } = data;
        const room = rooms[roomId];
        if (!room) return;
        if ((room.whiteSeat && room.whiteSeat.socketId === socket.id) || (room.blackSeat && room.blackSeat.socketId === socket.id)) {
            socket.to(roomId).emit('restGameRequest', {});
        } else {
            socket.emit('error', { message: 'Only seated players can request a game reset.' });
        }
    });

    socket.on('acceptRestGame', (data) => {
        const { roomId } = data;
        const room = rooms[roomId];
        if (!room) return;
        if ((room.whiteSeat && room.whiteSeat.socketId === socket.id) || (room.blackSeat && room.blackSeat.socketId === socket.id)) {
            room.gameState = {
                isGameStarted: false,
                isGameOver: false,
                board: initializeBoard(),
                currentTurn: 'w',
                moveHistory: [],
                currentMoveIndex: -1,
            };
            io.to(roomId).emit('restGameAccepted', {});
        
            io.to(roomId).emit('chat', { username: 'System', message: 'The game has been reset.', type: 'system' });
        } else {
            socket.emit('error', { message: 'Only seated players can accept a game reset.' });
        }
    });

    socket.on('reconnectToRoom', (roomId) => {
        if (rooms[roomId]) {
            clearTimeout(reconnectionTimeouts[socket.id]);
            rooms[roomId].players += 1;
            socket.join(roomId);
            currentRoom = roomId;
            socket.emit('chatHistory', chatHistory[roomId]);
            const room = rooms[roomId];
            socket.emit('seatUpdate', { whiteSeat: room.whiteSeat, blackSeat: room.blackSeat });
            emitRoomList();
            console.log(`User reconnected to room ${roomId}. Now it has ${rooms[roomId].players} player(s).`);
        }
    });

    socket.on('gameOver', (data) => {
        const { winner } = data;
        const roomId = currentRoom;
        const room = rooms[roomId];
        if (!room || !room.gameState || room.gameState.isGameOver) return;
        room.gameState.isGameOver = true;
        saveGameData(roomId, winner);
        io.to(roomId).emit('gameOver', { winner });
    
        let message = '';
        if (winner === 'draw') {
            message = 'Game is a draw!';
        } else {
            message = `${winner === 'w' ? 'White' : 'Black'} wins!`;
        }
        io.to(roomId).emit('chat', { username: 'System', message, type: 'system' });
    });
});

app.get('/gameHistory', (req, res) => {
    const historyFilePath = path.join(__dirname, 'gameHistory.json');
    let gameHistory = [];
    try {
        if (fs.existsSync(historyFilePath)) {
            const data = fs.readFileSync(historyFilePath);
            gameHistory = JSON.parse(data);
        }
    } catch (err) {
        console.error('Error reading game history file:', err);
    }
    res.json(gameHistory);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
