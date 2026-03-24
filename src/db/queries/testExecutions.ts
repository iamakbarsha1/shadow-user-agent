import { prisma } from '../client';
import { Prisma, type TestExecution } from '@prisma/client';
import type { FailureDiagnosis } from '../../types/testExecution';

/**
 * Database query helpers for the TestExecution model
 */

export interface CreateTestExecutionData {
  testCaseId: string;
  status: string;
  duration: number;
  output?: string;
  diagnosis?: FailureDiagnosis;
  healedCode?: string;
}

/**
 * Creates a new test execution record
 */
export async function createTestExecution(data: CreateTestExecutionData): Promise<TestExecution> {
  return prisma.testExecution.create({
    data: {
      testCaseId: data.testCaseId,
      status: data.status,
      duration: data.duration,
      output: data.output,
      diagnosis: data.diagnosis
        ? (data.diagnosis as unknown as Prisma.InputJsonValue)
        : undefined,
      healedCode: data.healedCode,
    },
  });
}

/**
 * Lists all executions for a test case, newest first
 */
export async function listExecutionsByTestCaseId(
  testCaseId: string,
  limit = 20
): Promise<TestExecution[]> {
  return prisma.testExecution.findMany({
    where: { testCaseId },
    orderBy: { executedAt: 'desc' },
    take: limit,
  });
}

/**
 * Counts executions for a test case
 */
export async function countExecutionsByTestCaseId(testCaseId: string): Promise<number> {
  return prisma.testExecution.count({ where: { testCaseId } });
}
