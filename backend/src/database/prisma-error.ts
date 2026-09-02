import { Prisma } from '../generated/prisma/client.js';

/**
 * Prisma error codes used across the repositories.
 * @see https://www.prisma.io/docs/orm/reference/error-reference
 */
export const PrismaErrorCode = {
  UniqueConstraintViolation: 'P2002',
  ForeignKeyConstraintViolation: 'P2003',
  RecordNotFound: 'P2025',
} as const;

export type PrismaErrorCode = (typeof PrismaErrorCode)[keyof typeof PrismaErrorCode];

export const isPrismaError = (error: unknown, code: PrismaErrorCode): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
