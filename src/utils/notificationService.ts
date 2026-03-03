
import { AdminNotifications } from '@/entities';

/**
 * Notification Service
 * Handles creating and managing admin notifications
 * Includes privacy filtering for residents
 */
async function asText(res: Response) {
  const t = await res.text();
  return t || `${res.status} ${res.statusText}`;
}

export const notificationService = {
  async getUnreadNotifications(): Promise<AdminNotifications[]> {
    const res = await fetch("/api/notifications?unread=1", { credentials: "include" });
    if (!res.ok) throw new Error(await asText(res));
    const data = await res.json();
    return data?.items || [];
  },

  async getAllNotifications(): Promise<AdminNotifications[]> {
    const res = await fetch("/api/notifications", { credentials: "include" });
    if (!res.ok) throw new Error(await asText(res));
    const data = await res.json();
    return data?.items || [];
  },

  async markAsRead(notificationId: string): Promise<boolean> {
    const res = await fetch(`/api/notifications/${notificationId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    return res.ok;
  },

  async markAllAsRead(): Promise<boolean> {
    // simplest: fetch unread then patch each (matches your old service behavior)
    const unread = await this.getUnreadNotifications();
    await Promise.all(unread.map((n) => this.markAsRead(n._id)));
    return true;
  },

  async deleteNotification(notificationId: string): Promise<boolean> {
    const res = await fetch(`/api/notifications/${notificationId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  },

  // optional helper for later usage from WorkOrderDetails
  async createAdminNotification(data: {
    notificationType: string;
    residentId: string;
    message: string;
    residentName?: string;
    residentEmail?: string;
    unitNumber?: string;
  }): Promise<boolean> {
    const res = await fetch("/api/notifications", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok;
  },
};
