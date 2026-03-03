import { Mail, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-primary border-t border-primary-foreground/10 mt-24">
      <div className="max-w-[120rem] mx-auto px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h3 className="font-heading text-2xl text-primary-foreground mb-4">
              Warwick Condo
            </h3>
            <p className="font-paragraph text-base text-primary-foreground/80">
              Streamlined work order management for modern condominium communities.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-xl text-primary-foreground mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="/" className="font-paragraph text-base text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="/dashboard" className="font-paragraph text-base text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/submit" className="font-paragraph text-base text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  Submit Request
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-xl text-primary-foreground mb-4">
              Contact
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-primary-foreground/80" />
                <span className="font-paragraph text-base text-primary-foreground/80">
                  anca.aghintei@blueskyhospitalitysolutions.com
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={18} className="text-primary-foreground/80" />
                <span className="font-paragraph text-base text-primary-foreground/80">
                  (555) 123-4567
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/10">
          <p className="font-paragraph text-sm text-primary-foreground/60 text-center">
            © {new Date().getFullYear()} Warwick Condo. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
