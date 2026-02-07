import Link from 'next/link';
import { ArrowRight, Eye, Link2, BarChart3, Users, Zap, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">CreatorPixel</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Log In
            </Link>
            <Link
              href="/auth/login"
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Now in Beta
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            You build the audience.<br />
            <span className="text-brand-600">You should own the data.</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            CreatorPixel reveals who actually watches, clicks, and engages with your content.
            Turn anonymous viewers into identified contacts — no database required.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/auth/login"
              className="bg-brand-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-brand-700 flex items-center gap-2"
            >
              Start Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#how-it-works"
              className="text-gray-600 px-8 py-3 rounded-lg text-lg font-medium hover:text-gray-900 border border-gray-200 hover:border-gray-300"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="px-6 py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Everything YouTube won&apos;t tell you
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Link2,
                title: 'Smart Links',
                desc: 'Replace your Linktree with instrumented links that capture rich data on every click. Works in YouTube descriptions, Instagram bio, TikTok, email — everywhere.',
              },
              {
                icon: BarChart3,
                title: 'Deep Analytics',
                desc: 'Go beyond basic clicks. See devices, locations, referral sources, time-of-day patterns, and cross-channel journeys for every visitor.',
              },
              {
                icon: Users,
                title: 'Identity Resolution',
                desc: 'AI-powered matching connects anonymous clicks into real contact profiles. See names, companies, social profiles — not just numbers.',
              },
            ].map((feature) => (
              <div key={feature.title} className="bg-white p-8 rounded-xl border border-gray-100 hover:shadow-lg">
                <div className="w-12 h-12 bg-brand-50 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof placeholder */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wide mb-8">Trusted by creators who want to own their data</p>
          <div className="grid grid-cols-3 gap-8">
            {[
              { stat: '10M+', label: 'Clicks tracked' },
              { stat: '15%', label: 'Avg. match rate' },
              { stat: '<100ms', label: 'Redirect speed' },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-4xl font-bold text-gray-900">{item.stat}</div>
                <div className="text-gray-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 bg-brand-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to see your real audience?</h2>
          <p className="text-brand-100 text-lg mb-8">Free plan includes 25 Smart Links and full click analytics. No credit card required.</p>
          <Link
            href="/auth/login"
            className="bg-white text-brand-600 px-8 py-3 rounded-lg text-lg font-medium hover:bg-brand-50 inline-flex items-center gap-2"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand-600 rounded flex items-center justify-center">
              <Eye className="w-4 h-4 text-white" />
            </div>
            <span>CreatorPixel</span>
          </div>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-gray-900">Privacy</Link>
            <Link href="#" className="hover:text-gray-900">Terms</Link>
            <Link href="#" className="hover:text-gray-900">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
