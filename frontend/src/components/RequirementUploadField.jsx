import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Upload, FileText, Trash2, CheckCircle, RefreshCw, Eye, AlertTriangle,
  XCircle, Replace, Plus, X, File, Image as ImageIcon, ExternalLink, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

/* ── Status badge configuration ────────────────────────────────── */
const STATUS_CONFIG = {
  submitted:            { label: 'Submitted',            color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300' },
  pending:              { label: 'Pending Review',       color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300' },
  under_review:         { label: 'Under Review',         color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300' },
  approved:             { label: 'Approved',             color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300' },
  verified:             { label: 'Approved',             color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300' },
  rejected:             { label: 'Rejected',             color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300' },
  needs_replacement:    { label: 'Needs Replacement',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300' },
  replacement_required: { label: 'Needs Replacement',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300' },
  replaced:             { label: 'Replaced',             color: 'bg-muted text-muted-foreground border-border' },
};

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(filename, mime) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (ext === 'pdf' || mime?.includes('pdf')) {
    return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
  }
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) || mime?.includes('image')) {
    return <ImageIcon className="h-4 w-4 text-sky-500 shrink-0" />;
  }
  return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
}

export default function RequirementUploadField({
  requirement,
  docKey,
  existingDocuments = [],
  disabled = false,
  isUploading = false,
  uploadProgress = 0,
  onUpload,           // async (files, docKey, requirement) => void
  onReplace,          // async (file, docId, docKey) => void
  onDelete,           // async (docId) => void
  onPreview,          // (doc) => void
  error = null,
  compact = false,
  className = '',
}) {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState(null);
  const [replacingDocId, setReplacingDocId] = useState(null);
  const [previewModal, setPreviewModal] = useState({ open: false, url: null, title: '', type: '' });
  const [localErrors, setLocalErrors] = useState([]);

  const addFileInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);

  const reqName = requirement?.name || 'Document Requirement';
  const reqDesc = requirement?.description;
  const isRequired = requirement?.is_required !== false;
  const formats = requirement?.formats || ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
  const maxMb = requirement?.max_size_mb || 20;

  // Active (non-replaced) uploaded documents for this requirement
  const uploadedDocs = (existingDocuments || []).filter(d => d.verification_status !== 'replaced');
  const hasApprovedDocs = uploadedDocs.some(d => ['approved', 'verified'].includes(d.verification_status));
  const hasRejectedDocs = uploadedDocs.some(d => ['rejected', 'needs_replacement', 'replacement_required'].includes(d.verification_status));

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      stagedFiles.forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const validateSingleFile = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const normalizedFormats = formats.map(f => f.toLowerCase().trim());
    if (!normalizedFormats.includes(ext) && !normalizedFormats.includes('*')) {
      return `File "${file.name}" has an unsupported format (${ext}). Allowed: ${formats.join(', ')}`;
    }
    if (file.size > maxMb * 1024 * 1024) {
      return `File "${file.name}" (${formatFileSize(file.size)}) exceeds the maximum limit of ${maxMb}MB.`;
    }
    return null;
  };

  const handleFileSelection = (newFileList) => {
    if (!newFileList || newFileList.length === 0) return;
    const filesArray = Array.from(newFileList);
    const errors = [];
    const validItems = [];

    filesArray.forEach((file) => {
      // Validate format and size
      const err = validateSingleFile(file);
      if (err) {
        errors.push(err);
        return;
      }

      // Check if already in stagedFiles (prevent duplicate in same selection)
      const isAlreadyStaged = stagedFiles.some(
        sf => sf.file.name === file.name && sf.file.size === file.size
      );
      if (isAlreadyStaged) {
        errors.push(`"${file.name}" is already in your selected list.`);
        return;
      }

      // Check if already in uploadedDocs
      const isAlreadyUploaded = uploadedDocs.some(
        ud => (ud.original_filename === file.name || ud.label === file.name) && Number(ud.file_size) === file.size
      );
      if (isAlreadyUploaded) {
        errors.push(`"${file.name}" has already been uploaded for this requirement.`);
        return;
      }

      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const previewUrl = (isImage || isPdf) ? URL.createObjectURL(file) : null;

      validItems.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'document',
        isImage,
        isPdf,
        previewUrl,
      });
    });

    if (errors.length > 0) {
      setLocalErrors(errors);
      errors.forEach(e => toast.error(e));
    } else {
      setLocalErrors([]);
    }

    if (validItems.length > 0) {
      // Append to previously selected files without replacing them!
      setStagedFiles(prev => [...prev, ...validItems]);
      toast.success(`${validItems.length} file(s) added. Ready to upload.`);
    }
  };

  const removeStagedFile = (id) => {
    setStagedFiles(prev => {
      const target = prev.find(item => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(item => item.id !== id);
    });
  };

  const clearAllStaged = () => {
    stagedFiles.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setStagedFiles([]);
    setLocalErrors([]);
  };

  const handleUploadStaged = async () => {
    if (stagedFiles.length === 0 || !onUpload) return;
    const filesToUpload = stagedFiles.map(s => s.file);
    try {
      await onUpload(filesToUpload, docKey, requirement);
      // Clear staged files on successful upload
      clearAllStaged();
    } catch (err) {
      // Keep staged files so user doesn't lose their selection
    }
  };

  const handleTriggerReplace = (docId) => {
    setReplacingDocId(docId);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
      replaceFileInputRef.current.click();
    }
  };

  const handleReplaceSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !replacingDocId || !onReplace) return;

    const err = validateSingleFile(file);
    if (err) {
      toast.error(err);
      return;
    }

    try {
      await onReplace(file, replacingDocId, docKey);
      setReplacingDocId(null);
    } catch (err) {
      // Error handled by caller
    }
  };

  const previewStagedFile = (stagedItem) => {
    if (!stagedItem.previewUrl) {
      toast.info('Preview is not available for this file type.');
      return;
    }
    setPreviewModal({
      open: true,
      url: stagedItem.previewUrl,
      title: stagedItem.name,
      type: stagedItem.isPdf ? 'pdf' : (stagedItem.isImage ? 'image' : 'other'),
    });
  };

  const totalAttachments = uploadedDocs.length + stagedFiles.length;

  return (
    <div
      className={`rounded-2xl border p-3.5 sm:p-5 transition-all space-y-4 bg-card w-full max-w-full overflow-hidden ${
        error ? 'border-destructive/60 bg-destructive/5' : 'border-border/80 hover:border-border'
      } ${className}`}
      id={`doc-manager-req-${requirement?.index ?? docKey}`}
      data-req-id={requirement?.id || docKey}
    >
      {/* ── Requirement Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3 w-full max-w-full">
        <div className="space-y-2 min-w-0 flex-1 w-full">
          <div className="flex flex-col xs:flex-row xs:items-center gap-2 flex-wrap">
            <h4 className="text-sm sm:text-base font-bold text-foreground flex items-start sm:items-center gap-2 min-w-0 break-words">
              <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5 sm:mt-0" />
              <span className="break-words">{reqName}</span>
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              {isRequired ? (
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border-primary/20 shrink-0">
                  Required
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground border-border shrink-0">
                  Optional
                </Badge>
              )}

              {/* Total attachments indicator */}
              {totalAttachments > 0 && (
                <Badge variant="secondary" className="text-xs font-semibold gap-1 bg-muted shrink-0">
                  <span>{totalAttachments} {totalAttachments === 1 ? 'file' : 'files'} attached</span>
                </Badge>
              )}

              {hasApprovedDocs && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 text-xs font-semibold gap-1 shrink-0">
                  <CheckCircle className="h-3 w-3" /> Approved
                </Badge>
              )}
            </div>
          </div>

          {reqDesc && (
            <p className="text-xs text-muted-foreground leading-relaxed break-words">
              {reqDesc}
            </p>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] text-muted-foreground pt-0.5 flex-wrap">
            <span className="font-medium text-foreground/80">Multiple pages/attachments supported.</span>
            <span>•</span>
            <span className="break-all">Accepted: {formats.join(', ')}</span>
            <span>•</span>
            <span className="shrink-0">Max {maxMb}MB per file</span>
          </div>
        </div>

        {/* Top-level Upload / Add More Button if attachments exist */}
        {!disabled && !hasApprovedDocs && (
          <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
            <input
              type="file"
              ref={addFileInputRef}
              multiple
              className="hidden"
              accept={formats.join(',')}
              disabled={isUploading}
              onChange={(e) => {
                handleFileSelection(e.target.files);
                e.target.value = '';
              }}
            />
            {uploadedDocs.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full sm:w-auto h-9 gap-1.5 text-xs font-semibold rounded-xl bg-background hover:bg-muted shadow-2xs touch-manipulation justify-center"
                onClick={() => addFileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Add More Files</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Hidden input for replacing a specific document */}
      <input
        type="file"
        ref={replaceFileInputRef}
        className="hidden"
        accept={formats.join(',')}
        disabled={isUploading}
        onChange={handleReplaceSelected}
      />

      {/* Uploading Progress */}
      {isUploading && (
        <div className="space-y-1.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between text-xs text-primary font-bold">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Uploading attachment(s)...</span>
            </span>
            <span>{uploadProgress || 0}%</span>
          </div>
          <Progress value={uploadProgress || 0} className="h-2" />
        </div>
      )}

      {/* ── 1. Uploaded Attachments (Already on Server) ─────────────── */}
      {uploadedDocs.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Uploaded Attachments ({uploadedDocs.length})</span>
            </span>
          </div>

          <div className="space-y-2">
            {uploadedDocs.map((doc, idx) => {
              const vstatus = doc.verification_status || doc.review_status || 'pending';
              const cfg = STATUS_CONFIG[vstatus] || STATUS_CONFIG.pending;
              const isApproved = ['approved', 'verified'].includes(vstatus);
              const isRejected = ['rejected', 'needs_replacement', 'replacement_required'].includes(vstatus);
              const remark = doc.verification_remark || doc.review_note || doc.reviewer_remarks;

              return (
                <div
                  key={doc.id || idx}
                  className="rounded-xl border border-border/70 p-3 bg-muted/20 hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-lg bg-card border border-border/80 flex items-center justify-center shrink-0 shadow-2xs">
                      {getFileIcon(doc.original_filename, doc.mime_type)}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-full" title={doc.original_filename}>
                          {doc.original_filename || doc.label || `Attachment ${idx + 1}`}
                        </p>
                        <Badge variant="outline" className={`text-[10px] font-semibold py-0 px-2 ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                        <span>{formatFileSize(doc.file_size)}</span>
                        {doc.created_at && (
                          <>
                            <span>•</span>
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Saved</span>
                      </div>
                      {remark && (
                        <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-900/50 mt-1 italic break-words">
                          ⚠️ {remark}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions for this specific uploaded attachment */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {onPreview && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onPreview(doc)}
                        className="h-9 px-3 text-xs gap-1.5 font-semibold text-muted-foreground hover:text-foreground touch-manipulation"
                        title="Preview attachment"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Preview</span>
                      </Button>
                    )}

                    {!disabled && !isApproved && vstatus !== 'under_review' && onReplace && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTriggerReplace(doc.id)}
                        className="h-9 px-3 text-xs gap-1.5 font-semibold text-muted-foreground hover:text-foreground touch-manipulation"
                        title="Replace this attachment"
                      >
                        <Replace className="h-4 w-4" />
                        <span>Replace</span>
                      </Button>
                    )}

                    {!disabled && !isApproved && vstatus !== 'under_review' && onDelete && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirmDoc(doc)}
                        className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 rounded-xl touch-manipulation flex items-center justify-center min-h-[36px] min-w-[36px]"
                        title="Remove attachment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. Staged Files (Newly Selected, Ready to Upload) ───────── */}
      {stagedFiles.length > 0 && (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 sm:p-3.5 space-y-3 w-full max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 min-w-0">
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Selected Files to Upload ({stagedFiles.length})</span>
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearAllStaged}
                className="h-9 text-xs text-muted-foreground hover:text-destructive px-3 touch-manipulation shrink-0"
                disabled={isUploading}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={handleUploadStaged}
                disabled={isUploading}
                className="h-9 px-4 text-xs font-bold gap-1.5 shadow-2xs touch-manipulation flex-1 sm:flex-initial justify-center"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    <span>Upload {stagedFiles.length} {stagedFiles.length === 1 ? 'File' : 'Files'}</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {stagedFiles.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 sm:gap-3 p-2.5 rounded-lg bg-background border border-primary/20 text-xs min-w-0"
              >
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                  <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                    {getFileIcon(item.name, item.type)}
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="font-semibold text-foreground truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {formatFileSize(item.size)} • Newly Selected
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {(item.isImage || item.isPdf) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => previewStagedFile(item)}
                      className="h-8 px-2 sm:px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground touch-manipulation"
                    >
                      <Eye className="h-3.5 w-3.5 shrink-0" />
                      <span className="hidden xs:inline">Preview</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeStagedFile(item.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-lg touch-manipulation flex items-center justify-center min-h-[34px] min-w-[34px]"
                    title="Remove from selection"
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Add more files to current staging and bottom Upload action */}
          {!disabled && (
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-primary/20">
              <div className="flex flex-col xs:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-10 px-3.5 text-xs font-semibold rounded-xl bg-background hover:bg-muted gap-1.5 touch-manipulation flex-1 sm:flex-initial justify-center shadow-2xs"
                  onClick={() => addFileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>+ Add More Files</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={handleUploadStaged}
                  disabled={isUploading}
                  className="h-10 px-4 text-xs font-bold gap-1.5 shadow-2xs touch-manipulation flex-1 sm:flex-initial justify-center"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5 shrink-0" />
                      <span>Upload {stagedFiles.length} {stagedFiles.length === 1 ? 'File' : 'Files'}</span>
                    </>
                  )}
                </Button>
              </div>
              <span className="text-[11px] text-muted-foreground italic break-words text-center sm:text-right">
                Ready to upload. Click "Upload" to submit.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── 3. Empty State / Dropzone (When no files are yet uploaded or staged) ── */}
      {uploadedDocs.length === 0 && stagedFiles.length === 0 && !disabled && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length > 0) {
              handleFileSelection(e.dataTransfer.files);
            }
          }}
          onClick={() => addFileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-2xl p-4 sm:p-6 text-center transition-all w-full max-w-full overflow-hidden ${
            dragOver
              ? 'border-primary bg-primary/10 scale-[1.005]'
              : error
                ? 'border-destructive/60 bg-destructive/5 hover:bg-destructive/10'
                : 'border-border/80 hover:border-primary/60 hover:bg-primary/5 bg-muted/10'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-muted text-muted-foreground group-hover:text-primary flex items-center justify-center transition-colors">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground break-words px-2">
                <span className="hidden sm:inline">Click to select or drag & drop files</span>
                <span className="sm:hidden">Tap to choose files or take photo</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 break-words px-2">
                <span className="hidden sm:inline">Select one or multiple files at once. You can add more pages anytime.</span>
                <span className="sm:hidden">Select PDF, photo, or document from your phone.</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono mt-1 flex-wrap justify-center px-1">
              <span>{formats.map(f => f.replace('.', '').toUpperCase()).join(', ')}</span>
              <span>•</span>
              <span>Up to {maxMb}MB per file</span>
            </div>
          </div>
        </div>
      )}

      {/* Local validation errors */}
      {localErrors.length > 0 && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive space-y-1">
          {localErrors.map((err, i) => (
            <p key={i} className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{err}</span>
            </p>
          ))}
        </div>
      )}

      {/* Missing Required Warning (when submitting without any files) */}
      {error && uploadedDocs.length === 0 && stagedFiles.length === 0 && (
        <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Modal: Preview Staged File ──────────────────────────────── */}
      <Dialog open={previewModal.open} onOpenChange={(open) => setPreviewModal(prev => ({ ...prev, open }))}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold truncate">
              {previewModal.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Previewing selected file before upload
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-[300px] max-h-[60vh] flex items-center justify-center bg-muted/20 rounded-xl p-2 border">
            {previewModal.type === 'image' && (
              <img
                src={previewModal.url}
                alt={previewModal.title}
                className="max-h-[55vh] max-w-full object-contain rounded"
              />
            )}
            {previewModal.type === 'pdf' && (
              <iframe
                src={previewModal.url}
                title={previewModal.title}
                className="w-full h-[55vh] rounded border-0"
              />
            )}
            {previewModal.type === 'other' && (
              <div className="text-center p-8 text-muted-foreground">
                <File className="h-12 w-12 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">Preview not supported for this file format.</p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewModal(prev => ({ ...prev, open: false }))}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Confirm Delete Uploaded Attachment ────────────────── */}
      <Dialog open={Boolean(deleteConfirmDoc)} onOpenChange={(open) => !open && setDeleteConfirmDoc(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Remove Attachment
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-2">
              Are you sure you want to remove <strong>"{deleteConfirmDoc?.original_filename || 'this attachment'}"</strong> from {reqName}?
              <br />
              Other attachments belonging to this requirement will remain intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmDoc(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (deleteConfirmDoc && onDelete) {
                  const targetId = deleteConfirmDoc.id;
                  setDeleteConfirmDoc(null);
                  await onDelete(targetId);
                }
              }}
            >
              Remove Attachment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
