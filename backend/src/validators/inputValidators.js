/**
 * Lightweight input validation helpers for AgroCycle API
 */

export function validateRequired(obj, requiredFields) {
  const missing = [];
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    const err = new Error(`Missing required fields: ${missing.join(', ')}`);
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    err.details = { missingFields: missing };
    throw err;
  }
}

export function validateNumber(value, fieldName, { min = -Infinity, max = Infinity, required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      const err = new Error(`Field "${fieldName}" is required and must be a number`);
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) {
    const err = new Error(`Field "${fieldName}" must be a valid number`);
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (num < min || num > max) {
    const err = new Error(`Field "${fieldName}" must be between ${min} and ${max}`);
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return num;
}
