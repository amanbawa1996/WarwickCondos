// src/entities/index.ts
// Phase 1 stub types. We'll replace these with real DB models later.

/**
 * Collection ID: staffmembers
 * Interface for StaffMembers
 */
export interface StaffMembers {
  _id: string;
  
  /** @wixFieldType text */
  full_name?: string;
  /** @wixFieldType text */
  email?: string;
  /** @wixFieldType text */
  phone_number?: string;
  /** @wixFieldType text */
  role?: string;
  /** @wixFieldType image - Contains image URL, render with <Image> component, NOT as text */
  employee_id?: string;
  _createdDate?: Date;
}

export interface Residents {
  _id: string;
  
  /** @wixFieldType text */
  email?: string;
  /** @wixFieldType text */
  firstName?: string;
  lastName?: string;
  unit_number?: string;
  phoneNumber?: string;
  /** @wixFieldType text */
  approvalStatus?: string;
  _createdDate?: Date;
}

export interface AdminNotifications {
  _id: string;
  notificationType: string; // PAYMENT_REQUEST | new_resident_registration etc
  message: string;
  residentName?: string;
  residentEmail?: string;
  isRead: boolean;
  createdDate: string | Date;
  adminId: string; // 'all' or specific
  residentID?: string;
}