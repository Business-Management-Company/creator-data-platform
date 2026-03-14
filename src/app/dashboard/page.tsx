'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Link2, MousePointerClick, Users, TrendingUp, Globe, Monitor, UserCheck, Linkedin, Mail } from 'lucide-react';
import { formatNumber, timeAgo } from '@/lib/utils';
import Link from 'next/link';

interface Stats {
  totalLinks: number;
  totalClicks: number;
  totalVisitors: number;
  matchRate: number;
  recentClicks: any[];
  recentVisitors: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalLinks: 0, totalClicks: 0, totalVisitors: 0, matchRate: 0,
    recentClicks: [], recentVisitors: [],
  });
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

      // Get visitor counts
      const { count: visitorCount } = await supabase
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: identifiedCount } = await supabase
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('identified', true);

      const total = visitorCount || 0;
      const identified = identifiedCount || 0;
      const matchRate = total > 0 ? Math.round((identified / total) * 100) : 0;

      // Get recent clicks
      const { data: recentClicks } = await supabase
        .from('click_events')
        .select('*, links(title, short_code)')
        .eq('user_id', user.id)
        .order('clicked_at', { ascending: false })
        .limit(10);

      // Get recent visitors
      const { data: recentVisitors } = await supabase
        .from('visitors')
        .select('id, visitor_id, full_name, company, email, avatar_url, inferred_location, device_types, identified, identity_source, last_seen_at')
        .eq('user_id', user.id)
        .order('last_seen_at', { ascending: false })
        .limit(5);

      setStats({
        totalLinks: links?.length || 0,
        totalClicks,
        totalVisitors: total,
        matchRate,
        recentClicks: recentClicks || [],
        recentVisitors: recentVisitors || [],
      });
      setLoading(false);
    }

    loadStats();
  }, []);

  const statCards = [
    { label: 'Smart Links', value: formatNumber(stats.totalLinks), icon: Link2, color: 'bg-blue-50 text-blue-600' },
    { label: 'Total Clicks', value: formatNumber(stats.totalClicks), icon: MousePointerClick, color: 'bg-green-50 text-green-600' },
    { label: 'Unique Visitors', value: formatNumber(stats.totalVisitors), icon: Users, color: 'bg-purple-50 text-purple-600' },
    { label: 'Match Rate', value: `${stats.matchRate}%`, icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent Visitors */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Visitors</h2>
            <Link href="/dashboard/visitors" className="text-sm text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-28 bg-gray-100 rounded animate-pulse mb-1" />
                    <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              ))
            ) : stats.recentVisitors.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No visitors yet. Install the pixel to get started.</p>
                <Link href="/dashboard/pixel" className="text-sm text-brand-600 hover:underline mt-1 inline-block">
                  Set up pixel
                </Link>
              </div>
            ) : (
              stats.recentVisitors.map((visitor: any) => (
                <div key={visitor.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {visitor.avatar_url ? (
                      <img src={visitor.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        visitor.identified ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {visitor.full_name ? visitor.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {visitor.full_name || visitor.company || 'Anonymous'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {visitor.inferred_location && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {visitor.inferred_location}
                          </span>
                        )}
                        {visitor.device_types?.[0] && (
                          <span className="flex items-center gap-1 capitalize">
                            <Monitor className="w-3 h-3" />
                            {visitor.device_types[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {visitor.identified ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        {visitor.identity_source === 'rb2b' && <Linkedin className="w-3 h-3 text-blue-600" />}
                        {visitor.identity_source === 'email' && <Mail className="w-3 h-3 text-green-600" />}
                        <UserCheck className="w-3.5 h-3.5 text-green-500" />
                      </span>
                    ) : (
                      <span className="w-2 h-2 bg-gray-300 rounded-full" />
                    )}
                    <span className="text-xs text-gray-400">{timeAgo(visitor.last_seen_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Clicks */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Clicks</h2>
            <Link href="/dashboard/analytics" className="text-sm text-brand-600 hover:text-brand-700">
              View analytics
            </Link>
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
    </div>
  );
}
