import { Prisma } from '@prisma/client';

const errorHandler = (err, req, res, _next) => {
  console.error('Error:', err);

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const field = err.meta?.target;
        return res.status(409).json({
          success: false,
          message: `A record with this ${Array.isArray(field) ? field.join(', ') : field || 'value'} already exists.`,
          error: 'UNIQUE_CONSTRAINT_VIOLATION',
        });
      }
      case 'P2025':
        return res.status(404).json({
          success: false,
          message: 'Record not found.',
          error: 'NOT_FOUND',
        });
      case 'P2003': {
        const field = err.meta?.field_name;
        return res.status(400).json({
          success: false,
          message: `Invalid reference: related record not found for ${field || 'foreign key'}.`,
          error: 'FOREIGN_KEY_VIOLATION',
        });
      }
      case 'P2014':
        return res.status(400).json({
          success: false,
          message: 'Cannot delete this record because it is referenced by other records.',
          error: 'RELATION_VIOLATION',
        });
      default:
        return res.status(400).json({
          success: false,
          message: `Database error: ${err.message}`,
          error: err.code,
        });
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      message: 'Invalid data provided. Please check your request.',
      error: 'VALIDATION_ERROR',
    });
  }

  // JWT errors (fallback)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired.',
    });
  }

  // Express body-parser errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
