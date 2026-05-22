import { Button, Section, Text } from '@react-email/components';
import { Layout } from './layout';

interface Props {
  authorName: string;
  confirmUrl: string;
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

export function SubscribeConfirm({ authorName, confirmUrl }: Props) {
  return (
    <Layout preview={`Confirm your subscription to ${authorName}`}>
      <Text style={heading}>One more step</Text>
      <Text style={paragraph}>
        Confirm you&apos;d like to receive new posts from{' '}
        <strong>{authorName}</strong> in your inbox.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Button href={confirmUrl} style={button}>
          Confirm subscription
        </Button>
      </Section>
      <Text style={paragraph}>
        If this wasn&apos;t you, ignore this email and nothing will happen.
      </Text>
      <Text style={linkFallback}>{confirmUrl}</Text>
    </Layout>
  );
}
