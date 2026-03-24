/**
 * TestGroup-related type definitions
 */

export interface TestGroup {
  id: string;
  name: string;
  description?: string;
  runOnSchedule: boolean;
  createdAt: string;
  updatedAt: string;
  memberships?: TestGroupMember[];
}

export interface TestGroupMember {
  id: string;
  testGroupId: string;
  testCaseId: string;
  order: number;
  testCase?: {
    id: string;
    title: string;
    status: string;
    framework: string;
  };
}

export interface CreateTestGroupRequest {
  name: string;
  description?: string;
  runOnSchedule?: boolean;
}

export interface UpdateTestGroupRequest {
  name?: string;
  description?: string;
  runOnSchedule?: boolean;
}

export interface AddTestGroupMemberRequest {
  testCaseId: string;
  order?: number;
}

export interface ListTestGroupsResponse {
  testGroups: TestGroup[];
  total: number;
}

export interface GetTestGroupResponse extends TestGroup {}

export interface GroupExecutionResult {
  testGroupId: string;
  testGroupName: string;
  results: MemberExecutionResult[];
  passed: number;
  failed: number;
  healed: number;
  total: number;
}

export interface MemberExecutionResult {
  testCaseId: string;
  testCaseTitle: string;
  executionId: string;
  status: 'passed' | 'failed' | 'healed' | 'error';
  duration: number;
  healed: boolean;
}
