'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Link2, MousePointerClick, Users, TrendingUp } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface Stats {
  totalLinks: number;
  totalClicks: number;
  totalVisitors: number;
  recentClicks: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ totalLinks: 0, totalClicks: 0, totalVisitors: 0, recentClicks: [] });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadStats() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get link count and total clicks
      const { data: links } = await supabase
        .from('links')
        .select('id, total_clicks')
        .eq('user_id', user.id);

      const totalClicks = links?.reduce((sum, l) => sum + (l.total_clicks || 0), 0) || 0;

      // Get visitor count
      const { count: visitorCount } = await supabase
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get recent clicks
      const { data: recentClicks } = await supabase
        .from('click_events')
        .select('*, links(title, short_code)')
        .eq('user_id', user.id)
        .order('clicked_at', { ascending: false })
        .limit(10);

      setStats({
        totalLinks: links?.length || 0,
        totalClicks,
        totalVisitors: visitorCount || 0,
        recentClicks: recentClicks || [],
      });
      setLoading(false);
    }

    loadStats();
  }, []);

  const statCards = [
    { label: 'Smart Links', value: formatNumber(stats.totalLinks), icon: Link2, color: 'bg-blue-50 text-blue-600' },
    { label: 'Total Clicks', value: formatNumber(stats.totalClicks), icon: MousePointerClick, color: 'bg-green-50 text-green-600' },
    { label: 'Unique Visitors', value: formatNumber(stats.totalVisitors), icon: Users, color: 'bg-purple-50 text-purple-600' },
    { label: 'Match Rate', value: 'Coming Soon', icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your audience intelligence at a glance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? (
                <div className="h-9 w-20 bg-gray-100 rounded animate-pulse" />
              ) : (
                card.value
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Recent Clicks</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4">
                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            ))
          ) : stats.recentClicks.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <MousePointerClick className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No clicks yet. Create a Smart Link to get started!</p>
            </div>
          ) : (
            stats.recentClicks.map((click) => (
              <div key={click.id} className="p-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="font-medium text-gray-900">
                    {(click as any).links?.title || 'Unknown Link'}
                  </span>
                  <span className="text-gray-400">
                    {click.city && click.country ? `${click.city}, ${click.country}` : click.country || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-gray-400">
                  <span>{click.device_type || 'desktop'}</span>
                  <span>{click.browser_name}</span>
                  <span>{new Date(click.clicked_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
