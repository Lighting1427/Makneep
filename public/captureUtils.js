export function checkCaptures(board, piece) {
    const directions = [
        { dx: 1, dy: 0 }, 
        { dx: -1, dy: 0 }, 
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 } 
    ];

    const opponentColor = piece.color === 'w' ? 'b' : 'w';
    let captures = [];

    directions.forEach(direction => {

        const lineCapture = checkDirection(board, piece, direction, opponentColor);
        captures = captures.concat(lineCapture);

        const middleCapture = checkMiddleCapture(board, piece, direction, opponentColor);
        captures = captures.concat(middleCapture);

        captures = captures.concat(checkSpecificPatterns(board, piece, direction, opponentColor));
    });

    return captures;
}

function checkDirection(board, piece, { dx, dy }, opponentColor) {
    let x = piece.x + dx;
    let y = piece.y + dy;
    let captured = [];

    while (isInBounds(x, y, board) && board[y][x] && board[y][x].color === opponentColor) {
        captured.push({ x, y, color: opponentColor });
        x += dx;
        y += dy;
    }

    if (captured.length > 0 && isInBounds(x, y, board) && board[y][x] && board[y][x].color === piece.color) {
        return captured;
    }

    return [];
}

export function checkMiddleCapture(board, piece, { dx, dy }, opponentColor) {
    let captures = [];
    let middleX = piece.x - dx;
    let middleY = piece.y - dy;
    let oppositeX = piece.x + dx;
    let oppositeY = piece.y + dy;

    if (
        isInBounds(middleX, middleY, board) && isInBounds(oppositeX, oppositeY, board) &&
        board[middleY][middleX] && board[middleY][middleX].color === opponentColor &&
        board[oppositeY][oppositeX] && board[oppositeY][oppositeX].color === opponentColor
    ) {
        captures.push({ x: middleX, y: middleY, color: opponentColor });
        captures.push({ x: oppositeX, y: oppositeY, color: opponentColor });
    }

    return captures;
}

function checkSpecificPatterns(board, piece, { dx, dy }, opponentColor) {
    let captures = [];

    for (let length = 2; length <= 6; length++) {
        for (let i = 0; i <= length; i++) {
            let leftX = piece.x - (i * dx);
            let leftY = piece.y - (i * dy);
            let rightX = piece.x + ((length - i + 1) * dx);
            let rightY = piece.y + ((length - i + 1) * dy);

            if (isInBounds(leftX, leftY, board) && board[leftY][leftX] && board[leftY][leftX].color === opponentColor &&
                isInBounds(rightX, rightY, board) && board[rightY][rightX] && board[rightY][rightX].color === opponentColor) {
                
                let valid = true;
                for (let j = 1; j <= length; j++) {
                    let midX = leftX + (j * dx);
                    let midY = leftY + (j * dy);
                    if (!isInBounds(midX, midY, board) || !board[midY][midX] || board[midY][midX].color !== piece.color) {
                        valid = false;
                        break;
                    }
                }

                if (valid) {
                    captures.push({ x: leftX, y: leftY, color: opponentColor });
                    captures.push({ x: rightX, y: rightY, color: opponentColor });
                }
            }
        }
    }

    return captures;
}

function isInBounds(x, y, board) {
    return y >= 0 && y < board.length && x >= 0 && x < board[0].length;
}

export function countPieces(board, color) {
    return board.flat().filter(piece => piece && piece.color === color).length;
}

export function hasNoPieces(board, color) {
    return countPieces(board, color) === 0;
}
