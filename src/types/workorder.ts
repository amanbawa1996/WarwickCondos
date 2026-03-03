export interface WorkOrder {
  _id: string;
  resident_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  unitNumber: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  assigned_staff_id?: string;
  scheduledDate?: Date;
  completedDate?: Date;
  estimatedCost?: number;
  actualCost?: number;
  paymentUrl?: string;
  paymentStatus: 'unpaid' | 'paid';
  paymentRequestedDate?: Date | string;
  paymentRequestAmount?: number;
  _createdAt?: Date;
  _updatedAt?: Date;
}
