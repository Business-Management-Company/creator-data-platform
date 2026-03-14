import { createAdminSupabase } from '@/lib/supabase/server';

const PDL_API_KEY = process.env.PEOPLE_DATA_LABS_API_KEY || '';
const PDL_BASE = 'https://api.peopledatalabs.com/v5';

// ============================================
// CONFIDENCE HIERARCHY (never overwrite higher)
// ============================================
export const CONFIDENCE = {
  email_pdl: 95,
  rb2b: 90,
  pdl_ip_person: 75,
  pdl_ip_company: 60,
  email: 50,
  anonymous: 0,
} as const;

export type IdentitySource = keyof typeof CONFIDENCE;

export function shouldOverwrite(
  currentSource: string | null,
  currentScore: number,
  newSource: IdentitySource
): boolean {
  const newScore = CONFIDENCE[newSource];
  if (!currentSource) return true;
  return newScore > currentScore;
}

// ============================================
// LAYER 2a: IP → Company Enrichment
// ============================================
export interface IPEnrichmentResult {
  company_name: string | null;
  company_domain: string | null;
  industry: string | null;
  employee_count: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  confidence: number;
  raw: any;
}

export async function enrichIP(ipAddress: string): Promise<IPEnrichmentResult | null> {
  if (!PDL_API_KEY || !ipAddress || ipAddress === '0.0.0.0' || ipAddress === '127.0.0.1') return null;

  const supabase = createAdminSupabase();

  // Check cache first
  const { data: cached } = await supabase
    .from('ip_enrichments')
    .select('*')
    .eq('ip_address', ipAddress)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (cached) {
    return {
      company_name: cached.company_name,
      company_domain: cached.company_domain,
      industry: cached.industry,
      employee_count: cached.employee_count,
      city: cached.city,
      state: cached.state,
      country: cached.country,
      confidence: cached.confidence,
      raw: cached.raw_pdl_response,
    };
  }

  try {
    const res = await fetch(`${PDL_BASE}/ip/enrich?ip=${encodeURIComponent(ipAddress)}&pretty=true`, {
      method: 'GET',
      headers: {
        'X-Api-Key': PDL_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      // 404 = not found, cache it to avoid re-calling
      if (res.status === 404) {
        await supabase.from('ip_enrichments').upsert({
          ip_address: ipAddress,
          confidence: 0,
          raw_pdl_response: { status: 404 },
          enriched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'ip_address' });
      }
      return null;
    }

    const data = await res.json();
    const company = data.data?.company || data.company || data;

    const result: IPEnrichmentResult = {
      company_name: company.display_name || company.name || null,
      company_domain: company.website || company.domain || null,
      industry: company.industry || null,
      employee_count: company.size || company.employee_count?.toString() || null,
      city: company.location?.locality || null,
      state: company.location?.region || null,
      country: company.location?.country || null,
      confidence: data.likelihood || 0.6,
      raw: data,
    };

    // Cache result
    await supabase.from('ip_enrichments').upsert({
      ip_address: ipAddress,
      company_name: result.company_name,
      company_domain: result.company_domain,
      industry: result.industry,
      employee_count: result.employee_count,
      city: result.city,
      state: result.state,
      country: result.country,
      confidence: result.confidence,
      raw_pdl_response: data,
      enriched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'ip_address' });

    return result;
  } catch (error) {
    console.error('PDL IP enrichment error:', error);
    return null;
  }
}

// ============================================
// LAYER 2b: Person Search (by company + city)
// ============================================
export interface PersonSearchResult {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  email: string | null;
  confidence: number;
  raw: any;
}

export async function searchPersonByCompany(
  companyName: string,
  city?: string | null
): Promise<PersonSearchResult | null> {
  if (!PDL_API_KEY || !companyName) return null;

  try {
    const query: any = {
      query: {
        bool: {
          must: [
            { term: { job_company_name: companyName } },
          ],
        },
      },
      size: 1,
    };

    if (city) {
      query.query.bool.must.push({ term: { location_locality: city } });
    }

    const res = await fetch(`${PDL_BASE}/person/search`, {
      method: 'POST',
      headers: {
        'X-Api-Key': PDL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const person = data.data?.[0];
    if (!person) return null;

    const confidence = person.match_score || data.likelihood || 0.5;
    if (confidence < 0.7) return null; // Only use high-confidence matches

    return {
      full_name: person.full_name || null,
      first_name: person.first_name || null,
      last_name: person.last_name || null,
      job_title: person.job_title || null,
      linkedin_url: person.linkedin_url || null,
      email: person.work_email || person.personal_emails?.[0] || null,
      confidence,
      raw: person,
    };
  } catch (error) {
    console.error('PDL person search error:', error);
    return null;
  }
}

// ============================================
// LAYER 3: Email → Person Enrichment
// ============================================
export interface PersonEnrichResult {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  twitter_handle: string | null;
  location_city: string | null;
  location_country: string | null;
  confidence: number;
  raw: any;
}

export async function enrichByEmail(email: string): Promise<PersonEnrichResult | null> {
  if (!PDL_API_KEY || !email) return null;

  const supabase = createAdminSupabase();

  // Check cache first
  const { data: cached } = await supabase
    .from('person_enrichments')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (cached) {
    return {
      full_name: cached.full_name,
      first_name: cached.first_name,
      last_name: cached.last_name,
      company: cached.company,
      job_title: cached.job_title,
      linkedin_url: cached.linkedin_url,
      twitter_handle: cached.twitter_handle,
      location_city: cached.location_city,
      location_country: cached.location_country,
      confidence: cached.confidence,
      raw: cached.raw_pdl_response,
    };
  }

  try {
    const res = await fetch(`${PDL_BASE}/person/enrich?email=${encodeURIComponent(email)}&pretty=true`, {
      method: 'GET',
      headers: {
        'X-Api-Key': PDL_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      // Cache the miss
      if (res.status === 404) {
        await supabase.from('person_enrichments').upsert({
          email: email.toLowerCase(),
          confidence: 0,
          raw_pdl_response: { status: 404 },
          enriched_at: new Date().toISOString(),
        }, { onConflict: 'email' });
      }
      return null;
    }

    const data = await res.json();
    const person = data.data || data;

    const result: PersonEnrichResult = {
      full_name: person.full_name || null,
      first_name: person.first_name || null,
      last_name: person.last_name || null,
      company: person.job_company_name || null,
      job_title: person.job_title || null,
      linkedin_url: person.linkedin_url || null,
      twitter_handle: person.twitter_url || null,
      location_city: person.location_locality || null,
      location_country: person.location_country || null,
      confidence: data.likelihood || 0.9,
      raw: data,
    };

    // Cache result
    await supabase.from('person_enrichments').upsert({
      email: email.toLowerCase(),
      full_name: result.full_name,
      first_name: result.first_name,
      last_name: result.last_name,
      company: result.company,
      job_title: result.job_title,
      linkedin_url: result.linkedin_url,
      twitter_handle: result.twitter_handle,
      location_city: result.location_city,
      location_country: result.location_country,
      confidence: result.confidence,
      raw_pdl_response: data,
      enriched_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    return result;
  } catch (error) {
    console.error('PDL email enrichment error:', error);
    return null;
  }
}

// ============================================
// AUDIT LOG HELPER
// ============================================
export async function logIdentityEvent(
  creatorId: string,
  visitorId: string,
  eventType: string,
  confidenceScore: number,
  identitySource: string,
  dataBefore: any,
  dataAfter: any
) {
  try {
    const supabase = createAdminSupabase();
    await supabase.from('identity_events').insert({
      creator_id: creatorId,
      visitor_id: visitorId,
      event_type: eventType,
      confidence_score: confidenceScore,
      identity_source: identitySource,
      data_before: dataBefore,
      data_after: dataAfter,
    });
  } catch (error) {
    console.error('Failed to log identity event:', error);
  }
}
