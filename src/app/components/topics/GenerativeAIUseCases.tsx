import { Briefcase, Bot, Film, FlaskConical, Megaphone, Stethoscope } from "lucide-react";

const useCases = [
  {
    icon: Bot,
    title: "AI Assistants and Chatbots",
    summary:
      "Conversational assistants generate human-like responses for support, onboarding, and knowledge lookup.",
    examples: ["Customer support bots", "Internal helpdesk copilots", "FAQ automation"],
  },
  {
    icon: Megaphone,
    title: "Content and Marketing",
    summary:
      "Generative AI drafts blogs, ad copies, social posts, and product descriptions in multiple styles and tones.",
    examples: ["Campaign copy variants", "SEO outlines", "Personalized email drafts"],
  },
  {
    icon: Film,
    title: "Image, Audio, and Video Creation",
    summary:
      "Models generate illustrations, narration, dubbing, music, and short video clips from text prompts.",
    examples: ["Ad creatives", "Explainer visuals", "Voiceover generation"],
  },
  {
    icon: FlaskConical,
    title: "Research and R&D",
    summary:
      "AI can generate hypotheses, summarize papers, and accelerate simulation-driven exploration workflows.",
    examples: ["Literature summarization", "Experiment ideation", "Rapid prototyping"],
  },
  {
    icon: Stethoscope,
    title: "Healthcare and Diagnostics Support",
    summary:
      "Generative systems assist with medical note drafting, clinical summarization, and imaging insights under expert review.",
    examples: ["Clinical report drafting", "Patient education content", "Decision support summaries"],
  },
  {
    icon: Briefcase,
    title: "Enterprise Automation",
    summary:
      "Teams use Gen AI for document intelligence, knowledge retrieval, coding support, and workflow automation.",
    examples: ["Contract summarization", "Policy Q&A", "Code generation assistance"],
  },
];

export function GenerativeAIUseCases() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-3">Generative AI Use Cases</h1>
      <p className="text-lg text-gray-600 mb-8">
        Practical applications of Gen AI across industries, from creative production to enterprise productivity.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {useCases.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">{item.title}</h2>
              </div>
              <p className="text-gray-700 mb-4">{item.summary}</p>
              <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                {item.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
