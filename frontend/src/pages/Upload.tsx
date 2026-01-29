import JSZip from 'jszip';
import { useState } from 'react';
import Navbar from '../components/Navbar';
import { uploadFiles } from '../lib/api';

interface UploadProgress {
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
  status: 'idle' | 'processing' | 'success' | 'error';
}

export default function Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    currentFile: '',
    currentIndex: 0,
    totalFiles: 0,
    status: 'idle'
  });

  // Inline status message (replaces toasts)
  const [message, setMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  
  // Track file processing status
  const [fileStatuses, setFileStatuses] = useState<Map<number, 'processing' | 'success' | 'error'>>(new Map());

  function showMessage(text: string, type: 'info' | 'success' | 'error' = 'info') {
    setMessage({ text, type });
  }

  function removeFile(index: number) {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    showMessage(`Removed file: ${files[index].name}`, 'info');
    
    // If all files are removed, reset the file input
    if (newFiles.length === 0) {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  }

  function clearAllFiles() {
    setFiles([]);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    showMessage('All files cleared', 'info');
  }

  async function extractZipFiles(selectedFiles: File[]): Promise<File[]> {
    const extractedFiles: File[] = [];
    
    for (const file of selectedFiles) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          setExtracting(true);
          showMessage(`Extracting ZIP: ${file.name}`, 'info');
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(file);
          
          let extractedCount = 0;
          // Extract Excel files from ZIP
          for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
            if (!zipEntry.dir && /\.(xlsx|xls|csv)$/i.test(filename)) {
              const blob = await zipEntry.async('blob');
              const extractedFile = new File([blob], filename.split('/').pop() || filename, {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              });
              extractedFiles.push(extractedFile);
              extractedCount++;
            }
          }
          showMessage(`Extracted ${extractedCount} file(s) from ${file.name}`, 'success');
        } catch (error) {
          console.error(`Error extracting ZIP file ${file.name}:`, error);
          showMessage(`Failed to extract ${file.name}`, 'error');
        } finally {
          setExtracting(false);
        }
      } else {
        // Not a ZIP file, add directly
        extractedFiles.push(file);
      }
    }
    
    return extractedFiles;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    
    const processedFiles = await extractZipFiles(selectedFiles);
    setFiles(processedFiles);
    
    if (processedFiles.length > 20) {
      showMessage(`Too many files: ${processedFiles.length}/20 max`, 'error');
    } else if (processedFiles.length > 0) {
      showMessage(`Loaded ${processedFiles.length} file(s) successfully`, 'success');
    }
  }

  async function uploadFilesOneByOne(filesToUpload: File[]) {
    let totalElapsedMs = 0;
    // Process files one by one (linear processing for visible progress)
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      
      // Set file as processing
      setFileStatuses(prev => new Map(prev).set(i, 'processing'));
      
      setUploadProgress({
        currentFile: file.name,
        currentIndex: i + 1,
        totalFiles: filesToUpload.length,
        status: 'processing'
      });
      
      showMessage(`Processing: ${file.name}`, 'info');
      
      try {
        // Upload file individually
        const result: any = await uploadFiles([file]);
        setFileStatuses(prev => new Map(prev).set(i, 'success'));
        showMessage(`✓ ${file.name}`, 'success');
        // Console log detailed backend timings if provided
        if (result) {
          const perFile = Array.isArray(result.files) && result.files.length > 0 ? result.files[0] : null;
          if (perFile) {
            console.groupCollapsed('[Upload] File processed');
            console.log('File:', perFile.name);
            if (typeof perFile.server_processing_ms === 'number') {
              console.log('Server processing (ms):', perFile.server_processing_ms);
            }
            console.log('Request round-trip (ms):', perFile.elapsed_ms);
            if (typeof perFile.courses_new === 'number') {
              console.log('Courses: new =', perFile.courses_new, ', existing =', perFile.courses_existing);
            }
            if (typeof perFile.students_new === 'number') {
              console.log('Students: new =', perFile.students_new, ', existing =', perFile.students_existing);
            }
            if (typeof perFile.total_in_file === 'number') {
              console.log('Attendance records: total_in_file =', perFile.total_in_file);
            }
            if (typeof perFile.inserted === 'number') {
              console.log('Inserted =', perFile.inserted, ', skipped_min_periods =', perFile.skipped_min_periods, ', skipped_duplicate =', perFile.skipped_duplicate);
            }
            console.groupEnd();
            totalElapsedMs += perFile.server_processing_ms || perFile.elapsed_ms || 0;
          }
          if (typeof result.total_elapsed_ms === 'number') {
            // When multiple files are sent at once (not our default), sum the server total
            totalElapsedMs += result.total_elapsed_ms;
          }
        }
      } catch (error) {
        setFileStatuses(prev => new Map(prev).set(i, 'error'));
        showMessage(`✗ Failed: ${file.name}`, 'error');
        throw error;
      }
    }
    return totalElapsedMs;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      showMessage('Please select at least one file', 'error');
      return;
    }
    if (files.length > 20) {
      showMessage('Maximum 20 files allowed', 'error');
      return;
    }
    try {
      setSubmitting(true);
      setFileStatuses(new Map());
      
      // Process files one by one with progress tracking (capture total elapsed)
      const clientStart = performance.now();
      const serverMeasuredTotal = await uploadFilesOneByOne(files);
      
      setUploadProgress({
        currentFile: '',
        currentIndex: files.length,
        totalFiles: files.length,
        status: 'success'
      });
      
      // Success message and redirect info
      showMessage('Files uploaded successfully. Redirecting to dashboard...', 'success');
      setFiles([]);
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      // Console summary (client + server measured)
      const clientElapsed = performance.now() - clientStart;
      console.group('[Upload] Summary');
      console.log('Files count:', files.length);
      console.log('Client total elapsed (ms):', Math.round(clientElapsed));
      if (serverMeasuredTotal) {
        console.log('Server total elapsed (ms):', Math.round(serverMeasuredTotal));
      }
      console.groupEnd();
    } catch (e: any) {
      setUploadProgress(prev => ({ ...prev, status: 'error' }));
      showMessage('Upload failed. Check console for details.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="bg-light min-vh-100">
        <div className="container py-3 py-md-5">
          <div className="row align-items-center mb-3 mb-md-4">
            <div className="col-auto" style={{width: '80px'}}></div>
            <div className="col text-center">
              <h2 className="mb-0 fs-4 fs-md-3">📊 Upload Attendance Data</h2>
            </div>
            <div className="col-auto" style={{width: '80px'}}></div>
          </div>
        
        <form onSubmit={onSubmit} className="card p-3 p-md-4 shadow-sm">
          <div className="mb-3">
            <label className="form-label fw-semibold">Upload Files (Excel or ZIP - Max 20 files)</label>
            <input
              type="file"
              className="form-control"
              name="files"
              multiple
              accept=".xlsx,.xls,.csv,.zip"
              onChange={handleFileChange}
              required
              disabled={extracting || submitting}
            />
            <small className="form-text text-muted d-block mt-2">
              Select up to 20 Excel files (.xlsx, .xls, .csv) or ZIP files containing Excel files.
              {extracting && (
                <span className="text-info ms-2">
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  Extracting ZIP files...
                </span>
              )}
            </small>
          </div>
          
          {files.length > 0 && (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                <strong className="fs-6">
                  Selected files ({files.length})
                  {submitting && uploadProgress.status === 'processing' && (
                    <span className="badge bg-primary ms-2 fs-7">
                      Processing {uploadProgress.currentIndex}/{uploadProgress.totalFiles}
                    </span>
                  )}
                </strong>
                <div className="d-flex gap-2 align-items-center">
                  {files.length >= 1 && (
                    <small className="text-muted d-none d-sm-inline">
                      Click <i className="fas fa-times"></i> to remove
                    </small>
                  )}
                  {files.length > 1 && (
                    <button 
                      type="button" 
                      className="btn btn-outline-danger btn-sm"
                      onClick={clearAllFiles}
                      disabled={submitting}
                    >
                      <i className="fas fa-trash-alt me-1"></i>Clear All
                    </button>
                  )}
                </div>
              </div>
              <div className="selected-files-grid">
                {Array.from(files).map((f, i) => {
                  const status = fileStatuses.get(i);
                  return (
                    <div 
                      key={i} 
                      className={`file-item ${
                        status === 'processing' ? 'file-item-processing' : ''
                      } ${
                        status === 'success' ? 'file-item-success' : ''
                      } ${
                        status === 'error' ? 'file-item-error' : ''
                      }`}
                    >
                      <i className="fas fa-file-excel text-success me-2"></i>
                      <small className="file-name" title={f.name}>{f.name}</small>
                      
                      {status === 'processing' && (
                        <span className="spinner-border spinner-border-sm text-primary ms-auto me-2" role="status"></span>
                      )}
                      {status === 'success' && (
                        <i className="fas fa-check-circle text-success ms-auto me-2" title="Uploaded successfully"></i>
                      )}
                      {status === 'error' && (
                        <i className="fas fa-exclamation-circle text-danger ms-auto me-2" title="Upload failed"></i>
                      )}
                      
                      <button 
                        type="button" 
                        className="btn-remove-file" 
                        onClick={() => removeFile(i)}
                        title="Remove this file"
                        aria-label="Remove file"
                        disabled={submitting}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {submitting && (
            <div className="mb-3">
              <div className="progress" style={{height: '25px'}}>
                <div 
                  className="progress-bar progress-bar-striped progress-bar-animated"
                  role="progressbar"
                  style={{width: `${(uploadProgress.currentIndex / uploadProgress.totalFiles) * 100}%`}}
                  aria-valuenow={uploadProgress.currentIndex}
                  aria-valuemin={0}
                  aria-valuemax={uploadProgress.totalFiles}
                >
                  {uploadProgress.currentIndex} / {uploadProgress.totalFiles}
                </div>
              </div>
            </div>
          )}
          
          <button 
            type="submit" 
            className="btn btn-primary w-100 w-md-auto"
            disabled={submitting || files.length === 0}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Processing Files...
              </>
            ) : (
              <>
                <i className="fas fa-upload me-2"></i>Process Files
              </>
            )}
          </button>
        </form>

        {(message || (submitting && uploadProgress.currentFile)) && (
          <div className={`alert alert-${
            message ? (message.type === 'success' ? 'success' : message.type === 'error' ? 'danger' : 'info') : 'info'
          } mt-3`} role="alert">
            {submitting && uploadProgress.currentFile ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Currently processing: <strong>{uploadProgress.currentFile}</strong>
              </>
            ) : (
              message?.text
            )}
          </div>
        )}
      </div>
      
      {/* Inline message replaces toast container */}
      </div>
    </>
  );
}


