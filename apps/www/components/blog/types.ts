export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  imageUrl: string | null;
  category: string;
  readTime: number;
  featured: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    username: string;
  };
}

export interface BlogUser {
  id: string;
  name: string;
  username: string;
  blogTheme?: string;
}
