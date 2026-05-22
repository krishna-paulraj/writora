import { Button, Hr, Img, Section, Text } from '@react-email/components';
import { Layout } from './layout';

interface Props {
  authorName: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  postUrl: string;
  unsubscribeUrl: string;
}

const heading = {
  color: '#0a0a0a',
  fontSize: '24px',
  fontWeight: 700,
  lineHeight: '32px',
  margin: '0 0 12px',
};

const eyebrow = {
  color: '#737373',
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '1.5px',
  margin: '0 0 16px',
  textTransform: 'uppercase' as const,
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

const cover = {
  borderRadius: '8px',
  margin: '0 0 24px',
  width: '100%',
};

const footerNote = {
  color: '#a8a29e',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0',
};

const footerLink = {
  color: '#737373',
  textDecoration: 'underline',
};

export function NewPost({
  authorName,
  title,
  description,
  imageUrl,
  postUrl,
  unsubscribeUrl,
}: Props) {
  return (
    <Layout
      preview={description || title}
      footer={
        <Text style={footerNote}>
          You&apos;re subscribed to {authorName} on Writora.{' '}
          <a href={unsubscribeUrl} style={footerLink}>
            Unsubscribe
          </a>
          .
        </Text>
      }
    >
      <Text style={eyebrow}>New post from {authorName}</Text>
      {imageUrl ? <Img src={imageUrl} alt={title} style={cover} /> : null}
      <Text style={heading}>{title}</Text>
      {description ? <Text style={paragraph}>{description}</Text> : null}
      <Section style={{ margin: '24px 0' }}>
        <Button href={postUrl} style={button}>
          Read post
        </Button>
      </Section>
      <Hr style={{ borderColor: '#e7e5e4', margin: '24px 0' }} />
      <Text style={footerNote}>
        Or open the link directly:{' '}
        <a href={postUrl} style={footerLink}>
          {postUrl}
        </a>
      </Text>
    </Layout>
  );
}
