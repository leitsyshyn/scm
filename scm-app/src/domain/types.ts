export type UUID = string;

export interface SoLineOpen {
  id: UUID;
  salesOrderId: UUID;
  soNumber: string | null;
  customerId: UUID;
  customerName: string;
  soStatus: string;
  orderDate: string;
  lineNo: number;
  productId: UUID;
  productSku: string;
  productName: string;
  uomId: UUID;
  uomCode: string;
  qtyOrdered: number;
  qtyReservedOpen: number;
  qtyToReserve: number;
}

export interface InventoryAvailable {
  warehouseId: UUID;
  warehouseCode: string;
  binId: UUID | null;
  binCode: string | null;
  productId: UUID;
  productSku: string;
  productName: string;
  lotId: UUID | null;
  lotCode: string | null;
  qtyOnHand: number;
  qtyAvailable: number;
}

export interface PickItemDetail {
  id: UUID;
  picklistId: UUID;
  warehouseId: UUID;
  picklistStatus: string;
  reservationId: UUID;
  binId: UUID | null;
  binCode: string | null;
  productId: UUID;
  productSku: string;
  productName: string;
  lotId: UUID | null;
  lotCode: string | null;
  qtyToPick: number;
  qtyPicked: number;
  status: string;
}

export interface ShipmentDetail {
  shipmentId: UUID;
  shipmentNumber: string | null;
  salesOrderId: UUID;
  soNumber: string;
  warehouseId: UUID;
  carrierId: UUID | null;
  carrierName: string | null;
  trackingNo: string | null;
  shipDate: string | null;
  shipmentItemId: UUID;
  productId: UUID;
  productSku: string;
  productName: string;
  lotId: UUID | null;
  lotCode: string | null;
  qtyShipped: number;
}

export interface CreateSalesOrderInput {
  soId?: UUID;
  customerId: UUID;
  orderDate: string;
  dueDate?: string | null | undefined;
  currency: string;
  userId: UUID;
}

export interface AddSalesOrderLineInput {
  soId: UUID;
  soLineId?: UUID;
  productId: UUID;
  uomId: UUID;
  qtyOrdered: number;
  pricePerUom: number;
  userId: UUID;
}

export interface ApproveSalesOrderInput {
  soId: UUID;
  userId: UUID;
}

export interface CreateReservationInput {
  reservationId?: UUID;
  soLineId: UUID;
  warehouseId: UUID;
  binId?: UUID | null | undefined;
  productId: UUID;
  lotId?: UUID | null | undefined;
  qtyReserved: number;
  userId: UUID;
}

export interface CreatePicklistInput {
  picklistId?: UUID;
  salesOrderId: UUID;
  warehouseId: UUID;
  userId: UUID;
}

export interface ConfirmPickInput {
  pickItemId: UUID;
  qtyToConfirm: number;
  userId: UUID;
}

export interface CreateShipmentInput {
  shipmentId?: UUID;
  salesOrderId: UUID;
  warehouseId: UUID;
  carrierId?: UUID | null | undefined;
  trackingNo?: string | null | undefined;
  shipDate: string; 
  userId: UUID;
}

export interface AddShipmentFromPicksInput {
  shipmentId: UUID;
  userId: UUID;
}

export interface InventoryFilter {
  warehouseId: UUID;
  productId: UUID;
  binId?: UUID | null;
  lotId?: UUID | null;
}
