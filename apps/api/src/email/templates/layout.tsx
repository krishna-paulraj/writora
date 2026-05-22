import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

interface LayoutProps {
  preview: string;
  children: ReactNode;
  footer?: ReactNode;
}

const main = {
  backgroundColor: '#fafaf9',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  padding: '24px 0',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e7e5e4',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '560px',
  padding: '40px',
};

const brand = {
  color: '#0a0a0a',
  fontSize: '18px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  margin: '0 0 32px',
};

const footer = {
  color: '#a8a29e',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '24px 0 0',
};

const hr = {
  borderColor: '#e7e5e4',
  margin: '32px 0',
};

export function Layout({ preview, children, footer: footerNode }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>writora</Text>
          {children}
          <Hr style={hr} />
          <Section>
            {footerNode ?? (
              <Text style={footer}>
                You&apos;re receiving this because of your account on Writora.
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
