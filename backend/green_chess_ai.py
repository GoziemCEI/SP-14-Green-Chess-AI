import torch
import chess
import numpy as np
from chess_encoder import ChessEncoder
from networks import ChessNet
from mcts import MCTS

class GreenChessAI:
    """Green Chess AI wrapper for FastAPI integration."""
    def __init__(self, model_path: str = None, num_simulations: int = 100):
        self.encoder = ChessEncoder()
        self.network = ChessNet()
        
        if model_path:
            self.network.load_state_dict(torch.load(model_path))
        
        self.network.eval()
        self.mcts = MCTS(self.network, self.encoder, num_simulations)

    def get_best_move(self, board: chess.Board) -> chess.Move:
        """Find best move using MCTS + neural network."""
        if not list(board.legal_moves):
            return None
        
        best_move, _ = self.mcts.search(board)
        return best_move

    def get_move_probabilities(self, board: chess.Board) -> dict:
        """Get move probabilities for position."""
        if not list(board.legal_moves):
            return {}
        
        _, policy = self.mcts.search(board)
        
        probabilities = {}
        for move in board.legal_moves:
            move_idx = move.from_square * 64 + move.to_square
            prob = float(policy[move_idx])
            if prob > 0:
                probabilities[move.uci()] = prob
        
        return probabilities

    def evaluate_position(self, board: chess.Board) -> float:
        """Get position evaluation [-1, 1]."""
        if board.is_checkmate():
            return -1.0 if board.turn else 1.0
        if board.is_stalemate():
            return 0.0
        
        encoded = self.encoder.encode_position(board)
        with torch.no_grad():
            x = torch.from_numpy(encoded).unsqueeze(0).float()
            _, value = self.network(x)
            return value.item()
