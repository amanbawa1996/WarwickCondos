// Resident Home Page - Original home page content
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Users, CreditCard, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';
import { Image } from '@/components/ui/image';
import ResidentHeader from '@/components/layout/ResidentHeader';
import Footer from '@/components/layout/Footer';

// --- Utility Components for Motion & Interaction ---

/**
 * AnimatedReveal
 * Uses IntersectionObserver to trigger a reveal animation when the element enters the viewport.
 * Safe, performant, and CSS-driven.
 */
type AnimatedRevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
};

const AnimatedReveal: React.FC<AnimatedRevealProps> = ({ 
  children, 
  className = '', 
  delay = 0,
  direction = 'up' 
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          element.classList.add('is-visible');
        }, delay);
        observer.unobserve(element);
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    observer.observe(element);
    return () => observer.disconnect();
  }, [delay]);

  const getTransform = () => {
    switch (direction) {
      case 'up': return 'translate-y-12';
      case 'down': return '-translate-y-12';
      case 'left': return 'translate-x-12';
      case 'right': return '-translate-x-12';
      default: return '';
    }
  };

  return (
    <div 
      ref={ref} 
      className={`transition-all duration-1000 ease-out opacity-0 ${getTransform()} ${className}`}
      style={{ willChange: 'opacity, transform' }}
    >
      <style>{`
        .is-visible {
          opacity: 1 !important;
          transform: translate(0, 0) !important;
        }
      `}</style>
      {children}
    </div>
  );
};

/**
 * ParallaxImage
 * A safe implementation of parallax using CSS variables updated by IntersectionObserver.
 */
const ParallaxImage: React.FC<{ src: string; alt: string; className?: string; id: string }> = ({ src, alt, className, id }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const ratio = entry.intersectionRatio;
            container.style.setProperty('--parallax-y', `${(1 - ratio) * 50}px`);
          }
        });
      },
      { threshold: buildThresholdList(), rootMargin: '0px' }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={`overflow-hidden relative ${className}`}>
      <div 
        className="w-full h-[120%] absolute top-[-10%] left-0 transition-transform duration-100 ease-linear will-change-transform"
        style={{ transform: 'translateY(var(--parallax-y, 0px))' }}
      >
        <Image
          src={src}
          alt={alt}
          width={1200}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

function buildThresholdList() {
  const thresholds = [];
  for (let i = 0; i <= 1.0; i += 0.05) {
    thresholds.push(i);
  }
  return thresholds;
}

// --- Main Page Component ---

export default function ResidentHomePage() {
  // Canonical Data Sources
  const serviceCards = [
    {
      id: 'submit-req',
      title: 'Submit Requests',
      description: 'Condo owners can easily submit detailed work order requests for any maintenance or service needs.',
      image: 'https://static.wixstatic.com/media/8b3327_d8cd18baf66047059b4b7e6e80434872~mv2.png?originWidth=576&originHeight=768',
      rotation: '-rotate-2',
      link: '/submit'
    },
    {
      id: 'my-orders',
      title: 'My Orders',
      description: 'View and track all your submitted work orders and their current status.',
      image: 'https://static.wixstatic.com/media/8b3327_965deb82c6e74ed8af0e367f18378700~mv2.png?originWidth=576&originHeight=768',
      rotation: 'rotate-0',
      link: '/dashboard'
    }
  ];

  const features = [
    {
      icon: ClipboardList,
      title: 'Request Tracking',
      desc: 'Monitor all work orders from submission to completion with detailed status updates.'
    },
    {
      icon: Users,
      title: 'Team Coordination',
      desc: 'Assign tasks to team members and manage workloads efficiently across your organization.'
    },
    {
      icon: CreditCard,
      title: 'Payment Integration',
      desc: 'Streamlined payment processing with transparent cost estimates and invoicing.'
    }
  ];

  return (
    <div className="min-h-screen bg-primary text-primary-foreground overflow-x-clip selection:bg-white selection:text-black">
      <ResidentHeader />

      {/* --- HERO SECTION --- */}
      <section className="relative w-full min-h-screen flex flex-col justify-center items-center pt-32 pb-20 px-6 overflow-hidden">
        
        {/* Background Ambience */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-white/5 rounded-full blur-[150px] opacity-30" />
        </div>

        <div className="w-full max-w-[120rem] mx-auto relative z-10">
          
          {/* Hero Typography */}
          <div className="text-center mb-24 lg:mb-32">
            <AnimatedReveal direction="up" delay={0}>
              <h1 className="font-heading text-7xl md:text-8xl lg:text-9xl leading-[0.9] tracking-tight text-white mix-blend-difference">
                Effortless <br />
                <span className="italic font-light opacity-90">Management</span>
              </h1>
            </AnimatedReveal>
            
            <AnimatedReveal direction="up" delay={200}>
              <div className="mt-8 flex flex-col items-center">
                <div className="h-px w-24 bg-white/30 mb-6" />
                <p className="font-paragraph text-xl md:text-2xl text-white/70 max-w-2xl text-center leading-relaxed">
                  Streamline your condominium work orders with precision, elegance, and ease.
                </p>
              </div>
            </AnimatedReveal>
          </div>

          {/* The Triptych Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 items-start perspective-1000">
            {serviceCards.map((card, index) => (
              <AnimatedReveal 
                key={card.id} 
                delay={400 + (index * 150)} 
                direction="up"
                className={`relative group ${index === 1 ? 'md:-mt-12' : ''}`}
              >
                <Link to={card.link} className="block">
                  <div 
                    className={`
                      relative bg-secondary rounded-[2rem] overflow-hidden 
                      transition-all duration-500 ease-out
                      hover:scale-[1.02] hover:shadow-2xl hover:shadow-white/10
                      ${card.rotation} hover:rotate-0 hover:z-20
                    `}
                  >
                    {/* Image Container */}
                    <div className="aspect-[3/4] relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500 z-10" />
                      <Image
                        src={card.image}
                        alt={card.title}
                        width={600}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      
                      {/* Overlay Content */}
                      <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20">
                        <h3 className="font-heading text-3xl text-white mb-2">{card.title}</h3>
                        <div className="h-px w-0 group-hover:w-full bg-white transition-all duration-500 ease-out mb-4" />
                        <p className="font-paragraph text-sm text-white/80 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-100">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </AnimatedReveal>
            ))}
          </div>
        </div>
      </section>

      {/* --- MANIFESTO / STICKY SCROLL SECTION --- */}
      <section className="relative w-full py-32 bg-primary border-t border-white/10">
        <div className="max-w-[120rem] mx-auto px-6 lg:px-12 flex flex-col lg:flex-row gap-20">
          
          {/* Sticky Title */}
          <div className="lg:w-1/3">
            <div className="sticky top-32">
              <AnimatedReveal direction="right">
                <span className="block font-paragraph text-sm tracking-[0.2em] uppercase text-white/50 mb-4">Our Philosophy</span>
                <h2 className="font-heading text-5xl lg:text-6xl text-white leading-tight">
                  Effortless <br />
                  <span className="text-white/40">Excellence.</span>
                </h2>
              </AnimatedReveal>
            </div>
          </div>

          {/* Scrolling Content */}
          <div className="lg:w-2/3 space-y-32">
            {[
              {
                title: "Precision Control",
                text: "Every request is a data point in a symphony of operations. We provide the conductor's baton, allowing you to direct maintenance flows with absolute precision.",
                icon: ShieldCheck
              },
              {
                title: "Transparent Finance",
                text: "Clarity is the ultimate luxury. Our payment integration ensures that every transaction is visible, traceable, and secure, eliminating ambiguity from the equation.",
                icon: CheckCircle2
              },
              {
                title: "Time Mastery",
                text: "We don't just manage tasks; we manage time. By streamlining communication between owners and teams, we return the most valuable asset back to you.",
                icon: Clock
              }
            ].map((item, idx) => (
              <AnimatedReveal key={idx} direction="up" className="group">
                <div className="flex flex-col md:flex-row gap-8 items-start border-l border-white/10 pl-8 md:pl-12 hover:border-white/40 transition-colors duration-500">
                  <div className="p-4 rounded-full border border-white/10 bg-white/5 group-hover:bg-white group-hover:text-black transition-all duration-500">
                    <item.icon size={32} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-heading text-4xl text-white mb-4">{item.title}</h3>
                    <p className="font-paragraph text-xl text-white/60 leading-relaxed max-w-xl group-hover:text-white/80 transition-colors">
                      {item.text}
                    </p>
                  </div>
                </div>
              </AnimatedReveal>
            ))}
          </div>
        </div>
      </section>

      {/* --- FEATURE SHOWCASE (BENTO GRID) --- */}
      <section className="w-full py-32 bg-white text-black relative overflow-hidden">
        <div className="max-w-[120rem] mx-auto px-6 lg:px-12 relative z-10">
          {/* ... keep existing code (empty section) ... */}
        </div>
      </section>

      {/* --- IMMERSIVE IMAGE BREAK --- */}
      <section className="w-full h-[80vh] relative overflow-hidden">
        <ParallaxImage 
          id="immersive-break"
          src="https://static.wixstatic.com/media/8b3327_414b5b1238cd4544ac2589a648c4ad3b~mv2.png?originWidth=1920&originHeight=960"
          alt="Architectural Detail"
          className="w-full h-full"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <AnimatedReveal>
            <h2 className="font-heading text-6xl md:text-8xl text-white text-center mix-blend-overlay opacity-90">
              Live & Love
            </h2>
          </AnimatedReveal>
        </div>
      </section>

      {/* --- WELCOME SECTION --- */}
      <section className="w-full py-32 bg-primary text-white border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <AnimatedReveal direction="up">
            <h2 className="font-heading text-5xl md:text-7xl mb-8">
              Welcome to Effortless Management
            </h2>
            <p className="font-paragraph text-xl md:text-2xl text-white/60 leading-relaxed">
              Experience a platform that transforms property management into a seamless, elegant process. 
              Designed for residents and administrators who value efficiency and clarity.
            </p>
          </AnimatedReveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
