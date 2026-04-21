import { Link, Outlet, useLocation } from "react-router";
import { Brain, MessageCircle } from "lucide-react";
import { AIAssistant } from "./AIAssistant";
import { useState } from "react";

export function Layout() {
  const location = useLocation();
  const [showAssistant, setShowAssistant] = useState(false);

  const topics = [
    { path: "/neural-network", label: "Neural Network" },
    { path: "/forward-propagation", label: "Forward Propagation" },
    { path: "/backward-propagation", label: "Backward Propagation" },
    {
      path: "/cnn",
      label: "CNN",
      children: [
        { path: "/image-text-extractor", label: "Image Text Extractor" },
        { path: "/scribble-vision-board", label: "Scribble Vision Board" },
      ],
    },
    {
      path: "/rnn",
      label: "RNN",
      children: [{ path: "/speech-to-text-demo", label: "Speech-to-Text Demo" }],
    },
    { path: "/lstm", label: "LSTM" },
    { path: "/hopfield-network", label: "Hopfield Network" },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">AI Made Easy</h1>
          </Link>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Topics</h2>
          <ul className="space-y-1">
            {topics.map((topic) => {
              const isParentActive =
                location.pathname === topic.path ||
                (topic.children ? topic.children.some((child) => child.path === location.pathname) : false);

              return (
              <li key={topic.path}>
                <Link
                  to={topic.path}
                  className={`block px-4 py-2 rounded-lg transition-colors ${
                    isParentActive
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {topic.label}
                </Link>

                {topic.children && (
                  <ul className="mt-1 ml-4 space-y-1">
                    {topic.children.map((child) => (
                      <li key={child.path}>
                        <Link
                          to={child.path}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            location.pathname === child.path
                              ? "bg-blue-50 text-blue-700 font-medium"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">Interactive AI Learning Platform</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* AI Assistant Button */}
      <button
        onClick={() => setShowAssistant(!showAssistant)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-50"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* AI Assistant Panel */}
      {showAssistant && (
        <AIAssistant onClose={() => setShowAssistant(false)} />
      )}
    </div>
  );
}
