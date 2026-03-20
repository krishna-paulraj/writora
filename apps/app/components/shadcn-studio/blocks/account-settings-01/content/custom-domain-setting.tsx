'use client'

import { useEffect, useState } from 'react'
import { CheckIcon, GlobeIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const CustomDomainSetting = () => {
  const [domain, setDomain] = useState('')
  const [original, setOriginal] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setDomain(data.customDomain || '')
        setOriginal(data.customDomain || '')
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setError('')
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ customDomain: domain || null }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message || 'Failed to update')
        return
      }

      setOriginal(domain)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='grid grid-cols-1 gap-10 lg:grid-cols-3'>
      <div className='flex flex-col space-y-1'>
        <h3 className='font-semibold'>Custom Domain</h3>
        <p className='text-muted-foreground text-sm'>
          Point your own domain to your Writora blog.
        </p>
      </div>

      <div className='space-y-6 lg:col-span-2'>
        <div className='space-y-4'>
          <div className='flex flex-col items-start gap-2'>
            <Label htmlFor='custom-domain'>Domain</Label>
            <div className='relative w-full'>
              <GlobeIcon className='text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2' />
              <Input
                id='custom-domain'
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value)
                  setError('')
                  setSaved(false)
                }}
                placeholder='blog.yourdomain.com'
                className='pl-9'
              />
            </div>
            {error && <p className='text-destructive text-sm'>{error}</p>}
            <p className='text-muted-foreground text-xs'>
              Add a CNAME record pointing to <code className='bg-muted rounded px-1 py-0.5'>cname.writora.com</code> in your DNS settings.
            </p>
          </div>
        </div>

        <div className='flex justify-end'>
          <Button
            onClick={handleSave}
            disabled={saving || domain === original}
            className='max-sm:w-full'
          >
            {saving ? (
              <>
                <Loader2Icon className='mr-2 size-4 animate-spin' />
                Saving...
              </>
            ) : saved ? (
              <>
                <CheckIcon className='mr-2 size-4' />
                Saved
              </>
            ) : (
              'Save Domain'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CustomDomainSetting
