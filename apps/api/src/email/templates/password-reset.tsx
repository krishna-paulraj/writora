import { Button, Section, Text } from '@react-email/components';
import { Layout } from './layout';

interface Props {
  name: string;
  resetUrl: string;
}

const heading = {
  color: '#0a0a0a',
  fontSize: '22px',
  fontWeight: 600,
  margin: '0 0 12px',
};

const paragraph = {
  color: '#404040',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const button = {
  backgroundColor: '#0a0a0a',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 500,
  padding: '12px 24px',
  textDecoration: 'none',
};

const linkFallback = {
  color: '#737373',
  fontSize: '13px',
  margin: '16px 0 0',
  wordBreak: 'break-all' as const,
};

export function PasswordReset({ name, resetUrl }: Props) {
  return (
    <Layout preview="Reset your Writora password">
      <Text style={heading}>Reset your password, {name}</Text>
      <Text style={paragraph}>
        Click below to choose a new password. The link expires in 1 hour.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Button href={resetUrl} style={button}>
          Reset password
        </Button>
      </Section>
      <Text style={paragraph}>
        If you didn&apos;t request this, you can safely ignore this email — your
        password won&apos;t change.
      </Text>
      <Text style={linkFallback}>{resetUrl}</Text>
    </Layout>
  );
}
