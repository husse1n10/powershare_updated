import { normalizeMeterScan } from './meterScan';
test('maps the real nested OCR API response and subscriber baseline into the editable confirmation', () => {
  const result=normalizeMeterScan({ocr:{meterNumber:'QAMETERA',readingValue:250,confidence:93},subscriber:{subscription_id:2,initial_kwh_consumed:'200.00',last_reading_value:null},requires_confirmation:true});
  expect(result).toMatchObject({meter_number:'QAMETERA',reading_value:250,confidence:93,previous_value:200,requires_confirmation:true});
});
test('preserves zero readings and uses the latest saved reading rather than the initial baseline', () => {
  expect(normalizeMeterScan({ocr:{readingValue:0},subscriber:{last_reading_value:'250.00',initial_kwh_consumed:200}})).toMatchObject({reading_value:0,previous_value:250});
  expect(normalizeMeterScan({ocr:{},subscriber:null}).previous_value).toBeNull();
  expect(normalizeMeterScan(null)).toBeNull();
});
