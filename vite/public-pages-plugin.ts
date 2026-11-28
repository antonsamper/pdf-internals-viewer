import type { ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

import { sitePage, pageHead } from '../src/lib/site-content.ts';
/** Serve the same static article components during development as in production. */
export const publicPages = (): Plugin => {
  return {
    configureServer(server) {
      const render = async (url: string | undefined, response: ServerResponse, next: (error?: unknown) => void) => {
        const pathname = new URL(url ?? '/', 'http://localhost').pathname;
        const page = sitePage(pathname);

        if (!page || page.path === '/' || page.path === '/about') {
          return next();
        }

        try {
          const { renderPage } = await server.ssrLoadModule('/src/prerender.ts');
          const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><script src="/theme.js"></script><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body><div id="root">${renderPage(page)}</div></body></html>`;

          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(await server.transformIndexHtml(page.path, html));
        } catch (error) {
          next(error);
        }
      };

      server.middlewares.use((request, response, next) => {
        render(request.url, response, next).catch(next);
      });
    },
    name: 'public-pages',
    transformIndexHtml: {
      handler(html, context) {
        const page = sitePage(context.path === '/index.html' ? '/' : context.path);

        if (!page) {
          return html;
        }

        return html
          .replace(/<title>[\s\S]*?<\/title>/, '')
          .replace(/<meta name="description"[^>]*>/, '')
          .replace('</head>', `${pageHead(page)}\n</head>`);
      },
      order: 'pre',
    },
  };
};
