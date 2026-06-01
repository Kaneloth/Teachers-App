import { Smartphone, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingAppBanner() {
  return (
    <section className="bg-[#0f172a] py-16 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10">
        {/* Phone mockup */}
        <div className="flex-shrink-0 flex justify-center">
          <div className="relative w-44">
            <div className="bg-[#1e293b] rounded-[2.5rem] p-3 shadow-2xl border border-white/10">
              <div className="bg-[#0d9488] rounded-[2rem] h-80 flex flex-col items-center justify-center gap-4 px-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <span className="text-white font-extrabold text-lg">EC</span>
                </div>
                <p className="text-white font-bold text-center text-sm">EduCross</p>
                <div className="space-y-2 w-full">
                  {['Match Found', 'CV Ready', 'New Message'].map((label, i) => (
                    <div key={i} className="bg-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${['bg-green-400','bg-amber-400','bg-blue-400'][i]}`} />
                      <p className="text-white/90 text-[10px] font-medium">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#1e293b] rounded-full z-10" />
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 text-center md:text-left">
          <span className="inline-block text-xs font-bold text-[#0d9488] bg-[#0d9488]/20 px-3 py-1 rounded-full mb-3 uppercase tracking-widest">
            📱 Mobile App
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
            EduCross is built<br />
            <span className="text-[#2dd4bf]">for your phone.</span>
          </h2>
          <p className="text-white/70 text-base mb-6 max-w-md">
            Get instant vacancy alerts, chat with educators, and manage your transfer — right from your pocket. Available on iOS & Android.
          </p>

          {/* Star rating */}
          <div className="flex items-center gap-2 justify-center md:justify-start mb-6">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <span className="text-white/60 text-sm">Loved by educators across SA</span>
          </div>

          {/* Store buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start mb-6">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-[#0d9488] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#0f766e] transition-colors shadow-lg text-sm"
            >
              Get Started Now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex items-center gap-2 justify-center md:justify-start">
            <Smartphone className="w-4 h-4 text-[#2dd4bf]" />
            <p className="text-white/50 text-xs">
              Works on any device — phone, tablet, or desktop.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}