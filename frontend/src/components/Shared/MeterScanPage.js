import React, { useCallback, useEffect, useState } from 'react';
import {
  FiCamera, FiRefreshCw, FiSave, FiUploadCloud,
} from 'react-icons/fi';
import api from '../../services/api';
import { normalizeMeterScan } from '../../utils/meterScan';
import { useLang } from '../../contexts/LangContext';

function todayLocalIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthInputValue(dateString) {
  const value = String(dateString || '');
  const [yearRaw, monthRaw] = value.split('-');
  if (!yearRaw || !monthRaw) return '';
  return `${yearRaw}-${monthRaw}`;
}

function applyMonthToDate(dateString, monthValue) {
  const [yearRaw, monthRaw] = String(monthValue || '').split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return dateString || todayLocalIso();
  }

  const current = String(dateString || todayLocalIso()).split('-');
  const currentDay = Number(current[2] || 1);
  const lastDay = new Date(year, month, 0).getDate();
  const day = String(Math.min(Math.max(currentDay, 1), lastDay)).padStart(2, '0');
  return `${year}-${String(month).padStart(2, '0')}-${day}`;
}

function toFiniteNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMonthYearParts(dateString) {
  const value = String(dateString || '');
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  return {
    year: Number.isInteger(year) ? year : null,
    month: Number.isInteger(month) ? month : null,
  };
}

function formatReadingMonth(dateString, lang = 'en') {
  if (!dateString) return '-';
  const value = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(value.getTime())) return dateString;
  return value.toLocaleDateString(lang === 'ar' ? 'ar-LB' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function emptyReadingForm(readingDate = todayLocalIso()) {
  return {
    reading_value: '',
    reading_date: readingDate || todayLocalIso(),
    notes: '',
  };
}

function isImageFile(file) {
  const supportedMime = /^(image\/(jpeg|png|webp))$/i.test(file?.type || '');
  const supportedExtension = /\.(png|jpe?g|webp)$/i.test(file?.name || '');
  if (file?.type) return supportedMime;
  return supportedExtension;
}

function SummaryRow({ items }) {
  const visibleItems = items.filter((item) => item && (item.render || (item.value !== undefined && item.value !== null && item.value !== '')));
  if (!visibleItems.length) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      {visibleItems.map((item) => (
        <div
          key={item.label}
          style={{
            minWidth: 0,
            display: 'grid',
            gap: 4,
            color: 'var(--text)',
            fontSize: '0.95rem',
          }}
        >
          <strong>{item.label}</strong>
          {item.render || <span style={{ color: 'var(--text-sub)', wordBreak: 'break-word' }}>{item.value}</span>}
        </div>
      ))}
    </div>
  );
}

export default function MeterScanPage({ scope = 'owner' }) {
  const { t, lang } = useLang();
  const basePath = `/${scope}`;
  const [msg, setMsg] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoQueue, setPhotoQueue] = useState([]);
  const [completedInBatch, setCompletedInBatch] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [selectedSubscriber, setSelectedSubscriber] = useState(null);
  const [previousReading, setPreviousReading] = useState(null);
  const [form, setForm] = useState(emptyReadingForm);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const currentBatchTotal = (photoFile ? 1 : 0) + photoQueue.length;

  const resetScanState = useCallback(() => {
    setPhotoFile(null);
    setPhotoQueue([]);
    setCompletedInBatch(0);
    setScanResult(null);
    setSelectedSubscriber(null);
    setPreviousReading(null);
    setForm(emptyReadingForm());
    setPreviewUrl('');
  }, []);

  const scanPhoto = useCallback(async (file) => {
    const payload = new FormData();
    payload.append('photo', file);

    setScanning(true);
    setScanResult(null);
    setSelectedSubscriber(null);
    setPreviousReading(null);

    try {
      const res = await api.post(`${basePath}/meter-readings/scan`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = normalizeMeterScan(res.data);
      setScanResult(data);
      setSelectedSubscriber(data?.subscriber || null);
      setPreviousReading(toFiniteNumber(data?.previous_value));
      setForm((current) => ({
        ...current,
        reading_value: data?.reading_value != null ? String(data.reading_value) : current.reading_value,
      }));
      const messageTemplate = t.matchedMeterAndReading || 'Matched meter {meter} and detected reading {reading}.';
      setMsg({
        type: data?.subscriber && data?.reading_value != null ? 'success' : 'warning',
        text: data?.subscriber && data?.reading_value != null ? messageTemplate
          .replace('{meter}', data?.meter_number || '-')
          .replace('{reading}', data?.reading_value ?? '-') : (t.meterScanMismatchHelp || 'Could not match this meter photo.'),
      });
    } catch (err) {
      const data = normalizeMeterScan(err.response?.data);
      setScanResult(data);
      setSelectedSubscriber(data?.subscriber || null);
      setPreviousReading(toFiniteNumber(data?.previous_value));
      if (data?.reading_value != null) {
        setForm((current) => ({
          ...current,
          reading_value: String(data.reading_value),
        }));
      }
      setMsg({
        type: 'warning',
        text: data?.error || t.meterScanMismatchHelp || 'Could not match this meter photo. Check the extracted meter number and reading below.',
      });
    } finally {
      setScanning(false);
    }
  }, [basePath, t]);

  const loadPhoto = useCallback(async (file, readingDate = todayLocalIso()) => {
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setScanResult(null);
    setSelectedSubscriber(null);
    setPreviousReading(null);
    setForm(emptyReadingForm(readingDate));
    await scanPhoto(file);
  }, [scanPhoto]);

  const handleChoosePhoto = async (event) => {
    const files = Array.from(event.target.files || []).filter(isImageFile);
    event.target.value = '';
    if (!files.length) return;

    setMsg(null);
    if (photoFile || scanning || scanResult) {
      setPhotoQueue((current) => [...current, ...files]);
      const messageTemplate = t.photosAddedToQueue || '{count} photos added to the queue.';
      setMsg({
        type: 'info',
        text: messageTemplate.replace('{count}', files.length),
      });
      return;
    }

    const [firstFile, ...remainingFiles] = files;
    setCompletedInBatch(0);
    setPhotoQueue(remainingFiles);
    await loadPhoto(firstFile, form.reading_date);
  };

  const handleSkipCurrent = async () => {
    const [nextFile, ...remainingFiles] = photoQueue;
    if (!nextFile) {
      resetScanState();
      return;
    }

    const readingDateForNext = form.reading_date;
    setPhotoQueue(remainingFiles);
    await loadPhoto(nextFile, readingDateForNext);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!selectedSubscriber?.subscription_id) {
      setMsg({ type: 'warning', text: t.noMatchedSubscriberYet || 'No subscriber is matched to this scan yet.' });
      return;
    }

    const readingValue = toFiniteNumber(form.reading_value);
    if (!Number.isFinite(readingValue) || readingValue < 0) {
      setMsg({ type: 'danger', text: t.newMeterReading || 'New meter reading' });
      return;
    }

    setSaving(true);
    try {
      if (scope === 'owner') {
        const { month, year } = getMonthYearParts(form.reading_date);
        await api.post('/owner/bills', {
          subscription_id: selectedSubscriber.subscription_id,
          month,
          year,
          current_reading: readingValue,
          ocr_confirmed: true,
          ocr: { meterNumber: scanResult.meter_number, readingValue: scanResult.reading_value, confidence: scanResult.confidence },
          reading_date: form.reading_date,
          notes: form.notes || '',
        });
        setMsg({ type: 'success', text: t.readingSavedAndBillGenerated || 'Reading saved and bill generated for this month.' });
      } else {
        const { month, year } = getMonthYearParts(form.reading_date);
        await api.post(`${basePath}/bills`, {
          subscription_id: selectedSubscriber.subscription_id,
          month,
          year,
          current_reading: readingValue,
          ocr_confirmed: true,
          ocr: { meterNumber: scanResult.meter_number, readingValue: scanResult.reading_value, confidence: scanResult.confidence },
          reading_date: form.reading_date,
          notes: form.notes || '',
        });
        setMsg({ type: 'success', text: t.readingSavedAndBillGenerated || 'Reading saved and bill generated for this month.' });
      }
      setCompletedInBatch((current) => current + 1);
      const [nextFile, ...remainingFiles] = photoQueue;
      if (nextFile) {
        setPhotoQueue(remainingFiles);
        await loadPhoto(nextFile, form.reading_date);
      } else {
        resetScanState();
      }
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || t.failed || 'Operation failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h4 className="page-title">
          <FiCamera style={{ marginRight: 7, verticalAlign: 'middle' }} />
          {t.meterScan || 'Meter Scan'}
        </h4>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>
          {msg.text}
          <button className="btn-close" onClick={() => setMsg(null)}>x</button>
        </div>
      )}

      <div className="table-card">
        <div className="card-header-row">
          <span className="card-title">{t.meterScan || 'Meter Scan'}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {t.meterScanIntro || 'Upload the meter photo first. The subscriber will be matched automatically.'}
          </span>
        </div>

        <div style={{ padding: '16px', display: 'grid', gap: 14 }}>
          <div className="meter-upload-area" style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
            {previewUrl ? (
              <img src={previewUrl} alt={t.readingPhoto || 'Reading photo'} />
            ) : (
              <div>
                <FiUploadCloud style={{ fontSize: '2rem', marginBottom: 8 }} />
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                  {t.uploadMeterPhoto || 'Upload Meter Photo'}
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {t.meterScanUploadHelp || 'Upload a clear meter photo. The system will extract the meter number and reading, then match the subscriber automatically.'}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <label
                className="btn btn-primary"
                style={{ position: 'relative', overflow: 'hidden' }}
              >
                <FiCamera style={{ marginRight: 6 }} />
                {photoFile ? (t.takeAnotherPhoto || 'Take Another Photo') : (t.takePhoto || 'Take Photo')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handleChoosePhoto}
                  disabled={saving}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                  }}
                />
              </label>
              <label
                className="btn btn-outline-primary"
                style={{ position: 'relative', overflow: 'hidden' }}
              >
                <FiUploadCloud style={{ marginRight: 6 }} />
                {t.choosePhotos || t.choosePhoto || 'Choose Photos'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleChoosePhoto}
                  disabled={saving}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                  }}
                />
              </label>
              {scanning && (
                <span className="btn btn-light disabled">
                  <span className="spinner-border spinner-border-sm" style={{ marginRight: 6 }} />
                  {t.loading || 'Loading...'}
                </span>
              )}
            </div>
            {(completedInBatch > 0 || currentBatchTotal > 1) && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {(t.meterScanBatchStatus || 'Batch: {saved} saved, 1 active, {waiting} waiting.')
                  .replace('{saved}', completedInBatch)
                  .replace('{waiting}', photoQueue.length)}
              </div>
            )}
          </div>

          {scanResult && (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface)',
                padding: '14px',
                display: 'grid',
                gap: 10,
              }}
            >
              <SummaryRow
                items={[
                  { label: t.prevReading || 'Prev Reading', value: previousReading ?? 0 },
                  {
                    label: t.newReading || 'New Reading',
                    value: form.reading_value || scanResult.reading_value || '',
                    render: (
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={form.reading_value}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          reading_value: event.target.value,
                        }))}
                        min={0}
                        step={0.01}
                        style={{
                          width: '100%',
                          maxWidth: 180,
                        }}
                      />
                    ),
                  },
                ]}
              />
              <SummaryRow
                items={[
                  {
                    label: t.month || 'Month',
                    value: formatReadingMonth(form.reading_date, lang),
                    render: (
                      <input
                        type="month"
                        className="form-control form-control-sm"
                        value={monthInputValue(form.reading_date)}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          reading_date: applyMonthToDate(current.reading_date, event.target.value),
                        }))}
                        style={{
                          width: '100%',
                          maxWidth: 180,
                        }}
                      />
                    ),
                  },
                  { label: t.meterNum || 'Meter #', value: scanResult.meter_number || '-' },
                  { label: t.subscriber || 'Subscriber', value: selectedSubscriber?.full_name || '-' },
                ]}
              />
              {scanResult.confidence != null && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {t.confidence || 'Confidence'}: {Number(scanResult.confidence).toFixed(1)}%
                </div>
              )}
            </div>
          )}

          {!selectedSubscriber && scanResult?.meter_number && (
            <div className="alert alert-warning mb-0">
              {t.noActiveSubscriberForMeter || 'No active subscriber was found for meter number'} <strong>{scanResult.meter_number}</strong>.
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={resetScanState}
                disabled={saving || scanning}
              >
                <FiRefreshCw style={{ marginRight: 6 }} />
                {t.reset || 'Reset'}
              </button>
              {(photoFile || photoQueue.length > 0) && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleSkipCurrent}
                  disabled={saving || scanning}
                >
                  {photoQueue.length > 0 ? (t.skipPhoto || 'Skip Photo') : (t.cancel || 'Cancel')}
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || scanning || !selectedSubscriber || !scanResult}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm" style={{ marginRight: 6 }} />
                ) : (
                  <FiSave style={{ marginRight: 6 }} />
                )}
                {t.saveReading || 'Save Reading'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
