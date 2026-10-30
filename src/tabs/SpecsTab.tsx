import React from 'react';
import { FileCode, Check, RefreshCw, BookmarkCheck } from 'lucide-react';
import { SpecFile } from '../types';

interface SpecsTabProps {
  specFiles: SpecFile[];
  selectedSpecPath: string;
  specContent: string;
  savingSpec: boolean;
  saveSuccess: boolean;
  onSelectSpec: (filePath: string) => void;
  onChangeSpecContent: (content: string) => void;
  onSaveSpec: () => void;
}

export default function SpecsTab({
  specFiles,
  selectedSpecPath,
  specContent,
  savingSpec,
  saveSuccess,
  onSelectSpec,
  onChangeSpecContent,
  onSaveSpec
}: SpecsTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 space-y-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
          System Contracts & Specs
        </h3>
        {specFiles.map((file) => (
          <div
            key={file.path}
            onClick={() => onSelectSpec(file.path)}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              selectedSpecPath === file.path
                ? 'bg-indigo-950/40 border-indigo-500/50 text-white shadow-md shadow-indigo-950/30'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs font-mono">{file.path}</span>
              <span className="text-[10px] text-slate-500 font-mono">{file.lineCount} lines</span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {file.exists ? `Size: ${(file.size / 1024).toFixed(1)} KB` : 'Not created'}
            </p>
          </div>
        ))}
      </div>

      <div className="lg:col-span-8 space-y-3">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-white font-mono">{selectedSpecPath}</span>
            </div>

            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              <button
                onClick={onSaveSpec}
                disabled={savingSpec}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                {savingSpec ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BookmarkCheck className="w-3 h-3" />}
                Save Changes
              </button>
            </div>
          </div>

          <textarea
            value={specContent}
            onChange={(e) => onChangeSpecContent(e.target.value)}
            className="w-full h-[520px] bg-slate-950 p-4 text-xs font-mono text-slate-200 focus:outline-none resize-none leading-relaxed"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
