import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async create(authorId: string, dto: CreateBlogDto) {
    const existing = await this.prisma.blog.findUnique({
      where: { authorId_slug: { authorId, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException('A blog with this slug already exists');
    }

    return this.prisma.blog.create({
      data: {
        ...dto,
        authorId,
      },
    });
  }

  async findAllByAuthor(authorId: string) {
    return this.prisma.blog.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, authorId: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    if (blog.authorId !== authorId) {
      throw new ForbiddenException();
    }
    return blog;
  }

  async update(id: string, authorId: string, dto: UpdateBlogDto) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    if (blog.authorId !== authorId) {
      throw new ForbiddenException();
    }

    if (dto.slug && dto.slug !== blog.slug) {
      const slugExists = await this.prisma.blog.findUnique({
        where: { authorId_slug: { authorId, slug: dto.slug } },
      });
      if (slugExists) {
        throw new ConflictException('A blog with this slug already exists');
      }
    }

    return this.prisma.blog.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, authorId: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    if (blog.authorId !== authorId) {
      throw new ForbiddenException();
    }
    return this.prisma.blog.delete({ where: { id } });
  }

  // Public endpoints
  async findPublicByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const blogs = await this.prisma.blog.findMany({
      where: { authorId: user.id, published: true },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, username: true } },
      },
    });

    return { user: { id: user.id, name: user.name, username: user.username, blogTheme: user.blogTheme }, blogs };
  }

  async findPublicByUsernameAndSlug(username: string, slug: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const blog = await this.prisma.blog.findUnique({
      where: { authorId_slug: { authorId: user.id, slug } },
      include: {
        author: { select: { id: true, name: true, username: true } },
      },
    });
    if (!blog || !blog.published) {
      throw new NotFoundException('Blog not found');
    }

    // Get adjacent posts for navigation
    const allBlogs = await this.prisma.blog.findMany({
      where: { authorId: user.id, published: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, slug: true, title: true },
    });

    const currentIndex = allBlogs.findIndex((b) => b.id === blog.id);
    const previousPost = currentIndex > 0 ? allBlogs[currentIndex - 1] : null;
    const nextPost =
      currentIndex < allBlogs.length - 1 ? allBlogs[currentIndex + 1] : null;

    // Get related posts (same category first, then others)
    const relatedBlogs = await this.prisma.blog.findMany({
      where: {
        authorId: user.id,
        published: true,
        id: { not: blog.id },
      },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
      take: 3,
      include: {
        author: { select: { id: true, name: true, username: true } },
      },
    });

    // Sort related: same category first
    const sameCat = relatedBlogs.filter((b) => b.category === blog.category);
    const otherCat = relatedBlogs.filter((b) => b.category !== blog.category);
    const related = [...sameCat, ...otherCat].slice(0, 3);

    return {
      blog,
      blogTheme: user.blogTheme,
      previousPost,
      nextPost,
      relatedPosts: related,
    };
  }
}
