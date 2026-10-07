import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RotateCcw, CreditCard, FileText, SwitchCamera, AlertCircle } from 'lucide-react';

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureCompleted: (fileDataUrl: string, fileName: string, fileSize: number) => void;
}

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  isOpen,
  onClose,
  onCaptureCompleted
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [frameMode, setFrameMode] = useState<'id-card' | 'full-doc'>('id-card');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Start camera when opened
  useEffect(() => {
    if (!isOpen) return;

    let currentStream: MediaStream | null = null;

    const startCamera = async () => {
      setErrorMessage(null);
      setCapturedImage(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access is not supported by your browser.');
        }

        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });

        currentStream = s;
        setStream(s);

        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
      } catch (err: any) {
        console.warn('Camera stream error:', err);
        setErrorMessage(err.message || 'Unable to access camera. Please check permissions.');
      }
    };

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setCapturedImage(null);
    onClose();
  };

  const handleSwitchCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Precise bounding crop capture
  const handleCapture = () => {
    if (!videoRef.current || !frameRef.current) return;

    const video = videoRef.current;
    const frame = frameRef.current;

    const videoRect = video.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();

    // Scale factors between rendered element and actual video pixels
    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    // Crop box in actual video coordinates
    const cropX = (frameRect.left - videoRect.left) * scaleX;
    const cropY = (frameRect.top - videoRect.top) * scaleY;
    const cropWidth = frameRect.width * scaleX;
    const cropHeight = frameRect.height * scaleY;

    // Create offscreen canvas strictly sized to the crop frame
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(cropWidth, 100);
    canvas.height = Math.max(cropHeight, 100);
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Draw strictly the portion within the viewfinder frame
    ctx.drawImage(
      video,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
  };

  const handleConfirmScan = () => {
    if (!capturedImage) return;

    // Estimate file size from base64 string
    const stringLength = capturedImage.length - 'data:image/jpeg;base64,'.length;
    const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.562489633438347;

    const fileName = `${frameMode === 'id-card' ? 'id_card_scan' : 'document_scan'}_${Date.now()}.jpg`;

    onCaptureCompleted(capturedImage, fileName, Math.round(sizeInBytes));
    handleClose();
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  if (!isOpen) return null;

  return (
    <div className="scanner-overlay" role="dialog" aria-modal="true">
      {/* Header */}
      <div className="scanner-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={20} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: '15px' }}>Document Scanner</span>
        </div>

        {/* Framing Mode Toggle */}
        {!capturedImage && !errorMessage && (
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.15)', padding: '3px', borderRadius: '20px' }}>
            <button
              onClick={() => setFrameMode('id-card')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#ffffff',
                background: frameMode === 'id-card' ? 'var(--accent)' : 'transparent',
                cursor: 'pointer'
              }}
            >
              <CreditCard size={14} />
              <span>ID Card</span>
            </button>
            <button
              onClick={() => setFrameMode('full-doc')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#ffffff',
                background: frameMode === 'full-doc' ? 'var(--accent)' : 'transparent',
                cursor: 'pointer'
              }}
            >
              <FileText size={14} />
              <span>Full Doc</span>
            </button>
          </div>
        )}

        <button
          onClick={handleClose}
          className="btn-ghost"
          style={{ color: '#ffffff', padding: '6px' }}
          aria-label="Close camera"
        >
          <X size={22} />
        </button>
      </div>

      {/* Main Viewfinder Body */}
      <div className="scanner-body">
        {errorMessage ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#ffffff', maxWidth: '360px' }}>
            <AlertCircle size={40} color="var(--warning)" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
              Camera Not Available
            </div>
            <p style={{ fontSize: '13px', color: '#a0a0ab', marginBottom: '18px' }}>
              {errorMessage}
            </p>
            <button
              onClick={handleClose}
              className="btn btn-primary"
              style={{ margin: '0 auto' }}
            >
              Close & Browse Files
            </button>
          </div>
        ) : capturedImage ? (
          /* Captured Preview */
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <img
              src={capturedImage}
              alt="Cropped Scan"
              style={{
                maxWidth: '90%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.8)',
                border: '2px solid var(--accent)'
              }}
            />
            <div style={{ color: '#ffffff', marginTop: '12px', fontSize: '13px', fontWeight: 500 }}>
              Document extracted cleanly to frame boundaries
            </div>
          </div>
        ) : (
          /* Live Stream & Optical Frame */
          <>
            <video
              ref={videoRef}
              className="scanner-video"
              playsInline
              autoPlay
              muted
            />

            {/* Viewfinder Cutout Mask */}
            <div className="viewfinder-mask">
              <div
                ref={frameRef}
                className={`viewfinder-frame ${frameMode}`}
              >
                {/* 4 Corner Crosshairs */}
                <div className="corner-bracket corner-tl" />
                <div className="corner-bracket corner-tr" />
                <div className="corner-bracket corner-bl" />
                <div className="corner-bracket corner-br" />
              </div>

              <div style={{
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 500,
                marginTop: '16px',
                background: 'rgba(0, 0, 0, 0.6)',
                padding: '5px 12px',
                borderRadius: '12px',
                backdropFilter: 'blur(4px)'
              }}>
                Align {frameMode === 'id-card' ? 'ID Card' : 'Document'} within corner brackets
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Controls */}
      <div className="scanner-controls">
        {capturedImage ? (
          <>
            <button
              onClick={handleRetake}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', border: 'none', padding: '10px 18px' }}
            >
              <RotateCcw size={16} />
              <span>Retake</span>
            </button>

            <button
              onClick={handleConfirmScan}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', fontSize: '14px', fontWeight: 600 }}
            >
              <Check size={18} />
              <span>Use Document</span>
            </button>
          </>
        ) : !errorMessage ? (
          <>
            <button
              onClick={handleSwitchCamera}
              className="btn-ghost"
              style={{ color: '#ffffff', width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Flip Camera"
            >
              <SwitchCamera size={20} />
            </button>

            {/* Circular Shutter Button */}
            <button
              onClick={handleCapture}
              className="shutter-btn"
              aria-label="Capture document picture"
            />

            <div style={{ width: '44px' }} />
          </>
        ) : null}
      </div>
    </div>
  );
};
