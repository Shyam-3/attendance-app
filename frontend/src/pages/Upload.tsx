import JSZip from 'jszip';
import { useState } from 'react';
import { uploadFiles } from '../lib/api';

export default function Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [extracting, setExtracting] = useState(false);

  function removeFile(index: number) {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    
    // If all files are removed, reset the file input
    if (newFiles.length === 0) {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  }

  async function extractZipFiles(selectedFiles: File[]): Promise<File[]> {
    const extractedFiles: File[] = [];
    
    for (const file of selectedFiles) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          setExtracting(true);
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(file);
          
          // Extract Excel files from ZIP
          for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
            if (!zipEntry.dir && /\.(xlsx|xls|csv)$/i.test(filename)) {
              const blob = await zipEntry.async('blob');
              const extractedFile = new File([blob], filename.split('/').pop() || filename, {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              });
              extractedFiles.push(extractedFile);
            }
          }
        } catch (error) {
          console.error(`Error extracting ZIP file ${file.name}:`, error);
          setMessage({ type: 'error', text: `Failed to extract ${file.name}. Please ensure it's a valid ZIP file.` });
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
    
    setMessage(null);
    const processedFiles = await extractZipFiles(selectedFiles);
    setFiles(processedFiles);
    
    if (processedFiles.length > 20) {
      setMessage({ type: 'error', text: `Extracted ${processedFiles.length} files. Maximum 20 files allowed. Please select fewer files.` });
    } else if (processedFiles.length > 0) {
      setMessage({ type: 'success', text: `Successfully loaded ${processedFiles.length} file(s) for upload.` });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one file.' });
      return;
    }
    if (files.length > 20) {
      setMessage({ type: 'error', text: 'Maximum 20 files allowed at once.' });
      return;
    }
    try {
      setSubmitting(true);
      setMessage(null);
      await uploadFiles(files);
      setMessage({ type: 'success', text: 'Upload successful! Files processed successfully. Redirecting to dashboard...' });
      setFiles([]);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (e) {
      setMessage({ type: 'error', text: 'Upload failed. Please check file format and try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-light min-vh-100">
      <div className="container py-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <a href="/" className="btn btn-outline-primary">
            <i className="fas fa-arrow-left me-2"></i>Back to Dashboard
          </a>
          <h2 className="text-center mb-0">📊 Upload Attendance Data</h2>
          <div></div>
        </div>
        
        <form onSubmit={onSubmit} className="card p-4 shadow-sm">
          <div className="mb-3">
            <label className="form-label">Upload Attendance Files (Excel or ZIP - Max 20 files)</label>
            <input
              type="file"
              className="form-control"
              name="files"
              multiple
              accept=".xlsx,.xls,.csv,.zip"
              onChange={handleFileChange}
              required
              disabled={extracting}
            />
            <small className="form-text text-muted">
              You can select up to 20 Excel files (.xlsx, .xls, .csv) or ZIP files containing Excel files.
              {extracting && <span className="text-info ms-2"><i className="fas fa-spinner fa-spin me-1"></i>Extracting ZIP files...</span>}
            </small>
          </div>
          
          {files.length > 0 && (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>Selected files ({files.length}):</strong>
                {files.length > 1 && (
                  <small className="text-muted">Click <i className="fas fa-times"></i> to remove a file</small>
                )}
              </div>
              <div className="selected-files-grid">
                {Array.from(files).map((f, i) => (
                  <div key={i} className="file-item">
                    <i className="fas fa-file-excel text-success me-2"></i>
                    <small className="file-name" title={f.name}>{f.name}</small>
                    <button 
                      type="button" 
                      className="btn-remove-file" 
                      onClick={() => removeFile(i)}
                      title="Remove this file"
                      aria-label="Remove file"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <i className="fas fa-upload me-2"></i>{submitting ? 'Processing Files...' : 'Process Files'}
          </button>
        </form>
        
        {message && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'} mt-3`}>
            <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2`}></i>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}


