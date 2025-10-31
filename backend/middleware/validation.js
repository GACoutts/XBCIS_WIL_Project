// backend/middleware/validation.js - Input validation middleware
import { body, param, query, validationResult } from 'express-validator';

// Middleware to handle validation results
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
      code: 'VALIDATION_ERROR'
    });
  }
  next();
};

// Ticket ID validation
export const validateTicketId = [
  param('ticketId')
    .isInt({ min: 1 })
    .withMessage('TicketId must be a positive integer'),
  handleValidationErrors
];

// Quote ID validation
export const validateQuoteId = [
  param('quoteId')
    .isInt({ min: 1 })
    .withMessage('QuoteId must be a positive integer'),
  handleValidationErrors
];

// Pagination validation
export const validatePagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative'),
  handleValidationErrors
];

// Date range validation
export const validateDateRange = [
  query('dateFrom')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('dateFrom must be a valid ISO 8601 date'),
  query('dateTo')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('dateTo must be a valid ISO 8601 date')
    .custom((dateTo, { req }) => {
      if (req.query.dateFrom && dateTo && new Date(dateTo) < new Date(req.query.dateFrom)) {
        throw new Error('dateTo must be after dateFrom');
      }
      return true;
    }),
  handleValidationErrors
];

// Status validation
export const validateStatus = [
  query('status')
    .optional()
    .isIn(['Open', 'In Review', 'Quoting', 'Approved', 'In Progress', 'Completed', 'Closed'])
    .withMessage('Invalid status value'),
  handleValidationErrors
];

// Combined landlord query validation
export const validateLandlordQueries = [
  ...validatePagination.slice(0, -1), // Remove handleValidationErrors
  ...validateDateRange.slice(0, -1),
  ...validateStatus.slice(0, -1),
  handleValidationErrors
];