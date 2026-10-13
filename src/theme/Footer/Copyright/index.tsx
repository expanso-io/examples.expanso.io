// examples' tsconfig loads no theme types; this one declares @theme/Footer/Copyright.
/// <reference types="@docusaurus/theme-classic" />
import React from 'react';
import Copyright from '@theme-original/Footer/Copyright';
import type CopyrightType from '@theme/Footer/Copyright';
import type { WrapperProps } from '@docusaurus/types';

import ManageCookies from '@site/src/components/cookies/ManageCookies';

type Props = WrapperProps<typeof CopyrightType>;

/** Adds the "Cookie settings" control next to the copyright, matching marketing and cloud. */
export default function CopyrightWrapper(props: Props): React.JSX.Element {
  return (
    <>
      <Copyright {...props} />
      <ManageCookies />
    </>
  );
}
