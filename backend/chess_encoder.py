import chess
import numpy as np

class ChessEncoder:
    """Converts chess board positions to neural network input tensors."""
    
    def __init__(self):
        self.piece_map = {
            chess.PAWN: 0,
            chess.KNIGHT: 1,
            chess.BISHOP: 2,
            chess.ROOK: 3,
            chess.QUEEN: 4,
            chess.KING: 5
        }
    
    def encode_board(self, board: chess.Board) -> np.ndarray:
        """Encode board state as 12 planes (6 pieces × 2 colors)."""
        encoded = np.zeros((12, 8, 8), dtype=np.float32)
        
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece:
                row, col = chess.square_rank(square), chess.square_file(square)
                piece_idx = self.piece_map[piece.piece_type]
                color_offset = 0 if piece.color == chess.WHITE else 6
                encoded[piece_idx + color_offset, row, col] = 1.0
        
        return encoded
    
    def encode_position(self, board: chess.Board) -> np.ndarray:
        """Full position encoding with board + metadata."""
        board_planes = self.encode_board(board)
        
        turn_plane = np.full((1, 8, 8), float(board.turn), dtype=np.float32)
        
        return np.concatenate([board_planes, turn_plane], axis=0)
    
    def move_to_action(self, move: chess.Move) -> tuple:
        """Convert move to (from_square, to_square) indices."""
        return (move.from_square, move.to_square)
    
    def action_to_move(self, board: chess.Board, from_square: int, to_square: int) -> chess.Move:
        """Convert action indices to chess move."""
        move = chess.Move(from_square, to_square)
        if move in board.legal_moves:
            return move
        return None
