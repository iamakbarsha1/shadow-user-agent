import { prisma } from '../client';

/**
 * Database queries for test_groups and test_group_memberships tables
 */

export interface CreateTestGroupData {
  name: string;
  description?: string;
  runOnSchedule?: boolean;
}

export interface UpdateTestGroupData {
  name?: string;
  description?: string;
  runOnSchedule?: boolean;
}

/**
 * Creates a new test group
 */
export async function createTestGroup(data: CreateTestGroupData) {
  return await prisma.testGroup.create({
    data: {
      name: data.name,
      description: data.description,
      runOnSchedule: data.runOnSchedule ?? false,
    },
    include: { memberships: { include: { testCase: true }, orderBy: { order: 'asc' } } },
  });
}

/**
 * Finds a test group by ID with its members
 */
export async function findTestGroupById(id: string) {
  return await prisma.testGroup.findUnique({
    where: { id },
    include: { memberships: { include: { testCase: true }, orderBy: { order: 'asc' } } },
  });
}

/**
 * Lists all test groups
 */
export async function listTestGroups() {
  return await prisma.testGroup.findMany({
    orderBy: { createdAt: 'desc' },
    include: { memberships: { include: { testCase: true }, orderBy: { order: 'asc' } } },
  });
}

/**
 * Updates a test group
 */
export async function updateTestGroup(id: string, data: UpdateTestGroupData) {
  return await prisma.testGroup.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.runOnSchedule !== undefined && { runOnSchedule: data.runOnSchedule }),
    },
    include: { memberships: { include: { testCase: true }, orderBy: { order: 'asc' } } },
  });
}

/**
 * Deletes a test group by ID
 */
export async function deleteTestGroup(id: string) {
  return await prisma.testGroup.delete({ where: { id } });
}

/**
 * Adds a test case to a group
 */
export async function addMemberToGroup(testGroupId: string, testCaseId: string, order = 0) {
  return await prisma.testGroupMembership.upsert({
    where: { testGroupId_testCaseId: { testGroupId, testCaseId } },
    create: { testGroupId, testCaseId, order },
    update: { order },
  });
}

/**
 * Removes a test case from a group
 */
export async function removeMemberFromGroup(testGroupId: string, testCaseId: string) {
  return await prisma.testGroupMembership.delete({
    where: { testGroupId_testCaseId: { testGroupId, testCaseId } },
  });
}

/**
 * Lists members of a group ordered by position
 */
export async function listGroupMembers(testGroupId: string) {
  return await prisma.testGroupMembership.findMany({
    where: { testGroupId },
    include: { testCase: true },
    orderBy: { order: 'asc' },
  });
}
