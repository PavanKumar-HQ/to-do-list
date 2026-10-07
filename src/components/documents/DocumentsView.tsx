import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  Upload,
  Camera,
  Search,
  Download,
  Eye,
  Trash2,
  Edit2,
  X,
  FileCheck,
  Shield,
  Receipt,
  HeartPulse,
  Award,
  FileBadge,
  CreditCard,
  Plus,
  AlertTriangle,
  Calendar,
  User,
  Hash
} from 'lucide-react';
import { DocumentRepository } from '../../repositories/DocumentRepository';
import { db } from '../../db/db';
import { formatDisplayDate } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { DocumentScannerModal } from './DocumentScannerModal';
import type { DocumentItem, DocumentCategory, EntityType } from '../../types';

export const DocumentsView: React.FC = () => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  // Source Choice Modal (Upload vs Camera Scan)
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Add Document Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('govt_id');
  const [docNumber, setDocNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [docExpiryDate, setDocExpiryDate] = useState('');
  const [docIssueDate, setDocIssueDate] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [relatedType, setRelatedType] = useState<EntityType>('person');
  const [relatedId, setRelatedId] = useState('');

  // Selected file buffer
  const [selectedFileData, setSelectedFileData] = useState<{
    name: string;
    size: number;
    mimeType: string;
    dataUrl: string;
  } | null>(null);

  // Edit Modal
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('govt_id');
  const [editDocNumber, setEditDocNumber] = useState('');
  const [editHolderName, setEditHolderName] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Queries
  const documents = useLiveQuery(async () => {
    return DocumentRepository.queryAllActive();
  }, []) || [];

  const people = useLiveQuery(async () => db.people.filter(p => !p.deletedAt).toArray(), []) || [];
  const familyMembers = useLiveQuery(async () => db.familyMembers.filter(f => !f.deletedAt).toArray(), []) || [];
  const warranties = useLiveQuery(async () => db.warranties.filter(w => !w.deletedAt).toArray(), []) || [];

  const handleOpenAddFlow = () => {
    setIsChoiceModalOpen(true);
  };

  const handleStartUpload = () => {
    setIsChoiceModalOpen(false);
    fileInputRef.current?.click();
  };

  const handleStartScanner = () => {
    setIsChoiceModalOpen(false);
    setIsScannerOpen(true);
  };

  const handleScannerCompleted = (dataUrl: string, fileName: string, fileSize: number) => {
    setSelectedFileData({
      name: fileName,
      size: fileSize,
      mimeType: 'image/jpeg',
      dataUrl
    });
    setDocTitle(docTitle || 'Scanned Government ID');
    setDocCategory('govt_id');
    setIsAddOpen(true);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      showToast('File size exceeds 20MB limit for local vault', { type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFileData({
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        dataUrl: reader.result as string
      });
      if (!docTitle) {
        setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      setIsAddOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = '';
  };

  const handleSaveDocument = async () => {
    if (!docTitle.trim()) {
      showToast('Document title is required', { type: 'warning' });
      return;
    }
    if (!selectedFileData) {
      showToast('Please attach or scan a document image/file', { type: 'warning' });
      return;
    }

    try {
      await DocumentRepository.create({
        title: docTitle.trim(),
        category: docCategory,
        documentNumber: docNumber.trim() || undefined,
        holderName: holderName.trim() || undefined,
        expiryDate: docExpiryDate || undefined,
        issueDate: docIssueDate || undefined,
        relatedEntityType: relatedType,
        relatedEntityId: relatedId || 'none',
        fileData: selectedFileData.dataUrl,
        fileName: selectedFileData.name,
        fileSize: selectedFileData.size,
        mimeType: selectedFileData.mimeType,
        notes: docNotes.trim() || undefined
      });

      showToast('Document securely saved to personal archive', { type: 'success' });
      setIsAddOpen(false);
      setDocTitle('');
      setDocNumber('');
      setHolderName('');
      setDocExpiryDate('');
      setDocIssueDate('');
      setDocNotes('');
      setSelectedFileData(null);
      setRelatedId('');
    } catch (err: any) {
      showToast(err.message || 'Failed to save document', { type: 'error' });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingDoc || !editTitle.trim()) return;

    try {
      await DocumentRepository.update(editingDoc.id, {
        title: editTitle.trim(),
        category: editCategory,
        documentNumber: editDocNumber.trim() || undefined,
        holderName: editHolderName.trim() || undefined,
        expiryDate: editExpiryDate || undefined,
        notes: editNotes.trim() || undefined
      });
      showToast('Document details updated', { type: 'success' });
      setEditingDoc(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to update', { type: 'error' });
    }
  };

  const handleDeleteDoc = async (doc: DocumentItem) => {
    if (confirm(`Move "${doc.title}" to trash?`)) {
      await DocumentRepository.softDelete(doc.id);
      showToast(`Moved ${doc.title} to trash`, { type: 'info' });
      if (previewDoc?.id === doc.id) setPreviewDoc(null);
    }
  };

  const handleDownload = (doc: DocumentItem) => {
    if (!doc.fileData) {
      showToast('No raw file content available for this document', { type: 'warning' });
      return;
    }
    const a = document.createElement('a');
    a.href = doc.fileData;
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getCategoryBadge = (category: DocumentCategory) => {
    switch (category) {
      case 'govt_id':
        return (
          <span className="badge badge-accent" style={{ gap: '4px' }}>
            <CreditCard size={12} />
            <span>Govt ID</span>
          </span>
        );
      case 'id':
        return (
          <span className="badge badge-accent" style={{ gap: '4px' }}>
            <FileBadge size={12} />
            <span>Identity</span>
          </span>
        );
      case 'medical':
        return (
          <span className="badge badge-danger" style={{ gap: '4px' }}>
            <HeartPulse size={12} />
            <span>Medical</span>
          </span>
        );
      case 'insurance':
        return (
          <span className="badge badge-warning" style={{ gap: '4px' }}>
            <Shield size={12} />
            <span>Insurance</span>
          </span>
        );
      case 'warranty':
        return (
          <span className="badge badge-success" style={{ gap: '4px' }}>
            <Shield size={12} />
            <span>Warranty</span>
          </span>
        );
      case 'receipt':
        return (
          <span className="badge badge-neutral" style={{ gap: '4px' }}>
            <Receipt size={12} />
            <span>Receipt</span>
          </span>
        );
      default:
        return (
          <span className="badge badge-neutral" style={{ gap: '4px' }}>
            <FileText size={12} />
            <span>{category}</span>
          </span>
        );
    }
  };

  const categories: { key: DocumentCategory | 'all'; label: string }[] = [
    { key: 'all', label: 'All Documents' },
    { key: 'govt_id', label: 'Government IDs' },
    { key: 'id', label: 'Passports & Licenses' },
    { key: 'medical', label: 'Medical Reports' },
    { key: 'insurance', label: 'Insurance Policies' },
    { key: 'warranty', label: 'Warranties' },
    { key: 'receipt', label: 'Invoices & Receipts' },
    { key: 'agreement', label: 'Agreements & Contracts' },
    { key: 'certificate', label: 'Certificates' },
    { key: 'other', label: 'Other' }
  ];

  const filteredDocs = documents.filter(doc => {
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      doc.title.toLowerCase().includes(q) ||
      doc.fileName.toLowerCase().includes(q) ||
      (doc.documentNumber && doc.documentNumber.toLowerCase().includes(q)) ||
      (doc.holderName && doc.holderName.toLowerCase().includes(q)) ||
      (doc.notes && doc.notes.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="doc-page">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
        accept="image/*,application/pdf"
      />

      {/* Header */}
      <div className="doc-header">
        <div>
          <h1 className="doc-header-title">Documents & IDs Vault</h1>
          <p className="doc-header-subtitle">
            Secure, local-first archive for Government IDs, Passports, Medical Records, Policies & Receipts.
          </p>
        </div>

        <button
          onClick={handleOpenAddFlow}
          className="btn btn-primary"
          style={{ gap: '8px', padding: '9px 18px', fontSize: '13.5px', borderRadius: 'var(--radius-sm)' }}
        >
          <Plus size={16} />
          <span>Add Document / ID</span>
        </button>
      </div>

      {/* Search and Category Filter Chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by title, ID number, holder name, notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        {/* Filter Pills with Horizontal Scroll */}
        <div className="category-scroll">
          {categories.map(c => {
            const count = c.key === 'all' ? documents.length : documents.filter(d => d.category === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setSelectedCategory(c.key)}
                className={`cat-chip ${selectedCategory === c.key ? 'active' : ''}`}
              >
                <span>{c.label}</span>
                {count > 0 && <span style={{ opacity: 0.8, marginLeft: '4px' }}>({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocs.length === 0 ? (
        <div className="card" style={{ padding: '48px 20px', textAlign: 'center', marginTop: '20px' }}>
          <FileText size={48} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            No documents found
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '420px', margin: '4px auto 16px auto' }}>
            Store your Government ID cards (Aadhaar, Passport, PAN), health insurance papers, and warranty receipts locally on this device.
          </p>
          <button
            onClick={handleOpenAddFlow}
            className="btn btn-primary btn-sm"
          >
            <Plus size={15} />
            <span>Add or Scan First Document</span>
          </button>
        </div>
      ) : (
        <div className="doc-grid">
          {filteredDocs.map(doc => {
            const isImage = doc.mimeType?.startsWith('image/');
            const isExpiringSoon = doc.expiryDate && new Date(doc.expiryDate).getTime() - Date.now() < 30 * 86400000;

            return (
              <div key={doc.id} className="doc-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      {getCategoryBadge(doc.category)}
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '6px' }}>
                        {doc.title}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => {
                          setEditingDoc(doc);
                          setEditTitle(doc.title);
                          setEditCategory(doc.category);
                          setEditDocNumber(doc.documentNumber || '');
                          setEditHolderName(doc.holderName || '');
                          setEditExpiryDate(doc.expiryDate || '');
                          setEditNotes(doc.notes || '');
                        }}
                        className="btn-ghost"
                        style={{ padding: '4px', color: 'var(--text-muted)' }}
                        title="Edit metadata"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc)}
                        className="btn-ghost"
                        style={{ padding: '4px', color: 'var(--danger)' }}
                        title="Move to trash"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* ID Number & Holder Info */}
                  {(doc.documentNumber || doc.holderName) && (
                    <div style={{ marginTop: '8px', padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: '6px', fontSize: '12px' }}>
                      {doc.documentNumber && (
                        <div style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                          ID: {doc.documentNumber}
                        </div>
                      )}
                      {doc.holderName && (
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Holder: {doc.holderName}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Preview Thumbnail */}
                  <div
                    onClick={() => setPreviewDoc(doc)}
                    className="doc-preview-area"
                  >
                    {isImage && doc.fileData ? (
                      <img src={doc.fileData} alt={doc.title} />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <FileText size={36} style={{ margin: '0 auto 6px auto' }} />
                        <span style={{ fontSize: '11.5px', fontFamily: 'monospace' }}>
                          {doc.fileName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expiry Alert */}
                  {doc.expiryDate && (
                    <div style={{
                      fontSize: '11.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: isExpiringSoon ? 'var(--danger)' : 'var(--text-muted)'
                    }}>
                      <Calendar size={13} />
                      <span>Expires: {formatDisplayDate(doc.expiryDate)}</span>
                      {isExpiringSoon && <span style={{ fontWeight: 600 }}>(Expiring Soon)</span>}
                    </div>
                  )}

                  {doc.notes && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4 }}>
                      {doc.notes}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>{formatFileSize(doc.fileSize)}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      title="Download"
                    >
                      <Download size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Choice Modal: Upload vs Camera Scan */}
      {isChoiceModalOpen && (
        <div className="modal-overlay" onClick={() => setIsChoiceModalOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', margin: '0 auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Add Document or ID
              </div>
              <button onClick={() => setIsChoiceModalOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Choose how you want to capture your document:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleStartScanner}
                className="btn btn-primary"
                style={{ justifyContent: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-md)', gap: '12px' }}
              >
                <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '8px' }}>
                  <Camera size={22} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>Scan with Camera</div>
                  <div style={{ fontSize: '12px', opacity: 0.9 }}>
                    Smart viewfinder crops ID card / document edges cleanly
                  </div>
                </div>
              </button>

              <button
                onClick={handleStartUpload}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-md)', gap: '12px' }}
              >
                <div style={{ padding: '8px', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
                  <Upload size={22} color="var(--accent)" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                    Upload from Device
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Browse PDFs or photos from your files
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Scanner Viewfinder Modal */}
      {isScannerOpen && (
        <DocumentScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onCaptureCompleted={handleScannerCompleted}
        />
      )}

      {/* Add Document Metadata Form Modal */}
      {isAddOpen && (
        <div className="modal-overlay" onClick={() => setIsAddOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Document Details
              </div>
              <button onClick={() => setIsAddOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Attached file thumbnail snippet */}
            {selectedFileData && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', marginBottom: '14px' }}>
                {selectedFileData.mimeType.startsWith('image/') ? (
                  <img src={selectedFileData.dataUrl} alt="Snippet" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} />
                ) : (
                  <FileText size={32} color="var(--accent)" />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedFileData.name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {formatFileSize(selectedFileData.size)}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Document Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aadhaar Card, Passport Front, Driver's License"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Category
                </label>
                <select
                  value={docCategory}
                  onChange={e => setDocCategory(e.target.value as any)}
                  style={{ marginTop: '4px' }}
                >
                  <option value="govt_id">Government ID (Aadhaar / PAN / Voter ID)</option>
                  <option value="id">Passport / Driver's License</option>
                  <option value="medical">Medical Record / Prescription</option>
                  <option value="insurance">Insurance Policy</option>
                  <option value="warranty">Warranty Card</option>
                  <option value="receipt">Invoice / Receipt</option>
                  <option value="agreement">Contract / Agreement</option>
                  <option value="certificate">Certificate</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* ID Specific Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    ID / Document Number
                  </label>
                  <input
                    type="text"
                    placeholder="XXXX-XXXX-XXXX"
                    value={docNumber}
                    onChange={e => setDocNumber(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Name on Document
                  </label>
                  <input
                    type="text"
                    placeholder="Holder's Name"
                    value={holderName}
                    onChange={e => setHolderName(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={docExpiryDate}
                    onChange={e => setDocExpiryDate(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={docIssueDate}
                    onChange={e => setDocIssueDate(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
              </div>

              {/* Link to Entity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Link To
                  </label>
                  <select
                    value={relatedType}
                    onChange={e => {
                      setRelatedType(e.target.value as EntityType);
                      setRelatedId('');
                    }}
                    style={{ marginTop: '4px' }}
                  >
                    <option value="person">Person</option>
                    <option value="family_member">Family Member</option>
                    <option value="warranty">Warranty Item</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Select Link Target
                  </label>
                  <select
                    value={relatedId}
                    onChange={e => setRelatedId(e.target.value)}
                    style={{ marginTop: '4px' }}
                  >
                    <option value="">None</option>
                    {relatedType === 'person' &&
                      people.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    {relatedType === 'family_member' &&
                      familyMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.relationship})
                        </option>
                      ))}
                    {relatedType === 'warranty' &&
                      warranties.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.itemName}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional remarks or reference details..."
                  value={docNotes}
                  onChange={e => setDocNotes(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDocument}
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  Save to Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingDoc && (
        <div className="modal-overlay" onClick={() => setEditingDoc(null)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Edit Document Info
              </div>
              <button onClick={() => setEditingDoc(null)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value as any)}
                  style={{ marginTop: '4px' }}
                >
                  <option value="govt_id">Government ID</option>
                  <option value="id">Passport / License</option>
                  <option value="medical">Medical Report</option>
                  <option value="insurance">Insurance Policy</option>
                  <option value="warranty">Warranty Card</option>
                  <option value="receipt">Invoice / Receipt</option>
                  <option value="agreement">Contract</option>
                  <option value="certificate">Certificate</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>ID Number</label>
                  <input
                    type="text"
                    value={editDocNumber}
                    onChange={e => setEditDocNumber(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Holder Name</label>
                  <input
                    type="text"
                    value={editHolderName}
                    onChange={e => setEditHolderName(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Expiry Date</label>
                <input
                  type="date"
                  value={editExpiryDate}
                  onChange={e => setEditExpiryDate(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={() => setEditingDoc(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button onClick={handleSaveEdit} className="btn btn-primary" style={{ flex: 2 }}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)} role="dialog" aria-modal="true">
          <div
            className="bottom-sheet"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '640px', margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {previewDoc.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {previewDoc.fileName}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="btn btn-secondary btn-sm"
                  title="Download file"
                >
                  <Download size={15} />
                  <span>Download</span>
                </button>
                <button onClick={() => setPreviewDoc(null)} className="btn-ghost" style={{ padding: '6px' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Content View */}
            <div style={{
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '260px',
              marginBottom: '16px'
            }}>
              {previewDoc.mimeType?.startsWith('image/') && previewDoc.fileData ? (
                <img
                  src={previewDoc.fileData}
                  alt={previewDoc.title}
                  style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '6px', boxShadow: 'var(--shadow-md)' }}
                />
              ) : previewDoc.mimeType === 'application/pdf' && previewDoc.fileData ? (
                <iframe
                  src={previewDoc.fileData}
                  title={previewDoc.title}
                  style={{ width: '100%', height: '55vh', border: 'none', borderRadius: '6px' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileText size={48} style={{ margin: '0 auto 8px auto' }} />
                  <p style={{ fontWeight: 600 }}>{previewDoc.fileName}</p>
                  <p style={{ fontSize: '12px' }}>{formatFileSize(previewDoc.fileSize)}</p>
                </div>
              )}
            </div>

            {/* Metadata Section */}
            {(previewDoc.documentNumber || previewDoc.holderName || previewDoc.expiryDate) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px', marginBottom: '14px', fontSize: '12.5px' }}>
                {previewDoc.documentNumber && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>ID Number: </span>
                    <strong style={{ fontFamily: 'monospace' }}>{previewDoc.documentNumber}</strong>
                  </div>
                )}
                {previewDoc.holderName && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Holder: </span>
                    <strong>{previewDoc.holderName}</strong>
                  </div>
                )}
                {previewDoc.expiryDate && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Expires: </span>
                    <strong>{formatDisplayDate(previewDoc.expiryDate)}</strong>
                  </div>
                )}
              </div>
            )}

            {previewDoc.notes && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Notes: </span>
                {previewDoc.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
