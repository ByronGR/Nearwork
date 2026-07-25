const fallbackRoles = {
  "customer-support": {
    "role": "Customer Support Specialist",
    "dept": "CX",
    "junior": 4200000,
    "mid": 6200000,
    "senior": 8200000,
    "us": 64000
  },
  "sales-development": {
    "role": "Sales Development Rep",
    "dept": "Sales",
    "junior": 4500000,
    "mid": 7000000,
    "senior": 9300000,
    "us": 72000
  },
  "frontend-developer": {
    "role": "Frontend Developer",
    "dept": "Technology",
    "junior": 6500000,
    "mid": 10500000,
    "senior": 15500000,
    "us": 125000
  },
  "operations-coordinator": {
    "role": "Operations Coordinator",
    "dept": "Operations",
    "junior": 4300000,
    "mid": 6800000,
    "senior": 9000000,
    "us": 76000
  },
  "finance-analyst": {
    "role": "Finance Analyst",
    "dept": "Finance",
    "junior": 5200000,
    "mid": 7900000,
    "senior": 11500000,
    "us": 90000
  },
  "marketing-specialist": {
    "role": "Marketing Specialist",
    "dept": "Marketing",
    "junior": 4800000,
    "mid": 7600000,
    "senior": 10800000,
    "us": 85000
  }
};

function numberFrom(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  return Number(String(value).replace(/[^0-9.]/g, '')) || 0;
}

function normalizeRecords(records) {
  const roles = {};
  for (const record of records || []) {
    const f = record.fields || {};
    const role = f.Role || f.role || f.Name || f.name || f['Role Name'];
    if (!role) continue;
    const key = String(role).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    roles[key] = {
      role: String(role),
      dept: f.Department || f.department || f.Industry || 'General',
      junior: numberFrom(f.Junior || f.junior || f['Junior COP'] || f['Junior Salary']),
      mid: numberFrom(f.Mid || f.mid || f['Mid COP'] || f['Mid Salary'] || f.Salary),
      senior: numberFrom(f.Senior || f.senior || f['Senior COP'] || f['Senior Salary']),
      us: numberFrom(f['US Salary'] || f['US Benchmark'] || f.us || f.US) || 80000
    };
    if (!roles[key].junior) roles[key].junior = Math.round(roles[key].mid * 0.75) || 4500000;
    if (!roles[key].mid) roles[key].mid = Math.round((roles[key].junior + roles[key].senior) / 2) || 7000000;
    if (!roles[key].senior) roles[key].senior = Math.round(roles[key].mid * 1.35);
  }
  return Object.keys(roles).length ? roles : fallbackRoles;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  const key = process.env.AIRTABLE_KEY;
  const base = process.env.AIRTABLE_BASE;
  const table = process.env.AIRTABLE_SALARY_TABLE || 'Roles';
  if (!key || !base) return res.status(200).json({ source: 'fallback', roles: fallbackRoles });
  try {
    const url = 'https://api.airtable.com/v0/' + encodeURIComponent(base) + '/' + encodeURIComponent(table) + '?pageSize=100';
    const airtableRes = await fetch(url, { headers: { Authorization: 'Bearer ' + key } });
    if (!airtableRes.ok) throw new Error('Airtable returned ' + airtableRes.status);
    const data = await airtableRes.json();
    return res.status(200).json({ source: 'airtable', roles: normalizeRecords(data.records) });
  } catch (error) {
    return res.status(200).json({ source: 'fallback', warning: error.message, roles: fallbackRoles });
  }
};
