import { useMemo, useState } from "react";
import { Wand2 } from "lucide-react";

type GenerateResponse = {
  response?: string;
  image?: string;
  images?: string[];
};

const DEFAULT_MODEL = import.meta.env.VITE_OLLAMA_IMAGE_MODEL || "x/flux2-klein:4b";
const IMAGE_GENERATION_ENDPOINT = import.meta.env.VITE_OLLAMA_ENDPOINT || "http://localhost:11434/api/generate";

const starterPrompts = [
  "A futuristic AI classroom with holographic neural network diagrams, cinematic lighting, ultra detailed",
  "A robot teacher explaining deep learning on a digital whiteboard, vibrant colors, 4k illustration",
  "An isometric city powered by AI agents and data pipelines, clean style, sharp details",
  "A surreal library where books become floating vectors and embeddings, dreamy atmosphere",
];

function extractBase64Image(payload: GenerateResponse): string {
  if (payload.image && payload.image.trim()) return payload.image.trim();
  if (Array.isArray(payload.images) && payload.images.length > 0) {
    const first = payload.images[0];
    if (typeof first === "string" && first.trim()) return first.trim();
  }

  const responseText = payload.response || "";
  const markdownDataUrlMatch = responseText.match(/data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)/i);
  if (markdownDataUrlMatch?.[2]) return markdownDataUrlMatch[2];

  const rawBase64Match = responseText.match(/([A-Za-z0-9+/]{200,}={0,2})/);
  if (rawBase64Match?.[1]) return rawBase64Match[1];

  return "";
}

export function GenerativeAIImageGenerator() {
  const [prompt, setPrompt] = useState(starterPrompts[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [imageBase64, setImageBase64] = useState("");

  const imageDataUrl = useMemo(() => {
    if (!imageBase64) return "";
    return `data:image/png;base64,${imageBase64}`;
  }, [imageBase64]);

  const generateImage = async () => {
    if (!prompt.trim()) {
      setErrorText("Please enter a prompt.");
      return;
    }

    setIsGenerating(true);
    setErrorText("");
    setImageBase64("");

    try {
      const response = await fetch(IMAGE_GENERATION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`Image generation request failed (${response.status}): ${errorBody || "Unknown error"}`);
      }

      const payload = (await response.json()) as GenerateResponse;
      const extracted = extractBase64Image(payload);

      if (!extracted) {
        throw new Error("No image found in model response. Verify model supports image generation output.");
      }

      setImageBase64(extracted);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image generation failed.";
      setErrorText(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-3">Gen AI Image Generator</h1>
      <p className="text-lg text-gray-600 mb-8">Insert prompt or use sample prompt to generate image.</p>

      <div className="bg-white rounded-xl p-6 shadow-lg max-w-4xl">
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm text-gray-700 mb-1">Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Describe the image you want to generate"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {starterPrompts.map((starter) => (
              <button
                key={starter}
                onClick={() => setPrompt(starter)}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Use Sample Prompt
              </button>
            ))}
          </div>

          <button
            onClick={generateImage}
            disabled={isGenerating}
            className="px-5 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Wand2 className="w-5 h-5" />
            {isGenerating ? "Generating..." : "Generate Image"}
          </button>

          {errorText && <p className="text-sm text-red-600">{errorText}</p>}

          {imageDataUrl ? (
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <img src={imageDataUrl} alt="Generated from prompt" className="w-full rounded-lg" />
            </div>
          ) : (
            <div className="min-h-[260px] rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 flex items-center justify-center text-center">
              <p className="text-gray-500">Generated image will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}