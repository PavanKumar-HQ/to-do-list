import React, { useState } from 'react';
import {
  ChevronLeft,
  AlertCircle,
  Check,
  CheckSquare,
  Wallet,
  Users,
  Calendar,
  FileText,
  Target,
  Clock,
  Lightbulb
} from 'lucide-react';
import { SettingsService } from '../../services/settingsService';
import { db } from '../../db/db';

interface NameOnboardingModalProps {
  onComplete: (displayName: string) => void;
}

export const NameOnboardingModal: React.FC<NameOnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [nameInput, setNameInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 2: What matters to you (8 categories from mockup Image 1)
  const categoryTiles = [
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)' },
    { id: 'money', label: 'Money', icon: Wallet, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.18)' },
    { id: 'people', label: 'People', icon: Users, color: '#c084fc', bg: 'rgba(192, 132, 252, 0.18)' },
    { id: 'events', label: 'Events', icon: Calendar, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)' },
    { id: 'notes', label: 'Notes', icon: FileText, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.18)' },
    { id: 'goals', label: 'Goals', icon: Target, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)' },
    { id: 'routines', label: 'Routines', icon: Clock, color: '#818cf8', bg: 'rgba(129, 140, 248, 0.18)' },
    { id: 'ideas', label: 'Ideas', icon: Lightbulb, color: '#e879f9', bg: 'rgba(232, 121, 249, 0.18)' }
  ];

  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'tasks',
    'money'
  ]);

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Step 1 Submission
  const handleStep1Submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);

    const validation = SettingsService.validateDisplayName(nameInput);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Please enter your name.');
      return;
    }
    setStep(2);
  };

  // Step 2 Submission (Persists name, interests, and completes onboarding)
  const handleStep2Submit = async () => {
    setIsSubmitting(true);
    try {
      const cleanName = nameInput.trim() || 'Pavan';
      await SettingsService.saveDisplayName(cleanName);
      await db.settings.update('current_settings', {
        isOnboarded: true
      });
      onComplete(cleanName);
    } catch {
      onComplete(nameInput.trim() || 'Pavan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--bg-app, #f9f9f8)',
        color: 'var(--text-primary, #171717)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        overflowY: 'auto'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        {/* =====================================================================
            STEP 1: WELCOME & NAME INPUT (Image 1 Left)
            ===================================================================== */}
        {step === 1 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Liquid Droplet Orb Graphic */}
            <div
              style={{
                width: '100px',
                height: '100px',
                position: 'relative',
                marginBottom: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, rgba(13, 148, 136, 0.3) 0%, rgba(20, 184, 166, 0.15) 50%, rgba(255, 255, 255, 0) 80%)',
                  filter: 'blur(16px)'
                }}
              />
              <div
                style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '50% 50% 45% 55% / 55% 45% 55% 45%',
                  background: 'linear-gradient(135deg, #ccfbf1 0%, #2dd4bf 45%, #0d9488 100%)',
                  boxShadow: 'inset 0 2px 6px rgba(255, 255, 255, 0.8), 0 8px 32px rgba(13, 148, 136, 0.25)',
                  border: '1.5px solid rgba(255, 255, 255, 0.8)'
                }}
              />
            </div>

            {/* Kanso Branding */}
            <h1
              id="onboarding-title"
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 6px 0',
                letterSpacing: '-0.02em'
              }}
            >
              Kanso
            </h1>
            <div
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginBottom: '36px'
              }}
            >
              Your life. Organized.
            </div>

            {/* Main Catchphrase */}
            <h2
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 10px 0',
                letterSpacing: '-0.03em'
              }}
            >
              Let's make this yours.
            </h2>
            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
                margin: '0 0 32px 0',
                maxWidth: '320px'
              }}
            >
              A private place for the things you don't want to keep in your head.
            </p>

            {/* Name Input Card */}
            <form onSubmit={handleStep1Submit} style={{ width: '100%', marginBottom: '20px' }}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1.5px solid var(--border-light)',
                  borderRadius: '20px',
                  padding: '16px 20px',
                  textAlign: 'left',
                  boxShadow: 'var(--shadow-sm)',
                  marginBottom: '18px'
                }}
              >
                <label
                  htmlFor="user-name-input"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    marginBottom: '8px'
                  }}
                >
                  What should I call you?
                </label>
                <input
                  id="user-name-input"
                  type="text"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="e.g. Alex"
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '17px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    padding: 0
                  }}
                />
              </div>

              {validationError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--danger)',
                    fontSize: '13px',
                    marginBottom: '14px',
                    textAlign: 'left'
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Continue Button */}
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent)',
                  boxShadow: '0 4px 20px rgba(20, 184, 166, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Continue
              </button>
            </form>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              No account. No email. Just you.
            </div>
          </div>
        )}

        {/* =====================================================================
            STEP 2: WHAT MATTERS TO YOU (Image 1 Right)
            ===================================================================== */}
        {step === 2 && (
          <div style={{ width: '100%', textAlign: 'left', animation: 'fadeIn 0.2s ease-out' }}>
            {/* Back Button */}
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--text-secondary)',
                padding: '6px 8px',
                marginLeft: '-8px',
                marginBottom: '16px'
              }}
            >
              <ChevronLeft size={20} />
            </button>

            <h1
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 8px 0',
                letterSpacing: '-0.02em'
              }}
            >
              What matters to you?
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                margin: '0 0 24px 0',
                lineHeight: 1.45
              }}
            >
              Select the areas you want to track. You can change this anytime.
            </p>

            {/* 2x4 Categories Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '28px'
              }}
            >
              {categoryTiles.map((cat) => {
                const isSelected = selectedInterests.includes(cat.id);
                const Icon = cat.icon;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleInterest(cat.id)}
                    style={{
                      background: 'var(--bg-surface)',
                      border: isSelected
                        ? '1.5px solid var(--accent)'
                        : '1px solid var(--border-light)',
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 16px rgba(13, 148, 136, 0.15)' : 'var(--shadow-sm)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: cat.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Icon size={18} color={cat.color} />
                      </div>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          border: isSelected ? 'none' : '1.5px solid var(--border-strong)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff'
                        }}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginTop: '12px'
                      }}
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleStep2Submit}
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 600,
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent)',
                boxShadow: '0 4px 20px rgba(20, 184, 166, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isSubmitting ? 'Personalizing...' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
