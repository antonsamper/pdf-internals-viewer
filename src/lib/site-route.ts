import { useEffect, useState, type MouseEvent } from 'react';

import { SITE_PAGES, SITE_URL, sitePage, structuredData, type SitePath } from './site-content';
const set = (selector: string, attributes: Record<string, string>) => {
  const element =
    document.head.querySelector(selector) ??
    document.head.appendChild(document.createElement(selector.startsWith('link') ? 'link' : 'meta'));
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
};
const updateMetadata = (path: SitePath) => {
  const page = sitePage(path) ?? SITE_PAGES[0];
  document.title = page.title;
  set('meta[name="description"]', {
    content: page.description,
    name: 'description',
  });
  set('link[rel="canonical"]', { href: SITE_URL + path, rel: 'canonical' });
  for (const [name, content] of Object.entries({
    'og:description': page.description,
    'og:title': page.title,
    'og:type': path.startsWith('/guides/') ? 'article' : 'website',
    'og:url': SITE_URL + path,
  }))
    set(`meta[property="${name}"]`, { content, property: name });
  for (const [name, content] of Object.entries({
    'twitter:description': page.description,
    'twitter:title': page.title,
  }))
    set(`meta[name="${name}"]`, { content, name });
  const schema =
    document.getElementById('site-schema') ??
    document.head.appendChild(
      Object.assign(document.createElement('script'), {
        id: 'site-schema',
        type: 'application/ld+json',
      })
    );
  schema.textContent = JSON.stringify(structuredData(page));
};
// Keep the PDF workspace mounted while visiting public content.
export const useSiteRoute = (initialPath: SitePath = '/') => {
  const goHome = () => {
    if (path === '/') return;
    window.history.pushState(null, '', '/');
    setPath('/');
  };
  const followLink = (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    const anchor = event.target instanceof Element ? event.target.closest('a') : null;
    if (!anchor || anchor.hasAttribute('download') || anchor.target === '_blank') return false;
    const url = new URL(anchor.href);
    const next = sitePage(url.pathname);
    // Sample links intentionally load a fresh workspace, and external links stay native.
    if (url.origin !== window.location.origin || !next || url.search || url.hash) return false;
    event.preventDefault();
    if (url.pathname !== window.location.pathname) window.history.pushState(null, '', url);
    setPath(next.path);
    return true;
  };
  const [path, setPath] = useState<SitePath>(initialPath);
  useEffect(() => {
    const onPopState = () => setPath(sitePage(window.location.pathname)?.path ?? '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- popstate listener subscribes once; setPath is a stable state setter.
  }, []);
  useEffect(() => {
    updateMetadata(path);
    const focusTarget =
      document.querySelector<HTMLElement>(path !== '/' ? '.about-page' : '.empty-workspace') ??
      document.querySelector<HTMLElement>('.app-identity');
    focusTarget?.focus();
  }, [path]);
  return { about: path === '/about', followLink, goHome, path };
};
