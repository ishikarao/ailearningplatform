import { useEffect, useRef, useState } from "react";
import { Eraser, Sparkles, PencilLine } from "lucide-react";

type GuessResult = {
  digit: number;
  confidence: number;
  reason?: string;
};

type MatrixFeatures = {
  activePixels: number;
  aspectRatio: number;
  centerX: number;
  centerY: number;
};

const CANVAS_SIZE = 280;
const GRID_SIZE = 28;
const MNIST_INNER_SIZE = 20;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function extractJsonObject(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : "";
}

function extractDigitFromText(text: string) {
  const keyMatch = text.match(/(?:best_digit|digit)\s*[:=]\s*([1-9])/i);
  if (keyMatch) return Number(keyMatch[1]);

  const numberMatch = text.match(/\b([1-9])\b/);
  if (numberMatch) return Number(numberMatch[1]);

  const lowered = text.toLowerCase();
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
  };
  for (const [word, value] of Object.entries(words)) {
    if (lowered.includes(word)) return value;
  }

  return NaN;
}

function heuristicDigitFromFeatures(features: MatrixFeatures) {
  if (features.aspectRatio < 0.55 || features.activePixels < 65) return 1;
  if (features.activePixels > 165) return 8;
  if (features.centerY < 11 && features.aspectRatio > 0.8) return 7;
  if (features.centerX > 14 && features.activePixels > 95) return 9;
  if (features.aspectRatio > 1.25) return 2;
  return 5;
}

function downsampleTo14x14(matrix: number[][]) {
  const out: number[][] = [];
  for (let y = 0; y < 14; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < 14; x += 1) {
      const y0 = y * 2;
      const x0 = x * 2;
      const avg =
        (matrix[y0][x0] +
          matrix[y0][x0 + 1] +
          matrix[y0 + 1][x0] +
          matrix[y0 + 1][x0 + 1]) /
        4;
      row.push(Number(avg.toFixed(2)));
    }
    out.push(row);
  }
  return out;
}

function shiftMatrix(matrix: number[][], dx: number, dy: number) {
  const shifted = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 0));
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny >= 0 && ny < GRID_SIZE && nx >= 0 && nx < GRID_SIZE) {
        shifted[ny][nx] = matrix[y][x];
      }
    }
  }
  return shifted;
}

function dilateMatrix(matrix: number[][]) {
  const dilated = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 0));
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      let maxValue = matrix[y][x];
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const ny = y + ky;
          const nx = x + kx;
          if (ny >= 0 && ny < GRID_SIZE && nx >= 0 && nx < GRID_SIZE) {
            maxValue = Math.max(maxValue, matrix[ny][nx]);
          }
        }
      }
      dilated[y][x] = Number(maxValue.toFixed(3));
    }
  }
  return dilated;
}

function getMatrixFeatures(matrix: number[][]): MatrixFeatures {
  let minX = GRID_SIZE;
  let minY = GRID_SIZE;
  let maxX = 0;
  let maxY = 0;
  let activePixels = 0;
  let sumX = 0;
  let sumY = 0;
  let sumWeight = 0;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const value = matrix[y][x];
      if (value > 0.2) {
        activePixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      sumWeight += value;
      sumX += value * x;
      sumY += value * y;
    }
  }

  const width = minX <= maxX ? maxX - minX + 1 : 1;
  const height = minY <= maxY ? maxY - minY + 1 : 1;

  return {
    activePixels,
    aspectRatio: Number((width / height).toFixed(3)),
    centerX: Number((sumX / (sumWeight || 1)).toFixed(3)),
    centerY: Number((sumY / (sumWeight || 1)).toFixed(3)),
  };
}

function matrixToSparsePoints(matrix: number[][]) {
  const points: string[] = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const value = matrix[y][x];
      if (value > 0.2) {
        points.push(`${x}:${y}:${value.toFixed(2)}`);
      }
    }
  }
  return points.slice(0, 180).join(" ");
}

function summarizeVariant(name: string, matrix: number[][]) {
  return {
    name,
    features: getMatrixFeatures(matrix),
    sparse: matrixToSparsePoints(matrix),
    mini14: downsampleTo14x14(matrix),
  };
}

function encodeMini14(mini14: number[][]) {
  return mini14
    .map((row) =>
      row
        .map((v) => {
          if (v < 0.15) return "0";
          if (v < 0.35) return "1";
          if (v < 0.6) return "2";
          return "3";
        })
        .join("")
    )
    .join("/");
}

export function DrawAIGuess() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [isGuessing, setIsGuessing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [guess, setGuess] = useState<GuessResult | null>(null);
  const [modelUsed, setModelUsed] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    context.fillStyle = "#000000";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.lineWidth = 18;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#ffffff";
  }, []);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const point = getPoint(event);
    isDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const endDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawingRef.current = false;
    canvas.releasePointerCapture(event.pointerId);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#000000";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    setGuess(null);
    setErrorText("");
  };

  const getNormalizedGrid = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const fullContext = canvas.getContext("2d", { willReadFrequently: true });
    if (!fullContext) return null;

    const fullImageData = fullContext.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
    let minX = CANVAS_SIZE;
    let minY = CANVAS_SIZE;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < CANVAS_SIZE; y += 1) {
      for (let x = 0; x < CANVAS_SIZE; x += 1) {
        const i = (y * CANVAS_SIZE + x) * 4;
        const intensity = (fullImageData[i] + fullImageData[i + 1] + fullImageData[i + 2]) / 3;
        if (intensity > 20) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (minX > maxX || minY > maxY) {
      return null;
    }

    const pad = 16;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(CANVAS_SIZE - 1, maxX + pad);
    maxY = Math.min(CANVAS_SIZE - 1, maxY + pad);

    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;
    const squareSize = Math.max(cropWidth, cropHeight);

    const squareCanvas = document.createElement("canvas");
    squareCanvas.width = squareSize;
    squareCanvas.height = squareSize;
    const squareContext = squareCanvas.getContext("2d", { willReadFrequently: true });
    if (!squareContext) return null;

    squareContext.fillStyle = "#000000";
    squareContext.fillRect(0, 0, squareSize, squareSize);
    squareContext.imageSmoothingEnabled = true;
    squareContext.drawImage(
      canvas,
      minX,
      minY,
      cropWidth,
      cropHeight,
      (squareSize - cropWidth) / 2,
      (squareSize - cropHeight) / 2,
      cropWidth,
      cropHeight
    );

    const smallCanvas = document.createElement("canvas");
    smallCanvas.width = GRID_SIZE;
    smallCanvas.height = GRID_SIZE;
    const smallContext = smallCanvas.getContext("2d", { willReadFrequently: true });
    if (!smallContext) return null;

    smallContext.fillStyle = "#000000";
    smallContext.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
    smallContext.imageSmoothingEnabled = true;

    const offset = Math.floor((GRID_SIZE - MNIST_INNER_SIZE) / 2);
    smallContext.drawImage(
      squareCanvas,
      0,
      0,
      squareSize,
      squareSize,
      offset,
      offset,
      MNIST_INNER_SIZE,
      MNIST_INNER_SIZE
    );

    const imageData = smallContext.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data;

    const matrix: number[][] = [];
    let brightPixelCount = 0;

    for (let y = 0; y < GRID_SIZE; y += 1) {
      const row: number[] = [];
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const i = (y * GRID_SIZE + x) * 4;
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const gray = (r + g + b) / 3;
        const normalized = Number((gray / 255).toFixed(3));
        if (normalized > 0.1) brightPixelCount += 1;
        row.push(normalized);
      }
      matrix.push(row);
    }

    return {
      matrix,
      brightPixelCount,
    };
  };

  const askSarvamForGuess = async () => {
    const apiKey = import.meta.env.VITE_SARVAM_API_KEY;
    if (!apiKey) {
      setErrorText("Missing VITE_SARVAM_API_KEY in your .env file.");
      return;
    }

    const normalized = getNormalizedGrid();
    if (!normalized) {
      setErrorText("Could not read drawing data from canvas.");
      return;
    }

    if (normalized.brightPixelCount < 8) {
      setErrorText("Draw a clearer digit first, then try again.");
      return;
    }

    setIsGuessing(true);
    setErrorText("");
    setGuess(null);

    const originalMini14 = downsampleTo14x14(normalized.matrix);
    const shiftedMini14 = downsampleTo14x14(shiftMatrix(normalized.matrix, 1, 0));
    const dilatedMini14 = downsampleTo14x14(dilateMatrix(normalized.matrix));
    const compactPayload = {
      f: getMatrixFeatures(normalized.matrix),
      o: encodeMini14(originalMini14),
      s: encodeMini14(shiftedMini14),
      d: encodeMini14(dilatedMini14),
    };

    const modelCandidates = (
      import.meta.env.VITE_SARVAM_MODEL_CANDIDATES || "sarvam-30b,sarvam-105b,sarvam-m"
    )
      .split(",")
      .map((m: string) => m.trim())
      .filter(Boolean);

    const sendRequest = async (model: string, content: string, maxTokens: number) => {
      const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content }],
          max_tokens: maxTokens,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        const compactError = errorBody.replace(/\s+/g, " ").trim().slice(0, 260);
        throw new Error(`Sarvam request failed with status ${response.status}${compactError ? `: ${compactError}` : ""}`);
      }

      return response.json();
    };

    try {
      const basePrompt =
        "Digit classification task. Input encodes a 14x14 grayscale digit using chars 0-3 (0=black,3=white). " +
        "Digit is only from 1-9. Use o/s/d as original/shifted/dilated variants and f as shape features. " +
        "Reply STRICT JSON only: {\"best_digit\":number,\"confidence\":number,\"reason\":string}. " +
        JSON.stringify(compactPayload);

      let payload: any = null;
      let lastError = "";

      for (const model of modelCandidates) {
        try {
          payload = await sendRequest(model, basePrompt, 60);
          setModelUsed(model);
          break;
        } catch (firstError) {
          const firstMessage = firstError instanceof Error ? firstError.message : "";
          lastError = firstMessage;
          if (!firstMessage.includes("status 422")) {
            continue;
          }

          const tinyPrompt =
            "Classify 1-9 digit from encoded 14x14 grid. Return JSON: {\"best_digit\":number,\"confidence\":number}. " +
            `o=${compactPayload.o}`;
          try {
            payload = await sendRequest(model, tinyPrompt, 30);
            setModelUsed(model);
            break;
          } catch (tinyError) {
            lastError = tinyError instanceof Error ? tinyError.message : firstMessage;
          }
        }
      }

      if (!payload) {
        throw new Error(lastError || "All configured Sarvam models failed.");
      }

      const rawContent = payload?.choices?.[0]?.message?.content;
      const rawText =
        typeof rawContent === "string"
          ? rawContent
          : Array.isArray(rawContent)
          ? rawContent
              .map((part) =>
                typeof part === "string"
                  ? part
                  : typeof part?.text === "string"
                  ? part.text
                  : ""
              )
              .join(" ")
          : rawContent
          ? JSON.stringify(rawContent)
          : "";
      const parsedText = extractJsonObject(rawText);

      let data = {} as GuessResult;
      if (parsedText) {
        try {
          data = JSON.parse(parsedText) as GuessResult;
        } catch {
          data = {} as GuessResult;
        }
      }

      let responseDigit =
        Number((data as unknown as { best_digit?: number }).best_digit) || Number(data.digit);
      let responseConfidence = Number(data.confidence);
      let fallbackUsed = false;

      if (!Number.isFinite(responseDigit)) {
        responseDigit = extractDigitFromText(rawText);
      }
      if (!Number.isFinite(responseDigit)) {
        responseDigit = heuristicDigitFromFeatures(compactPayload.f);
        fallbackUsed = true;
      }
      if (!Number.isFinite(responseConfidence)) {
        responseConfidence = fallbackUsed ? 35 : 50;
      }

      const safeDigit = clamp(Math.round(responseDigit), 1, 9);
      const safeConfidence = clamp(Math.round(responseConfidence), 0, 100);

      setGuess({
        digit: safeDigit,
        confidence: safeConfidence,
        reason: data.reason || (fallbackUsed ? "Fallback guess from digit-shape features." : "Compact-grid based Sarvam guess."),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get digit guess.";
      setErrorText(message);
    } finally {
      setIsGuessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Draw & AI Guess (CNN Demo) 1-9</h1>
      <p className="text-lg text-gray-600 mb-8">
        Draw a single handwritten digit from 1 to 9. The canvas is converted to a 28x28 grayscale grid and sent to Sarvam AI for classification.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-5 flex items-center gap-2">
            <PencilLine className="w-6 h-6 text-blue-600" />
            Draw Digit
          </h2>

          <div className="rounded-xl border border-gray-300 p-4 bg-gray-100">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={endDrawing}
              onPointerLeave={(event) => {
                if (isDrawingRef.current) {
                  endDrawing(event);
                }
              }}
              className="w-full max-w-[360px] aspect-square rounded-lg touch-none mx-auto bg-black cursor-crosshair"
            />
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <button
              onClick={askSarvamForGuess}
              disabled={isGuessing}
              className="px-5 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              {isGuessing ? "Guessing..." : "Guess with Sarvam AI"}
            </button>

            <button
              onClick={clearCanvas}
              className="px-5 py-3 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 flex items-center gap-2"
            >
              <Eraser className="w-5 h-5" />
              Clear
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4">Uses VITE_SARVAM_API_KEY and optional VITE_SARVAM_MODEL_CANDIDATES.</p>
          {modelUsed && <p className="text-xs text-gray-500 mt-1">Model used: {modelUsed}</p>}
          {errorText && <p className="text-sm text-red-600 mt-2">{errorText}</p>}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-5">AI Result</h2>

          {guess ? (
            <div className="space-y-5">
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                <p className="text-sm text-blue-700 mb-1">Predicted Digit</p>
                <p className="text-6xl font-bold text-blue-900">{guess.digit}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Confidence</p>
                  <p className="text-sm font-semibold text-gray-900">{guess.confidence}%</p>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${guess.confidence}%` }}
                  />
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <p className="text-sm text-amber-900">
                  <span className="font-semibold">Why this guess:</span> {guess.reason}
                </p>
              </div>
            </div>
          ) : (
            <div className="min-h-[260px] rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 flex items-center justify-center text-center">
              <p className="text-gray-500">
                Draw a digit from 1 to 9 and click Guess with Sarvam AI.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}