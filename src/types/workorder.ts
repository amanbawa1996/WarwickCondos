export interface WorkOrder {
  _id: string;
  resident_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  unitNumber: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  assigned_staff_id?: string;
  scheduledDate?: Date | string;
  completedDate?: Date | string;
  estimatedCost?: number;
  actualCost?: number;
  paymentUrl?: string;
  paymentStatus: 'unpaid' | 'paid';
  paymentRequestedDate?: Date | string;
  paymentRequestAmount?: number;

  selectedPaymentMethodId?: string | null;
  selectedPaymentMethod?: {
    id: string;
    brand: string;
    last4: string;
    expMonth: number | null;
    expYear: number | null;
  } | null;

  _createdAt?: Date | string;
  _updatedAt?: Date | string;
}
