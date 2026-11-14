'use strict';
const fs=require('fs/promises');
const path=require('path');
const os=require('os');
const sharp=require('sharp');
const {createWorker}=require('tesseract.js');
const subscriberRepo=require('../../DAL/repositories/subscriberRepository');
const profileRepo=require('../../DAL/repositories/profileRepository');
const {validateMeterReading}=require('../domain/billingRules');
const {normalizeMeterNumber,parseOcrText}=require('../domain/ocrRules');
const AppError=require('../../utils/AppError');

// DEF-067: OCR must not depend on a runtime CDN download and must never hang a
// request (which also kept private meter photos on disk). The English model is
// bundled via @tesseract.js-data/eng and every OCR step has a timeout.
const OCR_TIMEOUT_MS=Number(process.env.OCR_TIMEOUT_MS||45000);
function ocrWorkerOptions(){
  const opts={errorHandler:()=>{},cachePath:path.join(os.tmpdir(),'powershare-tessdata')};
  try{const eng=require('@tesseract.js-data/eng');opts.langPath=eng.langPath;opts.gzip=eng.gzip;}catch(_){/* falls back to tesseract.js default download */}
  return opts;
}
function withTimeout(promise,ms){let t;return Promise.race([promise,new Promise((_,rej)=>{t=setTimeout(()=>rej(new Error('OCR timeout')),ms);})]).finally(()=>clearTimeout(t));}
async function recognizeImage(imagePath){
  if(!imagePath)throw new AppError('Meter image is required',422,'METER_IMAGE_REQUIRED');
  const prepared=`${imagePath}.processed.png`;
  try{await sharp(imagePath).greyscale().normalize().sharpen().resize({width:1600,withoutEnlargement:true}).png().toFile(prepared);}
  catch(_){await fs.unlink(prepared).catch(()=>{});throw new AppError('The uploaded file is not a readable JPG, PNG or WEBP image',422,'INVALID_IMAGE');}
  let worker;
  try{worker=await withTimeout(createWorker('eng',1,ocrWorkerOptions()),OCR_TIMEOUT_MS);}
  catch(_){await fs.unlink(prepared).catch(()=>{});throw new AppError('OCR engine is unavailable. Enter the meter reading manually.',503,'OCR_UNAVAILABLE');}
  try{
    let result;
    try{result=await withTimeout(worker.recognize(prepared),OCR_TIMEOUT_MS);}
    catch(_){throw new AppError('OCR could not read this image in time. Enter the meter reading manually.',503,'OCR_UNAVAILABLE');}
    const parsed=parseOcrText(result.data.text);
    return {...parsed,confidence:Number(result.data.confidence||0)};
  }finally{await worker.terminate(); await fs.unlink(prepared).catch(()=>{});}
}

async function scanForOwner(userId,imagePath){
  try{
    const owner=await profileRepo.getOwnerByUserId(userId); if(!owner)throw new AppError('Owner profile not found',404,'OWNER_NOT_FOUND');
    const ocr=await recognizeImage(imagePath);
    let subscriber=null;
    if(ocr.meterNumber) subscriber=await subscriberRepo.findByMeter(owner.id,ocr.meterNumber);
    return {ocr,subscriber,requires_confirmation:true};
  }finally{
    if(imagePath)await fs.unlink(imagePath).catch(()=>{});
  }
}
async function scanForCollector(userId,imagePath){
  try{
    const collector=await profileRepo.getCollectorByUserId(userId); if(!collector)throw new AppError('Collector profile not found',404,'COLLECTOR_NOT_FOUND');
    const ocr=await recognizeImage(imagePath); let subscriber=null;
    if(ocr.meterNumber) subscriber=await subscriberRepo.findByMeter(collector.owner_id,ocr.meterNumber);
    return {ocr,subscriber,requires_confirmation:true};
  }finally{
    if(imagePath)await fs.unlink(imagePath).catch(()=>{});
  }
}
async function addReading({ownerId,subscriptionId,readingValue,readingDate,photoPath,userId,ocr={}}){
  const sub=await subscriberRepo.getSubscription(ownerId,subscriptionId); if(!sub)throw new AppError('Subscription not found',404,'SUBSCRIPTION_NOT_FOUND');
  const prev=await subscriberRepo.previousReading(subscriptionId,sub.initial_kwh_consumed);
  const validation=validateMeterReading(readingValue,prev); if(!validation.valid)throw new AppError(validation.error,422,'INVALID_METER_READING');
  return subscriberRepo.createReading({subscription_id:subscriptionId,reading_value:Number(readingValue),previous_value:prev,reading_date:readingDate||new Date().toISOString().slice(0,10),photo_path:photoPath?path.relative(process.cwd(),photoPath):null,ocr_meter_number:ocr.meterNumber||null,ocr_reading_value:ocr.readingValue??null,ocr_confidence:ocr.confidence??null,ocr_confirmed:true,created_by:userId});
}
module.exports={normalizeMeterNumber,parseOcrText,recognizeImage,scanForOwner,scanForCollector,addReading};
