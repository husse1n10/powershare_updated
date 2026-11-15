export function normalizeMeterScan(data) {
  if (!data) return null;
  const subscriber = data.subscriber || null;
  const previous = data.previous_value ?? subscriber?.last_reading_value ?? subscriber?.initial_kwh_consumed;
  const parsed = previous == null || previous === '' ? null : Number(previous);
  return {
    ...data,
    subscriber,
    meter_number: data.meter_number ?? data.ocr?.meterNumber ?? '',
    reading_value: data.reading_value ?? data.ocr?.readingValue ?? null,
    confidence: data.confidence ?? data.ocr?.confidence ?? null,
    previous_value: Number.isFinite(parsed) ? parsed : null,
  };
}
