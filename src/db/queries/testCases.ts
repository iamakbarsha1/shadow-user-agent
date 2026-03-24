import { Prisma } from '@prisma/client';
import { prisma } from '../client';

/**
 * Database queries for test_cases table
 */

export interface CreateTestCaseData {
  runId: string;
  title: string;
  description?: string;
  testCode: string;
  framework?: string;
  selectorMap?: Record<string, string>;
}

export interface UpdateTestCaseData {
  title?: string;
  description?: string;
  testCode?: string;
  status?: string;
  lastRunAt?: Date;
  lastResult?: Prisma.InputJsonValue;
  selectorMap?: Record<string, string>;
}

/**
 * Creates a new test case record
 */
export async function createTestCase(data: CreateTestCaseData) {
  return await prisma.testCase.create({
    data: {
      runId: data.runId,
      title: data.title,
      description: data.description,
      testCode: data.testCode,
      framework: data.framework ?? 'playwright',
      selectorMap: data.selectorMap ?? {},
    },
  });
}

/**
 * Finds a test case by ID
 */
export async function findTestCaseById(id: string) {
  return await prisma.testCase.findUnique({
    where: { id },
  });
}

/**
 * Lists all test cases for a run
 */
export async function listTestCasesByRunId(runId: string) {
  return await prisma.testCase.findMany({
    where: { runId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Updates a test case
 */
export async function updateTestCase(id: string, data: UpdateTestCaseData) {
  return await prisma.testCase.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.testCode !== undefined && { testCode: data.testCode }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.lastRunAt !== undefined && { lastRunAt: data.lastRunAt }),
      ...(data.lastResult !== undefined && { lastResult: data.lastResult }),
      ...(data.selectorMap !== undefined && { selectorMap: data.selectorMap }),
    },
  });
}

/**
 * Deletes a test case by ID
 */
export async function deleteTestCase(id: string) {
  return await prisma.testCase.delete({
    where: { id },
  });
}

/**
 * Counts test cases for a run
 */
export async function countTestCasesByRunId(runId: string) {
  return await prisma.testCase.count({
    where: { runId },
  });
}
