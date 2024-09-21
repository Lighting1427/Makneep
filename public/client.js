import { checkCaptures } from './captureUtils.js';
const socket = io();

let board = Array(8).fill().map(() => Array(8).fill(null));
let selectedPiece = null;
let currentTurn = 'w'; 
let whiteTime = 300; 
let blackTime = 300;
let timerInterval;
let moveHistory = [];
let currentMoveIndex = -1;
let isViewingHistory = false;
let previousMove = null;
let currentMove = null;
let myColor = null; 
let afkTimeout;
let isAfk = false;
let totalTime = 600; 
let gameStarted = false; 

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
if (!roomId) {
    alert('No room ID specified!');
    window.location.href = '/'; 
}

localStorage.setItem('currentRoomId', roomId);

document.getElementById('room-id-display').textContent = 'Room ID: ' + roomId;

const username = localStorage.getItem('userName') || 'Unknown User';
socket.emit('joinRoom', { roomId, username });

function initializeBoard() {
    board = Array(8).fill().map(() => Array(8).fill(null));
    for (let col = 0; col < 8; col++) {
        board[7][col] = { color: 'w', x: col, y: 7 };
        board[0][col] = { color: 'b', x: col, y: 0 };
    }
}

function renderCoordinateLabels() {
    const topLabels = document.getElementById('top-labels');
    const bottomLabels = document.getElementById('bottom-labels');
    const leftLabels = document.getElementById('left-labels');
    const rightLabels = document.getElementById('right-labels');

    topLabels.innerHTML = '';
    bottomLabels.innerHTML = '';
    leftLabels.innerHTML = '';
    rightLabels.innerHTML = '';

    const lettersWhite = ['a','b','c','d','e','f','g','h'];
    const lettersBlack = ['h','g','f','e','d','c','b','a'];
    const letters = myColor === 'b' ? lettersBlack : lettersWhite;

    const numbersWhite = ['8','7','6','5','4','3','2','1'];
    const numbersBlack = ['1','2','3','4','5','6','7','8'];
    const numbers = myColor === 'b' ? numbersBlack : numbersWhite;

    letters.forEach(letter => {
        const topSpan = document.createElement('span');
        topSpan.textContent = letter;
        topLabels.appendChild(topSpan);

        const bottomSpan = document.createElement('span');
        bottomSpan.textContent = letter;
        bottomLabels.appendChild(bottomSpan);
    });

    numbers.forEach(number => {
        const leftSpan = document.createElement('span');
        leftSpan.textContent = number;
        leftLabels.appendChild(leftSpan);

        const rightSpan = document.createElement('span');
        rightSpan.textContent = number;
        rightLabels.appendChild(rightSpan);
    });
}

function renderBoard() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = '';

    for (let displayRow = 0; displayRow < 8; displayRow++) {
        for (let displayCol = 0; displayCol < 8; displayCol++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');

            let row, col;
            if (myColor === 'b') {
                row = 7 - displayRow;
                col = 7 - displayCol;
            } else {
                row = displayRow;
                col = displayCol;
            }

            cell.dataset.row = row;
            cell.dataset.col = col;

            const piece = board[row][col];
            if (piece) {
                cell.classList.add(piece.color === 'b' ? 'black-piece' : 'white-piece');
            }

            if (previousMove && previousMove.row === row && previousMove.col === col) {
                cell.classList.add('prev-move');
            }
            if (currentMove && currentMove.row === row && currentMove.col === col) {
                cell.classList.add('current-move');
            }

            cell.style.gridRowStart = displayRow + 1;
            cell.style.gridColumnStart = displayCol + 1;

            cell.addEventListener('click', () => handleMove(row, col));

            boardElement.appendChild(cell);
        }
    }
}

function resetAfkTimer() {
    clearTimeout(afkTimeout);
    if (isAfk) {
        isAfk = false;
        socket.emit('playerActive', { roomId });
    }
    afkTimeout = setTimeout(() => {
        isAfk = true;
        socket.emit('playerAFK', { roomId });
    }, 30000); 
}

['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetAfkTimer);
});

resetAfkTimer();

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        totalTime--;
        document.getElementById('total-game-timer').textContent = `Total Game Time: ${formatTime(totalTime)}`;
        if (totalTime === 0) {
            clearInterval(timerInterval);
            const whitePieces = countPieces('w');
            const blackPieces = countPieces('b');
            if (whitePieces > blackPieces) {
                alert("White wins! Time's up and White has more pieces.");
                socket.emit('gameOver', { winner: 'w' });
            } else if (blackPieces > whitePieces) {
                alert("Black wins! Time's up and Black has more pieces.");
                socket.emit('gameOver', { winner: 'b' });
            } else {
                alert("Game is a draw! Time's up and both players have equal pieces.");
                socket.emit('gameOver', { winner: 'draw' });
            }
            return;
        }

        if (currentTurn === 'w') {
            whiteTime--;
            document.getElementById('white-timer').textContent = `White Time: ${formatTime(whiteTime)}`;
            if (whiteTime === 0) {
                clearInterval(timerInterval);
                alert("Black wins! White's time ran out.");
                socket.emit('gameOver', { winner: 'b' });
                return;
            }
        } else {
            blackTime--;
            document.getElementById('black-timer').textContent = `Black Time: ${formatTime(blackTime)}`;
            if (blackTime === 0) {
                clearInterval(timerInterval);
                alert("White wins! Black's time ran out.");
                socket.emit('gameOver', { winner: 'w' });
                return;
            }
        }
    }, 1000);
}

function countPieces(color) {
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === color) {
                count++;
            }
        }
    }
    return count;
}

function checkGameOver() {
    const opponentColor = currentTurn === 'w' ? 'b' : 'w';

    let opponentHasPieces = false;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === opponentColor) {
                opponentHasPieces = true;
                break;
            }
        }
        if (opponentHasPieces) {
            break;
        }
    }

    if (!opponentHasPieces) {
        alert(`${currentTurn === 'w' ? 'White' : 'Black'} wins! Opponent has no pieces left.`);
        socket.emit('gameOver', { winner: currentTurn });
        return true;
    }

    const opponentHasValidMoves = hasValidMoves(opponentColor);
    if (!opponentHasValidMoves) {
        alert(`${currentTurn === 'w' ? 'White' : 'Black'} wins! Opponent has no valid moves.`);
        socket.emit('gameOver', { winner: currentTurn });
        return true;
    }

    return false;
}

function hasValidMoves(color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === color) {
                if (getValidMoves(row, col).length > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

function getValidMoves(row, col) {
    const validMoves = [];
    const piece = board[row][col];
    if (!piece) return validMoves;

    const directions = [
        { dx: 0, dy: 1 },  
        { dx: 0, dy: -1 }, 
        { dx: 1, dy: 0 },  
        { dx: -1, dy: 0 }  
    ];

    for (const direction of directions) {
        let newRow = row + direction.dy;
        let newCol = col + direction.dx;

        while (isInBounds(newRow, newCol) && !board[newRow][newCol]) {
            validMoves.push({ row: newRow, col: newCol });
            newRow += direction.dy;
            newCol += direction.dx;
        }
    }

    return validMoves;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTurnDisplay() {
    const turnElement = document.getElementById('turn-display');
    if (gameStarted) {
        turnElement.textContent = currentTurn === 'w' ? "Turn ของฝ่ายขาว" : "Turn ของฝ่ายดำ";
        startTimer();
    } else {
        turnElement.textContent = "Game has not started";
        clearInterval(timerInterval);
    }
}

function handleMove(row, col) {
    if (!gameStarted) return; 
    if (currentMoveIndex !== moveHistory.length - 1) return;
    if (isViewingHistory) return;
    if (!myColor) {
        alert('You are not a seated player.');
        return;
    }
    if (myColor !== currentTurn) {
        alert('Not your turn!');
        return;
    }

    const piece = board[row][col];

    if (selectedPiece) {
        if (piece && piece.color === currentTurn) {
            clearHighlights();
            selectedPiece = { row, col, color: piece.color };
            highlightValidMoves(row, col, piece);
        } else if (!piece && isValidMove(selectedPiece.row, selectedPiece.col, row, col)) {
            movePiece(row, col);

            socket.emit('move', {
                board,
                move: { from: { row: selectedPiece.row, col: selectedPiece.col }, to: { row, col } },
                currentTurn,
                moveHistory,
                currentMoveIndex
            });
            updateGameAfterMove();
        } else {
            clearHighlights();
            selectedPiece = null;
        }
    } else if (piece && piece.color === currentTurn) {
        selectedPiece = { row, col, color: piece.color };
        highlightValidMoves(row, col, piece);
    }
}

function formatPosition(row, col) {
    const letters = ['a','b','c','d','e','f','g','h'];
    const numbers = ['8','7','6','5','4','3','2','1'];

    const colLetter = letters[col];
    const rowNumber = numbers[row];

    return `${colLetter}${rowNumber}`;
}

function movePiece(row, col) {
    const from = formatPosition(selectedPiece.row, selectedPiece.col);
    const to = formatPosition(row, col);

    previousMove = { row: selectedPiece.row, col: selectedPiece.col };
    currentMove = { row, col };

    board[selectedPiece.row][selectedPiece.col] = null;
    board[row][col] = { color: selectedPiece.color, x: col, y: row };

    const moveString = `${from} - ${to}`;

    const captures = checkCaptures(board, { x: col, y: row, color: selectedPiece.color });
    captures.forEach(capture => board[capture.y][capture.x] = null);

    moveHistory.push({
        move: moveString,
        boardState: JSON.parse(JSON.stringify(board)),
        capturedPieces: captures.map(capture => ({ ...capture }))
    });

    if (checkGameOver()) {
        return;
    }

    currentMoveIndex = moveHistory.length - 1;

    currentTurn = currentTurn === 'w' ? 'b' : 'w';

    socket.emit('move', {
        board,
        currentTurn, 
        moveHistory,
        currentMoveIndex
    });

    updateMoveHistoryDisplay();
    renderBoard();
    updateTurnDisplay(); 
}

function updateGameAfterMove() {
    renderBoard();
    selectedPiece = null;
    isViewingHistory = false;
}

function goToMove(index) {
    const historyEntry = moveHistory[index];
    board = JSON.parse(JSON.stringify(historyEntry.boardState));
    renderBoard();
}

function getCoordinatesFromPosition(pos) {
    const letters = ['a','b','c','d','e','f','g','h'];
    const numbers = ['8','7','6','5','4','3','2','1'];

    const col = letters.indexOf(pos[0]);
    const row = numbers.indexOf(pos[1]);
    if (col === -1 || row === -1) return null;

    return { row, col };
}

function nextMove() {
    if (currentMoveIndex < moveHistory.length - 1) {
        clearHighlights();
        currentMoveIndex++;
        const historyEntry = moveHistory[currentMoveIndex];
        board = JSON.parse(JSON.stringify(historyEntry.boardState));
        previousMove = getCoordinatesFromPosition(historyEntry.move.split(' - ')[0]);
        currentMove = getCoordinatesFromPosition(historyEntry.move.split(' - ')[1]);
        renderBoard();
        updateMoveHistoryDisplay();
        isViewingHistory = currentMoveIndex !== moveHistory.length - 1;
    }
}

function prevMove() {
    if (currentMoveIndex > 0) {
        clearHighlights();
        currentMoveIndex--;
        const historyEntry = moveHistory[currentMoveIndex];
        board = JSON.parse(JSON.stringify(historyEntry.boardState));
        previousMove = getCoordinatesFromPosition(historyEntry.move.split(' - ')[0]);
        currentMove = getCoordinatesFromPosition(historyEntry.move.split(' - ')[1]);
        renderBoard();
        updateMoveHistoryDisplay();
        isViewingHistory = currentMoveIndex !== moveHistory.length - 1;
    }
}

function updateMoveHistoryDisplay() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = ''; 

    moveHistory.forEach((entry, index) => {
        let li;

        if (index % 2 === 0) {
            li = document.createElement('li');
            li.innerHTML = `${Math.floor(index / 2) + 1}. ${entry.move}`;

            if (currentMoveIndex === index) {
                li.innerHTML = li.innerHTML.replace(entry.move, `<span class="highlight-move">${entry.move}</span>`);
            }
        } else {
            const lastLi = historyList.lastChild;
            if (lastLi) {
                lastLi.innerHTML += ` ${entry.move}`;
                if (currentMoveIndex === index) {
                    lastLi.innerHTML = lastLi.innerHTML.replace(entry.move, `<span class="highlight-move">${entry.move}</span>`);
                }
            }
        }
        if (index % 2 === 0) {
            historyList.appendChild(li);
        }
    });
}

function highlightValidMoves(row, col, piece) {
    clearHighlights();
    const validMoves = getValidMoves(row, col);

    validMoves.forEach(move => {
        const cell = document.querySelector(`.cell[data-row='${move.row}'][data-col='${move.col}']`);
        if (cell) {
            cell.classList.add('highlight');
        }
    });
}

function isValidMove(oldRow, oldCol, newRow, newCol) {
    return (oldRow === newRow || oldCol === newCol) && isPathClear(oldRow, oldCol, newRow, newCol);
}

function isPathClear(oldRow, oldCol, newRow, newCol) {
    let stepRow = oldRow === newRow ? 0 : (newRow - oldRow) / Math.abs(newRow - oldRow);
    let stepCol = oldCol === newCol ? 0 : (newCol - oldCol) / Math.abs(newCol - oldCol);

    let currentRow = oldRow + stepRow;
    let currentCol = oldCol + stepCol;

    while (currentRow !== newRow || currentCol !== newCol) {
        if (board[currentRow][currentCol]) {
            return false;
        }
        currentRow += stepRow;
        currentCol += stepCol;
    }

    return true;
}

function isInBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function clearHighlights() {
    previousMove = null;
    currentMove = null;
    document.querySelectorAll('.highlight, .prev-move, .current-move').forEach(cell => {
        cell.classList.remove('highlight', 'prev-move', 'current-move');
    });
}

document.getElementById('choose-white').addEventListener('click', () => {
    const username = localStorage.getItem('userName') || 'Unknown User';
    socket.emit('chooseSeat', { roomId, color: 'w', username });
});

document.getElementById('choose-black').addEventListener('click', () => {
    const username = localStorage.getItem('userName') || 'Unknown User';
    socket.emit('chooseSeat', { roomId, color: 'b', username });
});

document.getElementById('stand-up').addEventListener('click', () => {
    socket.emit('standUp', { roomId });
    myColor = null;
    renderCoordinateLabels();
    renderBoard();
});

document.getElementById('start-game').addEventListener('click', () => {
    if (!myColor) {
        alert('You are not a seated player.');
        return;
    }
    socket.emit('startGame', { roomId });
});

document.getElementById('rest-game').addEventListener('click', () => {
    if (!myColor) {
        alert('You are not a seated player.');
        return;
    }
    socket.emit('restGame', { roomId });
});

document.getElementById('accept-rest-game').addEventListener('click', () => {
    if (!myColor) {
        alert('You are not a seated player.');
        return;
    }
    socket.emit('acceptRestGame', { roomId });
});

document.getElementById('prevMove').addEventListener('click', prevMove);
document.getElementById('nextMove').addEventListener('click', nextMove);

document.getElementById('send-chat').addEventListener('click', () => {
    const messageInput = document.getElementById('chat-input');
    const message = messageInput.value.trim();
    if (message) {
        const username = localStorage.getItem('userName') || 'Unknown User';
        socket.emit('chat', { roomId, username, message });
        messageInput.value = '';
    }
});

document.getElementById('chat-input').addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        document.getElementById('send-chat').click();
    }
});

socket.on('move', (data) => {
    board = data.board;
    currentTurn = data.currentTurn;
    moveHistory = data.moveHistory;
    currentMoveIndex = data.currentMoveIndex;
    previousMove = data.move.from;
    currentMove = data.move.to;

    renderBoard();
    updateTurnDisplay();
    updateMoveHistoryDisplay();
});

socket.on('seatUpdate', (data) => {
    const { whiteSeat, blackSeat } = data;
    const chooseWhiteButton = document.getElementById('choose-white');
    const chooseBlackButton = document.getElementById('choose-black');
    if (whiteSeat) {
        const buttonText = whiteSeat.isAfk ? `${whiteSeat.username} (AFK)` : whiteSeat.username;
        chooseWhiteButton.textContent = buttonText;
        chooseWhiteButton.disabled = true;
    } else {
        chooseWhiteButton.textContent = 'Choose White';
        chooseWhiteButton.disabled = false;
    }
    if (blackSeat) {
        const buttonText = blackSeat.isAfk ? `${blackSeat.username} (AFK)` : blackSeat.username;
        chooseBlackButton.textContent = buttonText;
        chooseBlackButton.disabled = true;
    } else {
        chooseBlackButton.textContent = 'Choose Black';
        chooseBlackButton.disabled = false;
    }
    const socketId = socket.id;
    if (whiteSeat && whiteSeat.socketId === socketId) {
        myColor = 'w';
        document.getElementById('stand-up').style.display = 'block';
        if (gameStarted) {
            document.getElementById('surrender-button').style.display = 'block';
        }
    } else if (blackSeat && blackSeat.socketId === socketId) {
        myColor = 'b';
        document.getElementById('stand-up').style.display = 'block';
        if (gameStarted) {
            document.getElementById('surrender-button').style.display = 'block';
        }
    } else {
        myColor = null;
        document.getElementById('stand-up').style.display = 'none';
        document.getElementById('surrender-button').style.display = 'none'; 
    }
    if (whiteSeat && blackSeat && !gameStarted) {
        if (myColor) {
            document.getElementById('start-game').style.display = 'block';
        } else {
            document.getElementById('start-game').style.display = 'none';
        }
    } else {
        document.getElementById('start-game').style.display = 'none';
    }
    renderCoordinateLabels(); 
    renderBoard(); 
});

socket.on('gameOver', (data) => {
    const { winner } = data;
    let message = '';
    if (winner === 'draw') {
        message = 'Game is a draw!';
    } else {
        message = `${winner === 'w' ? 'White' : 'Black'} wins!`;
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    socket.emit('chat', { roomId, username: 'System', message, type: 'system' });
    gameStarted = false; 
    updateTurnDisplay();
});

document.getElementById('surrender-button').addEventListener('click', () => {
    if (!myColor) {
        alert('You are not a seated player.');
        return;
    }
    clearInterval(timerInterval);
    socket.emit('surrender', { roomId, color: myColor });
    const message = `${myColor === 'w' ? 'White' : 'Black'} player has surrendered.`;
    socket.emit('chat', { roomId, username: 'System', message, type: 'system' });
});

socket.on('stopTimer', () => {
    clearInterval(timerInterval);
});

socket.on('gameStarted', (gameState) => {
    gameStarted = true;
    document.getElementById('seat-selection').style.display = 'none';
    document.getElementById('start-game').style.display = 'none';
    document.getElementById('rest-game').style.display = 'block';
    board = gameState.board;
    currentTurn = gameState.currentTurn;
    moveHistory = gameState.moveHistory;
    currentMoveIndex = gameState.currentMoveIndex;
    whiteTime = gameState.whiteTime || 300;
    blackTime = gameState.blackTime || 300;
    totalTime = gameState.totalTime || 600;

    if (myColor === 'w' || myColor === 'b') {
        document.getElementById('surrender-button').style.display = 'block';
    }
    renderBoard();
    updateTurnDisplay();
    updateMoveHistoryDisplay();
    startTimer(); 
});

socket.on('restGameRequest', (data) => {
    if (myColor) {
        document.getElementById('accept-rest-game').style.display = 'block';
    }
});

socket.on('restGameAccepted', (data) => {
    gameStarted = false;
    initializeBoard();
    renderBoard();
    moveHistory = [];
    currentMoveIndex = -1;
    isViewingHistory = false;
    previousMove = null;
    currentMove = null;
    selectedPiece = null;
    currentTurn = 'w';
    whiteTime = 300;
    blackTime = 300;
    totalTime = 600;
    clearInterval(timerInterval);
    document.getElementById('total-game-timer').textContent = `Total Game Time: ${formatTime(totalTime)}`;
    document.getElementById('white-timer').textContent = `White Time: ${formatTime(whiteTime)}`;
    document.getElementById('black-timer').textContent = `Black Time: ${formatTime(blackTime)}`;
    updateTurnDisplay();
    updateMoveHistoryDisplay();
    clearHighlights();
    document.getElementById('rest-game').style.display = 'none';
    document.getElementById('accept-rest-game').style.display = 'none';
    document.getElementById('surrender-button').style.display = 'none';
    document.getElementById('seat-selection').style.display = 'block';
    socket.emit('requestSeatUpdate', { roomId });
});

socket.on('chat', (data) => {
    const chatMessages = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    if (data.type === 'system') {
        messageElement.textContent = data.message;
        messageElement.style.color = 'blue';
    } else {
        messageElement.textContent = `${data.username}: ${data.message}`;
    }
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('chatHistory', (history) => {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = ''; 
    history.forEach(({ username, message }) => {
        const messageElement = document.createElement('div');
        messageElement.textContent = `${username}: ${message}`;
        chatMessages.appendChild(messageElement);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('error', (data) => {
    alert(data.message);
});

document.getElementById('viewPgnButton').addEventListener('click', () => {
    const whitePlayer = localStorage.getItem('userName') || 'White Player';
    const blackPlayer = 'Black Player'; 
    const gameResult = '*'; 
    const pgnData = {
        whitePlayer,
        blackPlayer,
        result: gameResult,
        startTime: new Date().toISOString(),
        moveHistory
    };

    localStorage.setItem('pgnData', JSON.stringify(pgnData));
    window.open('pgn.html', '_blank'); 
});

initializeBoard();
renderCoordinateLabels();
renderBoard();
socket.emit('requestSeatUpdate', { roomId });
