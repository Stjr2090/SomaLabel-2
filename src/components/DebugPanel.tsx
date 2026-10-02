import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, Terminal } from 'lucide-react';

interface DebugPanelProps {
  rawApiError?: string | null;
  rawModelText?: string | null;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  rawApiError,
  rawModelText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // If both are completely empty, don't show an empty panel
  if (!rawApiError && !rawModelText) {
    return null;
  }

  const handleCopy = () => {
    const textToCopy = `=== RAW API ERROR ===\n${rawApiError || '(None)'}\n\n=== RAW MODEL TEXT ===\n${rawModelText || '(None)'}`;
    navigator.clipboard?.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full mt-6 text-left border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 flex items-center justify-between text-slate-700 font-bold hover:bg-slate-100 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-500" />
          <span>Debug details</span>
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 pt-2 border-t border-slate-200 space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100 font-semibold text-[11px]"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy debug info</span>
                </>
              )}
            </button>
          </div>

          {/* Raw API Error */}
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 block mb-1">
              Raw API Error
            </span>
            <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
              {rawApiError || '(No API error reported)'}
            </div>
          </div>

          {/* Raw Model Text */}
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 block mb-1">
              Raw Model Text
            </span>
            <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-52 whitespace-pre-wrap break-all">
              {rawModelText || '(No model text generated)'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
