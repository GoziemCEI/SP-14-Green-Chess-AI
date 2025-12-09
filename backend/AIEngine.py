import os
import chess
import chess.engine
import sys
import json
import random
BOOK_PATH = "ecoA.json"
with open(BOOK_PATH, 'r') as f:
    OPENING_BOOK = json.load(f) # Load the opening book

def get_opening_move(board: chess.Board):
    fen = board.fen()
    if fen in OPENING_BOOK:
        moves_list = OPENING_BOOK[fen]['moves'].split()  # Split moves from PGN string
        # Convert algebraic to UCI
        move_uci = random.choice([m for i, m in enumerate(moves_list) if i % 2 == 1])
        return board.parse_uci(move_uci)
    return None

def get_best_move(board: chess.Board) -> chess.Move:
    try:
        # Check if on Windows
        if sys.platform == "win32":  # IMPORTANT: It's "win32" not "win"
            engine_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "engine", "stockfish-windows-x86-64-avx2.exe")
        else:
            engine_path = "engine/stockfish-macos-m1-apple-silicon"
        
        print(f"Platform: {sys.platform}")
        print(f"Attempting to load engine from: {engine_path}")
        print(f"File exists: {os.path.exists(engine_path)}")
        
        engine = chess.engine.SimpleEngine.popen_uci(engine_path)
        result = engine.play(board, chess.engine.Limit(time=0.1))
        engine.quit()
        return result.move
    except Exception as e:
        print(f"ERROR in get_best_move: {e}")
        raise





def minimax(board: chess.Board, depth: int, alpha=float('-inf'), beta=float('inf')) -> float:
    
    if board.is_checkmate() or board.is_stalemate() or depth == 0:
        return evaluate_board(board)

    if board.turn == chess.WHITE:
        max_eval = float('-inf')
        for move in board.legal_moves:
            board.push(move)
            eval = minimax(board, depth - 1, alpha, beta)
            board.pop()
            max_eval = max(max_eval, eval)
            alpha = max(alpha, eval)
            if beta <= alpha:
                break
        return max_eval
    else:
        min_eval = float('inf')
        for move in board.legal_moves:
            board.push(move)
            eval = minimax(board, depth - 1, alpha, beta)
            board.pop()
            min_eval = min(min_eval, eval)
            beta = min(beta, eval)
            if beta <= alpha:
                break
        return min_eval


def evaluate_board(board: chess.Board) -> float:
    piece_values = {
        chess.PAWN: 1,
        chess.KNIGHT: 3,
        chess.BISHOP: 3,
        chess.ROOK: 5,
        chess.QUEEN: 9,
        chess.KING: 0
    }

    value = 0
    for piece_type, val in piece_values.items():
        value += len(board.pieces(piece_type, chess.WHITE)) * val
        value -= len(board.pieces(piece_type, chess.BLACK)) * val
    return value
