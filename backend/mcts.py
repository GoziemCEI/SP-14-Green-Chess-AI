import chess
import numpy as np
import torch
from typing import Dict, Tuple

class MCTSNode:
    """Monte Carlo Tree Search node for game tree exploration."""
    def __init__(self, board: chess.Board, parent=None, move: chess.Move = None):
        self.board = board.copy()
        self.parent = parent
        self.move = move
        self.children: Dict[chess.Move, MCTSNode] = {}
        self.visits = 0
        self.value_sum = 0.0
        self.prior = 1.0

    def ucb(self, c_puct: float = 1.0) -> float:
        """Upper Confidence Bound for tree traversal."""
        if self.visits == 0:
            return float('inf')
        
        exploitation = self.value_sum / self.visits
        exploration = c_puct * self.prior * (np.sqrt(self.parent.visits) / (1 + self.visits))
        return exploitation + exploration

    def update(self, value: float):
        """Update node statistics after simulation."""
        self.visits += 1
        self.value_sum += value

class MCTS:
    """Monte Carlo Tree Search with neural network evaluation."""
    def __init__(self, network, encoder, num_simulations: int = 100, c_puct: float = 1.0):
        self.network = network
        self.encoder = encoder
        self.num_simulations = num_simulations
        self.c_puct = c_puct

    def search(self, board: chess.Board) -> Tuple[chess.Move, np.ndarray]:
        """Run MCTS search and return best move with policy."""
        root = MCTSNode(board)
        
        for _ in range(self.num_simulations):
            node = self._select(root)
            value = self._evaluate(node)
            self._backup(node, value)
        
        policy = self._compute_policy(root)
        best_move = max(root.children.keys(), 
                       key=lambda m: root.children[m].visits)
        
        return best_move, policy

    def _select(self, node: MCTSNode) -> MCTSNode:
        """Tree traversal using UCB selection."""
        while not node.board.is_game_over():
            if len(node.children) < len(list(node.board.legal_moves)):
                return self._expand(node)
            
            node = max(node.children.values(), key=lambda n: n.ucb(self.c_puct))
        
        return node

    def _expand(self, node: MCTSNode) -> MCTSNode:
        """Add new child node for unexplored move."""
        unexplored = [m for m in node.board.legal_moves 
                     if m not in node.children]
        
        if not unexplored:
            return node
        
        move = unexplored[0]
        child_board = node.board.copy()
        child_board.push(move)
        child = MCTSNode(child_board, parent=node, move=move)
        node.children[move] = child
        
        return child

    def _evaluate(self, node: MCTSNode) -> float:
        """Neural network position evaluation."""
        if node.board.is_checkmate():
            return -1.0 if node.board.turn else 1.0
        if node.board.is_stalemate():
            return 0.0
        
        encoded = self.encoder.encode_position(node.board)
        with torch.no_grad():
            x = torch.from_numpy(encoded).unsqueeze(0).float()
            _, value = self.network(x)
            return value.item()

    def _backup(self, node: MCTSNode, value: float):
        """Propagate value up the tree."""
        while node:
            node.update(-value)
            node = node.parent
            value = -value

    def _compute_policy(self, root: MCTSNode) -> np.ndarray:
        """Convert visit counts to policy probabilities."""
        total_visits = sum(child.visits for child in root.children.values())
        policy = np.zeros(4672)
        
        for move, child in root.children.items():
            move_idx = move.from_square * 64 + move.to_square
            policy[move_idx] = child.visits / total_visits
        
        return policy
