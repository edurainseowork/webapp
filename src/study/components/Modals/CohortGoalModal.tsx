import { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, ArrowRight, Info, AlertTriangle, RefreshCw, Loader2, Target } from 'lucide-react';
import { useCourses, type CmsCategory } from '../../lib/courses';

/* ------------------------------------------------------------------ */
/*  "Select your Goal" popup                                            */
/*                                                                      */
/*  Goals are the course categories managed in the admin CMS            */
/*  (GET /api/categories), so adding, renaming or removing a category   */
/*  there updates this popup without a code change.                     */
/* ------------------------------------------------------------------ */

interface CohortGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** CMS category id of the student's current goal, if any */
  activeGoalId: number | null;
  /** Saves the goal; reject with an Error to keep the popup open and show the message */
  onConfirm: (category: CmsCategory) => Promise<void>;
}

/** Up to two initials from the category name, shown in the card's icon tile. */
const initials = (name: string) =>
  name
    .split(/[\s\-/&.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '•';

export function CohortGoalModal(props: CohortGoalModalProps) {
  // Mounted only while open: categories load when the popup is shown, and every opening
  // starts from the student's current goal
  return props.isOpen ? <GoalPicker {...props} /> : null;
}

function GoalPicker({ onClose, activeGoalId, onConfirm }: CohortGoalModalProps) {
  const { status, error, categories, categoriesError, courses, reload } = useCourses();
  const [selectedId, setSelectedId] = useState<number | null>(activeGoalId);
  const [validation, setValidation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The saved goal can arrive after the popup opened
  useEffect(() => setSelectedId(activeGoalId), [activeGoalId]);

  // CMS order, plus how many published courses each category has
  const goals = useMemo(() => {
    const counts = new Map<number, number>();
    courses.forEach((c) => c.categoryId && counts.set(c.categoryId, (counts.get(c.categoryId) ?? 0) + 1));
    return [...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((category) => ({ category, courseCount: counts.get(category.id) ?? 0 }));
  }, [categories, courses]);

  const selected = goals.find((g) => g.category.id === selectedId) ?? null;
  const active = goals.find((g) => g.category.id === activeGoalId) ?? null;
  const loading = status === 'loading' && categories.length === 0;
  const loadError = categories.length === 0 ? categoriesError ?? (status === 'error' ? error : null) : null;

  const handleConfirm = async () => {
    if (!selected) {
      setValidation('Please select a goal to continue.');
      return;
    }
    setValidation(null);
    setSaving(true);
    try {
      await onConfirm(selected.category);
      onClose();
    } catch (err) {
      setValidation(err instanceof Error && err.message ? err.message : 'Could not save your goal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const countText = (n: number) => (n === 0 ? 'Courses coming soon' : `${n} course${n === 1 ? '' : 's'} available`);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={saving ? undefined : onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 sm:px-7 pt-6 pb-5 shrink-0 relative">
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#EAF3F1] hover:bg-[#dcece7] text-[#175A67] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Adaptive Learning Path
          </span>

          {/* "Your Goal" only names the saved goal; picking another card shows it as a pending switch
              until Confirm is clicked */}
          <h2 id="goal-modal-title" className="text-xl sm:text-2xl font-bold text-[#0C2E35] mt-3 pr-10">
            {selected && active && selected.category.id !== active.category.id ? (
              <>
                Switch your goal to <span className="text-[#175A67]">{selected.category.name}</span>?
              </>
            ) : selected ? (
              <>
                {active ? 'Your Goal: ' : 'Set your goal to '}
                <span className="text-[#175A67]">{selected.category.name}</span>
              </>
            ) : (
              'Select your Goal'
            )}
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1.5 max-w-lg">
            {selected && active && selected.category.id !== active.category.id
              ? `Your current goal is ${active.category.name}. Click Confirm & Set Goal to switch to ${selected.category.name} — ${countText(
                  selected.courseCount
                ).toLowerCase()}.`
              : selected
              ? `We'll set up your courses, tests and notes for ${selected.category.name}. ${
                  selected.courseCount ? countText(selected.courseCount) + '.' : 'New courses for this goal are on the way.'
                }`
              : 'Choose your primary target exam to personalize your syllabus, diagnostic tests, and ranker notes.'}
          </p>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 sm:px-7 pb-4 flex-1">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Choose Your Target</span>
            {active && <span className="text-[11px] font-semibold text-emerald-600 truncate">Active Target: {active.category.name}</span>}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-busy="true" aria-label="Loading goals">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="rounded-2xl p-4 border-2 border-[#EAF3F1] animate-pulse">
                  <div className="w-9 h-9 rounded-xl bg-[#EAF3F1] mb-3" />
                  <div className="h-3 w-2/3 rounded bg-slate-200" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-100 mt-2" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border-2 border-[#EAF3F1] py-10 px-6 flex flex-col items-center text-center">
              <AlertTriangle className="w-6 h-6 text-amber-500 mb-2" />
              <p className="font-semibold text-[#0C2E35]">Couldn't load goals</p>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm">{loadError}</p>
              <button
                onClick={() => void reload()}
                className="mt-4 flex items-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-semibold px-4 py-2 rounded-full"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try again
              </button>
            </div>
          ) : goals.length === 0 ? (
            <div className="rounded-2xl border-2 border-[#EAF3F1] py-10 px-6 flex flex-col items-center text-center">
              <Target className="w-6 h-6 text-[#94A3B8] mb-2" />
              <p className="font-semibold text-[#0C2E35]">No goals available yet</p>
              <p className="text-xs text-[#64748B] mt-1">Goals will appear here once they are added. Please check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Goals">
              {goals.map(({ category, courseCount }) => {
                const isSelected = selectedId === category.id;
                return (
                  <button
                    key={category.id}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setSelectedId(category.id);
                      setValidation(null);
                    }}
                    className={`relative text-left rounded-2xl p-4 border-2 transition-all ${
                      isSelected ? 'bg-[#0F3B42] border-[#0F3B42] shadow-md' : 'bg-white border-[#EAF3F1] hover:border-[#175A67]/20'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </span>
                    )}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 text-xs font-bold ${
                        isSelected ? 'bg-white/15 text-white' : 'bg-[#EAF3F1] text-[#175A67]'
                      }`}
                    >
                      {initials(category.name)}
                    </div>
                    <p className={`font-semibold text-sm leading-snug ${isSelected ? 'text-white' : 'text-[#0C2E35]'}`}>{category.name}</p>
                    <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-white/70' : 'text-[#64748B]'}`}>{countText(courseCount)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-7 py-4 border-t border-[#EAF3F1] shrink-0">
          {validation && (
            <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-red-600 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {validation}
            </p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[11px] text-[#2A707C]">
              <Info className="w-3.5 h-3.5 shrink-0" />
              You can switch your goal anytime from the top navigation.
            </p>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                onClick={onClose}
                disabled={saving}
                className="text-sm font-bold text-[#2A707C] hover:text-[#175A67] px-2 transition-colors disabled:opacity-50"
              >
                {activeGoalId ? 'Cancel' : 'Skip for now'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || loading || !!loadError || goals.length === 0}
                className="flex items-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] disabled:opacity-60 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    Confirm &amp; Set Goal
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CohortGoalModal;