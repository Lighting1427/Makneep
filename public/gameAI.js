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
let movePair = []; 
let isViewingHistory = false;
let previousMove = null; 
let currentMove = null;  
let isViewingWhiteMove = true;
let playerSeat = null;  
let aiSeat = null;      
let gameStarted = false; 
const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const numbers = [1, 2, 3, 4, 5, 6, 7, 8];
let isAiThinking = false;

const userName = localStorage.getItem('userName');
console.log('User Name:', userName);

function initializeBoard() {
    for (let col = 0; col < 8; col++) {
        board[7][col] = { color: 'w', x: col, y: 7 };
        board[0][col] = { color: 'b', x: col, y: 0 };
    }
}

function renderBoard() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = ''; 
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');

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
            cell.addEventListener('click', () => handleMove(row, col));
            boardElement.appendChild(cell);
        }
    }
}

function startGame() {
    if (!playerSeat) return; 
    gameStarted = true;  
    currentTurn = playerSeat === 'w' ? 'w' : 'b';
    updateTurnDisplay();
    startTimer();
    renderBoard();
    document.getElementById('startGame').style.display = 'none';
    document.getElementById('restartGame').style.display = 'inline';
    if (playerSeat === 'b') {
        currentTurn = 'w';  
        aiMakeMove();  
    }
}

function restartGame() {
    leaveSeat(); 
    board = Array(8).fill().map(() => Array(8).fill(null));
    selectedPiece = null;
    currentTurn = 'w';
    whiteTime = 300;
    blackTime = 300;
    moveHistory = [];
    currentMoveIndex = -1;
    gameStarted = false;
    previousMove = null;
    currentMove = null;
    isViewingHistory = false;
    isAiThinking = false;
    clearInterval(timerInterval);
    document.getElementById('white-timer').textContent = 'White Time: 05:00';
    document.getElementById('black-timer').textContent = 'Black Time: 05:00';
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    initializeBoard();
    renderBoard();
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (currentTurn === 'w') {
            whiteTime--;
            document.getElementById('white-timer').textContent = `White Time: ${formatTime(whiteTime)}`;
            if (whiteTime === 0) {
                clearInterval(timerInterval);
                alert("Black wins! White's time ran out.");
                document.getElementById('restartGame').style.display = 'inline';
            }
        } else if (currentTurn === 'b') { 
            blackTime--;
            document.getElementById('black-timer').textContent = `Black Time: ${formatTime(blackTime)}`;
            if (blackTime === 0) {
                clearInterval(timerInterval);
                alert("White wins! Black's time ran out.");
                document.getElementById('restartGame').style.display = 'inline';
            }
        }
    }, 1000); 
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTurnDisplay() {
    const turnElement = document.getElementById('turn-display');
    turnElement.textContent = currentTurn === 'w' ? "Turn ของฝ่ายขาว" : "Turn ของฝ่ายดำ";
}

function handleMove(row, col) {
    if (!gameStarted) {
        alert("เกมยังไม่เริ่ม! กรุณากดปุ่ม 'เริ่มเกม' ก่อน"); 
        return;
    }
    if (playerSeat !== currentTurn) {
        alert("ไม่ใช่เทิร์นของคุณ!"); 
        return;
    }
    if (currentMoveIndex !== moveHistory.length - 1) {
        return; 
    }
    if (isViewingHistory) {
        return;
    }
    const piece = board[row][col];
    if (selectedPiece) {
        if (piece && piece.color === currentTurn) {
            selectedPiece = { row, col, color: piece.color };
            highlightValidMoves(row, col, piece);
            return;
        }
        if (!piece && isValidMove(selectedPiece.row, selectedPiece.col, row, col)) {
            if (selectedPiece.color !== currentTurn) {
                alert("Not your turn!");
                return;
            }
            movePiece(row, col);
            updateGameAfterMove();
        }
    } else if (piece && piece.color === currentTurn) {
        selectedPiece = { row, col, color: piece.color };
        highlightValidMoves(row, col, piece);
    }
}

function leaveSeat() {
    playerSeat = null;
    aiSeat = null;

    document.getElementById('selectWhite').textContent = 'เลือกเป็นฝ่ายขาว';
    document.getElementById('selectBlack').textContent = 'เลือกเป็นฝ่ายดำ';
    document.getElementById('selectWhite').style.display = 'inline';
    document.getElementById('selectBlack').style.display = 'inline';
    document.getElementById('white-player-name').textContent = 'White: Not selected';
    document.getElementById('black-player-name').textContent = 'Black: Not selected';
    document.getElementById('leaveSeat').style.display = 'none';
    document.getElementById('startGame').style.display = 'none';
    document.getElementById('restartGame').style.display = 'none';
    document.getElementById('board-wrapper').classList.remove('flip-board');
}

document.getElementById('selectWhite').addEventListener('click', () => selectSeat('w'));
document.getElementById('selectBlack').addEventListener('click', () => selectSeat('b'));
document.getElementById('leaveSeat').addEventListener('click', leaveSeat);
document.getElementById('startGame').addEventListener('click', startGame);
document.getElementById('restartGame').addEventListener('click', restartGame);
document.getElementById('viewPgnButton').addEventListener('click', () => {
    const whitePlayer = localStorage.getItem('userName') || 'White Player';
    const blackPlayer = 'AI';
    const gameResult = '*'; 
    const pgnData = {
        whitePlayer,
        blackPlayer,
        result: gameResult,
        startTime: new Date().toISOString(),
        moveHistory,
    };
    localStorage.setItem('pgnData', JSON.stringify(pgnData));
    window.open('pgn.html', '_blank');
});


function formatPosition(row, col) {
    const letters = 'abcdefgh'; 
    return `${letters[col]}${8 - row}`; 
}

function movePiece(row, col) {
    const from = formatPosition(selectedPiece.row, selectedPiece.col);
    const to = formatPosition(row, col);

    previousMove = { row: selectedPiece.row, col: selectedPiece.col };
    currentMove = { row, col };
    board[selectedPiece.row][selectedPiece.col] = null;
    board[row][col] = { color: selectedPiece.color, x: col, y: row };

    const move = `${from} - ${to}`;
    const captures = checkCaptures(board, { x: col, y: row, color: selectedPiece.color });
    captures.forEach(capture => {
        board[capture.y][capture.x] = null;
    });
    moveHistory.push({
        move,
        boardState: JSON.parse(JSON.stringify(board)),
        capturedPieces: captures.map(capture => ({ ...capture }))
    });

    currentMoveIndex = moveHistory.length - 1;

    updateMoveHistoryDisplay();
    renderBoard();
}

function aiMakeMove() {
    const depth = 4;
    isAiThinking = true; 

    const thinkingTimeLimit = 5000; 
    const aiStartThinkingTime = Date.now();

    function aiThink() {
        const elapsed = Date.now() - aiStartThinkingTime;

        if (elapsed >= thinkingTimeLimit) {
            isAiThinking = false; 
            const bestMove = minimax(board, depth, true, -Infinity, Infinity);
            if (bestMove && bestMove.fromRow !== undefined && bestMove.fromCol !== undefined) {
                selectedPiece = { row: bestMove.fromRow, col: bestMove.fromCol, color: aiSeat };
                movePiece(bestMove.row, bestMove.col);
                updateGameAfterMove();
            } else {
                alert("AI ไม่สามารถเดินหมากได้ คุณชนะแล้ว!");
            }
            startTimer(); 
        } else {
            setTimeout(aiThink, 100); 
        }
    }

    aiThink();  
}

function minimax(board, depth, isMaximizingPlayer, alpha, beta) {
    if (depth === 0) {
        return evaluateBoard(board); 
    }

    const color = isMaximizingPlayer ? aiSeat : playerSeat;
    let validMoves = findValidMovesForAI(board, color);

    if (validMoves.length === 0) {
        return null; 
    }

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        let bestMove = null;

        for (let move of validMoves) {
            let newBoard = simulateMove(board, move, color);
            let evaluation = minimax(newBoard, depth - 1, false, alpha, beta);

            evaluation += move.captures.length * 10; 

            if (evaluation > maxEval) {
                maxEval = evaluation;
                if (depth === 4) {
                    bestMove = move; 
                }
            }
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) {
                break;
            }
        }
        return depth === 4 ? bestMove : maxEval; 
    } else {
        let minEval = Infinity;

        for (let move of validMoves) {
            let newBoard = simulateMove(board, move, color);
            let evaluation = minimax(newBoard, depth - 1, true, alpha, beta);

            evaluation -= move.captures.length * 10; 

            if (evaluation < minEval) {
                minEval = evaluation;
            }
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) {
                break;
            }
        }
        return minEval;
    }
}

function findValidMovesForAI(board, color) {
    let validMoves = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === color) {
                const directions = [
                    { dx: 0, dy: 1 },  
                    { dx: 0, dy: -1 }, 
                    { dx: 1, dy: 0 },  
                    { dx: -1, dy: 0 }  
                ];

                directions.forEach(direction => {
                    let newRow = row + direction.dy;
                    let newCol = col + direction.dx;

                    while (isInBounds(newRow, newCol) && !board[newRow][newCol]) {
                        let move = {
                            fromRow: row,
                            fromCol: col,
                            row: newRow,
                            col: newCol
                        };
                        let simulatedBoard = simulateMove(board, move, color);
                        const captures = checkCaptures(simulatedBoard, { x: move.col, y: move.row, color: color });

                        validMoves.push({ ...move, captures });

                        newRow += direction.dy;
                        newCol += direction.dx;
                    }
                });
            }
        }
    }
    return validMoves;
}

function updateGameAfterMove() {
    renderBoard();
    currentTurn = currentTurn === 'w' ? 'b' : 'w';  

    if (currentTurn === aiSeat) {
        aiMakeMove();  
    } else {
        startTimer();  
    }
    selectedPiece = null;
    updateTurnDisplay();
}

function simulateMove(board, move, color) {
    const newBoard = JSON.parse(JSON.stringify(board)); 

    newBoard[move.fromRow][move.fromCol] = null;
    newBoard[move.row][move.col] = { color: color, x: move.col, y: move.row };

    const captures = checkCaptures(newBoard, { x: move.col, y: move.row, color: color });
    captures.forEach(capture => {
        newBoard[capture.y][capture.x] = null;
    });

    return newBoard;
}

function evaluateBoard(board) {
    let score = 0;
    const aiColor = aiSeat;
    const opponentColor = playerSeat;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                if (piece.color === aiColor) {
                    score += 10;

                    const captures = checkCaptures(board, { x: col, y: row, color: aiColor });
                    score += captures.length * 5;
                } else if (piece.color === opponentColor) {
                    score -= 10;

                    const captures = checkCaptures(board, { x: col, y: row, color: opponentColor });
                    score -= captures.length * 5;
                }
            }
        }
    }
    return score;
}

function selectSeat(color) {
    if (playerSeat) return;  

    playerSeat = color;  
    aiSeat = color === 'w' ? 'b' : 'w';  

    if (color === 'w') {
        document.getElementById('selectWhite').textContent = `White: ${userName}`;
        document.getElementById('selectBlack').textContent = 'Black: AI';
        document.getElementById('white-player-name').textContent = `White: ${userName}`;
        document.getElementById('black-player-name').textContent = 'Black: AI';
        document.getElementById('board-wrapper').classList.remove('flip-board');
    } else {
        document.getElementById('selectWhite').textContent = 'White: AI';
        document.getElementById('selectBlack').textContent = `Black: ${userName}`;
        document.getElementById('white-player-name').textContent = 'White: AI';
        document.getElementById('black-player-name').textContent = `Black: ${userName}`;
        document.getElementById('board-wrapper').classList.add('flip-board');
    }
    document.getElementById('selectWhite').style.display = 'none';
    document.getElementById('selectBlack').style.display = 'none';
    document.getElementById('leaveSeat').style.display = 'inline';
    document.getElementById('startGame').style.display = 'inline';

}

function goToMove(index) {
    const historyEntry = moveHistory[index];
    board = JSON.parse(JSON.stringify(historyEntry.boardState)); 
    renderBoard(); 
}

function getCoordinatesFromPosition(pos) {
    const letters = 'abcdefgh';
    const col = letters.indexOf(pos[0]);
    const row = 8 - parseInt(pos[1], 10);
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

function goToCurrentMove() {
    currentMoveIndex = moveHistory.length - 1;
    const historyEntry = moveHistory[currentMoveIndex];
    board = JSON.parse(JSON.stringify(historyEntry.boardState));
    renderBoard();
    updateMoveHistoryDisplay();

    isViewingHistory = false; 
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

    if (moveHistory.length % 2 !== 0) {
        const li = historyList.lastChild;
        if (li && currentMoveIndex === moveHistory.length - 1) {
            li.innerHTML = li.innerHTML.replace(moveHistory[moveHistory.length - 1].move, `<span class="highlight-move">${moveHistory[moveHistory.length - 1].move}</span>`);
        }
    }
}

function highlightValidMoves(row, col, piece) {
    clearHighlights();
    const directions = [
        { dx: 0, dy: 1 }, 
        { dx: 0, dy: -1 }, 
        { dx: 1, dy: 0 },  
        { dx: -1, dy: 0 }  
    ];

    directions.forEach(direction => {
        let newRow = row + direction.dy;
        let newCol = col + direction.dx;

        while (isInBounds(newRow, newCol) && !board[newRow][newCol]) {
            const cell = document.querySelector(`#board div:nth-child(${newRow * 8 + newCol + 1})`);
            cell.classList.add('highlight');
            newRow += direction.dy;
            newCol += direction.dx;
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

document.getElementById('prevMove').addEventListener('click', prevMove);
document.getElementById('nextMove').addEventListener('click', nextMove);

socket.on('move', (data) => {
    board = data.board;
    renderBoard();
});

initializeBoard();
renderBoard();
