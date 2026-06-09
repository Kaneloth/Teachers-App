import { useState } from 'react';
import { Briefcase, FileText, Mail } from 'lucide-react';
import VacanciesPage from '@/pages/VacanciesPage';
import CVBuilderPage from '@/pages/CVBuilderPage';
import CoverLettersPage from '@/pages/CoverLettersPage';

type CareerTab = 'vacancies' | 'cv' | 'letters';

const TABS: { id: CareerTab; label: string; icon: typeof FileText }[] = [
  { id: 'vacancies', label: 'Vacancies',     icon: Briefcase },
  { id: 'cv',        label: 'CV Builder',    icon: FileText  },
  { id: 'letters',   label: 'Cover Letters', icon: Mail      },
];

export default function CareerToolsPage() {
  const [active, setActive] = useState<CareerTab>('vacancies');

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Tab switcher ─────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-3 pb-0">
        <div className="flex gap-0">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                  isActive
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.5} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="flex-1">
        {active === 'vacancies' && <VacanciesPage />}
        {active === 'cv'        && <CVBuilderPage />}
        {active === 'letters'   && <CoverLettersPage />}
      </div>
    </div>
  );
}
