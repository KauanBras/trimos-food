"use client";

import type { ComponentProps } from "react";

const DEMO_PATH = "/r/hirotatsu-sushi-demo";

type PublicDemoLinkProps = Omit<ComponentProps<"a">, "href">;

export function PublicDemoLink({ onClick, ...props }: PublicDemoLinkProps) {
  return (
    <a
      {...props}
      href={DEMO_PATH}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;

        event.preventDefault();
        // A full navigation is intentional: it remains reliable in mobile Safari.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(DEMO_PATH);
      }}
    />
  );
}
