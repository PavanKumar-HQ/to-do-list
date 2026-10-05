import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  ChevronUp,
  ChevronDown,
  Volume2,
  Upload,
  Sparkles,
  Music,
  Check,
  Edit3
} from 'lucide-react';
import {
  getConfiguredAlarmTone,
  saveCustomDeviceTone,
  testAlarmSound,
  type AlarmToneType
} from '../../services/soundService';

interface ClockTimeSetterProps {
  value: string; // HH:MM (24-hour format e.g. "14:30")
  onChange: (time: string) => void;
  isRequired?: boolean;
  label?: string;
  showToneSelector?: boolean;
}

export const ClockTimeSetter: React.FC<ClockTimeSetterProps> = ({
  value,
  onChange,
  isRequired = false,
  label = 'Time',
  showToneSelector = true
}) => {
  // Parse initial 24h string to 12h format
  const parse24To12 = (timeStr: string) => {
    if (!timeStr) {
      const now = new Date();
      now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5);
      const h24 = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return { hour: h12, minute: parseInt(m, 10), period };
    }
    const [hStr, mStr] = timeStr.split(':');
    const h24 = parseInt(hStr || '10', 10);
    const m = parseInt(mStr || '00', 10);
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { hour: h12, minute: m, period };
  };

  const [timeState, setTimeState] = useState(() => parse24To12(value));
  const [hourString, setHourString] = useState(String(timeState.hour).padStart(2, '0'));
  const [minuteString, setMinuteString] = useState(String(timeState.minute).padStart(2, '0'));
  const [useNativeInput, setUseNativeInput] = useState(false);
  const [activeTone, setActiveTone] = useState<AlarmToneType>('digital');
  const [customToneName, setCustomToneName] = useState<string | null>(null);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  const minuteInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when external value changes
  useEffect(() => {
    if (value) {
      const parsed = parse24To12(value);
      setTimeState(parsed);
      setHourString(String(parsed.hour).padStart(2, '0'));
      setMinuteString(String(parsed.minute).padStart(2, '0'));
    }
  }, [value]);

  useEffect(() => {
    getConfiguredAlarmTone().then((cfg) => {
      setActiveTone(cfg.tone);
      if (cfg.customName) setCustomToneName(cfg.customName);
    });
  }, []);

  // Format 12h state back to 24h string and notify parent
  const updateTime = (hour: number, minute: number, period: string) => {
    let h24 = hour % 12;
    if (period === 'PM') h24 += 12;
    const time24 = `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    setTimeState({ hour, minute, period });
    setHourString(String(hour).padStart(2, '0'));
    setMinuteString(String(minute).padStart(2, '0'));
    onChange(time24);
  };

  // Stepper handlers
  const stepHour = (delta: number) => {
    let newH = timeState.hour + delta;
    if (newH > 12) newH = 1;
    if (newH < 1) newH = 12;
    updateTime(newH, timeState.minute, timeState.period);
  };

  const stepMinute = (delta: number) => {
    let newM = timeState.minute + delta;
    if (newM >= 60) newM = 0;
    if (newM < 0) newM = 55;
    updateTime(timeState.hour, newM, timeState.period);
  };

  const togglePeriod = () => {
    const nextPeriod = timeState.period === 'AM' ? 'PM' : 'AM';
    updateTime(timeState.hour, timeState.minute, nextPeriod);
  };

  // Quick Preset Handlers
  const applyPresetTime = (h24: number, m: number) => {
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    updateTime(h12, m, period);
  };

  const addRelativeMinutes = (mins: number) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + mins);
    applyPresetTime(d.getHours(), d.getMinutes());
  };

  // Custom Audio File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const saved = await saveCustomDeviceTone(file);
      setActiveTone('custom');
      setCustomToneName(saved.name);
      testAlarmSound('custom');
    } catch (err) {
      console.error('Failed to load custom tone:', err);
    }
  };

  const handleTestSound = async () => {
    setIsPlayingTest(true);
    await testAlarmSound(activeTone);
    setTimeout(() => setIsPlayingTest(false), 1200);
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-light)',
        borderRadius: '12px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {/* Header Label with Compulsory Asterisk Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Clock size={15} color="var(--accent)" />
          <span>{label}</span>
          {isRequired && (
            <span
              style={{
                color: 'var(--danger)',
                fontWeight: 700,
                fontSize: '15px',
                marginLeft: '2px'
              }}
              title="Required"
            >
              *
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setUseNativeInput(!useNativeInput)}
            className="btn-ghost"
            style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '3px' }}
            title="Toggle native time keyboard entry"
          >
            <Edit3 size={11} />
            <span>{useNativeInput ? 'Dial' : 'Type 24h'}</span>
          </button>
          {value ? (
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
              {value} ({timeState.hour}:{String(timeState.minute).padStart(2, '0')} {timeState.period})
            </span>
          ) : null}
        </div>
      </div>

      {/* Mode A: Native Typeable Time input */}
      {useNativeInput ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="time"
            value={value || '10:00'}
            onChange={(e) => onChange(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)'
            }}
          />
        </div>
      ) : (
        /* Mode B: Tactile Clock Setter Interface with Direct Typing Support */
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            padding: '8px 0',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {/* Hours Stepper & Typeable Input */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => stepHour(1)}
              className="btn btn-secondary btn-sm"
              style={{ width: '44px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
              aria-label="Increase hour"
            >
              <ChevronUp size={18} />
            </button>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={hourString}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                setHourString(val);
                const num = parseInt(val, 10);
                if (!isNaN(num) && num >= 1 && num <= 12) {
                  updateTime(num, timeState.minute, timeState.period);
                  if (val.length === 2) {
                    minuteInputRef.current?.focus();
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  stepHour(1);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  stepHour(-1);
                }
              }}
              onBlur={() => {
                const num = parseInt(hourString, 10);
                if (isNaN(num) || num < 1) {
                  updateTime(12, timeState.minute, timeState.period);
                } else if (num > 12) {
                  updateTime(12, timeState.minute, timeState.period);
                } else {
                  updateTime(num, timeState.minute, timeState.period);
                }
              }}
              aria-label="Type Hour (1-12)"
              style={{
                fontSize: '24px',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-primary)',
                width: '46px',
                height: '38px',
                textAlign: 'center',
                padding: '2px 4px',
                background: 'var(--bg-surface-elevated)',
                borderRadius: '6px',
                border: '1.5px solid var(--border-light)',
                outline: 'none'
              }}
            />

            <button
              type="button"
              onClick={() => stepHour(-1)}
              className="btn btn-secondary btn-sm"
              style={{ width: '44px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
              aria-label="Decrease hour"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-muted)' }}>:</div>

          {/* Minutes Stepper & Typeable Input */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => stepMinute(5)}
              className="btn btn-secondary btn-sm"
              style={{ width: '44px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
              aria-label="Increase minutes"
            >
              <ChevronUp size={18} />
            </button>

            <input
              ref={minuteInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={minuteString}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                setMinuteString(val);
                const num = parseInt(val, 10);
                if (!isNaN(num) && num >= 0 && num <= 59) {
                  updateTime(timeState.hour, num, timeState.period);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  stepMinute(1);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  stepMinute(-1);
                }
              }}
              onBlur={() => {
                const num = parseInt(minuteString, 10);
                if (isNaN(num) || num < 0) {
                  updateTime(timeState.hour, 0, timeState.period);
                } else if (num > 59) {
                  updateTime(timeState.hour, 59, timeState.period);
                } else {
                  updateTime(timeState.hour, num, timeState.period);
                }
              }}
              aria-label="Type Minute (0-59)"
              style={{
                fontSize: '24px',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-primary)',
                width: '46px',
                height: '38px',
                textAlign: 'center',
                padding: '2px 4px',
                background: 'var(--bg-surface-elevated)',
                borderRadius: '6px',
                border: '1.5px solid var(--border-light)',
                outline: 'none'
              }}
            />

            <button
              type="button"
              onClick={() => stepMinute(-5)}
              className="btn btn-secondary btn-sm"
              style={{ width: '44px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
              aria-label="Decrease minutes"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          {/* AM / PM Toggle Pill */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '6px' }}>
            <button
              type="button"
              onClick={togglePeriod}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                background: 'var(--accent)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 2px 8px rgba(20, 184, 166, 0.3)',
                transition: 'transform 0.1s ease'
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {timeState.period}
            </button>
          </div>
        </div>
      )}

      {/* Quick Relative Presets */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => addRelativeMinutes(15)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '11px', padding: '4px 8px', borderRadius: 'var(--radius-full)' }}
        >
          +15m
        </button>
        <button
          type="button"
          onClick={() => addRelativeMinutes(30)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '11px', padding: '4px 8px', borderRadius: 'var(--radius-full)' }}
        >
          +30m
        </button>
        <button
          type="button"
          onClick={() => addRelativeMinutes(60)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '11px', padding: '4px 8px', borderRadius: 'var(--radius-full)' }}
        >
          +1h
        </button>
        <button
          type="button"
          onClick={() => applyPresetTime(9, 0)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '11px', padding: '4px 8px', borderRadius: 'var(--radius-full)' }}
        >
          Morning 9 AM
        </button>
        <button
          type="button"
          onClick={() => applyPresetTime(14, 0)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '11px', padding: '4px 8px', borderRadius: 'var(--radius-full)' }}
        >
          Afternoon 2 PM
        </button>
        <button
          type="button"
          onClick={() => applyPresetTime(18, 0)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '11px', padding: '4px 8px', borderRadius: 'var(--radius-full)' }}
        >
          Evening 6 PM
        </button>
      </div>

      {/* Custom Alarm Ringtone Selector */}
      {showToneSelector && (
        <div
          style={{
            marginTop: '4px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Alarm Ringtone
            </span>
            <button
              type="button"
              onClick={handleTestSound}
              disabled={isPlayingTest}
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '11px', padding: '2px 8px', gap: '4px' }}
            >
              <Volume2 size={12} color="var(--accent)" />
              <span>{isPlayingTest ? 'Playing...' : 'Test Sound'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['digital', 'bell', 'gentle'] as AlarmToneType[]).map((t) => {
              const isSelected = activeTone === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setActiveTone(t);
                    testAlarmSound(t);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: isSelected ? 600 : 400,
                    background: isSelected ? 'var(--accent)' : 'var(--bg-surface)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                    cursor: 'pointer'
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}

            {/* Custom Tone Option */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: activeTone === 'custom' ? 600 : 400,
                background: activeTone === 'custom' ? 'var(--accent)' : 'var(--bg-surface)',
                color: activeTone === 'custom' ? '#ffffff' : 'var(--text-secondary)',
                border: activeTone === 'custom' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                cursor: 'pointer'
              }}
            >
              <Upload size={11} />
              <span>{customToneName ? customToneName.slice(0, 10) + '...' : 'Upload Audio'}</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
