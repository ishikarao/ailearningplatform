import { useMemo, useRef, useState } from "react";
import { Mic, Square, Languages, AudioLines } from "lucide-react";

type SupportedLanguage = {
  name: string;
  code: string;
};

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { name: "Hindi", code: "hi-IN" },
  { name: "Assamese", code: "as-IN" },
  { name: "Bengali", code: "bn-IN" },
  { name: "Urdu", code: "ur-IN" },
  { name: "Kannada", code: "kn-IN" },
  { name: "Nepali", code: "ne-IN" },
  { name: "Malayalam", code: "ml-IN" },
  { name: "Konkani", code: "kok-IN" },
  { name: "Marathi", code: "mr-IN" },
  { name: "Kashmiri", code: "ks-IN" },
  { name: "Odia", code: "od-IN" },
  { name: "Sindhi", code: "sd-IN" },
  { name: "Punjabi", code: "pa-IN" },
  { name: "Sanskrit", code: "sa-IN" },
  { name: "Tamil", code: "ta-IN" },
  { name: "Santali", code: "sat-IN" },
  { name: "Telugu", code: "te-IN" },
  { name: "Manipuri", code: "mni-IN" },
  { name: "English", code: "en-IN" },
  { name: "Bodo", code: "brx-IN" },
  { name: "Gujarati", code: "gu-IN" },
];

function getSupportedMimeType() {
  const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
  for (const type of preferred) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function SpeechToTextDemo() {
  const [selectedLanguage, setSelectedLanguage] = useState("hi-IN");
  const [recordingLanguage, setRecordingLanguage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const [statusText, setStatusText] = useState("Ready to record");
  const [errorText, setErrorText] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const activeLanguageRef = useRef(selectedLanguage);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const endpoint = import.meta.env.VITE_SARVAM_STT_ENDPOINT || "https://api.sarvam.ai/speech-to-text";

  const fullTranscript = useMemo(() => transcriptChunks.join(" ").trim(), [transcriptChunks]);

  const stopTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const sendSttRequest = async (targetEndpoint: string, formData: FormData, apiKey: string) => {
    return fetch(targetEndpoint, {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
      },
      body: formData,
    });
  };

  const uploadRecording = async (blob: Blob) => {
    if (blob.size === 0) return;

    const apiKey = import.meta.env.VITE_SARVAM_API_KEY;
    if (!apiKey) {
      setErrorText("Missing VITE_SARVAM_API_KEY in your .env file.");
      return;
    }

    setIsSending(true);

    try {
      const normalizedType = blob.type.includes("ogg") ? "audio/ogg" : "audio/webm";
      const ext = normalizedType === "audio/ogg" ? "ogg" : "webm";
      const formData = new FormData();
      formData.append("file", new File([blob], `recording-${Date.now()}.${ext}`, { type: normalizedType }));
      formData.append("model", "saaras:v3");
      formData.append("mode", "transcribe");
      formData.append("language_code", activeLanguageRef.current);

      let response = await sendSttRequest(endpoint, formData, apiKey);

      // Backward compatibility for older endpoint values that include /v1.
      if (response.status === 404 && endpoint.includes("/v1/speech-to-text")) {
        const fallbackEndpoint = endpoint.replace("/v1/speech-to-text", "/speech-to-text");
        response = await sendSttRequest(fallbackEndpoint, formData, apiKey);
      }

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error?.message || `Sarvam request failed with status ${response.status}`;
        throw new Error(message);
      }

      const transcript = (payload?.transcript || "").trim();
      if (transcript) {
        setTranscriptChunks((prev) => {
          return [...prev, transcript];
        });
        setStatusText("Transcript received");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to transcribe audio chunk.";
      setErrorText(message);
      setStatusText("Transcription failed");
    } finally {
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    setErrorText("");
    setStatusText("Requesting microphone access...");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support microphone recording.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      activeLanguageRef.current = selectedLanguage;
      setRecordingLanguage(selectedLanguage);

      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stopTracks();

        const recordedBlob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        recordedChunksRef.current = [];

        if (recordedBlob.size === 0) {
          setStatusText("No audio captured. Please try recording again.");
          return;
        }

        setStatusText("Uploading recording for transcription...");
        await uploadRecording(recordedBlob);
      };

      recorder.start();
      setIsRecording(true);
      setStatusText("Recording... click Stop to transcribe");
    } catch (error) {
      stopTracks();
      const message = error instanceof Error ? error.message : "Could not start recording.";
      setErrorText(message);
      setStatusText("Microphone access failed");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingLanguage(null);
    setStatusText("Processing recording...");
  };

  const clearTranscript = () => {
    setTranscriptChunks([]);
    setErrorText("");
    setStatusText("Ready to record");
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Speech-to-Text Demo (RNN/LSTM)</h1>
      <p className="text-lg text-gray-600 mb-8">
        Record speech, stop recording, then send the full clip to Sarvam Speech-to-Text in your selected language.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <Languages className="w-6 h-6 text-blue-600" />
            Language + Recorder
          </h2>

          <label className="block text-sm font-medium text-gray-700 mb-2">Select Language</label>
          <select
            value={selectedLanguage}
            onChange={(event) => setSelectedLanguage(event.target.value)}
            disabled={isRecording}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name} ({lang.code})
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={startRecording}
              disabled={isRecording}
              className="px-5 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Mic className="w-5 h-5" />
              Start Live Record
            </button>

            <button
              onClick={stopRecording}
              disabled={!isRecording}
              className="px-5 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Square className="w-5 h-5" />
              Stop
            </button>

            <button
              onClick={clearTranscript}
              className="px-5 py-3 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Clear Transcript
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Status:</span> {statusText}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Recording Language:</span> {recordingLanguage || "Not recording"}
            </p>
            <p className="text-xs text-gray-500">
              Uses <span className="font-mono">VITE_SARVAM_API_KEY</span> and optional <span className="font-mono">VITE_SARVAM_STT_ENDPOINT</span>.
            </p>
            {errorText && <p className="text-sm text-red-600">{errorText}</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <AudioLines className="w-6 h-6 text-purple-600" />
            Live Transcript
          </h2>

          <div className="h-28 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 p-4 mb-5 flex items-end gap-1">
            {Array.from({ length: 42 }).map((_, i) => {
              const base = isRecording ? 20 + ((i * 13) % 55) : 10;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full ${isRecording ? "bg-blue-500 animate-pulse" : "bg-blue-200"}`}
                  style={{ height: `${base}%` }}
                />
              );
            })}
          </div>

          <div className="min-h-[220px] bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-y-auto">
            {fullTranscript ? (
              <p className="text-gray-900 leading-7">{fullTranscript}</p>
            ) : (
              <p className="text-gray-500">Your transcript will appear here as chunks are processed.</p>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Tip: Click Start, speak clearly, then click Stop to transcribe the full recording.
          </p>
        </div>
      </div>
    </div>
  );
}
