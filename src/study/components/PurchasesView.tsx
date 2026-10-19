import React, { useState } from 'react';
import {
  GraduationCap,
  Receipt,
  ArrowRight,
  IndianRupee,
  Clock3,
  CheckCircle2,
  Download,
  Search,
  BookOpen,
  Calendar,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { EnrolledCoursesView } from './Courses/EnrolledCoursesView';
import { CourseDetailView } from './Courses/CourseDetailView';
import { useCatalog } from './Courses/courseData';
import { MissingCourse } from './Courses/CoursesHub';
import { Toast, formatINR, useToast } from './Courses/CourseShared';

/* ------------------------------------------------------------------ */
/*  Types & Mock Transactions                                          */
/* ------------------------------------------------------------------ */

export interface PurchaseRecord {
  id: string;
  orderNumber: string;
  title: string;
  category: 'IIT-JEE' | 'NEET' | 'CBSE';
  type: 'Course' | 'Test Series' | 'Subscription';
  amount: number;
  date: string;
  paymentMethod: string;
  status: 'Active' | 'Completed' | 'Expired';
}

const DEFAULT_PURCHASES: PurchaseRecord[] = [
  {
    id: 'ord_1',
    orderNumber: 'EDR-2026-9812',
    title: 'PRO Subscription — 12 Months All-Access',
    category: 'IIT-JEE',
    type: 'Subscription',
    amount: 4999,
    date: '02 Aug 2026',
    paymentMethod: 'UPI / GPay',
    status: 'Active',
  },
  {
    id: 'ord_2',
    orderNumber: 'EDR-2026-9540',
    title: 'Rotational Dynamics & Mechanics Mastery',
    category: 'IIT-JEE',
    type: 'Course',
    amount: 149,
    date: '18 Aug 2026',
    paymentMethod: 'Credit Card (•••• 4021)',
    status: 'Active',
  },
  {
    id: 'ord_3',
    orderNumber: 'EDR-2026-9218',
    title: 'JEE Main Full Syllabus All-India Test Series',
    category: 'IIT-JEE',
    type: 'Test Series',
    amount: 299,
    date: '25 Aug 2026',
    paymentMethod: 'UPI / PhonePe',
    status: 'Active',
  },
  {
    id: 'ord_4',
    orderNumber: 'EDR-2026-8804',
    title: 'Organic Chemistry Synthesis & Reactions Vault',
    category: 'IIT-JEE',
    type: 'Course',
    amount: 199,
    date: '05 Sep 2026',
    paymentMethod: 'Net Banking (HDFC)',
    status: 'Completed',
  },
  {
    id: 'ord_5',
    orderNumber: 'EDR-2026-7910',
    title: 'Electrostatics & Current Electricity Foundation',
    category: 'IIT-JEE',
    type: 'Course',
    amount: 99,
    date: '10 Jun 2026',
    paymentMethod: 'UPI / Paytm',
    status: 'Expired',
  },
];

const STATUS_STYLES: Record<PurchaseRecord['status'], { badge: string; dot: string }> = {
  Active: {
    badge: 'bg-[#10B981]/15 text-[#059669] border border-[#10B981]/25',
    dot: 'bg-[#10B981]',
  },
  Completed: {
    badge: 'bg-[#175A67]/15 text-[#175A67] border border-[#175A67]/25',
    dot: 'bg-[#175A67]',
  },
  Expired: {
    badge: 'bg-red-50 text-red-600 border border-red-200',
    dot: 'bg-red-500',
  },
};

/* ------------------------------------------------------------------ */
/*  Component Props                                                    */
/* ------------------------------------------------------------------ */

interface PurchasesViewProps {
  onBack: () => void;
  selectedBatch: string;
  initialView?: 'overview' | 'enrolled' | 'transactions';
}

export function PurchasesView({
  onBack,
  selectedBatch,
  initialView = 'overview',
}: PurchasesViewProps) {
  const [currentView, setCurrentView] = useState<'overview' | 'enrolled' | 'transactions'>(initialView);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [jumpToPlans, setJumpToPlans] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Completed' | 'Expired'>('all');
  const [toast, showToast] = useToast();

  const totalSpent = DEFAULT_PURCHASES.reduce((sum, p) => sum + p.amount, 0);
  const activeCount = DEFAULT_PURCHASES.filter((p) => p.status === 'Active').length;
  const catalog = useCatalog();
  const enrolledCoursesCount = catalog.ownedBatches.length;

  const filteredPurchases = DEFAULT_PURCHASES.filter((p) => {
    const matchesFilter = statusFilter === 'all' || p.status === statusFilter;
    const matchesQuery =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const handleDownloadInvoice = (orderNumber: string, title: string) => {
    showToast(`Downloading Tax Invoice for ${orderNumber} (${title})…`);
  };

  // If a batch detail view is open:
  if (selectedBatchId) {
    const batch = catalog.getBatch(selectedBatchId);
    if (!batch) {
      return <MissingCourse status={catalog.status} error={catalog.error} onRetry={catalog.reload} onBack={() => setSelectedBatchId(null)} />;
    }

    return (
      <CourseDetailView
        key={selectedBatchId}
        batch={batch}
        isEnrolled={catalog.isOwned(selectedBatchId)}
        selectedBatch={selectedBatch}
        scrollToPlans={jumpToPlans}
        onBack={() => setSelectedBatchId(null)}
        onExit={onBack}
        onGoToMyCourses={() => {
          setSelectedBatchId(null);
          setCurrentView('enrolled');
        }}
      />
    );
  }

  // If user clicked into "Your Enrolled Courses":
  if (currentView === 'enrolled') {
    return (
      <EnrolledCoursesView
        selectedBatch={selectedBatch}
        onBack={() => setCurrentView('overview')}
        onOpenBatch={(batchId) => {
          setJumpToPlans(false);
          setSelectedBatchId(batchId);
        }}
        onBuyBatch={(batchId) => {
          setJumpToPlans(true);
          setSelectedBatchId(batchId);
        }}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'My Purchases', onClick: () => setCurrentView('overview') },
          { label: 'Your Enrolled Courses' },
        ]}
      />
    );
  }
  // If user clicked into "Transaction History":
  if (currentView === 'transactions') {
    return (
      <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30] min-h-[calc(100vh-6rem)] shadow-sm">
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
          <SubPageHeader
            onBack={() => setCurrentView('overview')}
            crumbs={[
              { label: 'Home', onClick: onBack },
              { label: 'My Purchases', onClick: () => setCurrentView('overview') },
              { label: 'Transaction History' },
            ]}
            rightElement={
              <button
                onClick={() => showToast('Generating consolidated statement for 2026…')}
                className="hidden sm:flex items-center gap-1.5 bg-white hover:bg-[#EAF3F1] text-[#175A67] border border-[#175A67]/20 font-bold text-xs px-3.5 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Consolidated Statement
              </button>
            }
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0B1C30] tracking-tight">Transaction History</h1>
              <p className="text-xs sm:text-sm text-[#2A707C] font-medium mt-1">
                Complete audit ledger of your receipts, GST invoices, and order references.
              </p>
            </div>

            {/* Quick Stat Pill */}
            <div className="flex items-center gap-3 bg-white/80 border border-white/80 rounded-2xl p-3 px-4 shadow-sm shrink-0">
              <div>
                <p className="text-[10px] font-bold text-[#70787C] uppercase tracking-wider">Total Investment</p>
                <p className="text-lg font-black text-[#175A67] flex items-center">
                  <IndianRupee className="w-4 h-4" />
                  {totalSpent.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="w-px h-8 bg-[#175A67]/15" />
              <div>
                <p className="text-[10px] font-bold text-[#70787C] uppercase tracking-wider">Active Items</p>
                <p className="text-lg font-black text-[#059669]">{activeCount}</p>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-white/60 p-3 rounded-2xl border border-white/80">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2A707C]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders, subjects, or #ID..."
                className="w-full pl-10 pr-4 py-2 bg-white rounded-xl text-xs sm:text-sm text-[#0B1C30] placeholder-[#70787C] focus:outline-none focus:ring-2 focus:ring-[#175A67]/20 border border-white/60"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'Active', 'Completed', 'Expired'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                    statusFilter === status
                      ? 'bg-[#175A67] text-white shadow-sm'
                      : 'bg-white/80 hover:bg-white text-[#2A707C] border border-white/80'
                  }`}
                >
                  {status === 'all' ? 'All Orders' : status}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions List */}
          {filteredPurchases.length === 0 ? (
            <div className="bg-white/70 rounded-3xl p-10 text-center border border-white/80">
              <Receipt className="w-12 h-12 text-[#175A67]/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#0B1C30]">No matching transactions found</h3>
              <p className="text-xs text-[#2A707C] mt-1">Try clearing your filters or search keywords.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredPurchases.map((p) => (
                <div
                  key={p.id}
                  className="bg-white/80 hover:bg-white border border-white/90 rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#175A67] to-[#0F3B42] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <Receipt className="w-5 h-5 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[11px] font-bold text-[#175A67] bg-[#175A67]/10 px-2 py-0.5 rounded-md">
                          #{p.orderNumber}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-[#40484B] px-2 py-0.5 rounded-md">
                          {p.category}
                        </span>
                        <span className="text-[10px] font-semibold text-[#70787C]">
                          &bull; {p.type}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-[#0B1C30] leading-snug">
                        {p.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-[#70787C] mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#175A67]" />
                          {p.date}
                        </span>
                        <span>&bull;</span>
                        <span>Paid via {p.paymentMethod}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#175A67]/10">
                    <div className="text-left md:text-right">
                      <p className="text-base sm:text-lg font-black text-[#0B1C30] flex items-center md:justify-end">
                        <IndianRupee className="w-4 h-4" />
                        {p.amount.toLocaleString('en-IN')}
                      </p>
                      <span className={`inline-flex items-center gap-1.5 mt-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[p.status].badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[p.status].dot}`} />
                        {p.status}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDownloadInvoice(p.orderNumber, p.title)}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#175A67] bg-white hover:bg-[#EAF3F1] border border-[#175A67]/20 px-3.5 py-2 rounded-xl transition-all active:scale-95 shadow-sm shrink-0"
                      title="Download Tax Invoice"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Invoice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  // Default: Overview Hub with the TWO main tiles as instructed by the user!
  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30] min-h-[calc(100vh-6rem)] shadow-sm">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        {/* SubPage Header */}
        <SubPageHeader
          onBack={onBack}
          crumbs={[
            { label: 'Home', onClick: onBack },
            { label: 'My Purchases' },
          ]}
        />

        {/* Page Headline */}
        <div className="mb-7">
          <h1 className="text-2xl sm:text-3xl font-black text-[#0B1C30] tracking-tight">My Purchases</h1>
          <p className="text-xs sm:text-sm text-[#2A707C] font-medium mt-1">
            Manage your enrolled academic courses.
          </p>
        </div>

        {/* ======================================================== */}
        {/*  MAIN TILE                                               */}
        {/* ======================================================== */}
        <div className="max-w-xl mb-8">
          {/* Tile 1: Your Enrolled Courses */}
          <div
            onClick={() => setCurrentView('enrolled')}
            className="group relative bg-white/75 hover:bg-white/95 backdrop-blur-md border border-white/80 rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between active:scale-[0.99]"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#175A67] to-[#0F3B42] text-white flex items-center justify-center shadow-md">
                  <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <span className="text-xs font-bold bg-[#10B981]/15 text-[#059669] px-3.5 py-1 rounded-full border border-[#10B981]/25 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  {enrolledCoursesCount} Batches Enrolled
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-[#0B1C30] group-hover:text-[#175A67] transition-colors">
                Your Enrolled Courses
              </h2>
              <p className="text-xs sm:text-sm text-[#40484B] mt-2 leading-relaxed">
                Access your active academic batches, daily lecture streams, comprehensive curriculum roadmap, and chapter-wise DPPs.
              </p>
            </div>

            <div className="mt-7 pt-4 border-t border-[#175A67]/10 flex items-center justify-between">
              <span className="text-xs font-bold text-[#175A67] group-hover:underline flex items-center gap-1.5">
                Open Enrolled Courses
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
              <span className="text-[11px] text-[#70787C] font-semibold">Resume Lectures &gt;</span>
            </div>
          </div>
        </div>
      </div>
      <Toast message={toast} />
    </div>
  );
}

export default PurchasesView;
