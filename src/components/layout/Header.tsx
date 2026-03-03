import { Link } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useMember } from '@/integrations';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const memberContext = useMember();
  const memberData = memberContext.member;
  const isAuthenticated = memberContext.isAuthenticated;
  const role = (memberContext as any).userRole ?? null;
  const homePath = role === 'admin' ? '/admin' : '/home';
  // Use memberData directly from authenticated context
  const displayMember = memberData;

  // Extract name from member data - prioritize actual login email
  const getDisplayName = () => {
    if (displayMember?.contact?.firstName) {
      return displayMember.contact.firstName;
    }
    if (displayMember?.profile?.nickname) {
      return displayMember.profile.nickname;
    }
    if (displayMember?.loginEmail) {
      return displayMember.loginEmail.split('@')[0];
    }
    return 'Profile';
  };

  const { actions } = memberContext;

  const handleLogout = () => {
    localStorage.removeItem('residentSession');
    localStorage.removeItem('adminSession');
    localStorage.removeItem('devModeRole');
    localStorage.removeItem('mockMemberData');
    actions.logout();
  };

  // Only show header if authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="bg-primary border-b border-primary-foreground/10">
      <div className="max-w-[120rem] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-20">
          <Link to={homePath} className="font-heading text-2xl lg:text-3xl text-primary-foreground">
            Warwick Condo
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              to={homePath} 
              className="font-paragraph text-base text-primary-foreground hover:opacity-70 transition-opacity"
            >
              Home
            </Link>
            <Link 
              to={role === 'admin' ? '/admin' : '/dashboard'}
              className="font-paragraph text-base text-primary-foreground hover:opacity-70 transition-opacity"
            >
              {role === 'admin' ? 'Dashboard' : 'My Orders'}
            </Link>
            {role !== 'admin' && (
              <Link 
                to="/submit" 
                className="font-paragraph text-base text-primary-foreground hover:opacity-70 transition-opacity"
              >
                Submit Request
              </Link>
            )}
            <div className="flex items-center gap-4 border-l border-primary-foreground/20 pl-8">
              {role === 'admin' && <NotificationBell />}
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary-foreground/20 px-3 py-1 rounded-full text-primary-foreground">
                  {role === 'admin' ? 'Admin' : 'Resident'}
                </span>
                <Link 
                  to="/profile" 
                  className="font-paragraph text-base text-primary-foreground hover:opacity-70 transition-opacity"
                >
                  {getDisplayName()}
                </Link>
              </div>
              <Button
                onClick={handleLogout}
                className="bg-destructive text-white hover:bg-destructive/90 font-paragraph text-sm py-2 px-4 flex items-center gap-2"
              >
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-primary-foreground"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-6 border-t border-primary-foreground/10">
            <div className="flex flex-col gap-4">
              <Link 
                to={homePath}
                onClick={() => setIsMenuOpen(false)}
                className="font-paragraph text-base text-primary-foreground hover:opacity-70 transition-opacity"
              >
                Home
              </Link>
              <Link 
                to={role === 'admin' ? '/admin' : '/dashboard'}
                onClick={() => setIsMenuOpen(false)}
                className="font-paragraph text-base text-primary-foreground hover:opacity-70 transition-opacity"
              >
                {role === 'admin' ? 'Dashboard' : 'My Orders'}
              </Link>
              {role !== 'admin' && (
                <Link 
                  to="/submit" 
                  onClick={() => setIsMenuOpen(false)}
                  className="font-paragraph text-base text-primary-foreground hover:opacity-70 transition-opacity"
                >
                  Submit Request
                </Link>
              )}
              <div className="border-t border-primary-foreground/10 pt-4 mt-4">
                {role === 'admin' && <NotificationBell />}
                <Link 
                  to="/profile" 
                  onClick={() => setIsMenuOpen(false)}
                  className="font-paragraph text-base text-primary-foreground hover:opacity-70 transition-opacity block mb-4 mt-4"
                >
                  {displayMember?.contact?.firstName || displayMember?.profile?.nickname || 'Profile'}
                </Link>
                <span className="text-xs bg-primary-foreground/20 px-3 py-1 rounded-full text-primary-foreground inline-block mb-4">
                  {role === 'admin' ? 'Admin' : 'Resident'}
                </span>
                <Button
                  onClick={handleLogout}
                  className="w-full bg-destructive text-white hover:bg-destructive/90 font-paragraph text-sm py-2 flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  Logout
                </Button>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
