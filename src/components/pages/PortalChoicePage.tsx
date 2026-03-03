import { Link, useNavigate } from 'react-router-dom';
import { Users, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function PortalChoicePage() {
  const navigate = useNavigate();

  const handleQuickLoginAsAdmin = () => {
    localStorage.setItem('devModeRole', 'admin');
    navigate('/profile?role=admin');
  };

  const handleQuickLoginAsResident = () => {
    localStorage.setItem('devModeRole', 'resident');
    navigate('/profile?role=resident');
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-16">
            <h1 className="font-heading text-5xl lg:text-6xl text-primary-foreground mb-4">
              Choose Your Portal
            </h1>
            <p className="font-paragraph text-xl text-primary-foreground/70">
              Select whether you're a resident or administrator
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Resident Portal */}
            <Link to="/login" className="group">
              <div className="bg-secondary rounded-3xl p-8 lg:p-12 h-full flex flex-col justify-between hover:shadow-2xl transition-all duration-300 hover:scale-105">
                <div>
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Users size={32} className="text-secondary" />
                  </div>
                  <h2 className="font-heading text-3xl text-secondary-foreground mb-4">
                    Resident Portal
                  </h2>
                  <p className="font-paragraph text-lg text-secondary-foreground/70 mb-6">
                    Submit work order requests, track your orders, and manage payments for your unit.
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="font-paragraph text-base text-secondary-foreground/80 flex items-start gap-3">
                      <span className="text-primary mt-1">✓</span>
                      <span>Submit maintenance requests</span>
                    </li>
                    <li className="font-paragraph text-base text-secondary-foreground/80 flex items-start gap-3">
                      <span className="text-primary mt-1">✓</span>
                      <span>Track request status</span>
                    </li>
                    <li className="font-paragraph text-base text-secondary-foreground/80 flex items-start gap-3">
                      <span className="text-primary mt-1">✓</span>
                      <span>Make secure payments</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <Button className="w-full bg-primary text-secondary hover:bg-primary/90 font-paragraph text-lg py-6 flex items-center justify-center gap-2 group-hover:gap-4 transition-all">
                    Enter Portal
                    <ArrowRight size={20} />
                  </Button>
                  <Button 
                    onClick={handleQuickLoginAsResident}
                    variant="outline"
                    className="w-full border-2 border-secondary-foreground text-secondary-foreground hover:bg-secondary-foreground/10 font-paragraph text-sm py-2"
                  >
                    Quick Test (Resident)
                  </Button>
                </div>
              </div>
            </Link>

            {/* Admin Portal */}
            <Link to="/login" className="group">
              <div className="bg-secondary rounded-3xl p-8 lg:p-12 h-full flex flex-col justify-between hover:shadow-2xl transition-all duration-300 hover:scale-105">
                <div>
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Shield size={32} className="text-secondary" />
                  </div>
                  <h2 className="font-heading text-3xl text-secondary-foreground mb-4">
                    Admin Portal
                  </h2>
                  <p className="font-paragraph text-lg text-secondary-foreground/70 mb-6">
                    Manage residents, assign work orders, and oversee all maintenance operations.
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="font-paragraph text-base text-secondary-foreground/80 flex items-start gap-3">
                      <span className="text-primary mt-1">✓</span>
                      <span>Approve resident registrations</span>
                    </li>
                    <li className="font-paragraph text-base text-secondary-foreground/80 flex items-start gap-3">
                      <span className="text-primary mt-1">✓</span>
                      <span>Manage work orders</span>
                    </li>
                    <li className="font-paragraph text-base text-secondary-foreground/80 flex items-start gap-3">
                      <span className="text-primary mt-1">✓</span>
                      <span>Assign staff and track progress</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <Button className="w-full bg-primary text-secondary hover:bg-primary/90 font-paragraph text-lg py-6 flex items-center justify-center gap-2 group-hover:gap-4 transition-all">
                    Enter Portal
                    <ArrowRight size={20} />
                  </Button>
                  <Button 
                    onClick={handleQuickLoginAsAdmin}
                    variant="outline"
                    className="w-full border-2 border-secondary-foreground text-secondary-foreground hover:bg-secondary-foreground/10 font-paragraph text-sm py-2"
                  >
                    Quick Test (Admin)
                  </Button>
                </div>
              </div>
            </Link>
          </div>

          <div className="text-center mt-12">
            <p className="font-paragraph text-secondary-foreground/70">
              Need help?{' '}
              <Link to="/" className="text-secondary-foreground hover:underline font-semibold">
                Go back to home
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
