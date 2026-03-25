import { useState, useEffect } from 'react';
import { BaseCrudService } from '@/integrations';
import { StaffMembers } from '@/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, X, Check, Search } from 'lucide-react';

import AdminHeader from '@/components/layout/AdminHeader';
import Footer from '@/components/layout/Footer';

export default function StaffManagementPage() {
  const { toast } = useToast();
  const [staffMembers, setStaffMembers] = useState<StaffMembers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStaff, setFilteredStaff] = useState<StaffMembers[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    role: '',
    employeeId: '',
  });

  useEffect(() => {
    loadStaffMembers();
  }, []);

  useEffect(() => {
    filterStaff();
  }, [staffMembers, searchTerm]);

  const loadStaffMembers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/staff", { credentials: "include" });
      const data = await res.json();

      // If your API returns Wix-ish shape already, you're good
      const items = (data?.items || []) as StaffMembers[];

      setStaffMembers(items);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load staff members", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const filterStaff = () => {
    if (!searchTerm) {
      setFilteredStaff(staffMembers);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = staffMembers.filter(
      (staff) =>
        (staff.full_name || '').toLowerCase().includes(term) ||
        (staff.email || '').toLowerCase().includes(term) ||
        (staff.role || '').toLowerCase().includes(term) ||
        (staff.employee_id || '').toLowerCase().includes(term)
    );
    setFilteredStaff(filtered);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phoneNumber: '',
      role: '',
      employeeId: '',
    });
    setIsAddingNew(false);
    setEditingId(null);
  };

  const handleAddNew = () => {
    resetForm();
    setIsAddingNew(true);
  };

  const handleEdit = (staff: StaffMembers) => {
    setFormData({
      name: staff.full_name || '',
      email: staff.email || '',
      phoneNumber: staff.phone_number || '',
      role: staff.role || '',
      employeeId: staff.employee_id || '',
    });
    setEditingId(staff._id);
    setIsAddingNew(false);
    // Scroll to form
    setTimeout(() => {
      document.querySelector('[data-edit-form]')?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.role) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields (Name, Email, Role)',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingId) {
        // Update existing staff
        const res = await fetch(`/api/admin/staff/${editingId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phoneNumber: formData.phoneNumber,
            role: formData.role,
            employeeId: formData.employeeId,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        toast({
          title: 'Success',
          description: 'Staff member updated successfully',
        });
      } else {
        // Create new staff
        const res = await fetch("/api/admin/staff/", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phoneNumber: formData.phoneNumber,
            role: formData.role,
            employeeId: formData.employeeId,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        toast({
          title: 'Success',
          description: 'Staff member added successfully',
        });
      }
      resetForm();
      loadStaffMembers();
    } catch (error) {
      console.error('Error saving staff member:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : "Failed to save staff member",
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/staff/${id}`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(await res.text());
      toast({
        title: 'Success',
        description: 'Staff member deleted successfully',
      });
      loadStaffMembers();
    } catch (error) {
      console.error('Error deleting staff member:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : "Failed to delete staff member",
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      <AdminHeader />

      <main className="max-w-[120rem] mx-auto px-6 lg:px-12 py-16">
        <div className="mb-12">
          <h1 className="font-heading text-5xl lg:text-6xl text-primary-foreground mb-4">
            Staff Management
          </h1>
          <p className="font-paragraph text-lg text-primary-foreground/80">
            Add, edit, and manage your team members
          </p>
        </div>

        {/* Add/Edit Form */}
        {(isAddingNew || editingId) && (
          <div data-edit-form className="bg-secondary rounded-3xl p-6 lg:p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-2xl text-secondary-foreground">
                {editingId ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h2>
              <button
                onClick={resetForm}
                className="text-secondary-foreground hover:opacity-70 transition-opacity"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-paragraph text-base text-secondary-foreground">
                  Full Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-primary border-secondary-foreground/20 text-primary-foreground"
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="font-paragraph text-base text-secondary-foreground">
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-primary border-secondary-foreground/20 text-primary-foreground"
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="font-paragraph text-base text-secondary-foreground">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="bg-primary border-secondary-foreground/20 text-primary-foreground"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="font-paragraph text-base text-secondary-foreground">
                  Role *
                </Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="bg-primary border-secondary-foreground/20 text-primary-foreground"
                  placeholder="e.g., Plumber, Electrician, Carpenter"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeId" className="font-paragraph text-base text-secondary-foreground">
                  Employee ID
                </Label>
                <Input
                  id="employeeId"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="bg-primary border-secondary-foreground/20 text-primary-foreground"
                  placeholder="EMP-001"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <Button
                onClick={handleSave}
                className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph flex items-center gap-2"
              >
                <Check size={18} />
                {editingId ? 'Update Staff Member' : 'Add Staff Member'}
              </Button>
              <Button
                onClick={resetForm}
                variant="outline"
                className="border-2 border-secondary-foreground text-secondary-foreground hover:bg-secondary-foreground hover:text-secondary font-paragraph"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Search and Add Button */}
        <div className="bg-secondary rounded-3xl p-6 lg:p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-foreground/50" size={20} />
              <Input
                placeholder="Search by name, email, role, or employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-primary border-secondary-foreground/20 text-primary-foreground w-full"
              />
            </div>
            {!isAddingNew && !editingId && (
              <Button
                onClick={handleAddNew}
                className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph flex items-center gap-2 whitespace-nowrap"
              >
                <Plus size={18} />
                Add Staff Member
              </Button>
            )}
          </div>
        </div>

        {/* Staff Members List */}
        {isLoading ? (
          <div className="text-center py-20">
            <p className="font-paragraph text-xl text-primary-foreground/80">Loading staff members...</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-paragraph text-xl text-primary-foreground/80">
              {searchTerm ? 'No staff members found matching your search' : 'No staff members yet. Add one to get started!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStaff.map((staff) => (
              <div
                key={staff._id}
                className="bg-secondary rounded-3xl p-6 lg:p-8 hover:scale-[1.01] transition-transform duration-300"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex-1">
                    <h3 className="font-heading text-2xl text-secondary-foreground mb-2">
                      {staff.full_name}
                    </h3>
                    <div className="space-y-2">
                      <p className="font-paragraph text-base text-secondary-foreground/70">
                        <span className="font-paragraph text-secondary-foreground/60">Email:</span> {staff.email}
                      </p>
                      {staff.phone_number && (
                        <p className="font-paragraph text-base text-secondary-foreground/70">
                          <span className="font-paragraph text-secondary-foreground/60">Phone:</span> {staff.phone_number}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        <Badge className="bg-primary text-primary-foreground border-primary-foreground/20 font-paragraph">
                          {staff.role}
                        </Badge>
                        {staff.employee_id && (
                          <Badge className="bg-primary text-primary-foreground border-primary-foreground/20 font-paragraph">
                            ID: {staff.employee_id}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 lg:flex-col">
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEdit(staff);
                      }}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-paragraph flex items-center gap-2 flex-1 lg:flex-none"
                    >
                      <Edit2 size={18} />
                      Edit
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(staff._id, staff.full_name || 'Staff Member');
                      }}
                      variant="destructive"
                      className="bg-destructive text-destructiveforeground hover:bg-destructive/90 font-paragraph flex items-center gap-2 flex-1 lg:flex-none"
                    >
                      <Trash2 size={18} />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {!isLoading && staffMembers.length > 0 && (
          <div className="mt-12 pt-8 border-t border-primary-foreground/10">
            <p className="font-paragraph text-base text-primary-foreground/70">
              Total Staff Members: <span className="font-heading text-2xl text-primary-foreground">{staffMembers.length}</span>
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
