import React, { type ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {
  HtmlClassNameProvider,
  PageMetadata,
  ThemeClassNames,
  listTagsByLetters,
  translateTagsPageTitle,
} from '@docusaurus/theme-common';
import type { PropTagsListPage } from '@docusaurus/plugin-content-docs';

const description =
  'Browse Expanso examples by technology, industry, and edge-processing pattern.';

export default function DocTagsListPage({ tags }: PropTagsListPage): ReactNode {
  const title = translateTagsPageTitle();
  return (
    <>
      <PageMetadata title={title} description={description} />
      <HtmlClassNameProvider
        className={clsx(ThemeClassNames.page.docsTagsListPage)}
      >
        <div className="container margin-vert--lg">
          <div className="row">
            <main className="col col--8 col--offset-2">
              <h1>{title}</h1>
              <p>{description}</p>
              <section className="margin-vert--lg">
                {listTagsByLetters(tags).map((entry) => (
                  <article key={entry.letter}>
                    <h2 id={entry.letter}>{entry.letter}</h2>
                    <ul className="padding--none">
                      {entry.tags.map((tag) => (
                        <li
                          key={tag.permalink}
                          className="margin-vert--sm margin-left--md"
                        >
                          <Link to={tag.permalink}>
                            {tag.label} ({tag.count})
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <hr />
                  </article>
                ))}
              </section>
            </main>
          </div>
        </div>
      </HtmlClassNameProvider>
    </>
  );
}
