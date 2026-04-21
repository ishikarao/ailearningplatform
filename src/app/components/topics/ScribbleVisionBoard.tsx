import { useEffect, useRef, useState } from "react";
import { Eraser, Sparkles, PencilLine } from "lucide-react";

type VisionGuess = {
  rawResponse: string;
  fullPayload: any;
};

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 560;

export function ScribbleVisionBoard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [isEraser, setIsEraser] = useState(false);
  const [brushSize, setBrushSize] = useState(9);
  const [isGuessing, setIsGuessing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [guess, setGuess] = useState<VisionGuess | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = brushSize;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = brushSize;
    ctx.strokeStyle = isEraser ? "#ffffff" : "#111111";
  }, [brushSize, isEraser]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(event);
    isDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + 0.01, point.y + 0.01);
    ctx.stroke();
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
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

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = isEraser ? "#ffffff" : "#111111";
    setGuess(null);
    setErrorText("");
  };

  const hasEnoughInk = () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    const data = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
    let darkPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avg < 235) darkPixels += 1;
      if (darkPixels > 1800) return true;
    }

    return false;
  };

  const guessFromSarvamVision = async () => {
    const apiKey = import.meta.env.VITE_SARVAM_API_KEY;
    if (!apiKey) {
      setErrorText("Missing VITE_SARVAM_API_KEY in your .env file.");
      return;
    }

    if (!hasEnoughInk()) {
      setErrorText("Write or draw something clearly first, then ask Sarvam Vision to guess.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setErrorText("Canvas is not ready.");
      return;
    }

    setIsGuessing(true);
    setErrorText("");
    setGuess(null);

    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to create blob"));
        }, "image/png");
      });

      // Step 1: Create a Document Intelligence job
      const createJobResponse = await fetch("https://api.sarvam.ai/v1/document-intelligence/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          language: "en-IN",
          output_format: "md"
        }),
      });

      if (!createJobResponse.ok) {
        throw new Error(`Failed to create job: ${createJobResponse.status}`);
      }

      const jobData = await createJobResponse.json();
      const jobId = jobData.job_id;

      // Step 2: Upload the image
      const formData = new FormData();
      formData.append("file", blob, "scribble.png");

      const uploadResponse = await fetch(
        `https://api.sarvam.ai/v1/document-intelligence/jobs/${jobId}/upload`,
        {
          method: "POST",
          headers: {
            "api-subscription-key": apiKey,
          },
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.status}`);
      }

      // Step 3: Start the job
      const startResponse = await fetch(
        `https://api.sarvam.ai/v1/document-intelligence/jobs/${jobId}/start`,
        {
          method: "POST",
          headers: {
            "api-subscription-key": apiKey,
          },
        }
      );

      if (!startResponse.ok) {
        throw new Error(`Failed to start job: ${startResponse.status}`);
      }

      // Step 4: Poll for completion
      let status;
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await fetch(
          `https://api.sarvam.ai/v1/document-intelligence/jobs/${jobId}`,
          {
            headers: {
              "api-subscription-key": apiKey,
            },
          }
        );

        if (!statusResponse.ok) {
          throw new Error(`Failed to get status: ${statusResponse.status}`);
        }

        status = await statusResponse.json();
        
        if (status.job_state === "Completed" || status.job_state === "Failed") {
          break;
        }
        
        attempts++;
      }

      if (status?.job_state !== "Completed") {
        throw new Error(`Job did not complete. Status: ${status?.job_state}`);
      }

      // Step 5: Download output
      const outputResponse = await fetch(
        `https://api.sarvam.ai/v1/document-intelligence/jobs/${jobId}/output`,
        {
          headers: {
            "api-subscription-key": apiKey,
          },
        }
      );

      if (!outputResponse.ok) {
        throw new Error(`Failed to download output: ${outputResponse.status}`);
      }

      const outputBlob = await outputResponse.blob();
      const outputText = await outputBlob.text();

      setGuess({
        rawResponse: JSON.stringify(status, null, 2),
        fullPayload: {
          status,
          extractedText: outputText
        }
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get Sarvam Vision response.";
      setErrorText(message);
    } finally {
      setIsGuessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Scribble Board + Sarvam Vision (Document Intelligence)</h1>
      <p className="text-lg text-gray-600 mb-8">
        Write anything or draw any sketch, then let Sarvam Vision extract text from it.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-8">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-5 flex items-center gap-2">
            <PencilLine className="w-6 h-6 text-blue-600" />
            Draw or Write
          </h2>

          <div className="rounded-xl border border-gray-300 p-4 bg-gradient-to-b from-white to-gray-50">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={endDrawing}
              onPointerLeave={(event) => {
                if (isDrawingRef.current) endDrawing(event);
              }}
              className="w-full aspect-[16/10] rounded-lg touch-none bg-white border border-gray-200 cursor-crosshair"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsEraser(false)}
              className={`px-4 py-2 rounded-lg border ${
                !isEraser ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-800 border-gray-300"
              }`}
            >
              Pen
            </button>

            <button
              onClick={() => setIsEraser(true)}
              className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${
                isEraser ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-800 border-gray-300"
              }`}
            >
              <Eraser className="w-4 h-4" />
              Eraser
            </button>

            <label className="flex items-center gap-2 text-sm text-gray-700 ml-2">
              Brush
              <input
                type="range"
                min={2}
                max={38}
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                className="w-36"
              />
              <span className="text-xs text-gray-500 w-7">{brushSize}</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={guessFromSarvamVision}
              disabled={isGuessing}
              className="px-5 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              {isGuessing ? "Sarvam Vision is analyzing..." : "Analyze with Sarvam Vision"}
            </button>

            <button
              onClick={clearCanvas}
              className="px-5 py-3 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Clear Board
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Uses VITE_SARVAM_API_KEY. This uses Sarvam's Document Intelligence API for OCR.
          </p>
          {errorText && <p className="text-sm text-red-600 mt-2">{errorText}</p>}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-5">Extracted Text</h2>

          {guess ? (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                <p className="text-sm font-semibold text-blue-700 mb-3">Recognized Text</p>
                <div className="text-base text-blue-900 whitespace-pre-wrap break-words leading-relaxed">
                  {guess.fullPayload?.extractedText || "No text extracted"}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">Job Metadata</p>
                <div className="space-y-2 text-sm">
                  {guess.fullPayload?.status?.job_id && (
                    <div className="flex gap-2">
                      <span className="font-medium text-gray-600">Job ID:</span>
                      <span className="text-gray-800 font-mono text-xs">{guess.fullPayload.status.job_id}</span>
                    </div>
                  )}
                  {guess.fullPayload?.status?.job_state && (
                    <div className="flex gap-2">
                      <span className="font-medium text-gray-600">Status:</span>
                      <span className="text-gray-800">{guess.fullPayload.status.job_state}</span>
                    </div>
                  )}
                  {guess.fullPayload?.status?.page_metrics && (
                    <div className="flex gap-2">
                      <span className="font-medium text-gray-600">Pages Processed:</span>
                      <span className="text-gray-800">
                        {guess.fullPayload.status.page_metrics.pages_processed || 0}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <details className="bg-white rounded-xl p-4 border border-gray-200">
                <summary className="text-sm font-semibold text-gray-700 cursor-pointer hover:text-gray-900">
                  Full Response (click to expand)
                </summary>
                <pre className="text-xs text-gray-800 overflow-auto max-h-96 whitespace-pre-wrap break-words font-mono bg-gray-50 p-4 rounded border border-gray-200 mt-3">
                  {guess.rawResponse}
                </pre>
              </details>
            </div>
          ) : (
            <div className="min-h-[260px] rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 flex items-center justify-center text-center">
              <p className="text-gray-500">Draw or write anything, then click Analyze with Sarvam Vision.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}