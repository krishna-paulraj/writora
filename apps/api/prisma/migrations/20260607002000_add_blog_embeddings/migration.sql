-- Semantic embeddings for blogs (powers related-posts + the backlink network).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "BlogEmbedding" (
    "blogId" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "model" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogEmbedding_pkey" PRIMARY KEY ("blogId")
);

ALTER TABLE "BlogEmbedding"
  ADD CONSTRAINT "BlogEmbedding_blogId_fkey"
  FOREIGN KEY ("blogId") REFERENCES "Blog"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Approximate-NN index for cosine distance (<=>). Lists tuned for a small/medium
-- corpus; can be rebuilt with more lists as the table grows.
CREATE INDEX "BlogEmbedding_embedding_idx"
  ON "BlogEmbedding"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
