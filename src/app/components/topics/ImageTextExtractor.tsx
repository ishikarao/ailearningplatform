import { useMemo, useState } from "react";
import { Sparkles, Upload, FileImage } from "lucide-react";
import JSZip from "jszip";

type ExtractResult = {
  rawResponse: string;
  status: any;
  text: string;
};

type UploadLinksResponse = {
  upload_urls: Record<string, { file_url: string; file_metadata?: Record<string, unknown> }>;
};

type JobStatusResponse = {
  job_id: string;
  job_state: string;
  error_message?: string;
  job_details?: Array<{
    pages_processed?: number;
    pages_succeeded?: number;
    pages_failed?: number;
  }>;
};

type DownloadLinksResponse = {
  download_urls: Record<string, { file_url: string }>;
};

export function ImageTextExtractor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [result, setResult] = useState<ExtractResult | null>(null);

  const previewUrl = useMemo(() => {
    if (!selectedFile) return "";
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  const createZipWithImage = async (imageFile: File) => {
    const zip = new JSZip();
    zip.file(imageFile.name, imageFile);
    return await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  };

  const uploadWithVisionProxy = async (targetUrl: string, headers: Record<string, string>, body: Blob) => {
    const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
    return await fetch("/__vision_proxy/upload", {
      method: "POST",
      headers: {
        "x-target-url": targetUrl,
        "x-target-headers": encodedHeaders,
        "Content-Type": "application/octet-stream",
      },
      body,
    });
  };

  const downloadWithVisionProxy = async (targetUrl: string) => {
    return await fetch(`/__vision_proxy/download?url=${encodeURIComponent(targetUrl)}`);
  };

  const extractTextFromOutputZip = async (zipBlob: Blob) => {
    const zip = await JSZip.loadAsync(zipBlob);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);

    const md = entries.find((entry) => entry.name.toLowerCase().endsWith(".md"));
    if (md) return await md.async("text");

    const txt = entries.find((entry) => entry.name.toLowerCase().endsWith(".txt"));
    if (txt) return await txt.async("text");

    const json = entries.find((entry) => entry.name.toLowerCase().endsWith(".json"));
    if (json) return await json.async("text");

    if (entries.length > 0) return await entries[0].async("text");
    return "";
  };

  const onSelectFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setResult(null);
    setErrorText("");
  };

  const extractFromImage = async () => {
    const apiKey = import.meta.env.VITE_SARVAM_API_KEY;
    if (!apiKey) {
      setErrorText("Missing AI API key in your .env file.");
      return;
    }

    if (!selectedFile) {
      setErrorText("Please upload an image first.");
      return;
    }

    setIsExtracting(true);
    setErrorText("");
    setResult(null);

    try {
      const zipBlob = await createZipWithImage(selectedFile);

      const createJobResponse = await fetch("https://api.sarvam.ai/doc-digitization/job/v1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          job_parameters: {
            language: "en-IN",
            output_format: "md",
          },
        }),
      });

      if (!createJobResponse.ok) {
        const errorBody = await createJobResponse.text().catch(() => "");
        throw new Error(`Failed to create job (${createJobResponse.status}): ${errorBody || "Unknown error"}`);
      }

      const createdJob = await createJobResponse.json();
      const jobId = createdJob?.job_id;
      if (!jobId) throw new Error("No job_id received from AI service.");

      const uploadLinksResponse = await fetch("https://api.sarvam.ai/doc-digitization/job/v1/upload-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          job_id: jobId,
          files: ["uploaded-image.zip"],
        }),
      });

      if (!uploadLinksResponse.ok) {
        const errorBody = await uploadLinksResponse.text().catch(() => "");
        throw new Error(`Failed to get upload links (${uploadLinksResponse.status}): ${errorBody || "Unknown error"}`);
      }

      const uploadLinks = (await uploadLinksResponse.json()) as UploadLinksResponse;
      const uploadInfo = Object.values(uploadLinks.upload_urls || {})[0];
      if (!uploadInfo?.file_url) throw new Error("Upload URL not provided by AI service.");

      const uploadHeaders: Record<string, string> = { "x-ms-blob-type": "BlockBlob" };
      if (uploadInfo.file_metadata) {
        for (const [key, value] of Object.entries(uploadInfo.file_metadata)) {
          if (typeof value === "string") uploadHeaders[key] = value;
        }
      }

      const putResponse = import.meta.env.DEV
        ? await uploadWithVisionProxy(uploadInfo.file_url, uploadHeaders, zipBlob)
        : await fetch(uploadInfo.file_url, { method: "PUT", headers: uploadHeaders, body: zipBlob });

      if (!putResponse.ok) throw new Error(`Failed to upload image ZIP (${putResponse.status}).`);

      const startResponse = await fetch(`https://api.sarvam.ai/doc-digitization/job/v1/${jobId}/start`, {
        method: "POST",
        headers: {
          "api-subscription-key": apiKey,
        },
      });

      if (!startResponse.ok) {
        const errorBody = await startResponse.text().catch(() => "");
        throw new Error(`Failed to start job (${startResponse.status}): ${errorBody || "Unknown error"}`);
      }

      let status: JobStatusResponse | null = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`https://api.sarvam.ai/doc-digitization/job/v1/${jobId}/status`, {
          method: "GET",
          headers: {
            "api-subscription-key": apiKey,
          },
        });

        if (!statusResponse.ok) {
          const errorBody = await statusResponse.text().catch(() => "");
          throw new Error(`Failed to fetch status (${statusResponse.status}): ${errorBody || "Unknown error"}`);
        }

        status = (await statusResponse.json()) as JobStatusResponse;
        if (["Completed", "PartiallyCompleted", "Failed"].includes(status.job_state)) break;
      }

      if (!status) throw new Error("Timed out waiting for AI job status.");
      if (status.job_state === "Failed") throw new Error(status.error_message || "AI job failed.");

      const downloadLinksResponse = await fetch(`https://api.sarvam.ai/doc-digitization/job/v1/${jobId}/download-files`, {
        method: "POST",
        headers: {
          "api-subscription-key": apiKey,
        },
      });

      if (!downloadLinksResponse.ok) {
        const errorBody = await downloadLinksResponse.text().catch(() => "");
        throw new Error(`Failed to get download links (${downloadLinksResponse.status}): ${errorBody || "Unknown error"}`);
      }

      const downloadLinks = (await downloadLinksResponse.json()) as DownloadLinksResponse;
      const downloadInfo = Object.values(downloadLinks.download_urls || {})[0];
      if (!downloadInfo?.file_url) throw new Error("Download URL not provided by AI service.");

      const outputResponse = import.meta.env.DEV
        ? await downloadWithVisionProxy(downloadInfo.file_url)
        : await fetch(downloadInfo.file_url);

      if (!outputResponse.ok) throw new Error(`Failed to download output ZIP (${outputResponse.status}).`);

      const outputZipBlob = await outputResponse.blob();
      const text = (await extractTextFromOutputZip(outputZipBlob)).trim();

      if (!text) throw new Error("No readable text detected in the uploaded image.");

      setResult({
        rawResponse: JSON.stringify(status, null, 2),
        status,
        text,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to extract text from image.";
      setErrorText(message);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Image Text Extractor</h1>
      <p className="text-lg text-gray-600 mb-8">Upload an image and extract readable text from it.</p>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-8">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-5 flex items-center gap-2">
            <Upload className="w-6 h-6 text-blue-600" />
            Upload Image
          </h2>

          <label className="block">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={onSelectFile}
              className="block w-full text-sm text-gray-700 file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            />
          </label>

          <div className="mt-5 rounded-xl border border-gray-300 p-4 bg-gray-50 min-h-[280px] flex items-center justify-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Uploaded preview" className="max-h-[420px] w-auto rounded-lg border border-gray-200" />
            ) : (
              <div className="text-center text-gray-500">
                <FileImage className="w-9 h-9 mx-auto mb-2" />
                Select an image to preview.
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={extractFromImage}
              disabled={isExtracting || !selectedFile}
              className="px-5 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              {isExtracting ? "Extracting text..." : "Extract Text"}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4">Uses AI API key and uploads the image as ZIP for document text extraction.</p>
          {errorText && <p className="text-sm text-red-600 mt-2">{errorText}</p>}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-5">Extracted Text</h2>
          {result ? (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                <p className="text-sm font-semibold text-blue-700 mb-3">Recognized Text</p>
                <div className="text-base text-blue-900 whitespace-pre-wrap break-words leading-relaxed">{result.text}</div>
              </div>

              <details className="bg-white rounded-xl p-4 border border-gray-200">
                <summary className="text-sm font-semibold text-gray-700 cursor-pointer hover:text-gray-900">Processing Metadata</summary>
                <pre className="text-xs text-gray-800 overflow-auto max-h-96 whitespace-pre-wrap break-words font-mono bg-gray-50 p-4 rounded border border-gray-200 mt-3">
                  {result.rawResponse}
                </pre>
              </details>
            </div>
          ) : (
            <div className="min-h-[260px] rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 flex items-center justify-center text-center">
              <p className="text-gray-500">Upload an image, then click Extract Text.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
