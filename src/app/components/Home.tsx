import { Link } from "react-router";
import { Brain, TrendingUp, TrendingDown, Grid3x3, Repeat, Clock, Network, Mic, PencilLine, Sparkles } from "lucide-react";

export function Home() {
  const topics = [
    {
      path: "/neural-network",
      icon: Brain,
      title: "Neural Network",
      description: "Learn the fundamentals of artificial neural networks and how they mimic the human brain.",
      color: "bg-blue-100 text-blue-600",
    },
    {
      path: "/forward-propagation",
      icon: TrendingUp,
      title: "Forward Propagation",
      description: "Understand how data flows forward through the network during prediction.",
      color: "bg-green-100 text-green-600",
    },
    {
      path: "/backward-propagation",
      icon: TrendingDown,
      title: "Backward Propagation",
      description: "Explore how networks learn by propagating errors backward to update weights.",
      color: "bg-red-100 text-red-600",
    },
    {
      path: "/cnn",
      icon: Grid3x3,
      title: "Convolutional Neural Networks",
      description: "Discover how CNNs revolutionized computer vision and image recognition.",
      color: "bg-purple-100 text-purple-600",
    },
    {
      path: "/rnn",
      icon: Repeat,
      title: "Recurrent Neural Networks",
      description: "Learn about networks designed for sequential data and time series.",
      color: "bg-orange-100 text-orange-600",
    },
    {
      path: "/lstm",
      icon: Clock,
      title: "Long Short-Term Memory",
      description: "Master the architecture that solved the vanishing gradient problem.",
      color: "bg-teal-100 text-teal-600",
    },
    {
      path: "/hopfield-network",
      icon: Network,
      title: "Hopfield Network",
      description: "Explore content-addressable memory systems and pattern recognition.",
      color: "bg-indigo-100 text-indigo-600",
    },
    {
      path: "/speech-to-text-demo",
      icon: Mic,
      title: "Speech-to-Text Demo (RNN/LSTM)",
      description: "Record live audio, choose language, and transcribe speech with AI.",
      color: "bg-pink-100 text-pink-600",
    },
    {
      path: "/draw-ai-guess",
      icon: PencilLine,
      title: "Draw & AI Guess (CNN Demo) 1-9",
      description: "Draw a digit and let AI classify it from 1 to 9.",
      color: "bg-amber-100 text-amber-700",
    },
    {
      path: "/scribble-vision-board",
      icon: Sparkles,
      title: "Scribble Board + Vision Guess",
      description: "Write or draw anything and let AI Vision guess what it sees.",
      color: "bg-cyan-100 text-cyan-700",
    },
  ];

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">AI Made Easy</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Interactive learning platform for mastering artificial intelligence and deep learning concepts
          </p>
        </div>

        {/* Topics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topics.map((topic) => {
            const Icon = topic.icon;
            return (
              <Link
                key={topic.path}
                to={topic.path}
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                <div className={`w-12 h-12 ${topic.color} rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{topic.title}</h3>
                <p className="text-gray-600">{topic.description}</p>
              </Link>
            );
          })}
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Interactive Learning</h3>
            <p className="text-gray-600">Engage with live visualizations and adjust parameters in real-time</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Grid3x3 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Real-World Applications</h3>
            <p className="text-gray-600">See practical implementations of each AI concept</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Network className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">AI Assistant</h3>
            <p className="text-gray-600">Get instant help and answers to your questions</p>
          </div>
        </div>
      </div>
    </div>
  );
}
