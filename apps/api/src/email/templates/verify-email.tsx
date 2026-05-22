import { Button, Section, Text } from '@react-email/components';
import { Layout } from './layout';

interface Props {
  name: string;
  verifyUrl: string;
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

export function VerifyEmail({ name, verifyUrl }: Props) {
  return (
    <Layout preview="Verify your email to finish setting up your blog">
      <Text style={heading}>Welcome, {name}</Text>
      <Text style={paragraph}>
        Confirm your email to finish setting up your Writora blog.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Button href={verifyUrl} style={button}>
          Verify email
        </Button>
      </Section>
      <Text style={paragraph}>
        This link expires in 24 hours. If you didn&apos;t sign up for Writora,
        you can ignore this email.
      </Text>
      <Text style={linkFallback}>{verifyUrl}</Text>
    </Layout>
  );
}
