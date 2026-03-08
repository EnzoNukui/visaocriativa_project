export type PermissionRole = 'admin' | 'supplier' | 'master';

export interface Permissions {
  viewOrders: boolean;
  viewFinancial: boolean;
  viewBatches: boolean;
  viewProduction: boolean;
  editRepasse: boolean;
  importOrders: boolean;
  createOrder: boolean;
  deleteOrder: boolean;
  manageUsers: boolean;
}

export const permissions: Record<PermissionRole, Permissions> = {
  admin: {
    viewOrders: true,
    viewFinancial: true,
    viewBatches: true,
    viewProduction: true,
    editRepasse: true,
    importOrders: true,
    createOrder: true,
    deleteOrder: true,
    manageUsers: false,
  },
  supplier: {
    viewOrders: true,       // RLS enforces own orders only
    viewFinancial: false,
    viewBatches: false,
    viewProduction: true,
    editRepasse: false,
    importOrders: false,
    createOrder: false,
    deleteOrder: false,
    manageUsers: false,
  },
  master: {
    viewOrders: true,
    viewFinancial: true,
    viewBatches: true,
    viewProduction: true,
    editRepasse: true,
    importOrders: true,
    createOrder: true,
    deleteOrder: true,
    manageUsers: true,
  },
};
