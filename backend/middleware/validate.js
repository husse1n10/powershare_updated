'use strict';
const { validationResult } = require('express-validator');
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(422).json({ success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: errors.array() });
}
module.exports = { validate };
