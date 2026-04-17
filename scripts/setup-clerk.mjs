/**
 * Set up Clerk organization and configure the owner user.
 * 
 * Clerk free tier provides: org:admin + org:member roles.
 * Our app maps granular roles (owner/manager/optician/sa/read_only) via user publicMetadata.
 * Permissions are enforced in app code based on the role.
 * 
 * Run: node --env-file=.env.local scripts/setup-clerk.mjs
 */

const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET) { console.error('Missing CLERK_SECRET_KEY'); process.exit(1); }

const API = 'https://api.clerk.com/v1';
const headers = { Authorization: `Bearer ${CLERK_SECRET}`, 'Content-Type': 'application/json' };

async function clerkGet(path) { return fetch(`${API}${path}`, { headers }).then(r => r.json()); }
async function clerkPost(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  return { ok: res.ok, data: text ? JSON.parse(text) : {} };
}
async function clerkPatch(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
  const text = await res.text();
  return { ok: res.ok, data: text ? JSON.parse(text) : {} };
}

console.log('\n🏢 Setting up Clerk...\n');

// 1. Create or find organization
const existingOrgs = await clerkGet('/organizations?limit=10');
let org = (existingOrgs.data || []).find(o => o.name === 'Lunettiq');

if (!org) {
  const { ok, data } = await clerkPost('/organizations', { name: 'Lunettiq' });
  if (ok) { org = data; console.log('  ✅ Created organization: Lunettiq'); }
  else { console.error('  ❌', JSON.stringify(data).slice(0, 200)); process.exit(1); }
} else {
  console.log(`  ⏭  Organization exists: ${org.name}`);
}
console.log(`  ID: ${org.id}\n`);

// 2. Find the first user and set them up as owner
const users = await clerkGet('/users?limit=5&order_by=-created_at');
const user = (users.data || users || [])[0];

if (!user) { console.log('  ⚠️  No users found. Sign up at /crm first, then re-run.'); process.exit(0); }

const email = user.email_addresses?.[0]?.email_address || user.id;
console.log(`👤 Configuring user: ${email}\n`);

// 3. Add user to organization as admin
const { ok: memberOk } = await clerkPost(`/organizations/${org.id}/memberships`, {
  user_id: user.id,
  role: 'org:admin',
});
console.log(`  ${memberOk ? '✅ Added to org as admin' : '⏭  Already a member'}`);

// 4. Set role + location metadata on user
const { ok: metaOk } = await clerkPatch(`/users/${user.id}`, {
  public_metadata: {
    role: 'owner',
    location_ids: ['plateau', 'dix30'],
    primary_location_id: 'plateau',
    can_view_all_locations: true,
    org_id: org.id,
  },
});
console.log(`  ${metaOk ? '✅ Set metadata: role=owner, locations=[plateau, dix30]' : '❌ Failed to set metadata'}`);

console.log(`
✅ Clerk setup complete!

Organization: ${org.name} (${org.id})
Owner: ${email}

Role system:
  Clerk provides org:admin and org:member.
  Granular roles (owner/manager/optician/sa/read_only) are in user.publicMetadata.role
  Permissions are enforced in app code via src/lib/crm/permissions.ts
  Location scoping via user.publicMetadata.location_ids
`);
