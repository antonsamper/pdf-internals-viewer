import type { MouseEvent } from 'react';

import { useEffect, useState } from 'react';

import type { SitePath } from './site-content';

import { SITE_PAGES, SITE_URL, sitePage, structuredData } from './site-content';
const set = (selector: string, attributes: Record<string, string>) => {
  const element =
    document.head.querySelector(selector) ??
    document.head.appendChild(document.createElement(selector.startsWith('link') ? 'link' : 'meta'));
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
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
  })) {
    set(`meta[property="${name}"]`, { content, property: name });
  }
  for (const [name, content] of Object.entries({
    'twitter:description': page.description,
    'twitter:title': page.title,
  })) {
    set(`meta[name="${name}"]`, { content, name });
  }
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
/** A primary click with no modifier keys that nothing else has handled. */
const isPlainClick = (event: MouseEvent<HTMLElement>) => {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
};
/** The public page a clicked link opens in place, or undefined when the browser should follow the link itself. */
const inPlaceTarget = (event: MouseEvent<HTMLElement>) => {
  const anchor = event.target instanceof Element ? event.target.closest('a') : null;
  if (!anchor || anchor.hasAttribute('download') || anchor.target === '_blank') {
    return undefined;
  }
  const url = new URL(anchor.href);
  // Sample links intentionally load a fresh workspace, and external links stay native.
  if (url.origin !== window.location.origin || url.search || url.hash) {
    return undefined;
  }
  const next = sitePage(url.pathname);
  return next && { next, url };
};
// Keep the PDF workspace mounted while visiting public content.
export const useSiteRoute = (initialPath: SitePath = '/') => {
  const goHome = () => {
    if (path === '/') {
      return;
    }
    window.history.pushState(null, '', '/');
    setPath('/');
  };
  const followLink = (event: MouseEvent<HTMLElement>) => {
    const target = isPlainClick(event) ? inPlaceTarget(event) : undefined;
    if (!target) {
      return false;
    }
    event.preventDefault();
    if (target.url.pathname !== window.location.pathname) {
      window.history.pushState(null, '', target.url);
    }
    setPath(target.next.path);
    return true;
  };
  const [path, setPath] = useState<SitePath>(initialPath);
  useEffect(() => {
    const onPopState = () => {
      return setPath(sitePage(window.location.pathname)?.path ?? '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      return window.removeEventListener('popstate', onPopState);
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- popstate listener subscribes once; setPath is a stable state setter.
  }, []);
  useEffect(() => {
    updateMetadata(path);
    const focusTarget =
      document.querySelector<HTMLElement>(path !== '/' ? '[data-reading-page]' : '[data-welcome]') ??
      document.querySelector<HTMLElement>('[data-app-identity]');
    focusTarget?.focus();
  }, [path]);
  return { about: path === '/about', followLink, goHome, path };
};
