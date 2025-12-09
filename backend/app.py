from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import chess
import chess.engine
from AIEngine import get_best_move, minimax, evaluate_board, get_opening_move
from green_chess_ai import GreenChessAI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai = GreenChessAI(num_simulations=100)

class BoardState(BaseModel):
    fen: str
    game_mode: str = "engine" # "engine" or "minimax"

@app.post("/evalbar/")
def eval_bar(board_state: BoardState):
    board = chess.Board(board_state.fen)
    
    if board_state.game_mode == "neural-mcts":
        eval = ai.evaluate_position(board)
    else:
        eval = evaluate_board(board)
    
    return {"evaluation": eval}

@app.post("/best-move/")
def best_move(board_state: BoardState):
    board = chess.Board(board_state.fen)
    
    if board_state.game_mode == "minimax":
        move = get_opening_move(board)
        if move:
            return {"best_move": move.uci()}
        best_move_result = None
        best_value = float('-inf') if board.turn == chess.WHITE else float('inf')
        for move in board.legal_moves:
            board.push(move)
            board_value = minimax(board, 3)
            board.pop()
            if (board.turn == chess.WHITE and board_value > best_value) or \
               (board.turn == chess.BLACK and board_value < best_value):
                best_value = board_value
                best_move_result = move
        return {"best_move": best_move_result.uci() if best_move_result else None}
    
    elif board_state.game_mode == "engine":
        move = get_best_move(board)
        return {"best_move": move.uci()}
    
    elif board_state.game_mode == "neural-mcts":
        move = ai.get_best_move(board)
        if move:
            return {"best_move": move.uci()}
        return {"best_move": None}
    
    else:
        return {"error": "Invalid game mode. Choose 'engine', 'minimax', or 'neural-mcts'."}

@app.get("/")
def root():
    return {"message": "Chess Engine API is running!"}

from typing import List

# --- new section for multiplayer WebSocket ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/chess")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            print("Received:", data)
            # Expecting data like {"from": "e2", "to": "e4"}
            await manager.broadcast(data)  # send move to all players
    except WebSocketDisconnect:
        manager.disconnect(websocket)
