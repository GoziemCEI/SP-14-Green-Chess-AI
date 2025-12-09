import React, { useState, useRef, useEffect} from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { themes } from "./themes";
import { boardThemes } from "./boardThemes";
import { Bishop, Rook, Knight, Queen, King, Pawn } from "./components/Pieces";
import { DefaultKing, DefaultQueen, DefaultRook, DefaultBishop, DefaultKnight, DefaultPawn } from "./components/DefaultPieces";

export default function App() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [moveHistory, setMoveHistory] = useState([]);
  const [selectedPieceTheme, setSelectedPieceTheme] = useState("Classic");
  const [selectedBoardTheme, setSelectedBoardTheme] = useState("Sand");
  const [useDefaultPieces, setUseDefaultPieces] = useState(false);
  const [gameMode, setGameMode] = useState("engine");
  const [pvpMode, setPvpMode] = useState("ai");
  const [aiMode, setAiMode] = useState("manual"); // "auto" or "manual"
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiError, setAiError] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/chess");
    wsRef.current = ws;

    ws.onopen = () => console.log("Connected to WebSocket server");

    ws.onmessage = (event) => {
      const moveData = JSON.parse(event.data);
      const move = gameRef.current.move({ from: moveData.from, to: moveData.to, promotion: "q" });
      if (move) {
        setFen(gameRef.current.fen());
        setMoveHistory(prev => [...prev, move.san]);
      }
    };

    ws.onclose = () => console.log("Disconnected from WebSocket");

    return () => ws.close();
  }, []);

   // Function to get AI move from backend
  async function getAiMove() {
    setIsAiThinking(true);
    setAiError(null);

     // PROTECTION: Prevent AI Move if in PvP mode
    if (pvpMode === "pvp") {
      setAiError("AI Move is not available in Player vs Player mode!");
      setIsAiThinking(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/best-move/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fen: gameRef.current.fen(),
          mode: gameMode, 
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("FULL AI DATA:", data); // This logs to console automatically

      let fromSquare, toSquare;

      // CASE 1: Response is just a string "e2e4"
      if (typeof data === 'string') {
        fromSquare = data.substring(0, 2);
        toSquare = data.substring(2, 4);
      } 
      // CASE 2: Response is { from: "e2", to: "e4" }
      else if (data.from && data.to) {
        fromSquare = data.from;
        toSquare = data.to;
      }
      // CASE 3: Response is { move: "e2e4" }
      else if (data.move && typeof data.move === 'string') {
         fromSquare = data.move.substring(0, 2);
         toSquare = data.move.substring(2, 4);
      }
      // CASE 4: Response is { best_move: "e2e4" } (common convention)
      else if (data.best_move && typeof data.best_move === 'string') {
         fromSquare = data.best_move.substring(0, 2);
         toSquare = data.best_move.substring(2, 4);
      }
      else {
        throw new Error("Unknown move format: " + JSON.stringify(data));
      }

      console.log(`Parsed Move: ${fromSquare} -> ${toSquare}`);

      // Check promotion
      const piece = gameRef.current.get(fromSquare);
      const isPromotion = piece && piece.type === 'p' && 
                          ((piece.color === 'w' && toSquare[1] === '8') ||
                           (piece.color === 'b' && toSquare[1] === '1'));
      
      const moveObj = {
        from: fromSquare,
        to: toSquare
      };
      
      if (isPromotion) {
        moveObj.promotion = "q";
      }
      
      const aiMove = gameRef.current.move(moveObj);

      if (aiMove) {
        setFen(gameRef.current.fen());
        setMoveHistory(prev => [...prev, aiMove.san]);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ from: fromSquare, to: toSquare }));
        }
      }
    } catch (error) {
      console.error("Error getting AI move:", error);
      setAiError(error.message);
    } finally {
      setIsAiThinking(false);
    }
  }


  function onDrop(sourceSquare, targetSquare) {
    const move = gameRef.current.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    if (!move) return false;
    
    setFen(gameRef.current.fen());
    setMoveHistory(prev => [...prev, move.san]);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ from: sourceSquare, to: targetSquare }));
    }

    // If in auto mode, trigger AI move after player moves
    if (aiMode === "auto" && !gameRef.current.isGameOver()) {
      setTimeout(() => getAiMove(), 500); // 500ms delay for better UX
    }

    return true;
  }

    function onTouchStart(e) {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // Calculate which square was touched
    const squareSize = rect.width / 8;
    const file = Math.floor(x / squareSize);
    const rank = 7 - Math.floor(y / squareSize);
    
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const touchedSquare = files[file] + (rank + 1);
    
    // Store the touched square
    e.currentTarget.dataset.touchStart = touchedSquare;
  }

  function onTouchEnd(e) {
    const touchStart = e.currentTarget.dataset.touchStart;
    if (!touchStart) return;
    
    const touch = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // Calculate which square was released on
    const squareSize = rect.width / 8;
    const file = Math.floor(x / squareSize);
    const rank = 7 - Math.floor(y / squareSize);
    
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const touchedSquare = files[file] + (rank + 1);
    
    // Try to make the move
    onDrop(touchStart, touchedSquare);
    delete e.currentTarget.dataset.touchStart;
  }


  function resetGame() {
    gameRef.current.reset();
    setFen(gameRef.current.fen());
    setMoveHistory([]);
    setAiError(null);
  }

  function undoMove() {
    gameRef.current.undo();
    setFen(gameRef.current.fen());
    setMoveHistory(prev => prev.slice(0, -1));
    setAiError(null);
  }

  const customPieces = useDefaultPieces
    ? {
        wB: ({ squareWidth }) => <DefaultBishop color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bB: ({ squareWidth }) => <DefaultBishop color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        wN: ({ squareWidth }) => <DefaultKnight color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bN: ({ squareWidth }) => <DefaultKnight color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        wR: ({ squareWidth }) => <DefaultRook color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bR: ({ squareWidth }) => <DefaultRook color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        wQ: ({ squareWidth }) => <DefaultQueen color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bQ: ({ squareWidth }) => <DefaultQueen color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        wK: ({ squareWidth }) => <DefaultKing color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bK: ({ squareWidth }) => <DefaultKing color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        wP: ({ squareWidth }) => <DefaultPawn color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bP: ({ squareWidth }) => <DefaultPawn color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
      }
    : {
        wB: ({ squareWidth }) => <Bishop color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bB: ({ squareWidth }) => <Bishop color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        wN: ({ squareWidth }) => <Knight color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bN: ({ squareWidth }) => <Knight color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        wR: ({ squareWidth }) => <Rook color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bR: ({ squareWidth }) => <Rook color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        wQ: ({ squareWidth }) => <Queen color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bQ: ({ squareWidth }) => <Queen color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        wK: ({ squareWidth }) => <King color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bK: ({ squareWidth }) => <King color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        wP: ({ squareWidth }) => <Pawn color="white" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
        bP: ({ squareWidth }) => <Pawn color="black" squareWidth={squareWidth} theme={themes[selectedPieceTheme]} />,
      };

  const isGameOver = gameRef.current.isGameOver();

  return (
    <div style={{ maxWidth: "1200px", margin: "50px auto", textAlign: "center" }}>
      <h1>React Chess App</h1>

            {/* Game Mode and AI Mode Controls */}
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "center", gap: "30px", flexWrap: "wrap" }}>
        <div>
          <label>Game Type: </label>
          <select value={pvpMode} onChange={e => setPvpMode(e.target.value)}>
            <option value="ai">vs AI</option>
            <option value="pvp">Player vs Player</option>
          </select>
        </div>

        {pvpMode === "ai" && (
          <>
            <div>
              <label>Game Mode: </label>
              <select value={gameMode} onChange={e => setGameMode(e.target.value)} disabled={isAiThinking}>
                <option value="engine">Stockfish Engine</option>
                <option value="minimax">Minimax AI</option>
                <option value="neural-mcts">Neural-MCTS AI</option>
              </select>
            </div>
            
            <div>
              <label>AI Mode: </label>
              <select value={aiMode} onChange={e => setAiMode(e.target.value)} disabled={isAiThinking}>
                <option value="manual">Manual (Click Button)</option>
                <option value="auto">Auto (AI Plays Automatically)</option>
              </select>
            </div>
          </>
        )}

        <div>
          <label>Piece Style: </label>
          <select value={useDefaultPieces ? "Default" : "Custom"} onChange={e => setUseDefaultPieces(e.target.value === "Default")}>
            <option value="Classic">Classic</option>
            <option value="Default">Default</option>
          </select>
        </div>
        <div>
          <label>Piece Theme: </label>
          <select value={selectedPieceTheme} onChange={e => setSelectedPieceTheme(e.target.value)}>
            {Object.keys(themes).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label>Board Theme: </label>
          <select value={selectedBoardTheme} onChange={e => setSelectedBoardTheme(e.target.value)}>
            {Object.keys(boardThemes).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>


      {/* Error Display */}
      {aiError && (
        <div style={{ 
          marginBottom: "20px", 
          padding: "10px", 
          backgroundColor: "#fee", 
          color: "#c33", 
          borderRadius: "4px",
          border: "1px solid #fcc"
        }}>
          ⚠️ {aiError}
        </div>
      )}

      {/* Board and Move History */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: "40px" }}>
        <Chessboard
          id="ChessBoard"
          boardWidth={600}
          position={fen}
          onPieceDrop={onDrop}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          customPieces={customPieces}
          customDarkSquareStyle={{ backgroundColor: boardThemes[selectedBoardTheme]?.dark }}
          customLightSquareStyle={{ backgroundColor: boardThemes[selectedBoardTheme]?.light }}
        />

        <div style={{ textAlign: "left" }}>
          <h2>Move History</h2>
          <div style={{ border: "1px solid #ccc", padding: "10px", height: "500px", overflowY: "scroll", width: "200px" }}>
            {moveHistory.length ? <ol>{moveHistory.map((m, i) => <li key={i}>{m}</li>)}</ol> : <p>No moves yet.</p>}
          </div>

          {/* Game Status */}
          {isGameOver && (
            <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#efe", borderRadius: "4px", color: "#060" }}>
              <strong>Game Over!</strong>
            </div>
          )}

          {isAiThinking && (
            <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#fef", borderRadius: "4px", color: "#66f" }}>
              <strong>🤔 AI is thinking...</strong>
            </div>
          )}

          <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* AI Move Button - Only show in manual mode */}
            {aiMode === "manual" && (
              <button 
                onClick={getAiMove} 
                disabled={isAiThinking || isGameOver}
                style={{
                  padding: "10px",
                  backgroundColor: isAiThinking || isGameOver ? "#ccc" : "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isAiThinking || isGameOver ? "not-allowed" : "pointer",
                  fontWeight: "bold"
                }}
              >
                {isAiThinking ? "AI Thinking..." : "AI Move"}
              </button>
            )}
            
            <button onClick={resetGame} style={{ padding: "10px" }}>Reset Game</button>
            <button onClick={undoMove} disabled={!moveHistory.length} style={{ padding: "10px" }}>
              Undo Move
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
