import { Separator } from '@/components/ui/separator'

import PersonalInfo from '@/components/shadcn-studio/blocks/account-settings-01/content/personal-info'
import EmailPass from '@/components/shadcn-studio/blocks/account-settings-01/content/email-password'
import ConnectAccount from '@/components/shadcn-studio/blocks/account-settings-01/content/connect-account'
import SocialUrl from '@/components/shadcn-studio/blocks/account-settings-01/content/social-url'
import DangerZone from '@/components/shadcn-studio/blocks/account-settings-01/content/danger-zone'

const UserGeneral = () => {
  return (
    <section className='py-3'>
      <div className='mx-auto max-w-7xl'>
        <PersonalInfo />
        <Separator className='my-10' />
        <EmailPass />
        <Separator className='my-10' />
        <ConnectAccount />
        <Separator className='my-10' />
        <SocialUrl />
        <Separator className='my-10' />
        <DangerZone />
      </div>
    </section>
  )
}

export default UserGeneral
