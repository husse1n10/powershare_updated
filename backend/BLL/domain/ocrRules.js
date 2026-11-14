'use strict';
function normalizeMeterNumber(v){return String(v||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();}
function parseOcrText(text){
  const raw=String(text||'').replace(/\r/g,'\n');
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const meterCandidates=[]; const readingCandidates=[];
  for(const line of lines){
    const meterMatch=line.match(/(?:NO\.?|METER|SERIAL|N°)\s*[:#-]?\s*([A-Z0-9-]{4,20})/i); if(meterMatch)meterCandidates.push(meterMatch[1]);
    const readingMatch=line.match(/(?:KWH|READ(?:ING)?|INDEX)\s*[:#-]?\s*(\d{1,10}(?:[.,]\d{1,2})?)/i); if(readingMatch)readingCandidates.push(readingMatch[1]);
  }
  const allNumbers=(raw.match(/\d{4,12}(?:[.,]\d{1,2})?/g)||[]);
  const readingRaw=readingCandidates[0]||allNumbers.find(x=>/[.,]/.test(x))||allNumbers[0]||'';
  const meterRaw=meterCandidates[0]||allNumbers.find(x=>x!==readingRaw)||'';
  return {meterNumber:normalizeMeterNumber(meterRaw),readingValue:readingRaw?Number(readingRaw.replace(',','.')):null,rawText:raw};
}
module.exports={normalizeMeterNumber,parseOcrText};
