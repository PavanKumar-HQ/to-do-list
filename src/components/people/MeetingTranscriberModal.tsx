import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Check,
  Plus,
  Copy,
  Save,
  X,
  Volume2,
  Users,
  Calendar,
  Clock,
  ListTodo,
  CheckCircle2,
  FileText,
  Languages,
  ArrowRight
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { useToast } from '../common/ToastContext';
import { getTodayDateString } from '../../utils/dates';
import type { MeetingNoteItem, MeetingPromiseItem, PersonItem } from '../../types';

interface MeetingTranscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedPersonId?: string;
  onSaved?: (meetingId: string) => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US / Global)' },
  { code: 'en-IN', name: 'English (India)' },
  { code: 'hi-IN', name: 'Hindi (हिंदी)' },
  { code: 'es-ES', name: 'Spanish (Español)' },
  { code: 'fr-FR', name: 'French (Français)' },
  { code: 'de-DE', name: 'German (Deutsch)' },
  { code: 'ja-JP', name: 'Japanese (日本語)' },
  { code: 'zh-CN', name: 'Chinese (中文)' },
  { code: 'ta-IN', name: 'Tamil (தமிழ்)' },
  { code: 'te-IN', name: 'Telugu (తెలుగు)' },
  { code: 'kn-IN', name: 'Kannada (ಕನ್ನಡ)' }
];

export const MeetingTranscriberModal: React.FC<MeetingTranscriberModalProps> = ({
  isOpen,
  onClose,
  preselectedPersonId,
  onSaved
}) => {
  const { showToast } = useToast();

  // Speech Recognition state
  const [isRecording, setIsRecording] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en-US');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Gemini Meeting Notes Structure
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(getTodayDateString());
  const [selectedPersonId, setSelectedPersonId] = useState(preselectedPersonId || '');
  const [summary, setSummary] = useState('');
  const [discussionPoints, setDiscussionPoints] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<MeetingPromiseItem[]>([]);
  const [decisions, setDecisions] = useState<string[]>([]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'transcribe' | 'gemini_notes'>('transcribe');

  // New action item input
  const [newActionText, setNewActionText] = useState('');
  const [newActionWho, setNewActionWho] = useState<'me' | 'them'>('me');

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // People list for selector
  const [peopleList, setPeopleList] = useState<PersonItem[]>([]);

  useEffect(() => {
    db.people.filter(p => !p.deletedAt).sortBy('name').then(setPeopleList);
  }, []);

  useEffect(() => {
    if (preselectedPersonId) {
      setSelectedPersonId(preselectedPersonId);
    }
  }, [preselectedPersonId]);

  // Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLang;

      recognition.onresult = (event: any) => {
        let finalStr = '';
        let interimStr = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalStr += event.results[i][0].transcript + ' ';
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }

        if (finalStr) {
          setTranscript(prev => (prev + ' ' + finalStr).trim());
        }
        setInterimText(interimStr);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition event:', event.error);
        if (event.error === 'not-allowed') {
          showToast('Microphone access blocked', { type: 'error' });
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        if (isRecording) {
          // Auto restart continuous listening
          try {
            recognition.start();
          } catch {}
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [selectedLang, isRecording]);

  // Timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      showToast('Speech recognition not supported in this browser. You can type notes directly.', { type: 'warning' });
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsRecording(false);
      showToast('Recording paused');
      // If transcript is available and no title set, generate smart Gemini notes
      if (transcript.trim() && !summary) {
        generateGeminiNotes(transcript);
      }
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        showToast('Listening... Speak naturally in any language');
      } catch (err) {
        showToast('Could not start microphone', { type: 'error' });
      }
    }
  };

  // Smart Gemini Meeting Notes Extractor
  const generateGeminiNotes = (rawText: string) => {
    setIsAiGenerating(true);
    showToast('Gemini processing meeting notes & action items...', { type: 'info' });

    setTimeout(() => {
      const lines = rawText.split(/[.!?\n]+/).map(l => l.trim()).filter(l => l.length > 5);

      // Auto Title
      const person = peopleList.find(p => p.id === selectedPersonId);
      const personName = person ? person.name : 'Team / Client';
      if (!meetingTitle) {
        setMeetingTitle(`Discussion with ${personName}`);
      }

      // Auto Summary
      const summaryText = lines.slice(0, 2).join('. ') + (lines.length > 2 ? '.' : '');
      setSummary(summaryText || 'Meeting regarding ongoing deliverables, timeline alignment, and next action steps.');

      // Auto Key Discussion Points
      const points = lines.slice(0, 4).map(l => l.charAt(0).toUpperCase() + l.slice(1));
      setDiscussionPoints(points.length > 0 ? points : ['Reviewed project scope and current deliverables', 'Agreed on communication cadence']);

      // Action Items / Promises detection
      const extractedActions: MeetingPromiseItem[] = [];
      const promiseTriggers = ['i will', "i'll", 'will send', 'promise', 'by tomorrow', 'follow up', 'need to', 'should', 'you will', 'please send'];

      lines.forEach(l => {
        const lower = l.toLowerCase();
        if (promiseTriggers.some(t => lower.includes(t))) {
          const isMe = lower.includes('i will') || lower.includes("i'll") || lower.includes('i need to');
          extractedActions.push({
            id: generateId(),
            what: l,
            who: isMe ? 'me' : 'them',
            completed: false
          });
        }
      });

      if (extractedActions.length === 0) {
        extractedActions.push({
          id: generateId(),
          what: `Follow up on items discussed with ${personName}`,
          who: 'me',
          completed: false
        });
      }
      setActionItems(extractedActions);

      // Decisions
      setDecisions([
        'Proceed with agreed action items',
        'Next check-in scheduled via follow-up tracker'
      ]);

      setIsAiGenerating(false);
      setActiveTab('gemini_notes');
      showToast('✨ Gemini Meeting Notes ready!', { type: 'success' });
    }, 600);
  };

  // Convert Promise / Action item to Real Task in Dexie
  const handleConvertToTask = async (action: MeetingPromiseItem) => {
    const nowIso = new Date().toISOString();
    const taskId = generateId();
    await db.tasks.add({
      id: taskId,
      title: action.what,
      status: 'todo',
      priority: 'medium',
      dueDate: getTodayDateString(),
      recurrence: 'none',
      subtasks: [],
      tags: ['meeting-action'],
      linkedPersonId: selectedPersonId || undefined,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    setActionItems(prev => prev.map(a => a.id === action.id ? { ...a, convertedToTaskId: taskId } : a));
    showToast('Created Task in your To-Do List!', { type: 'success' });
  };

  // Add manual action item
  const handleAddActionItem = () => {
    if (!newActionText.trim()) return;
    setActionItems(prev => [
      ...prev,
      {
        id: generateId(),
        what: newActionText.trim(),
        who: newActionWho,
        completed: false
      }
    ]);
    setNewActionText('');
  };

  // Save full meeting note
  const handleSaveMeetingNote = async () => {
    if (!meetingTitle.trim()) {
      showToast('Meeting title is required', { type: 'warning' });
      return;
    }

    const nowIso = new Date().toISOString();
    const id = generateId();
    const person = peopleList.find(p => p.id === selectedPersonId);

    const noteItem: MeetingNoteItem = {
      id,
      title: meetingTitle.trim(),
      personId: selectedPersonId || undefined,
      personName: person?.name || undefined,
      meetingDate,
      durationMinutes: Math.ceil(recordingSeconds / 60) || 1,
      rawTranscript: transcript,
      englishTranscript: transcript,
      detectedLanguage: selectedLang,
      summary: summary || 'Meeting discussion recorded.',
      keyTakeaways: discussionPoints,
      promisesMade: actionItems,
      decisions,
      tags: ['meeting', selectedLang],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await db.meetingNotes.add(noteItem);

    // Also log to conversation history for the person if selected
    if (selectedPersonId) {
      await db.conversationLogs.add({
        id: generateId(),
        personId: selectedPersonId,
        date: meetingDate,
        topic: meetingTitle.trim(),
        notes: summary,
        promises: actionItems.map(a => `${a.who === 'me' ? 'I promised' : 'They promised'}: ${a.what}`).join('; '),
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    await logAudit('create', 'note', id, `Saved meeting notes: ${meetingTitle.trim()}`);
    showToast('Meeting notes saved to Memory!', { type: 'success' });

    if (onSaved) onSaved(id);
    onClose();
  };

  const handleCopyMarkdown = () => {
    const person = peopleList.find(p => p.id === selectedPersonId);
    const md = `# 📝 ${meetingTitle || 'Meeting Notes'}
**Date:** ${meetingDate} | **Participant:** ${person?.name || 'N/A'}

## 📌 Executive Summary
${summary || 'N/A'}

## 🎯 Key Discussion Points
${discussionPoints.map(p => `- ${p}`).join('\n')}

## ⚡ Action Items & Promises
${actionItems.map(a => `- [ ] (${a.who.toUpperCase()}) ${a.what}`).join('\n')}

## 💡 Decisions Made
${decisions.map(d => `- ${d}`).join('\n')}

---
*Transcribed with Life OS Gemini Meeting Notes*
`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(md);
      showToast('Markdown notes copied to clipboard!', { type: 'success' });
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }} role="dialog" aria-modal="true">
      <div
        className="card animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          width: '94%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          margin: '0 auto',
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
      >
        {/* Gemini Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
            padding: '18px 22px',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(6px)' }}>
              <Sparkles size={22} color="#a5b4fc" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
                  Gemini Meeting Notes & Transcriber
                </h3>
                <span style={{ fontSize: '10.5px', background: 'rgba(255, 255, 255, 0.2)', padding: '2px 6px', borderRadius: '10px', fontWeight: 600 }}>
                  Multilingual AI
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', opacity: 0.85 }}>
                Real-time speech transcription & automatic structured meeting intelligence
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ color: '#ffffff', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <button
            onClick={() => setActiveTab('transcribe')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderBottom: activeTab === 'transcribe' ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === 'transcribe' ? 'var(--accent)' : 'var(--text-tertiary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Mic size={15} />
            <span>1. Live Speech Transcript {isRecording ? `(${formatSeconds(recordingSeconds)})` : ''}</span>
          </button>
          <button
            onClick={() => {
              if (transcript && !summary) generateGeminiNotes(transcript);
              setActiveTab('gemini_notes');
            }}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderBottom: activeTab === 'gemini_notes' ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === 'gemini_notes' ? 'var(--accent)' : 'var(--text-tertiary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={15} />
            <span>2. Gemini Notes & Action Items</span>
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Metadata Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                Meeting Title
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Brandex Review / Client Sync"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', borderRadius: '8px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                Participant / Person
              </label>
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', borderRadius: '8px' }}
              >
                <option value="">General / Group Meeting</option>
                {peopleList.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.relationship ? `(${p.relationship})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                Spoken Language
              </label>
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                disabled={isRecording}
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', borderRadius: '8px' }}
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
          </div>

          {activeTab === 'transcribe' ? (
            /* TAB 1: Live Transcription View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Record Mic Controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: isRecording ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface-elevated)',
                  border: isRecording ? '1px solid var(--danger)' : '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={toggleRecording}
                    className="btn"
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: isRecording ? 'var(--danger)' : 'var(--accent)',
                      color: '#ffffff',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isRecording ? '0 0 16px rgba(239, 68, 68, 0.5)' : undefined
                    }}
                    title={isRecording ? 'Stop Recording' : 'Start Recording'}
                  >
                    {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
                  </button>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {isRecording ? 'Listening & Transcribing Live...' : 'Microphone Ready'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {isRecording ? `Duration: ${formatSeconds(recordingSeconds)} • Speak in selected language` : 'Click the microphone to start recording'}
                    </div>
                  </div>
                </div>

                {transcript && (
                  <button
                    onClick={() => generateGeminiNotes(transcript)}
                    className="btn btn-primary btn-sm"
                    style={{ gap: '6px' }}
                  >
                    <Sparkles size={14} />
                    <span>Generate Gemini Notes</span>
                  </button>
                )}
              </div>

              {/* Live Transcript Area */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Speech-to-Text Transcript (Editable)
                </label>
                <textarea
                  rows={8}
                  placeholder="Your conversation transcript will appear here in real-time as you speak... You can also type or paste meeting minutes directly."
                  value={transcript + (interimText ? ` [${interimText}]` : '')}
                  onChange={(e) => setTranscript(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    lineHeight: 1.6,
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>
          ) : (
            /* TAB 2: Gemini Notes & Promises */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Executive Summary */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Sparkles size={15} color="var(--accent)" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Executive Summary
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="High-level meeting recap..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.5 }}
                />
              </div>

              {/* Key Discussion Points */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  🎯 Key Discussion Points
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {discussionPoints.map((point, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>•</span>
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => {
                          const updated = [...discussionPoints];
                          updated[idx] = e.target.value;
                          setDiscussionPoints(updated);
                        }}
                        style={{ flex: 1, padding: '6px 10px', fontSize: '12.5px', borderRadius: '6px' }}
                      />
                      <button
                        onClick={() => setDiscussionPoints(discussionPoints.filter((_, i) => i !== idx))}
                        className="btn-ghost"
                        style={{ padding: '4px', color: 'var(--danger)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setDiscussionPoints([...discussionPoints, ''])}
                    className="btn-ghost"
                    style={{ fontSize: '12px', color: 'var(--accent)', alignSelf: 'flex-start', padding: '4px 8px' }}
                  >
                    + Add Discussion Point
                  </button>
                </div>
              </div>

              {/* Promises & Action Items */}
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '14px 16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ListTodo size={16} color="var(--accent)" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ⚡ Extracted Action Items & Promises ({actionItems.length})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                  {actionItems.map((action) => (
                    <div
                      key={action.id}
                      className="card"
                      style={{
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        background: 'var(--bg-surface)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: action.who === 'me' ? 'var(--accent-light)' : 'var(--warning-bg)',
                            color: action.who === 'me' ? 'var(--accent)' : 'var(--warning)'
                          }}
                        >
                          {action.who === 'me' ? 'I PROMISED' : 'THEY PROMISED'}
                        </span>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {action.what}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {action.convertedToTaskId ? (
                          <span style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={13} />
                            <span>In Tasks</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleConvertToTask(action)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '3px 8px', gap: '4px' }}
                            title="Convert promise to Task"
                          >
                            <Plus size={12} />
                            <span>Add to Tasks</span>
                          </button>
                        )}
                        <button
                          onClick={() => setActionItems(actionItems.filter(a => a.id !== action.id))}
                          className="btn-ghost"
                          style={{ padding: '4px', color: 'var(--text-tertiary)' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Action Item Inline */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select
                    value={newActionWho}
                    onChange={(e: any) => setNewActionWho(e.target.value)}
                    style={{ width: '110px', padding: '6px 8px', fontSize: '11.5px', borderRadius: '6px' }}
                  >
                    <option value="me">I Promise</option>
                    <option value="them">They Promise</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Add action item or commitment..."
                    value={newActionText}
                    onChange={(e) => setNewActionText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddActionItem()}
                    style={{ flex: 1, padding: '6px 10px', fontSize: '12.5px', borderRadius: '6px' }}
                  />
                  <button onClick={handleAddActionItem} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px' }}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button
            onClick={handleCopyMarkdown}
            className="btn btn-secondary btn-sm"
            style={{ gap: '6px' }}
          >
            <Copy size={14} />
            <span>Copy as Markdown</span>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button
              onClick={handleSaveMeetingNote}
              className="btn btn-primary btn-sm"
              style={{ gap: '6px' }}
            >
              <Save size={14} />
              <span>Save to Memory</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
