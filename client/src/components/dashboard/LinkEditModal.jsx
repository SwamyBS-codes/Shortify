import { useState } from 'react'
import { useLinkWorkspace } from '../../context/LinkWorkspaceContext'
import { toDateInputValue, formatTagsForInput } from '../../utils/linkUtils'
import ExpirationFields from '../ui/ExpirationFields'
import PasswordProtectField from '../ui/PasswordProtectField'

function LinkEditModal() {
  const { editModalLink, closeEditModal, saveEditedLink, isSaving } = useLinkWorkspace()
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState(() => {
    if (!editModalLink) return null
    const type =
      editModalLink.expirationType === 'custom' || editModalLink.expirationType === 'date'
        ? 'custom_range'
        : editModalLink.expirationType || 'none'
    const isRange = type === 'custom_range'
    return {
      url: editModalLink.longUrl,
      customAlias: editModalLink.customAlias || editModalLink.code,
      protectWithPassword: editModalLink.passwordProtected,
      password: '',
      expirationType: type,
      expirationStartDate:
        isRange && editModalLink.startsAtIso ? toDateInputValue(editModalLink.startsAtIso) : '',
      expirationEndDate:
        isRange && editModalLink.expiresAtIso ? toDateInputValue(editModalLink.expiresAtIso) : '',
      folder: editModalLink.folder || '',
      tagsInput: formatTagsForInput(editModalLink.tags),
      isActive: editModalLink.isActive,
    }
  })

  if (!editModalLink || !form) return null

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await saveEditedLink(editModalLink.code, form)
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <span className="modal-tag">Edit link</span>
        <h2>{editModalLink.code}</h2>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            Destination URL
            <input type="url" value={form.url} onChange={(e) => updateField('url', e.target.value)} required />
          </label>

          <label>
            Custom alias
            <input type="text" value={form.customAlias} onChange={(e) => updateField('customAlias', e.target.value)} />
          </label>

          <label>
            Folder
            <input type="text" value={form.folder} onChange={(e) => updateField('folder', e.target.value)} placeholder="Optional" />
          </label>

          <label>
            Tags
            <input
              type="text"
              value={form.tagsInput}
              onChange={(e) => updateField('tagsInput', e.target.value)}
              placeholder="comma-separated"
            />
          </label>

          <PasswordProtectField
            protectWithPassword={form.protectWithPassword}
            onProtectChange={(v) => updateField('protectWithPassword', v)}
            password={form.password}
            onPasswordChange={(v) => updateField('password', v)}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword((v) => !v)}
            showOnboarding={false}
            passwordLabel="New password"
            newPasswordHint="Leave blank to keep current password"
          />

          <label>
            Expiration
            <select value={form.expirationType} onChange={(e) => updateField('expirationType', e.target.value)}>
              <option value="none">Never</option>
              <option value="1h">1 hour</option>
              <option value="6h">6 hours</option>
              <option value="12h">12 hours</option>
              <option value="1d">1 day</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="custom_range">Custom date range</option>
            </select>
          </label>

          <ExpirationFields
            expirationType={form.expirationType}
            startDate={form.expirationStartDate}
            endDate={form.expirationEndDate}
            onStartDateChange={(v) => updateField('expirationStartDate', v)}
            onEndDateChange={(v) => updateField('expirationEndDate', v)}
            showOnboarding={false}
          />

          <label className="checkbox-row">
            <input type="checkbox" checked={form.isActive} onChange={(e) => updateField('isActive', e.target.checked)} />
            Link is active
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LinkEditModal
