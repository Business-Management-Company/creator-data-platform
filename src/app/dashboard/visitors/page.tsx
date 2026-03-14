'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Users, UserCheck, UserX, TrendingUp, Globe, Monitor,
  ChevronRight, X, ExternalLink, Linkedin, Mail, Shield,
  Building2, Briefcase, Calendar, Clock, ArrowRight
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';

interface Visitor {
  id: string;
  visitor_id: string;
  email: string | null;
  full_name: string | null;
  company: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  avatar_url: string | null;
  fingerprint_hashes: string[];
  ip_addresses: string[];
  confidence_score: number;
  total_clicks: number;
  total_page_views: number;
  inferred_location: string | null;
  device_types: string[];
  identified: boolean;
  identity_source: string | null;
  first_page_url: string | null;
  last_page_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  enrichment_attempts: number;
  enriched_at: string | null;
}

interface PageView {
  id: string;
  page_url: string;
  page_title: string | null;
  referrer_domain: string | null;
  device_type: string | null;
  browser: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
}

interface IdentityEvent {
  id: string;
  event_type: string;
  confidence_score: number;
  identity_source: string;
  data_after: any;
  created_at: string;
}

type FilterMode = 'all' | 'identified' | 'anonymous';

export default function VisitorsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [dateRange, setDateRange] = useState(30);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [timeline, setTimeline] = useState<PageView[]>([]);
  const [identityHistory, setIdentityHistory] = useState<IdentityEvent[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, identified: 0, anonymous: 0, matchRate: 0 });
  const supabase = createClient();

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    let query = supabase
      .from('visitors')
      .select('*')
      .eq('user_id', user.id)
      .gte('last_seen_at', startDate.toISOString())
      .order('last_seen_at', { ascending: false })
      .limit(100);

    if (filter === 'identified') query = query.eq('identified', true);
    else if (filter === 'anonymous') query = query.or('identified.is.null,identified.eq.false');

    const { data } = await query;
    setVisitors(data || []);

    // Stats (always unfiltered for the period)
    const { count: totalCount } = await supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('last_seen_at', startDate.toISOString());

    const { count: identifiedCount } = await supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('identified', true)
      .gte('last_seen_at', startDate.toISOString());

    const total = totalCount || 0;
    const identified = identifiedCount || 0;
    setStats({
      total,
      identified,
      anonymous: total - identified,
      matchRate: total > 0 ? Math.round((identified / total) * 100) : 0,
    });

    setLoading(false);
  }, [filter, dateRange]);

  useEffect(() => { loadVisitors(); }, [loadVisitors]);

  async function openPanel(visitor: Visitor) {
    setSelectedVisitor(visitor);
    setPanelLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [viewsResult, eventsResult] = await Promise.all([
      supabase
        .from('page_view_events')
        .select('id, page_url, page_title, referrer_domain, device_type, browser, country, city, created_at')
        .eq('creator_id', user.id)
        .eq('visitor_id', visitor.visitor_id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('identity_events')
        .select('id, event_type, confidence_score, identity_source, data_after, created_at')
        .eq('creator_id', user.id)
        .eq('visitor_id', visitor.visitor_id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setTimeline(viewsResult.data || []);
    setIdentityHistory(eventsResult.data || []);
    setPanelLoading(false);
  }

  function getInitials(name: string | null) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function getConfidenceBadge(visitor: Visitor) {
    if (visitor.identity_source === 'email_pdl') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700"><Shield className="w-3 h-3" />Verified</span>;
    if (visitor.identity_source === 'rb2b') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"><Linkedin className="w-3 h-3" />LinkedIn</span>;
    if (visitor.identity_source === 'pdl_ip_person') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700"><UserCheck className="w-3 h-3" />Likely</span>;
    if (visitor.identity_source === 'pdl_ip_company') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700"><Building2 className="w-3 h-3" />Company</span>;
    if (visitor.identity_source === 'email') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700"><Mail className="w-3 h-3" />Email</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Anonymous</span>;
  }

  function getSourceLabel(source: string | null) {
    const labels: Record<string, string> = {
      email_pdl: 'Email + PDL',
      rb2b: 'RB2B / LinkedIn',
      pdl_ip_person: 'PDL IP → Person',
      pdl_ip_company: 'PDL IP → Company',
      email: 'Email Capture',
      manual: 'Manual',
    };
    return source ? labels[source] || source : 'None';
  }

  function extractPath(url: string | null) {
    if (!url) return '-';
    try { return new URL(url).pathname + (new URL(url).search || ''); } catch { return url; }
  }

  const statCards = [
    { label: 'Total Visitors', value: stats.total, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Identified', value: stats.identified, icon: UserCheck, color: 'bg-green-50 text-green-600' },
    { label: 'Anonymous', value: stats.anonymous, icon: UserX, color: 'bg-gray-50 text-gray-600' },
    { label: 'Match Rate', value: `${stats.matchRate}%`, icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Visitors</h1>
        <p className="text-gray-500 mt-1">See who's visiting your website — identified by 3-layer resolution.</p>
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
              {loading ? <div className="h-9 w-16 bg-gray-100 rounded animate-pulse" /> : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Date Range */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {(['all', 'identified', 'anonymous'] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                filter === f ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                dateRange === d ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Visitors Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="col-span-3">Visitor</div>
          <div className="col-span-2">Location</div>
          <div className="col-span-1">Pages</div>
          <div className="col-span-2">Last Seen</div>
          <div className="col-span-1">Device</div>
          <div className="col-span-2">Source</div>
          <div className="col-span-1">Status</div>
        </div>

        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 animate-pulse">
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full" />
                <div className="h-4 w-28 bg-gray-100 rounded" />
              </div>
              <div className="col-span-2"><div className="h-4 w-20 bg-gray-100 rounded" /></div>
              <div className="col-span-1"><div className="h-4 w-8 bg-gray-100 rounded" /></div>
              <div className="col-span-2"><div className="h-4 w-16 bg-gray-100 rounded" /></div>
              <div className="col-span-1"><div className="h-4 w-14 bg-gray-100 rounded" /></div>
              <div className="col-span-2"><div className="h-4 w-16 bg-gray-100 rounded" /></div>
              <div className="col-span-1"><div className="h-4 w-16 bg-gray-100 rounded" /></div>
            </div>
          ))
        ) : visitors.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No visitors yet</p>
            <p className="text-sm mt-1">Install the pixel on your website to start identifying visitors.</p>
          </div>
        ) : (
          visitors.map((visitor) => (
            <button
              key={visitor.id}
              onClick={() => openPanel(visitor)}
              className="w-full grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left items-center"
            >
              <div className="col-span-3 flex items-center gap-3 min-w-0">
                {visitor.avatar_url ? (
                  <img src={visitor.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    visitor.identified ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {getInitials(visitor.full_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {visitor.full_name || visitor.company || 'Anonymous Visitor'}
                  </p>
                  {visitor.company && visitor.full_name && (
                    <p className="text-xs text-gray-400 truncate">{visitor.job_title ? `${visitor.job_title} at ` : ''}{visitor.company}</p>
                  )}
                </div>
              </div>
              <div className="col-span-2 text-sm text-gray-600 truncate">{visitor.inferred_location || '-'}</div>
              <div className="col-span-1 text-sm text-gray-600">{(visitor.total_page_views || 0) + (visitor.total_clicks || 0)}</div>
              <div className="col-span-2 text-sm text-gray-500">{timeAgo(visitor.last_seen_at)}</div>
              <div className="col-span-1 text-sm text-gray-500 capitalize">{visitor.device_types?.[0] || '-'}</div>
              <div className="col-span-2">{getConfidenceBadge(visitor)}</div>
              <div className="col-span-1 flex items-center justify-end">
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </button>
          ))
        )}
      </div>

      {/* ===== SLIDE-OUT PANEL ===== */}
      {selectedVisitor && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedVisitor(null)} />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200 animate-slide-in">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-start justify-between z-10">
              <div className="flex items-center gap-4">
                {selectedVisitor.avatar_url ? (
                  <img src={selectedVisitor.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${
                    selectedVisitor.identified ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {getInitials(selectedVisitor.full_name)}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {selectedVisitor.full_name || 'Anonymous Visitor'}
                  </h2>
                  {selectedVisitor.job_title && selectedVisitor.company && (
                    <p className="text-sm text-gray-500">{selectedVisitor.job_title} at {selectedVisitor.company}</p>
                  )}
                  {!selectedVisitor.job_title && selectedVisitor.company && (
                    <p className="text-sm text-gray-500">{selectedVisitor.company}</p>
                  )}
                  <div className="mt-1">{getConfidenceBadge(selectedVisitor)}</div>
                </div>
              </div>
              <button onClick={() => setSelectedVisitor(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Identity Card */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {selectedVisitor.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700">{selectedVisitor.email}</span>
                  </div>
                )}
                {selectedVisitor.company && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700">{selectedVisitor.company}</span>
                  </div>
                )}
                {selectedVisitor.job_title && (
                  <div className="flex items-center gap-3 text-sm">
                    <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700">{selectedVisitor.job_title}</span>
                  </div>
                )}
                {selectedVisitor.linkedin_url && (
                  <a href={selectedVisitor.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 hover:underline">
                    <Linkedin className="w-4 h-4 flex-shrink-0" />
                    <span>LinkedIn Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {selectedVisitor.inferred_location && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700">{selectedVisitor.inferred_location}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Monitor className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700 capitalize">{selectedVisitor.device_types?.join(', ') || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500">First seen {new Date(selectedVisitor.first_seen_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedVisitor.total_page_views || 0}</p>
                  <p className="text-xs text-gray-500">Page Views</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedVisitor.total_clicks || 0}</p>
                  <p className="text-xs text-gray-500">Clicks</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedVisitor.confidence_score || 0}</p>
                  <p className="text-xs text-gray-500">Confidence</p>
                </div>
              </div>

              {/* Enrichment Sources */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Enrichment Source</h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Source</span>
                    <span className="font-medium text-gray-900">{getSourceLabel(selectedVisitor.identity_source)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Confidence</span>
                    <span className="font-medium text-gray-900">{selectedVisitor.confidence_score || 0}/100</span>
                  </div>
                  {selectedVisitor.enriched_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Enriched</span>
                      <span className="text-gray-700">{new Date(selectedVisitor.enriched_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Attempts</span>
                    <span className="text-gray-700">{selectedVisitor.enrichment_attempts || 0}</span>
                  </div>
                </div>
              </div>

              {/* Identity History */}
              {identityHistory.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Identity Resolution Log</h3>
                  <div className="space-y-2">
                    {identityHistory.map((evt) => (
                      <div key={evt.id} className="flex items-start gap-3 text-sm bg-gray-50 rounded-lg p-3">
                        <ArrowRight className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{evt.event_type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(evt.created_at).toLocaleString()} — confidence {evt.confidence_score}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visit Timeline */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Activity Timeline
                </h3>
                {panelLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-gray-400">No page views recorded.</p>
                ) : (
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {timeline.map((pv) => (
                      <div key={pv.id} className="flex items-center gap-3 text-sm py-2 px-3 rounded-lg hover:bg-gray-50">
                        <div className="flex-shrink-0 w-16 text-xs text-gray-400">
                          {new Date(pv.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex-shrink-0 w-14 text-xs text-gray-400">
                          {new Date(pv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex-1 truncate text-gray-700" title={pv.page_url || ''}>
                          {pv.page_title || extractPath(pv.page_url)}
                        </div>
                        {pv.referrer_domain && (
                          <span className="text-xs text-gray-400 flex-shrink-0">via {pv.referrer_domain}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Slide-in animation */}
      <style jsx>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
