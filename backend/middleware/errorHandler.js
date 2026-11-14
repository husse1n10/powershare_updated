'use strict';
const AppError = require('../utils/AppError');

function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

function normalizeError(err){
  if(err instanceof AppError || err?.statusCode) return err;
  if(err?.code==='ER_DUP_ENTRY') return new AppError('A record with the same unique value already exists',409,'DUPLICATE_RESOURCE');
  if(err?.code==='ER_NO_REFERENCED_ROW_2' || err?.code==='ER_ROW_IS_REFERENCED_2') return new AppError('The requested operation conflicts with related records',409,'DATA_INTEGRITY_CONFLICT');
  if(err?.code==='ER_DATA_TOO_LONG' || err?.code==='ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || err?.code==='ER_WARN_DATA_OUT_OF_RANGE') return new AppError('One or more values are invalid for this field',422,'INVALID_DATA');
  if(err?.name==='MulterError'){
    const message=err.code==='LIMIT_FILE_SIZE'?'Uploaded file exceeds the 8 MB limit':(err.message||'Invalid upload');
    return new AppError(message,422,'UPLOAD_VALIDATION_ERROR');
  }
  if(/Only JPG, PNG or WEBP images are allowed/i.test(String(err?.message||''))) return new AppError(err.message,422,'INVALID_IMAGE_TYPE');
  return err;
}

function errorHandler(originalErr, req, res, _next) {
  const err=normalizeError(originalErr);
  const status = err.statusCode || (err instanceof AppError ? 400 : 500);
  const payload = {
    success: false,
    error: status>=500 && process.env.NODE_ENV==='production' ? 'Internal server error' : (err.message || 'Internal server error'),
    code: err.code || 'INTERNAL_ERROR',
  };
  if (err.details) payload.details = err.details;
  if (process.env.NODE_ENV !== 'production' && status >= 500) payload.stack = err.stack;
  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler, normalizeError };
