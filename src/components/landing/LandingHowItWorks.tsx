const STEPS = [
  { num: '01', title: 'Create Your Profile', desc: 'Sign up and complete your educator profile — subjects, phase, province, and SACE number.' },
  { num: '02', title: 'Explore Vacancies & Peers', desc: 'Browse live vacancies or search for educators open to mutual transfers in your target area.' },
  { num: '03', title: 'Connect & Apply', desc: 'Send connection requests, start conversations, and apply using your EduCross-built CV.' },
  { num: '04', title: 'Get Placed', desc: 'Secure your next post with confidence, supported by verified credentials and a polished CV.' },
];

export default function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#f0fdfa] py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest">Simple Process</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] mt-2 mb-3">How EduCross Works</h2>
          <p className="text-[#64748b] max-w-xl mx-auto">From registration to placement in four straightforward steps.</p>
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
