import React, { useState } from 'react';
import { X, Crown, Check, Sparkles, Zap, Shield, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
  const [billingCycle, setBillingCycle] = useState<'yearly' | 'monthly'>('yearly');
  const [isUpgraded, setIsUpgraded] = useState(false);

  if (!isOpen) return null;

  const handleUpgrade = () => {
    setIsUpgraded(true);
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#F59E0B', '#10B981', '#175A67', '#34D399']
    });
    setTimeout(() => {
      setIsUpgraded(false);
      onClose();
    }, 2000);
  };

  const proPerks = [
    'Unlimited 24/7 PI AI Doubt Solver with step-by-step derivations & LaTeX',
    'Full NTA All-India CBT Test Series with AIR Rank Predictor',
    'Offline Vault Downloader for 4,800+ Top IITian Notes & Formula Maps',
    'Personal Weak-Area Auto Doctor with adaptive question recommendations',
    'Weekly 1-on-1 Strategy Video Review with Top 50 IIT-JEE Mentors',
    'Exclusive Access to Arena Live Speed Duels & Tournament Prizes',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl max-h-[90vh] bg-[#EAE3DE]/95 backdrop-blur-2xl border border-[#175A67]/30 rounded-3xl p-5 sm:p-7 shadow-2xl text-[#175A67] z-10 overflow-y-auto no-scrollbar">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/60 hover:bg-white text-[#175A67] transition-colors shadow-sm"
          title="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-xl bg-[#175A67] text-white">
            <Crown className="w-5 h-5 text-amber-300" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#175A67] bg-[#175A67]/10 px-3 py-1 rounded-full border border-[#175A67]/20">
            EduRain Pro Tier
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-[#175A67] tracking-tight">
          Supercharge Your Rank with Pro
        </h2>
        <p className="text-xs sm:text-sm text-[#2A707C] mt-1">
          Join 15,000+ serious aspirants targeting top IITs and AIIMS with intelligent AI prep.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center my-5">
          <div className="bg-white/60 p-1 rounded-xl border border-[#175A67]/20 flex items-center text-xs font-bold">
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-[#175A67] text-white shadow-sm'
                  : 'text-[#2A707C] hover:text-[#175A67]'
              }`}
            >
              Annual (Save 40%)
            </button>
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-[#175A67] text-white shadow-sm'
                  : 'text-[#2A707C] hover:text-[#175A67]'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Pricing Box */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/60 border border-[#175A67]/20 mb-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl sm:text-4xl font-black text-[#175A67]">
                {billingCycle === 'yearly' ? '₹799' : '₹1,299'}
              </span>
              <span className="text-xs text-[#2A707C] font-semibold"> / month</span>
            </div>
            {billingCycle === 'yearly' && (
              <span className="px-2.5 py-1 bg-[#10B981]/15 text-[#059669] border border-[#10B981]/30 rounded-lg text-xs font-bold">
                Billed Annually
              </span>
            )}
          </div>

          <p className="text-xs text-[#2A707C] mt-2 font-medium">
            Includes full unlimited access to all AI Mentorship, Live CBTs & Library downloads.
          </p>
        </div>

        {/* Perks List */}
        <div className="space-y-2.5 mb-6">
          {proPerks.map((perk, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#175A67] font-medium">
              <div className="w-4 h-4 rounded-full bg-[#10B981]/20 text-[#059669] flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>{perk}</span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleUpgrade}
          disabled={isUpgraded}
          className="w-full py-3.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          {isUpgraded ? (
            <span className="flex items-center gap-2">
              <Check className="w-5 h-5 stroke-[3]" />
              PRO MEMBERSHIP ACTIVATED!
            </span>
          ) : (
            <span>ACTIVATE PRO ACCESS NOW</span>
          )}
        </button>

        <p className="text-[11px] text-center text-[#2A707C] mt-3">
          7-Day Instant Refund Guarantee • Cancel anytime with one click
        </p>
      </div>
    </div>
  );
};
