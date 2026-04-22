import { useState } from "react";
import { BrainCircuit, Lightbulb, ListChecks } from "lucide-react";

type StructuredSolution = {
  topicName: string;
  topicExplanation: string;
  intuition: string;
  algorithm: string[];
  complexity: {
    time: string;
    space: string;
  };
  dryRun: string;
  edgeCases: string[];
  solution: {
    python: string;
  };
};

const OLLAMA_ENDPOINT =
  import.meta.env.VITE_OLLAMA_ENDPOINT ||
  "http://localhost:11434/api/generate";

// 🔥 USE SMALL MODEL
const MODEL_NAME =
  import.meta.env.VITE_OLLAMA_DSA_MODEL || "llama3.2:3b";

export function DSAProblemAssistant() {
  const [problem, setProblem] = useState("");
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<StructuredSolution | null>(null);
  const [error, setError] = useState("");

  const cleanJSON = (text: string) => {
    const match =
      text.match(/```json\s*([\s\S]*?)```/) ||
      text.match(/{[\s\S]*}/);
    return match ? match[1] || match[0] : "";
  };

  const generate = async () => {
    if (!problem.trim()) return;

    setLoading(true);
    setRawText("");
    setParsed(null);
    setError("");

    const prompt = `
You are a DSA tutor. Return ONLY JSON in this format:
{
  "topicName": "",
  "topicExplanation": "",
  "intuition": "",
  "algorithm": ["", ""],
  "complexity": { "time": "", "space": "" },
  "dryRun": "",
  "edgeCases": ["", ""],
  "solution": { "python": "" }
}

Keep explanation short and clear.

Problem:
${problem}
`;

    try {
      const res = await fetch(OLLAMA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL_NAME,
          prompt,
          stream: true,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      let fullText = "";

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const json = JSON.parse(line);
            fullText += json.response || "";
          } catch {}
        }

        setRawText(fullText); // 🔥 live update
      }

      // 🔥 parse after complete
      const cleaned = cleanJSON(fullText);

      try {
        const parsedJSON = JSON.parse(cleaned);
        setParsed(parsedJSON);
      } catch {
        setError("Failed to parse structured response.");
      }
    } catch (err: any) {
      setError(err.message || "Error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">DSA AI Assistant</h1>

      {/* INPUT */}
      <textarea
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
        className="w-full border p-3 rounded-lg mb-4"
        rows={6}
        placeholder="Enter DSA problem..."
      />

      <button
        onClick={generate}
        disabled={loading}
        className="bg-blue-600 text-white px-5 py-2 rounded-lg"
      >
        {loading ? "Generating..." : "Generate"}
      </button>

      {error && <p className="text-red-500 mt-3">{error}</p>}

      {/* OUTPUT */}
      <div className="mt-8 space-y-4">
        {parsed ? (
          <>
            <Card title="Topic">{parsed.topicName}</Card>
            <Card title="Explanation">{parsed.topicExplanation}</Card>
            <Card title="Intuition">{parsed.intuition}</Card>

            <Card title="Algorithm">
              <ol className="list-decimal ml-5">
                {parsed.algorithm.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </Card>

            <Card title="Complexity">
              <p>Time: {parsed.complexity.time}</p>
              <p>Space: {parsed.complexity.space}</p>
            </Card>

            <Card title="Dry Run">{parsed.dryRun}</Card>

            <Card title="Edge Cases">
              <ul className="list-disc ml-5">
                {parsed.edgeCases.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </Card>

            <Card title="Python Code">
              <pre className="bg-black text-green-400 p-3 rounded overflow-auto">
                {parsed.solution.python}
              </pre>
            </Card>
          </>
        ) : (
          rawText && (
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm text-gray-500 mb-2">
                Generating (live)...
              </p>
              <pre className="whitespace-pre-wrap text-sm">
                {rawText}
              </pre>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// 🔥 Reusable UI Card
function Card({
  title,
  children,
}: {
  title: string;
  children?: any;
}) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow">
      <h2 className="font-semibold mb-2">{title}</h2>
      <div className="text-gray-700 whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}