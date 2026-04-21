import { Link } from "react-router";
import { BookOpen } from "lucide-react";

const studyTopics = [
  {
    title: "What Is Generative AI",
    detail:
      "Generative AI creates new text, images, audio, video, and code by learning patterns from large datasets using deep learning.",
  },
  {
    title: "How It Works: Training and Inference",
    detail:
      "During training, models learn billions of parameters. During inference, they generate output from prompts using learned patterns.",
  },
  {
    title: "Model Types",
    detail:
      "Transformers generate token by token, diffusion models denoise random noise into images, and GAN/VAE families learn latent structure.",
  },
  {
    title: "RAG and Grounded Generation",
    detail:
      "Retrieval-Augmented Generation fetches relevant documents at runtime to reduce hallucinations and improve factual accuracy.",
  },
  {
    title: "Prompt Engineering",
    detail:
      "Specify subject, style, composition, and constraints. Iterate prompts in small steps to improve quality and consistency.",
  },
  {
    title: "Fine-Tuning and Adaptation",
    detail:
      "Techniques like LoRA and QLoRA adapt pre-trained models for domain-specific tasks with lower compute cost.",
  },
  {
    title: "Evaluation and Safety",
    detail:
      "Assess factuality, coherence, diversity, fairness, and latency. Include human oversight for high-impact workflows.",
  },
  {
    title: "Advantages and Limitations",
    detail:
      "Gen AI boosts productivity and personalization, but also introduces risks like bias, misinformation, and legal/ethical concerns.",
  },
];

export function GenerativeAIStudio() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-3">Generative AI</h1>
      <p className="text-lg text-gray-600 mb-8">
        Learn core Gen AI concepts and explore practical applications.
      </p>

      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600" />
          Study Material
        </h2>

        <div className="space-y-4">
          {studyTopics.map((topic) => (
            <div key={topic.title} className="rounded-lg border border-gray-200 p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-1">{topic.title}</h3>
              <p className="text-gray-700 text-sm leading-relaxed">{topic.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-blue-900 font-medium mb-2">Prompting Checklist</p>
          <ul className="text-sm text-blue-900 space-y-1 list-disc ml-5">
            <li>Define subject, style, lighting, and composition</li>
            <li>Add quality cues like high detail, cinematic, realistic</li>
            <li>Constrain negatives: blur, artifacts, low quality</li>
            <li>Iterate in small prompt edits</li>
          </ul>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link
            to="/generative-ai-use-cases"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Open Use Cases
          </Link>
          <Link
            to="/generative-ai-image-generator"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Image Generation
          </Link>
        </div>
      </div>
    </div>
  );
}