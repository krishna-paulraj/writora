import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { BlogEmbeddingService } from './blog-embedding.service';

// Global: blog, ai, scheduler, and (later) network modules all consume
// embeddings/similarity.
@Global()
@Module({
  providers: [EmbeddingService, BlogEmbeddingService],
  exports: [EmbeddingService, BlogEmbeddingService],
})
export class EmbeddingModule {}
