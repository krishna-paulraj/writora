-- Backlink-network niche gate: the membership's declared niche text is embedded
-- (same model/dimensions as BlogEmbedding) so matching can require candidate
-- articles to semantically fit a member site's topic. NULL — no niche set, or
-- embeddings unconfigured — means no gate for that site.
ALTER TABLE "NetworkMembership" ADD COLUMN IF NOT EXISTS "nicheEmbedding" vector(1536);
