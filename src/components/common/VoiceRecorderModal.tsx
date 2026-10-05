import React, { useState, useEffect } from 'react';
import { Mic, Square, Play, RotateCcw, X, Check, Volume2 } from 'lucide-react';
import { voiceRecorder } from '../../services/voiceService';
import { useToast } from './ToastContext';
import type { VoiceNoteItem } from '../../types';

interface VoiceRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (voiceNote: VoiceNoteItem) => void;
}

export const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  const { showToast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedNote, setRecordedNote] = useState<VoiceNoteItem | null>(null);
  const [title, setTitle] = useState('Voice Note');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    let timer: any;
    if (isRecording) {
      timer = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (!isOpen) {
      if (isRecording) {
        voiceRecorder.cancelRecording();
      }
      setIsRecording(false);
      setSeconds(0);
      setRecordedNote(null);
      if (audioElement) {
        audioElement.pause();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = async () => {
    try {
      setSeconds(0);
      setRecordedNote(null);
      await voiceRecorder.startRecording();
      setIsRecording(true);
    } catch (err: any) {
      showToast(`Microphone error: ${err.message || 'Permission denied'}`, { type: 'error' });
    }
  };

  const handleStop = async () => {
    try {
      setIsRecording(false);
      const note = await voiceRecorder.stopRecording(title);
      setRecordedNote(note);
      const audio = new Audio(note.audioBase64);
      audio.onended = () => setIsPlaying(false);
      setAudioElement(audio);
      showToast('Recording captured', { type: 'success' });
    } catch (err: any) {
      showToast(`Failed to process recording: ${err.message}`, { type: 'error' });
    }
  };

  const togglePlayback = () => {
    if (!audioElement) return;
    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.play();
      setIsPlaying(true);
    }
  };

  const handleSaveAndDone = () => {
    if (recordedNote) {
      onSaved?.(recordedNote);
    }
    onClose();
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Voice Memo
          </h2>
          <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close voice memo">
            <X size={20} />
          </button>
        </div>

        {/* Big recording indicator & timer */}
        <div style={{ padding: '24px 0' }}>
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: isRecording ? 'var(--danger-light)' : 'var(--bg-subtle)',
              border: isRecording ? '3px solid var(--danger)' : '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              transition: 'all 0.2s ease',
              animation: isRecording ? 'pulse 1.5s infinite' : 'none'
            }}
          >
            <Mic size={36} color={isRecording ? 'var(--danger)' : 'var(--text-secondary)'} />
          </div>

          <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
            {formatTimer(seconds)}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isRecording ? 'Listening... Speak clearly into your microphone' : recordedNote ? 'Recording finished' : 'Tap Record to capture your thoughts'}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
          {!isRecording && !recordedNote && (
            <button
              onClick={handleStart}
              className="btn btn-primary"
              style={{ minWidth: '140px', gap: '8px' }}
            >
              <Mic size={18} />
              <span>Record</span>
            </button>
          )}

          {isRecording && (
            <button
              onClick={handleStop}
              className="btn btn-danger"
              style={{ minWidth: '140px', gap: '8px' }}
            >
              <Square size={18} />
              <span>Stop & Save</span>
            </button>
          )}

          {recordedNote && (
            <>
              <button
                onClick={togglePlayback}
                className="btn btn-secondary"
                style={{ gap: '8px' }}
              >
                {isPlaying ? <Square size={16} /> : <Play size={16} />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                onClick={handleStart}
                className="btn btn-ghost"
                title="Discard and record again"
                style={{ gap: '6px' }}
              >
                <RotateCcw size={16} />
                <span>Retake</span>
              </button>
            </>
          )}
        </div>

        {recordedNote && (
          <div style={{ textAlign: 'left', marginTop: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Memo Label
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quick thoughts on project"
            />

            <button
              onClick={handleSaveAndDone}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px', gap: '8px' }}
            >
              <Check size={18} />
              <span>Done</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
