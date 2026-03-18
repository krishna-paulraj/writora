'use client'

import { useEffect, useState } from 'react'
import { CheckIcon, CopyIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const WWW_URL = process.env.NEXT_PUBLIC_WWW_URL || 'http://localhost:3000'

const UsernameSetting = () => {
  const [username, setUsername] = useState('')
  const [original, setOriginal] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setUsername(data.username || '')
        setOriginal(data.username || '')
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Username is required')
      return
    }

    if (!/^[a-z0-9_-]+$/.test(username)) {
      setError('Only lowercase letters, numbers, hyphens and underscores')
      return
    }

    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message || 'Failed to update username')
        return
      }

      setOriginal(username)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to update username')
    } finally {
      setSaving(false)
    }
  }

  const blogUrl = `${WWW_URL}/${original}`

  const copyUrl = () => {
    navigator.clipboard.writeText(blogUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className='grid grid-cols-1 gap-10 lg:grid-cols-3'>
      <div className='flex flex-col space-y-1'>
        <h3 className='font-semibold'>Username</h3>
        <p className='text-muted-foreground text-sm'>
          Your unique username is used for your public blog URL.
        </p>
      </div>

      <div className='space-y-6 lg:col-span-2'>
        <div className='space-y-4'>
          <div className='flex flex-col items-start gap-2'>
            <Label htmlFor='username'>Username</Label>
            <Input
              id='username'
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase())
                setError('')
                setSaved(false)
              }}
              placeholder='johndoe'
            />
            {error && <p className='text-destructive text-sm'>{error}</p>}
          </div>

          {original && (
            <div className='flex flex-col items-start gap-2'>
              <Label>Your Blog URL</Label>
              <div className='flex items-center gap-2'>
                <code className='bg-muted text-muted-foreground rounded px-3 py-1.5 text-sm'>
                  {blogUrl}
                </code>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={copyUrl}
                  className='shrink-0'
                >
                  {copied ? (
                    <CheckIcon className='size-4 text-green-500' />
                  ) : (
                    <CopyIcon className='size-4' />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className='flex justify-end'>
          <Button
            onClick={handleSave}
            disabled={saving || username === original}
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
              'Save Username'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default UsernameSetting
