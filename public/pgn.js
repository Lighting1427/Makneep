const pgnBoardDiv = document.getElementById('pgnBoard');
const pgnText = document.getElementById('pgnText');
const pgnData = JSON.parse(localStorage.getItem('pgnData'));
const moveHistory = pgnData.moveHistory || [];
const gameStartTime = new Date(pgnData.date || pgnData.startTime);
const whitePlayer = pgnData.whitePlayer || 'White Player';
const blackPlayer = pgnData.blackPlayer || 'Black Player';
const gameResult = pgnData.winner === 'w' ? '1-0' : pgnData.winner === 'b' ? '0-1' : '1/2-1/2';

let pgnIndex = -1;

document.getElementById('backToGameButton').addEventListener('click', () => {
    window.close();
});

document.getElementById('prevMoveButton').addEventListener('click', () => {
    if (pgnIndex > 0) {
        pgnIndex--;
        updatePgnBoard();
    }
});

document.getElementById('nextMoveButton').addEventListener('click', () => {
    if (pgnIndex < moveHistory.length - 1) {
        pgnIndex++;
        updatePgnBoard();
    }
});

document.getElementById('exportPgnButton').addEventListener('click', () => {
    const pgnString = generatePgnString();
    const blob = new Blob([pgnString], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'game.txt';
    link.click();
});

function generatePgnString() {
    const event = "[Event \"เกมหมากหนีบ\"]";
    const site = "[Site \"MakNeep\"]";
    const date = `[Date "${gameStartTime.toISOString().split('T')[0]}"]`;
    const round = `[Round "${calculateRound(moveHistory)}"]`;
    const white = `[White "${whitePlayer}"]`;
    const black = `[Black "${blackPlayer}"]`;
    const result = `[Result "${gameResult}"]`;
    const time = `[Time "${gameStartTime.toTimeString().split(' ')[0]}"]`;
    const timeControl = "[TimeControl \"600 second\"]";
    const moves = generateMoveString();

    return `${event}\n${site}\n${date}\n${round}\n${white}\n${black}\n${result}\n${time}\n${timeControl}\n\n${moves}`;
}

function calculateRound(moveHistory) {
    return Math.ceil(moveHistory.length / 2);
}

function generateMoveString() {
    let movesString = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const moveNumber = `${Math.floor(i / 2) + 1}. `;
        const whiteMove = moveHistory[i]?.move || 'Invalid Move';
        movesString += moveNumber + whiteMove;

        if (i + 1 < moveHistory.length) {
            const blackMove = moveHistory[i + 1]?.move || 'Invalid Move';
            movesString += ` ${blackMove}`;
        }

        movesString += ' ';
    }
    return movesString.trim();
}

function updatePgnBoard() {
    const currentBoardState = moveHistory[pgnIndex]?.boardState || initializeBoard();
    renderBoard(currentBoardState);
    renderMoveHistory();
}

function initializeBoard() {
    let newBoard = Array(8).fill().map(() => Array(8).fill(null));
    for (let col = 0; col < 8; col++) {
        newBoard[7][col] = { color: 'w', x: col, y: 7 };
        newBoard[0][col] = { color: 'b', x: col, y: 0 };
    }
    return newBoard;
}

function renderBoard(board) {
    pgnBoardDiv.innerHTML = ''; 
    const boardSize = 8;

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');

            const piece = board[y][x];
            if (piece) {
                const pieceDiv = document.createElement('div');
                pieceDiv.classList.add('piece');
                if (piece.color === 'w') {
                    pieceDiv.classList.add('white-piece');
                } else if (piece.color === 'b') {
                    pieceDiv.classList.add('black-piece');
                }
                pieceDiv.style.width = '100%';
                pieceDiv.style.height = '100%';
                cellDiv.appendChild(pieceDiv);
            }

            pgnBoardDiv.appendChild(cellDiv);
        }
    }
}

function renderMoveHistory() {
    pgnText.innerHTML = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const movePairDiv = document.createElement('div');
        movePairDiv.classList.add('move-pair');

        const moveNumberSpan = document.createElement('span');
        moveNumberSpan.classList.add('move-number');
        moveNumberSpan.textContent = `${Math.floor(i / 2) + 1}. `;

        const whiteMove = moveHistory[i]?.move || 'Invalid Move';
        const whiteMoveSpan = document.createElement('span');
        whiteMoveSpan.classList.add('move');
        whiteMoveSpan.textContent = whiteMove;
        whiteMoveSpan.addEventListener('click', () => {
            pgnIndex = i;
            updatePgnBoard();
        });

        movePairDiv.appendChild(moveNumberSpan);
        movePairDiv.appendChild(whiteMoveSpan);

        if (i + 1 < moveHistory.length) {
            const blackMove = moveHistory[i + 1]?.move || 'Invalid Move';
            const blackMoveSpan = document.createElement('span');
            blackMoveSpan.classList.add('move');
            blackMoveSpan.textContent = blackMove;
            blackMoveSpan.addEventListener('click', () => {
                pgnIndex = i + 1;
                updatePgnBoard();
            });
            movePairDiv.appendChild(blackMoveSpan);
        }

        pgnText.appendChild(movePairDiv);
    }

    const moveSpans = pgnText.querySelectorAll('.move');
    moveSpans.forEach((span, i) => {
        if (i === pgnIndex) {
            span.classList.add('highlighted');
        } else {
            span.classList.remove('highlighted');
        }
    });
}

if (moveHistory.length > 0) {
    pgnIndex = 0;
    updatePgnBoard();
}
