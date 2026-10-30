import React, { useState, useMemo } from 'react';
import {
  FileCode,
  Check,
  RefreshCw,
  BookmarkCheck,
  Lock,
  Edit3,
  AlertTriangle,
  GitCompare,
  RotateCcw
} from 'lucide-react';
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

interface DiffLine {
  type: 'same' | 'add' | 'del';
  oldLineNo?: number;
  newLineNo?: number;
  text: string;
}

function computeLineDiff(original: string, modified: string): DiffLine[] {
  const a = original.split('\n');
  const b = modified.split('\n');
  const m = a.length;
  const n = b.length;

  // LCS matrix for line-level diff (files in .spec/ are small, < 200 lines)
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: 'same', oldLineNo: i + 1, newLineNo: j + 1, text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'del', oldLineNo: i + 1, text: a[i] });
      i++;
    } else {
      result.push({ type: 'add', newLineNo: j + 1, text: b[j] });
      j++;
    }
  }
  while (i < m) {
    result.push({ type: 'del', oldLineNo: i + 1, text: a[i] });
    i++;
  }
  while (j < n) {
    result.push({ type: 'add', newLineNo: j + 1, text: b[j] });
    j++;
  }
  return result;
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
  const [showDiffReview, setShowDiffReview] = useState(false);
  const [pendingSwitchPath, setPendingSwitchPath] = useState<string | null>(null);

  const currentFile = specFiles.find((f) => f.path === selectedSpecPath);
  const originalContent = currentFile?.content ?? '';
  const isReadOnly = Boolean(currentFile?.readOnly);
  const isDirty = !isReadOnly && specContent !== originalContent;

  const diffLines = useMemo(() => {
    if (!isDirty) return [];
    return computeLineDiff(originalContent, specContent);
  }, [isDirty, originalContent, specContent]);

  const addedCount = diffLines.filter((d) => d.type === 'add').length;
  const removedCount = diffLines.filter((d) => d.type === 'del').length;

  const handleRequestSelectFile = (nextPath: string) => {
    if (nextPath === selectedSpecPath) return;
    if (isDirty) {
      setPendingSwitchPath(nextPath);
      return;
    }
    setShowDiffReview(false);
    setPendingSwitchPath(null);
    onSelectSpec(nextPath);
  };

  const handleConfirmDiscardAndSwitch = () => {
    if (!pendingSwitchPath) return;
    const target = pendingSwitchPath;
    setPendingSwitchPath(null);
    setShowDiffReview(false);
    onSelectSpec(target);
  };

  const handleDiscardEdits = () => {
    onChangeSpecContent(originalContent);
    setShowDiffReview(false);
    setPendingSwitchPath(null);
  };

  const handleConfirmSave = () => {
    onSaveSpec();
    setShowDiffReview(false);
    setPendingSwitchPath(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Sidebar File List with Ownership Labels */}
      <div className="lg:col-span-4 space-y-2.5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            System Contracts &amp; Ownership
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            {specFiles.filter((f) => !f.readOnly).length} editable /{' '}
            {specFiles.filter((f) => f.readOnly).length} harness
          </span>
        </div>

        {specFiles.map((file) => {
          const isSelected = selectedSpecPath === file.path;
          const fileDirty = isSelected && isDirty;
          return (
            <button
              key={file.path}
              type="button"
              onClick={() => handleRequestSelectFile(file.path)}
              className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-950/40 border-indigo-500/50 text-white shadow-md shadow-indigo-950/30'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-semibold text-xs font-mono truncate flex items-center gap-1.5">
                  {file.readOnly ? (
                    <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                  ) : (
                    <Edit3 className="w-3 h-3 text-emerald-400 shrink-0" />
                  )}
                  {file.path}
                </span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {file.lineCount} lines
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    file.ownership === 'harness-owned'
                      ? 'bg-amber-950/70 text-amber-300 border-amber-700/50'
                      : file.ownership === 'template'
                      ? 'bg-cyan-950/70 text-cyan-300 border-cyan-700/50'
                      : 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                  }`}
                >
                  {file.ownership === 'harness-owned'
                    ? 'HARNESS-OWNED (READ-ONLY)'
                    : file.ownership === 'template'
                    ? 'EDITABLE (SPOKE TEMPLATE)'
                    : 'EDITABLE (PROJECT-OWNED)'}
                </span>

                {fileDirty && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    UNSAVED
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Editor & Diff Panel */}
      <div className="lg:col-span-8 space-y-3">
        {/* Unsaved Changes Warning when Attempting to Switch Files */}
        {pendingSwitchPath && (
          <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-500/50 text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300 block">
                  Unsaved Changes in {selectedSpecPath}
                </span>
                <span className="text-amber-200/90">
                  You have {addedCount} added and {removedCount} removed line(s). Review and save
                  your diff first, or discard changes to open{' '}
                  <code className="font-mono text-white">{pendingSwitchPath}</code>.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => {
                  setPendingSwitchPath(null);
                  setShowDiffReview(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
              >
                Review Diff &amp; Save
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscardAndSwitch}
                className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-medium cursor-pointer"
              >
                Discard &amp; Switch
              </button>
            </div>
          </div>
        )}

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
          {/* Editor Top Bar */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-white font-mono">
                {selectedSpecPath}
              </span>
              {currentFile && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    currentFile.readOnly
                      ? 'bg-amber-950/70 text-amber-300 border-amber-700/50'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40'
                  }`}
                >
                  {currentFile.ownershipLabel}
                </span>
              )}
              {isDirty && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  +{addedCount} / -{removedCount} lines modified
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {saveSuccess && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}

              {!isReadOnly && isDirty && (
                <>
                  <button
                    type="button"
                    onClick={handleDiscardEdits}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiffReview((v) => !v)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                      showDiffReview
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                        : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white'
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    {showDiffReview ? 'Back to Editor' : 'Review Diff & Save'}
                  </button>
                </>
              )}

              {!isReadOnly && !isDirty && (
                <button
                  type="button"
                  disabled
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/70 text-slate-500 border border-slate-800 flex items-center gap-1.5 cursor-not-allowed"
                >
                  <BookmarkCheck className="w-3 h-3" />
                  No Unsaved Changes
                </button>
              )}
            </div>
          </div>

          {/* Read-only notice for harness-owned files */}
          {isReadOnly && (
            <div className="px-4 py-2.5 bg-amber-950/30 border-b border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                <strong>Protected Harness Engine File:</strong>{' '}
                <code className="font-mono text-amber-300">{selectedSpecPath}</code> is managed by
                the harness engine and overwritten on spoke sync. Use <code className="font-mono">/learn</code> to append operator rules safely.
              </span>
            </div>
          )}

          {/* Diff Review Before Saving */}
          {showDiffReview && isDirty ? (
            <div className="bg-slate-950">
              <div className="px-4 py-2.5 bg-indigo-950/30 border-b border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-indigo-200 font-mono">
                  Reviewing diff before saving <strong className="text-white">{selectedSpecPath}</strong>:{' '}
                  <span className="text-emerald-400">+{addedCount} added</span>,{' '}
                  <span className="text-rose-400">-{removedCount} removed</span>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={savingSpec}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 self-end sm:self-auto cursor-pointer"
                >
                  {savingSpec ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BookmarkCheck className="w-3.5 h-3.5" />
                  )}
                  Confirm &amp; Write to Disk
                </button>
              </div>

              <div className="max-h-[480px] overflow-y-auto font-mono text-xs divide-y divide-slate-900">
                {diffLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start px-3 py-0.5 whitespace-pre-wrap leading-relaxed ${
                      line.type === 'add'
                        ? 'bg-emerald-950/40 text-emerald-200'
                        : line.type === 'del'
                        ? 'bg-rose-950/40 text-rose-200'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className="w-8 shrink-0 text-right pr-2 text-[10px] text-slate-600 select-none">
                      {line.oldLineNo ?? ''}
                    </span>
                    <span className="w-8 shrink-0 text-right pr-2 text-[10px] text-slate-600 select-none">
                      {line.newLineNo ?? ''}
                    </span>
                    <span className="w-4 shrink-0 font-bold select-none">
                      {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                    </span>
                    <span className="flex-1 break-all">{line.text || ' '}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <textarea
              value={specContent}
              onChange={(e) => onChangeSpecContent(e.target.value)}
              readOnly={isReadOnly}
              aria-label={`Editor for ${selectedSpecPath}`}
              className={`w-full h-[520px] bg-slate-950 p-4 text-xs font-mono focus:outline-none resize-none leading-relaxed ${
                isReadOnly ? 'text-slate-400 cursor-default' : 'text-slate-200'
              }`}
              spellCheck={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
