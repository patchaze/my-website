import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
        modDate: z.coerce.date().optional(),
        author: z.string().default('Patricia Azevedo'),
        tags: z.array(z.string()).default([]),
        ogImage: z.string().optional(),
        readTime: z.number().default(5),
        draft: z.boolean().default(false),
    }),
});

export const collections = {
    blog: blogCollection,
};
