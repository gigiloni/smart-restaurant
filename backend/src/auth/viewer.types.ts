import type { Viewer } from '@smart-restaurant/contracts';

export type StaffViewer = Extract<Viewer, { kind: 'staff' }>;
export type GuestViewer = Extract<Viewer, { kind: 'guest' }>;

export type { Viewer };
