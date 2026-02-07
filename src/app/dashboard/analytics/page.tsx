'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart3, Globe, Monitor, MousePointerClick } from 'lucide-react';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [topCountries, setTopCountries] = useState<Record<string, number>>({});
  const [topDevices, setTopDevices] = useState<Record<string, number>>({});
  const [topReferrers, setTopReferrers] = useState<Record<string, number>>({});
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(7); // days
  const supabase = createClient();

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  async function loadAnalytics() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    const { data } = await supabase
      .from('analytics_daily')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (data) {
      setAnalytics(data);

      // Aggregate breakdowns
      const countries: Record<string, number> = {};
      const devices: Record<string, number> = {};
      const referrers: Record<string, number> = {};
      let clicks = 0;

      data.forEach((day) => {
        clicks += day.total_clicks || 0;
        if (day.countries) Object.entries(day.countries).forEach(([k, v]) => { countries[k] = (countries[k] || 0) + (v as number); });
        if (day.devices) Object.entries(day.devices).forEach(([k, v]) => { devices[k] = (devices[k] || 0) + (v as number); });
        if (day.referrers) Object.entries(day.referrers).forEach(([k, v]) => { referrers[k] = (referrers[k] || 0) + (v as number); });
      });

      setTopCountries(countries);
      setTopDevices(devices);
      setTopReferrers(referrers);
      setTotalClicks(clicks);
    }
    setLoading(false);
  }

  function sortedEntries(obj: Record<string, number>) {
    return Object.entries(obj).sort(([, a], [, b]) => b - a).slice(0, 10);
  }

  function BreakdownCard({ title, icon: Icon, data }: { title: string; icon: any; data: Record<string, number> }) {
    const entries = sortedEntries(data);
    const max = entries.length > 0 ? entries[0][1] : 1;

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        {entries.length === 0 ? (
          <p className="text-gray-400 text-sm">No data yet</p>
        ) : (
          <div className="space-y-3">
            {entries.map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">{key}</span>
                  <span className="text-gray-500 font-medium">{value}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full"
                    style={{ width: `${(value / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">See how your audience interacts with your links.</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setDateRange(days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                dateRange === days
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Total clicks banner */}
      <div className="bg-brand-600 rounded-xl p-6 mb-8 text-white">
        <p className="text-brand-100 text-sm mb-1">Total clicks ({dateRange} days)</p>
        <p className="text-4xl font-bold">
          {loading ? '...' : totalClicks.toLocaleString()}
        </p>
      </div>

      {/* Click timeline - simple bar chart */}
      {!loading && analytics.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Clicks Over Time</h3>
          <div className="flex items-end gap-1 h-40">
            {analytics.map((day) => {
              const maxClicks = Math.max(...analytics.map((d) => d.total_clicks || 0), 1);
              const height = ((day.total_clicks || 0) / maxClicks) * 100;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center justify-end group" title={`${day.date}: ${day.total_clicks} clicks`}>
                  <div
                    className="w-full bg-brand-500 rounded-t hover:bg-brand-600 min-h-[2px]"
                    style={{ height: `${height}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{analytics[0]?.date}</span>
            <span>{analytics[analytics.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BreakdownCard title="Countries" icon={Globe} data={topCountries} />
        <BreakdownCard title="Devices" icon={Monitor} data={topDevices} />
        <BreakdownCard title="Referrers" icon={MousePointerClick} data={topReferrers} />
      </div>
    </div>
  );
}
