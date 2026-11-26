import { createElement, StrictMode } from 'react';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';

import type { SitePage } from './lib/site-content';

import App from './app';
import { StaticPublicPage } from './content/public-page';
import { SITE_PAGES, SITE_URL, pageHead } from './lib/site-content';
export const renderPage = (page: SitePage) => {
  return page.path === '/' || page.path === '/about'
    ? renderToString(createElement(StrictMode, null, createElement(App, { initialPath: page.path })))
    : renderToStaticMarkup(createElement(StaticPublicPage, { page }));
};
export { SITE_PAGES, SITE_URL, pageHead };
