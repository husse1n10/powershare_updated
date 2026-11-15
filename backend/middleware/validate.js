'use strict';
const { validationResult } = require('express-validator');
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const details=errors.array().map(({value,...error})=>error);
  return res.status(422).json({ success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details });
}
module.exports = { validate };
