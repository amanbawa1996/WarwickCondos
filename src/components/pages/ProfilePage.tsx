"use client"

import { useState, useEffect, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Calendar, Upload, Check } from 'lucide-react';
// import Header from '@/components/layout/Header';
import ResidentHeader from '@/components/layout/ResidentHeader';
import AdminHeader from '@/components/layout/AdminHeader';
import Footer from '@/components/layout/Footer';
import { Image } from '@/components/ui/image';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
// import { useMember, type MemberContextType } from '@/integrations';
// import { BaseCrudService } from '@/integrations';
// import { Residents, Admins } from '@/entities';

function ProfilePageContent() {
  const isLoading = false; // auth gate happens in Router RequireAuth already
  const [userRole, setUserRole] = useState<"admin" | "resident" | null>(null);
  const [userData, setUserData] = useState<any>(null);

  const { toast } = useToast();
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Load user data from database based on logged-in email and role
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoadingUser(true);

        const res = await fetch("/api/profile", { cache: "no-store" });
        const json = await res.json();

        if (!json?.ok) {
          console.log("⚠️ ProfilePage: /api/profile failed", json);
          setIsLoadingUser(false);
          return;
        }

        const role = json.role as "admin" | "resident";
        const profile = json.profile;

        setUserRole(role);
        setUserData(profile);

        // Normalize fields for your existing UI state
        // residents table uses: first_name, last_name, phone_number
        // admins table might have full_name/phone_number/etc — we handle both
        const first =
          profile.first_name ??
          (profile.full_name ? String(profile.full_name).split(" ")[0] : "") ??
          "";
        const last =
          profile.last_name ??
          (profile.full_name ? String(profile.full_name).split(" ").slice(1).join(" ") : "") ??
          "";
        const phone = profile.phone_number ?? profile.phoneNumber ?? "";

        setProfileData({
          firstName: first || "",
          lastName: last || "",
          phone: phone || "",
        });

        console.log("✅ ProfilePage: loaded profile", { role });
      } catch (e) {
        console.log("❌ ProfilePage: network error", e);
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUserData();
  }, []);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid File',
          description: 'Please upload an image file.',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'Please upload an image smaller than 5MB.',
          variant: 'destructive',
        });
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setProfileImage(event.target?.result as string);
        toast({
          title: 'Image Selected',
          description: 'Your profile picture has been selected. Click Save to confirm.',
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // In a real implementation, this would update the resident data
      // For now, we'll just show a success message
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: 'Profile Updated',
        description: 'Your profile information has been saved successfully.',
      });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (userData && userRole) {
      if (userRole === "resident") {
        setProfileData({
          firstName: userData.first_name ?? "",
          lastName: userData.last_name ?? "",
          phone: userData.phone_number ?? "",
        });
      } else {
        const full = String(userData.full_name ?? "").trim();
        const parts = full.split(/\s+/).filter(Boolean);
        setProfileData({
          firstName: parts[0] ?? "",
          lastName: parts.slice(1).join(" ") ?? "",
          phone: userData.phone_number ?? "",
        });
      }
    }
    setIsEditing(false);
};

  // Determine if user is admin based on userRole from context
  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-primary text-primary-foreground">
      {isAdmin ? <AdminHeader /> : <ResidentHeader />}
      
      <main className="max-w-[120rem] mx-auto px-6 lg:px-12 py-16">
        {/* Back Button */}
        <Link to={isAdmin ? "/AdminDashboard" : "/ResidentHomePage"} className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-8">
          <ArrowLeft size={20} />
          <span className="font-paragraph">Back to Home</span>
        </Link>

        {/* Profile Header */}
        <div className="mb-12">
          <h1 className="font-heading text-5xl lg:text-6xl text-primary-foreground mb-4">
            My Profile
          </h1>
          <p className="font-paragraph text-lg text-primary-foreground/80">
            Manage your account information
          </p>
        </div>

        {/* Loading State */}
        {isLoading || isLoadingUser ? (
          <div className="text-center py-20">
            <p className="font-paragraph text-xl text-primary-foreground/80">Loading your profile...</p>
          </div>
        ) : !userData ? (
          <div className="text-center py-20">
            <p className="font-paragraph text-xl text-primary-foreground/80 mb-6">You are not logged in</p>
            <Link to="/login">
              <Button className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6">
                Go to Login
              </Button>
            </Link>
          </div>
        ) : (
          /* Profile Card */
          <div className="bg-secondary rounded-3xl p-8 lg:p-12 max-w-2xl">
            {/* Profile Picture Section */}
            <div className="mb-8 flex flex-col items-center">
              <div className="relative mb-6">
                {/* Profile Picture Circle */}
                <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-secondary-foreground/20 bg-secondary-foreground/5 flex items-center justify-center">
                  {profileImage ? (
                    <Image
                      src={profileImage}
                      alt="Profile Picture"
                      width={160}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-secondary-foreground/30">
                      <Upload size={48} />
                    </div>
                  )}
                </div>

                {/* Upload Button (visible when editing) */}
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-secondary-foreground text-secondary rounded-full p-3 cursor-pointer hover:bg-secondary-foreground/90 transition-colors shadow-lg">
                    <Upload size={20} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Edit/Save Buttons */}
              <div className="flex gap-3 w-full">
                {!isEditing ? (
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-base py-3"
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-base py-3 flex items-center justify-center gap-2"
                    >
                      <Check size={18} />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="outline"
                      className="flex-1 border-2 border-secondary-foreground text-secondary-foreground hover:bg-secondary-foreground/10 font-paragraph text-base py-3"
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Profile Information */}
            <div className="space-y-6 border-t border-secondary-foreground/10 pt-8">
              {/* First Name */}
              <div>
                <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">First Name</p>
                {isEditing ? (
                  <Input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    className="bg-secondary-foreground/5 border-secondary-foreground/20 text-secondary-foreground font-paragraph text-lg py-3"
                    placeholder="Enter your first name"
                  />
                ) : (
                  <p className="font-heading text-xl text-secondary-foreground">
                    {profileData.firstName || 'Not provided'}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Last Name</p>
                {isEditing ? (
                  <Input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                    className="bg-secondary-foreground/5 border-secondary-foreground/20 text-secondary-foreground font-paragraph text-lg py-3"
                    placeholder="Enter your last name"
                  />
                ) : (
                  <p className="font-heading text-xl text-secondary-foreground">
                    {profileData.lastName || 'Not provided'}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail size={16} className="text-secondary-foreground/60" />
                  <p className="font-paragraph text-sm text-secondary-foreground/60">Email</p>
                </div>
                <p className="font-paragraph text-lg text-secondary-foreground">
                  {userData?.email || 'Not provided'}
                </p>
                {/* {member?.loginEmailVerified && (
                  <p className="font-paragraph text-xs text-secondary-foreground/60 mt-1">✓ Verified</p>
                )} */}
              </div>

              {/* Phone */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Phone size={16} className="text-secondary-foreground/60" />
                  <p className="font-paragraph text-sm text-secondary-foreground/60">Phone</p>
                </div>
                {isEditing ? (
                  <Input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="bg-secondary-foreground/5 border-secondary-foreground/20 text-secondary-foreground font-paragraph text-lg py-3"
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <p className="font-paragraph text-lg text-secondary-foreground">
                    {profileData.phone || 'Not provided'}
                  </p>
                )}
              </div>

              {/* Approval Status (Residents only) */}
              {userRole === 'resident' && (
                <div>
                  <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Approval Status</p>
                  <p className="font-paragraph text-lg text-secondary-foreground capitalize">
                    {userData?.approval_status || 'Unknown'}
                  </p>
                </div>
              )}

              {/* Role Status (Admins only) */}
              {userRole === 'admin' && (
                <div>
                  <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Active</p>
                  <p className="font-paragraph text-lg text-secondary-foreground">
                    {userData?.is_active ? "Yes" : "No"}
                  </p>
                </div>
              )}

              
              
            </div>

            {/* Back Button */}
            <div className="mt-12 pt-8 border-t border-secondary-foreground/10">
              <Link to={isAdmin ? "/AdminDashboard" : "/ResidentHomePage"} className="block">
                <Button className="w-full bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function ProfilePage() {
  return <ProfilePageContent />;
}
