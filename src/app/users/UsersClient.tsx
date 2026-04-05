'use client'

import { useState, useEffect } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createEmployee,
  toggleUserActive,
  updateEmployee,
  createBoutique,
  resetPassword,
  toggleBoutiqueActive,
} from './actions'
import PageLayout from '@/components/PageLayout'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  ink: '#0F172A', slate: '#374151', muted: '#64748B',
  border: '#E2E8F0', bg: '#F8FAFC', surface: '#FFFFFF',
  navy: '#1B3A6B', blue: '#2563EB', blueL: '#EFF6FF',
  green: '#059669', greenL: '#ECFDF5',
  orange: '#D97706', orangeL: '#FFFBEB',
  red: '#DC2626', redL: '#FEF2F2',
  gold: '#B45309', goldL: '#FFFBEB',
  purple: '#7C3AED', purpleL: '#F5F3FF',
}
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

const ROLE_CONFIG = {
  owner:     { label: 'Propriétaire',   bg: C.purpleL, color: C.purple, accent: C.purple },
  admin:     { label: 'Administrateur', bg: C.blueL,   color: C.blue,   accent: C.blue },
  vendor:    { label: 'Vendeur',        bg: C.greenL,  color: C.green,  accent: C.green },
  warehouse: { label: 'Entrepôt',       bg: C.orangeL, color: C.orange, accent: C.orange },
}
const ROLE_OPTIONS: ['vendor' | 'warehouse' | 'admin', string][] = [
  ['vendor',    'Vendeur'],
  ['warehouse', 'Entrepôt'],
  ['admin',     'Administrateur'],
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink,
  outline: 'none', boxSizing: 'border-box',
  background: C.surface, fontFamily: FONT,
}

// ── SVG icons ──────────────────────────────────────────────────────────────────
function IconPencil() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  )
}
function IconKey() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7.5 7.5l4 4M9.5 7.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconClose() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}
function IconStore() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 6.5L3 2h10l1.5 4.5c0 1-.67 1.5-1.5 1.5S11.5 7.5 11 6.5c-.5 1-1 1.5-3 1.5s-2.5-.5-3-1.5C4.5 7.5 4 8 3 8S1.5 7.5 1.5 6.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M2 8v5.5h5v-3h2v3h5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function UsersClient({
  profile, employees, boutiques, currentUserId, badgeCounts,
}: {
  profile:       any
  employees:     any[]
  boutiques:     any[]
  currentUserId: string
  badgeCounts?:  BadgeCounts
}) {
  const router   = useRouter()
  const supabase = createClient()

  // Create form
  const [showCreate,    setShowCreate]    = useState(false)
  const [newEmail,      setNewEmail]      = useState('')
  const [newName,       setNewName]       = useState('')
  const [newRole,       setNewRole]       = useState<'vendor' | 'warehouse' | 'admin'>('vendor')
  const [newBoutique,   setNewBoutique]   = useState('')
  const [newPassword,   setNewPassword]   = useState('')
  const [newShowPwd,    setNewShowPwd]    = useState(false)
  const [creating,      setCreating]      = useState(false)
  const [createError,   setCreateError]   = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Edit modal
  const [editUser,        setEditUser]        = useState<any>(null)
  const [editName,        setEditName]        = useState('')
  const [editRole,        setEditRole]        = useState<'vendor' | 'warehouse' | 'admin'>('vendor')
  const [editBoutique,    setEditBoutique]    = useState('')
  const [editLoading,     setEditLoading]     = useState(false)
  const [editError,       setEditError]       = useState<string | null>(null)
  // Password section inside edit modal
  const [editPwdOpen,    setEditPwdOpen]    = useState(false)
  const [editPwd,        setEditPwd]        = useState('')
  const [editShowPwd,    setEditShowPwd]    = useState(false)
  const [editPwdLoading, setEditPwdLoading] = useState(false)
  const [editPwdError,   setEditPwdError]   = useState<string | null>(null)
  const [editPwdSuccess, setEditPwdSuccess] = useState(false)

  // Toggle
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Boutique management
  const [showBoutiques,      setShowBoutiques]      = useState(false)
  const [newBoutiqueName,    setNewBoutiqueName]    = useState('')
  const [newBoutiqueAddress, setNewBoutiqueAddress] = useState('')
  const [boutiqueLoading,    setBoutiqueLoading]    = useState(false)
  const [boutiqueError,      setBoutiqueError]      = useState<string | null>(null)
  const [boutiqueSuccess,    setBoutiqueSuccess]    = useState<string | null>(null)
  const [togglingBoutique,   setTogglingBoutique]   = useState<string | null>(null)

  // Filters
  const [search,       setSearch]       = useState('')
  const [filterRole,   setFilterRole]   = useState('all')
  const [filterActive, setFilterActive] = useState('active')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Create boutique ──────────────────────────────────────────────────────────
  const handleCreateBoutique = async () => {
    if (!newBoutiqueName.trim()) return
    setBoutiqueLoading(true); setBoutiqueError(null)
    const result = await createBoutique({
      name:    newBoutiqueName,
      address: newBoutiqueAddress,
    })
    setBoutiqueLoading(false)
    if (result.error) { setBoutiqueError(result.error); return }
    setBoutiqueSuccess('Boutique créée.')
    setNewBoutiqueName(''); setNewBoutiqueAddress('')
    setTimeout(() => { setBoutiqueSuccess(null); router.refresh() }, 1500)
  }

  // ── Create employee ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newEmail || !newName || !newPassword) return
    if (newPassword.length < 8) { setCreateError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    setCreating(true); setCreateError(null)
    const result = await createEmployee({
      email:      newEmail.trim().toLowerCase(),
      fullName:   newName.trim(),
      role:       newRole,
      boutiqueId: newRole === 'vendor' ? (newBoutique || null) : null,
      password:   newPassword,
    })
    setCreating(false)
    if (result.error) { setCreateError(result.error); return }
    setCreateSuccess(`Compte créé pour ${newName}.`)
    setNewEmail(''); setNewName(''); setNewPassword(''); setNewBoutique(''); setNewRole('vendor')
    setTimeout(() => { setCreateSuccess(null); setShowCreate(false); router.refresh() }, 2000)
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  const handleToggle = async (userId: string, currentActive: boolean) => {
    setTogglingId(userId)
    await toggleUserActive(userId, !currentActive)
    setTogglingId(null)
    router.refresh()
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const openEdit = (emp: any) => {
    setEditUser(emp)
    setEditName(emp.full_name)
    setEditRole(emp.role)
    setEditBoutique(emp.boutiques?.id ?? '')
    setEditError(null)
    setEditPwdOpen(false)
    setEditPwd('')
    setEditShowPwd(false)
    setEditPwdError(null)
    setEditPwdSuccess(false)
  }

  const handleEdit = async () => {
    if (!editUser || !editName) return
    setEditLoading(true); setEditError(null)
    const result = await updateEmployee({
      userId:     editUser.id,
      fullName:   editName.trim(),
      role:       editRole,
      boutiqueId: editRole === 'vendor' ? (editBoutique || null) : null,
    })
    setEditLoading(false)
    if (result.error) { setEditError(result.error); return }
    setEditUser(null)
    router.refresh()
  }

  // ── Password change (inside edit modal) ──────────────────────────────────────
  const handleEditPassword = async () => {
    if (!editUser || editPwd.length < 8) return
    setEditPwdLoading(true); setEditPwdError(null)
    const result = await resetPassword(editUser.id, editPwd)
    setEditPwdLoading(false)
    if (result.error) { setEditPwdError(result.error); return }
    setEditPwdSuccess(true)
    setEditPwd('')
    setTimeout(() => setEditPwdSuccess(false), 3000)
  }

  // ── Boutique toggle ──────────────────────────────────────────────────────────
  const handleToggleBoutique = async (boutiqueId: string, currentActive: boolean) => {
    setTogglingBoutique(boutiqueId); setBoutiqueError(null)
    const result = await toggleBoutiqueActive(boutiqueId, !currentActive)
    setTogglingBoutique(null)
    if (result.error) { setBoutiqueError(result.error); return }
    router.refresh()
  }

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = employees.filter(emp => {
    if (filterRole !== 'all' && emp.role !== filterRole) return false
    if (filterActive === 'active'   && !emp.is_active) return false
    if (filterActive === 'inactive' && emp.is_active)  return false
    if (search) {
      const q = search.toLowerCase()
      if (!emp.full_name?.toLowerCase().includes(q) &&
          !emp.email?.toLowerCase().includes(q)) return false
    }
    return true
  })

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <PageLayout profile={profile} activeRoute="/users" onLogout={handleLogout} badgeCounts={badgeCounts}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.ink,
            margin: '0 0 4px', letterSpacing: '-0.03em', fontFamily: FONT }}>
            Utilisateurs
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: FONT }}>
            {employees.filter(e => e.is_active).length} compte
            {employees.filter(e => e.is_active).length !== 1 ? 's' : ''} actif
            {employees.filter(e => e.is_active).length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-ghost"
            onClick={() => { setShowBoutiques(true); setBoutiqueError(null); setBoutiqueSuccess(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 16px', background: C.surface,
              color: C.slate, border: `1.5px solid ${C.border}`, borderRadius: 9,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            }}>
            <IconStore />
            Boutiques ({boutiques.filter(b => b.is_active).length}/{boutiques.length})
          </button>
          <button
            className="btn-meram"
            onClick={() => { setShowCreate(true); setCreateError(null); setCreateSuccess(null) }}
            style={{ padding: '10px 20px', border: 'none', borderRadius: 9,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
              display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            Nouvel employé
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12, marginBottom: 24 }}>
        {(Object.entries(ROLE_CONFIG) as [string, any][]).map(([role, cfg]) => {
          const count = employees.filter(e => e.role === role && e.is_active).length
          return (
            <div key={role} style={{ background: C.surface, borderRadius: 10,
              border: `1px solid ${C.border}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              padding: '14px 18px', borderLeft: `3px solid ${cfg.accent}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.slate,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                marginBottom: 6, fontFamily: FONT }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: cfg.color, fontFamily: FONT }}>
                {count}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap',
        background: C.surface, padding: '10px 14px', borderRadius: 10,
        border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou email…"
          style={{ ...inputStyle, flex: '1 1 200px', padding: '7px 10px', fontSize: 12 }}
        />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ ...inputStyle, width: 'auto', padding: '7px 10px', fontSize: 12 }}>
          <option value="all">Tous les rôles</option>
          {(Object.entries(ROLE_CONFIG) as [string, any][]).map(([r, cfg]) => (
            <option key={r} value={r}>{cfg.label}</option>
          ))}
        </select>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value)}
          style={{ ...inputStyle, width: 'auto', padding: '7px 10px', fontSize: 12 }}>
          <option value="all">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Désactivés</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center',
          fontSize: 12, color: C.muted, fontFamily: FONT }}>
          {filtered.length} / {employees.length}
        </div>
      </div>

      {/* ── Users table ── */}
      <div style={{ background: C.surface, borderRadius: 12,
        border: `1px solid ${C.border}`, overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center',
            color: C.muted, fontSize: 14, fontFamily: FONT }}>
            Aucun utilisateur correspond aux filtres.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {['Nom', 'Email', 'Rôle', 'Boutique', 'Créé le', 'Statut', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left',
                      fontSize: 12, fontWeight: 700, color: C.slate,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      fontFamily: FONT, borderBottom: `1.5px solid ${C.border}`,
                      whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp: any) => {
                  const roleCfg = ROLE_CONFIG[emp.role as keyof typeof ROLE_CONFIG]
                  const isMe    = emp.id === currentUserId
                  return (
                    <tr key={emp.id} style={{
                      borderBottom: `1px solid ${C.border}`,
                      opacity: emp.is_active ? 1 : 0.55,
                    }}>
                      <td style={{ padding: '13px 16px', fontFamily: FONT }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%',
                            background: roleCfg?.bg ?? C.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: roleCfg?.color ?? C.muted,
                            flexShrink: 0, letterSpacing: '0.03em',
                          }}>
                            {emp.full_name.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                              {emp.full_name}
                            </div>
                            {isMe && (
                              <div style={{ fontSize: 11, color: C.blue, fontWeight: 600, marginTop: 1 }}>
                                Votre compte
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 12, color: C.muted, fontFamily: FONT }}>
                        {emp.email}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 100,
                          background: roleCfg?.bg, color: roleCfg?.color, fontFamily: FONT }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%',
                            background: roleCfg?.accent, flexShrink: 0 }} />
                          {roleCfg?.label}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: C.ink, fontFamily: FONT }}>
                        {emp.boutiques?.name ?? <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 12, color: C.muted, fontFamily: FONT }}>
                        {new Date(emp.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 100,
                          background: emp.is_active ? C.greenL : C.redL,
                          color:      emp.is_active ? C.green  : C.red,
                          fontFamily: FONT }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%',
                            background: emp.is_active ? C.green : C.red, flexShrink: 0 }} />
                          {emp.is_active ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {(emp.role !== 'owner' || isMe) && (
                            <button
                              className="btn-outline-navy"
                              onClick={() => openEdit(emp)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                                background: 'transparent', color: C.blue,
                                border: `1px solid ${C.border}`,
                                fontSize: 12, fontWeight: 600, fontFamily: FONT }}>
                              <IconPencil /> Modifier
                            </button>
                          )}
                          {!isMe && emp.role !== 'owner' && (
                            <button
                              className={emp.is_active ? 'btn-ghost-danger' : 'btn-ghost'}
                              onClick={() => handleToggle(emp.id, emp.is_active)}
                              disabled={togglingId === emp.id}
                              style={{ padding: '5px 12px', borderRadius: 6, border: 'none',
                                background: emp.is_active ? C.redL : C.greenL,
                                color:      emp.is_active ? C.red  : C.green,
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                fontFamily: FONT,
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                opacity: togglingId === emp.id ? 0.6 : 1 }}>
                              {togglingId === emp.id ? <><span className="spinner-blue" />…</> : emp.is_active ? 'Désactiver' : 'Réactiver'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal
          title="Nouveau compte employé"
          subtitle="Le mot de passe sera transmis à l'employé lors de la remise d'accès."
          onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <FieldBlock label="Nom complet *">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="ex : Fatima Mbarga" style={inputStyle} />
            </FieldBlock>

            <FieldBlock label="Adresse email *">
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="ex : fatima@uca.cm" style={inputStyle} />
            </FieldBlock>

            <FieldBlock label="Mot de passe *">
              <div style={{ position: 'relative' }}>
                <input type={newShowPwd ? 'text' : 'password'} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  style={{ ...inputStyle, paddingRight: 40 }} />
                <button type="button" onClick={() => setNewShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)', background: 'none', border: 'none',
                    cursor: 'pointer', color: C.muted, display: 'flex', alignItems: 'center' }}>
                  <EyeIcon open={newShowPwd} />
                </button>
              </div>
            </FieldBlock>

            <FieldBlock label="Rôle *">
              <RoleSelector value={newRole} onChange={setNewRole} />
            </FieldBlock>

            {newRole === 'vendor' && (
              <FieldBlock label="Boutique assignée">
                <select value={newBoutique} onChange={e => setNewBoutique(e.target.value)}
                  style={inputStyle}>
                  <option value="">— Sélectionner —</option>
                  {boutiques.filter(b => b.is_active).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </FieldBlock>
            )}

            <Feedback error={createError} success={createSuccess} />

            <ModalFooter
              onConfirm={handleCreate}
              onCancel={() => setShowCreate(false)}
              loading={creating}
              disabled={!newEmail || !newName || !newPassword}
              confirmLabel="Créer le compte"
            />
          </div>
        </Modal>
      )}

      {/* ── Edit modal (includes password section) ── */}
      {editUser && (
        <Modal
          title={`Modifier le compte`}
          subtitle={editUser.email}
          onClose={() => setEditUser(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <FieldBlock label="Nom complet">
              <input value={editName} onChange={e => setEditName(e.target.value)}
                style={inputStyle} />
            </FieldBlock>

            {editUser?.role !== 'owner' && (
              <FieldBlock label="Rôle">
                <RoleSelector value={editRole} onChange={setEditRole} />
              </FieldBlock>
            )}

            {editRole === 'vendor' && editUser?.role !== 'owner' && (
              <FieldBlock label="Boutique assignée">
                <select value={editBoutique} onChange={e => setEditBoutique(e.target.value)}
                  style={inputStyle}>
                  <option value="">— Sélectionner —</option>
                  {boutiques.filter(b => b.is_active).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </FieldBlock>
            )}

            {editError && <Feedback error={editError} />}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-meram"
                onClick={handleEdit} disabled={editLoading}
                style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 9,
                  fontSize: 13, fontWeight: 700, cursor: editLoading ? 'not-allowed' : 'pointer',
                  fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: editLoading ? 0.7 : 1 }}>
                {editLoading ? <><span className="spinner" />Enregistrement…</> : 'Enregistrer les modifications'}
              </button>
            </div>

            {/* ── Password section (accordion) ── */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 2 }}>
              <button
                type="button"
                onClick={() => {
                  setEditPwdOpen(v => !v)
                  setEditPwd(''); setEditPwdError(null); setEditPwdSuccess(false)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '9px 12px', borderRadius: 8,
                  background: editPwdOpen ? C.blueL : C.bg,
                  border: `1px solid ${editPwdOpen ? '#BFDBFE' : C.border}`,
                  cursor: 'pointer', color: editPwdOpen ? C.blue : C.slate,
                  fontSize: 13, fontWeight: 600, fontFamily: FONT, textAlign: 'left' }}>
                <IconKey />
                Modifier le mot de passe
                <IconChevron open={editPwdOpen} />
              </button>

              {editPwdOpen && (
                <div style={{ marginTop: 12, animation: 'slideDown 0.18s ease' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type={editShowPwd ? 'text' : 'password'}
                        value={editPwd}
                        onChange={e => setEditPwd(e.target.value)}
                        placeholder="Nouveau mot de passe (min. 8 car.)"
                        autoFocus
                        style={{ ...inputStyle, paddingRight: 38 }}
                      />
                      <button type="button" onClick={() => setEditShowPwd(v => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%',
                          transform: 'translateY(-50%)', background: 'none', border: 'none',
                          cursor: 'pointer', color: C.muted, display: 'flex', alignItems: 'center' }}>
                        <EyeIcon open={editShowPwd} />
                      </button>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={handleEditPassword}
                      disabled={editPwdLoading || editPwd.length < 8}
                      style={{ padding: '10px 14px', borderRadius: 8,
                        background: (editPwdLoading || editPwd.length < 8) ? C.muted : C.blue,
                        color: '#fff', border: 'none', cursor: 'pointer',
                        fontSize: 12, fontWeight: 700, fontFamily: FONT,
                        whiteSpace: 'nowrap', flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 5 }}>
                      {editPwdLoading ? <><span className="spinner" />…</> : 'Appliquer'}
                    </button>
                  </div>
                  {editPwdError && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: C.redL,
                      borderRadius: 6, fontSize: 12, color: C.red, fontFamily: FONT }}>
                      {editPwdError}
                    </div>
                  )}
                  {editPwdSuccess && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: C.greenL,
                      borderRadius: 6, fontSize: 12, color: C.green, fontWeight: 600, fontFamily: FONT }}>
                      Mot de passe mis à jour.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </Modal>
      )}

      {/* ── Boutiques modal ── */}
      {showBoutiques && (
        <Modal
          title="Gestion des boutiques"
          subtitle={`${boutiques.filter(b => b.is_active).length} boutique${boutiques.filter(b => b.is_active).length !== 1 ? 's' : ''} active${boutiques.filter(b => b.is_active).length !== 1 ? 's' : ''}`}
          onClose={() => setShowBoutiques(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {boutiques.length === 0 ? (
              <p style={{ fontSize: 13, color: C.muted, fontFamily: FONT, margin: 0 }}>
                Aucune boutique enregistrée.
              </p>
            ) : (
              <div style={{ display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                {boutiques.map((b: any) => (
                  <div key={b.id} style={{
                    padding: '12px 14px', borderRadius: 8,
                    border: `1.5px solid ${b.is_active ? C.border : '#FECACA'}`,
                    background: b.is_active ? C.surface : '#FFF5F5',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: b.is_active ? C.green : C.red }} />
                      <span style={{ fontSize: 12, fontWeight: 700,
                        color: b.is_active ? C.ink : C.red, fontFamily: FONT,
                        flex: 1, minWidth: 0, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.name}
                      </span>
                    </div>
                    <button
                      className={b.is_active ? 'btn-ghost-danger' : 'btn-ghost'}
                      onClick={() => handleToggleBoutique(b.id, b.is_active)}
                      disabled={togglingBoutique === b.id}
                      style={{ padding: '5px 8px', borderRadius: 6, border: 'none',
                        fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                        background: b.is_active ? C.redL : C.greenL,
                        color:      b.is_active ? C.red  : C.green,
                        fontFamily: FONT, opacity: togglingBoutique === b.id ? 0.5 : 1 }}>
                      {togglingBoutique === b.id ? '…' : b.is_active ? 'Fermer' : 'Réouvrir'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <FieldBlock label="Ajouter une boutique">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={newBoutiqueName} onChange={e => setNewBoutiqueName(e.target.value)}
                    placeholder="Nom — ex : Boutique Biyem-Assi"
                    style={{ ...inputStyle }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={newBoutiqueAddress} onChange={e => setNewBoutiqueAddress(e.target.value)}
                      placeholder="Adresse — ex : Rue de l'Unité"
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateBoutique() }}
                      style={{ ...inputStyle, flex: 1 }} />
                    <button
                      className="btn-meram"
                      onClick={handleCreateBoutique}
                      disabled={boutiqueLoading || !newBoutiqueName.trim()}
                      style={{ padding: '10px 16px', borderRadius: 9, border: 'none',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        fontFamily: FONT, whiteSpace: 'nowrap', flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        opacity: (boutiqueLoading || !newBoutiqueName.trim()) ? 0.5 : 1 }}>
                      {boutiqueLoading ? <><span className="spinner" />…</> : 'Ajouter'}
                    </button>
                  </div>
                </div>
              </FieldBlock>
            </div>

            <Feedback error={boutiqueError} success={boutiqueSuccess} />
          </div>
        </Modal>
      )}

    </PageLayout>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  if (open) return (
    <svg width="16" height="16" viewBox="0 0 17 17" fill="none">
      <path d="M2 2l13 13M7.07 7.1A2 2 0 0 0 9.9 9.93M4.5 4.55C3.17 5.5 2.1 6.87 1.5 8.5c1.2 3.1 4.2 5 7 5 1.3 0 2.56-.4 3.62-1.08M7 3.07A8.1 8.1 0 0 1 8.5 3c2.8 0 5.8 1.9 7 5a9.2 9.2 0 0 1-1.96 3.02" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  return (
    <svg width="16" height="16" viewBox="0 0 17 17" fill="none">
      <ellipse cx="8.5" cy="8.5" rx="2.3" ry="2.3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1.5 8.5C2.7 5.4 5.7 3.5 8.5 3.5s5.8 1.9 7 5c-1.2 3.1-4.2 5-7 5s-5.8-1.9-7-5Z" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  )
}

function RoleSelector({ value, onChange }: {
  value:    'vendor' | 'warehouse' | 'admin'
  onChange: (v: 'vendor' | 'warehouse' | 'admin') => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {ROLE_OPTIONS.map(([r, l]) => (
        <button key={r} type="button" onClick={() => onChange(r)}
          style={{ flex: 1, padding: '9px 4px', borderRadius: 7,
            fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
            background: value === r ? C.blue    : C.surface,
            color:      value === r ? C.surface : C.slate,
            border: `1.5px solid ${value === r ? C.blue : C.border}`,
            fontFamily: FONT, transition: 'all 0.12s' }}>
          {l}
        </button>
      ))}
    </div>
  )
}

function Modal({ title, subtitle, children, onClose, maxWidth = 500 }: {
  title:     string
  subtitle?: string
  children:  React.ReactNode
  onClose:   () => void
  maxWidth?: number
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
        animation: 'modalBackdrop 0.2s ease',
      }}>
      <div style={{ background: '#FFFFFF', borderRadius: 16,
        width: '100%', maxWidth, maxHeight: '92vh',
        boxShadow: '0 32px 80px -16px rgba(0,0,0,0.28), 0 0 0 1px rgba(15,23,42,0.06)',
        animation: 'modalPanel 0.22s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg,#1D4ED8,#3B82F6,#60A5FA)', flexShrink: 0 }} />
        {/* Header */}
        <div style={{ padding: '20px 24px 16px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.ink,
              letterSpacing: '-0.02em', fontFamily: FONT }}>
              {title}
            </h3>
            {subtitle && (
              <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted, fontFamily: FONT }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            className="btn-icon"
            onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8,
            background: C.bg, border: `1px solid ${C.border}`,
            cursor: 'pointer', flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: C.muted, marginTop: -2 }}>
            <IconClose />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, fontFamily: FONT }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11.5, fontWeight: 600, color: C.slate,
        display: 'block', marginBottom: 6, fontFamily: FONT,
        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
  if (!error && !success) return null
  const isError = !!error
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8,
      background: isError ? C.redL : C.greenL,
      border: `1px solid ${isError ? '#FECACA' : '#A7F3D0'}`,
      fontSize: 12.5, fontWeight: 500,
      color: isError ? C.red : C.green, fontFamily: FONT,
      display: 'flex', alignItems: 'center', gap: 7 }}>
      {isError ? (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M6.5 4v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <circle cx="6.5" cy="9" r=".6" fill="currentColor"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 6.5l2 2 3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {error ?? success}
    </div>
  )
}

function ModalFooter({ onConfirm, onCancel, loading, disabled, confirmLabel }: {
  onConfirm:    () => void
  onCancel:     () => void
  loading:      boolean
  disabled?:    boolean
  confirmLabel: string
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <button
        className="btn-meram"
        onClick={onConfirm} disabled={loading || disabled}
        style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 9,
          fontSize: 13, fontWeight: 700,
          cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
          fontFamily: FONT, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 7,
          opacity: (loading || disabled) ? 0.7 : 1 }}>
        {loading ? <><span className="spinner" />{confirmLabel}…</> : confirmLabel}
      </button>
      <button
        className="btn-ghost"
        onClick={onCancel}
        style={{ padding: '11px 18px', background: C.surface, color: C.slate,
          border: `1.5px solid ${C.border}`, borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
        Annuler
      </button>
    </div>
  )
}
