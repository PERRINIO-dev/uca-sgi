import { getAdminClient } from './admin'

export type AuditActionType =
  | 'SALE_CREATED'
  | 'SALE_CANCELLED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'ORDER_DELIVERED'
  | 'STOCK_REQUEST_APPROVED'
  | 'STOCK_REQUEST_REJECTED'
  | 'STOCK_REQUEST_SUBMITTED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'BOUTIQUE_CREATED'
  | 'BOUTIQUE_ACTIVATED'
  | 'BOUTIQUE_DEACTIVATED'
  | 'PASSWORD_RESET'
  | 'FLOOR_PRICE_VIOLATION_ATTEMPT'
  | 'QUOTE_CREATED'
  | 'QUOTE_CONVERTED'
  | 'QUOTE_CANCELLED'
  | 'PAYMENT_RECORDED'
  | 'COMPANY_CREATED'
  | 'COMPANY_ACTIVATED'
  | 'COMPANY_DEACTIVATED'
  | 'PLATFORM_USER_SUSPENDED'
  | 'PLATFORM_USER_REACTIVATED'
  | 'PLATFORM_USER_PASSWORD_RESET'
  | 'USER_ROLE_CHANGED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'
  | 'CAISSE_CLOSED'
  | 'SUPPLIER_CREATED'
  | 'SUPPLIER_UPDATED'
  | 'PO_CREATED'
  | 'PO_ORDERED'
  | 'PO_RECEIVED'
  | 'PO_CANCELLED'

export interface AuditEntry {
  user_id:            string | null
  user_role_snapshot: string
  action_type:        AuditActionType
  entity_type:        string
  entity_id:          string
  company_id:         string | null
  data_before?:       Record<string, unknown>
  data_after?:        Record<string, unknown>
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  await getAdminClient().from('audit_logs').insert(entry)
}
