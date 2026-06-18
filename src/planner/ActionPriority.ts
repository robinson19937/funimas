export const ACTION_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;

export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const ACTION_PRIORITY_ORDER: Record<ActionPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};
