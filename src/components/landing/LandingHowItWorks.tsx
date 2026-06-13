const STEPS = [
  { num: '01', title: 'Create Your Account', desc: 'Sign up in 2 minutes. Choose “Educator” for transfer matching or “General” for CV tools – or both.' },
  { num: '02', title: 'Build Your Profile / CV', desc: 'Educators fill in teaching details (phase, subjects, province). General users build a polished CV with our AI assistant.' },
  { num: '03', title: 'Connect or Apply', desc: 'Educators: search and message peers open to transfer. General users: browse vacancies and submit applications.' },
  { num: '04', title: 'Achieve Your Goal', desc: 'Secure your school transfer or land your next job – all supported by Crosssa tools.' },
];

export default function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#f0fdfa] py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">Simple Process</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mt-2 mb-3">How Crosssa Works</h2>
          <p className="text-[#64748b] max-w-xl mx-auto">One platform, two journeys – both easy to start.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <div key={step.num} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(100%-12px)] w-6 h-0.5 bg-[#99f6e4] z-10" />
              )}
              <div className="bg-white rounded-2xl p-6 border border-[#ccfbf1] h-full">
                <span className="text-3xl font-black text-[#ccfbf1] block mb-3">{step.num}</span>
                <h3 className="text-base font-bold text-[#0f172a] mb-2">{step.title}</h3>
                <p className="text-sm text-[#64748b] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}