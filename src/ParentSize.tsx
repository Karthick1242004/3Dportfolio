// Modified version of
// https://github.com/airbnb/visx/blob/master/packages/visx-responsive/src/components/ParentSize.tsx
import debounce from 'lodash.debounce';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { mergeRefs } from 'react-merge-refs';

interface ResizeObserverPolyfill {
  new (callback: ResizeObserverCallback): ResizeObserver;
}

interface PrivateWindow {
  ResizeObserver: ResizeObserverPolyfill;
}

export type ParentSizeProps = {
  className?: string;
  debounceTime?: number;
  enableDebounceLeadingCall?: boolean;
  ignoreDimensions?: keyof ParentSizeState | (keyof ParentSizeState)[];
  parentSizeStyles?: React.CSSProperties;
  resizeObserverPolyfill?: ResizeObserverPolyfill;
  children: (
    args: {
      ref: HTMLDivElement | null;
      resize: (state: ParentSizeState) => void;
    } & ParentSizeState
  ) => React.ReactNode;
};

type ParentSizeState = {
  width: number;
  height: number;
  top: number;
  left: number;
};

export type ParentSizeProvidedProps = ParentSizeState;

const defaultIgnoreDimensions: ParentSizeProps['ignoreDimensions'] = [];
const defaultParentSizeStyles = { width: '100%', height: '100%' };

export default forwardRef<HTMLDivElement, ParentSizeProps>(function ParentSize(
  {
    className,
    children,
    debounceTime = 300,
    ignoreDimensions = defaultIgnoreDimensions,
    parentSizeStyles,
    enableDebounceLeadingCall = true,
    resizeObserverPolyfill,
    ...restProps
  }: ParentSizeProps &
    Omit<React.HTMLAttributes<HTMLDivElement>, keyof ParentSizeProps>,
  ref
) {
  const target = useRef<HTMLDivElement | null>(null);
  const animationFrameID = useRef(0);

  const [state, setState] = useState<ParentSizeState>({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
  });

  const resize = useMemo(() => {
    const normalized = Array.isArray(ignoreDimensions)
      ? ignoreDimensions
      : [ignoreDimensions];

    return debounce(
      (incoming: ParentSizeState) => {
        setState((existing) => {
          const stateKeys = Object.keys(existing) as (keyof ParentSizeState)[];
          const keysWithChanges = stateKeys.filter(
            (key) => existing[key] !== incoming[key]
          );
          const shouldBail = keysWithChanges.every((key) =>
            normalized.includes(key)
          );

          return shouldBail ? existing : incoming;
        });
      },
      debounceTime,
      { leading: enableDebounceLeadingCall }
    );
  }, [debounceTime, enableDebounceLeadingCall, ignoreDimensions]);

  useEffect(() => {
    const LocalResizeObserver =
      resizeObserverPolyfill ||
      (window as unknown as PrivateWindow).ResizeObserver;

    const observer = new LocalResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { left, top, width, height } = entry?.contentRect ?? {};
        animationFrameID.current = window.requestAnimationFrame(() => {
          resize({ width, height, top, left });
        });
      });
    });
    if (target.current) observer.observe(target.current);

    return () => {
      window.cancelAnimationFrame(animationFrameID.current);
      observer.disconnect();
      resize.cancel();
    };
  }, [resize, resizeObserverPolyfill]);

  return (
    <div
      style={{ ...defaultParentSizeStyles, ...parentSizeStyles }}
      ref={mergeRefs<HTMLDivElement>([ref, target])}
      className={className}
      {...restProps}
    >
      {children({
        ...state,
        ref: target.current,
        resize,
      })}
    </div>
  );
});
