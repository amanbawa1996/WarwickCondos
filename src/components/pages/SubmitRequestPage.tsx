import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {useMember } from '@/integrations';
// import { WorkOrder } from '@/types/workorder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import ResidentHeader from '@/components/layout/ResidentHeader';
import Footer from '@/components/layout/Footer';

export default function SubmitRequestPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useMember();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    // category: "",
    unitNumber: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
  });
  // Auto-populate resident's email and name from authenticated session
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) return;

        const data = await res.json();

        // Make this tolerant to whatever your /api/profile returns
        const unit = data?.profile?.unit_number ?? data?.unit_number ?? "";
        const name =
          data?.profile?.full_name ??
          [data?.profile?.first_name, data?.profile?.last_name].filter(Boolean).join(" ").trim() ??
          "";
        const email = data?.profile?.email ?? "";
        const phone = data?.profile?.phone_number ?? "";

        setFormData((prev) => ({
          ...prev,
          unitNumber: prev.unitNumber || unit,
          ownerName: prev.ownerName || name,
          ownerEmail: prev.ownerEmail || email,
          ownerPhone: prev.ownerPhone || phone,
        }));
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isLoading) return;
      if (!isAuthenticated) throw new Error("You are not logged in. Please login again.");

      console.log("SUBMIT payload", formData);

      const res = await fetch("/api/resident/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // body: JSON.stringify({
        //   title: formData.title,
        //   description: formData.description,
        //   // category: formData.category,
        //   priority: formData.priority,
        // }),
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create work order");
      }

      toast({
        title: "Request Submitted",
        description: "Your work order request has been submitted successfully.",
      });

      setIsSubmitting(false);

      // IMPORTANT: your router currently has /dashboard commented out
      // So send them to ResidentHomePage (which is enabled)
      navigate("/ResidentHomePage");
    } catch (error) {
      console.error("Error submitting work order:", error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit your work order. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      <ResidentHeader />

      <main className="max-w-[100rem] mx-auto px-6 lg:px-12 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-heading text-5xl lg:text-6xl text-primary-foreground mb-4">
            Submit Work Order
          </h1>
          <p className="font-paragraph text-lg text-primary-foreground/80 mb-12">
            Complete the form below to submit your maintenance or service request
          </p>

          <form onSubmit={handleSubmit} className="bg-secondary rounded-3xl p-8 lg:p-12 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="font-paragraph text-base text-secondary-foreground">
                  Request Title *
                </Label>
                <Input
                  id="title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="e.g., Leaking faucet in kitchen"
                />
              </div>

            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-paragraph text-base text-secondary-foreground">
                Description *
              </Label>
              <Textarea
                id="description"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-secondary border-secondary-foreground/20 text-secondary-foreground min-h-32"
                placeholder="Provide detailed information about the issue..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="priority" className="font-paragraph text-base text-secondary-foreground">
                  Priority *
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitNumber" className="font-paragraph text-base text-secondary-foreground">
                  Unit Number *
                </Label>
                <Input
                  id="unitNumber"
                  required
                  value={formData.unitNumber}
                  onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="e.g., 301"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="ownerName" className="font-paragraph text-base text-secondary-foreground">
                  Your Name *
                </Label>
                <Input
                  id="ownerName"
                  required
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="Full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerEmail" className="font-paragraph text-base text-secondary-foreground">
                  Email Address *
                </Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  required
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerPhone" className="font-paragraph text-base text-secondary-foreground">
                Phone Number *
              </Label>
              <Input
                id="ownerPhone"
                type="tel"
                required
                value={formData.ownerPhone}
                onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="flex gap-4 pt-6">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/')}
                className="border-2 border-secondary-foreground text-secondary-foreground hover:bg-secondary-foreground hover:text-secondary font-paragraph text-lg py-6"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
