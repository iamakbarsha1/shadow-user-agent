'use client';

import { useRef, useState } from 'react';

interface ApiSpecUploadProps {
  value: string;
  onChange: (spec: string) => void;
}

/**
 * Component for pasting or uploading an OpenAPI JSON specification.
 * Provides inline JSON validation feedback and file upload support.
 */
export function ApiSpecUpload({ value, onChange }: ApiSpecUploadProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const isValidJson = value.trim().length > 0 && (() => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  })();

  const showValidation = value.trim().length > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        onChange(text);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          OpenAPI Specification (JSON)
        </label>
        <p className="text-sm text-muted-foreground mb-4">
          Paste your OpenAPI 3.x or Swagger 2.0 JSON spec below, or upload a .json file
        </p>
      </div>

      <div className="space-y-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          placeholder={'{ "openapi": "3.0.0", ... }'}
          className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 font-mono text-sm resize-y"
          spellCheck={false}
        />

        <div className="flex items-center justify-between">
          {/* Validation indicator */}
          <div className="flex items-center gap-2">
            {showValidation && (
              isValidJson ? (
                <span className="flex items-center gap-1.5 text-sm text-green-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Valid JSON
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-red-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Invalid JSON — check syntax
                </span>
              )
            )}
            {value.trim().length > 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                {value.length.toLocaleString()} characters
              </span>
            )}
          </div>

          {/* File upload button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Upload JSON spec file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-border text-foreground text-sm font-medium transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              {fileName ? `${fileName}` : 'Upload .json'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
